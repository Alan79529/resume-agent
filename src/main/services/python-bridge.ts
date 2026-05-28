// Python 子进程管理 - JSON-RPC over stdin/stdout
import { spawn, type ChildProcess } from 'child_process';
import { join } from 'path';
import { existsSync } from 'fs';
import { app } from 'electron';

let pythonProcess: ChildProcess | null = null;
let requestIdCounter = 0;
const pendingRequests = new Map<string, {
  resolve: (value: unknown) => void;
  reject: (reason: Error) => void;
  timer: ReturnType<typeof setTimeout>;
}>();

let stdoutBuffer = '';
let isStarting = false;
let isReady = false;

function getProjectRoot(): string {
  // app.getAppPath() 在开发模式返回项目根目录，打包后返回 resources 目录
  return app.getAppPath();
}

function getPythonPath(): string {
  const projectRoot = getProjectRoot();

  // 优先使用项目 venv 中的 Python
  if (process.platform === 'win32') {
    const venvPython = join(projectRoot, 'python', '.venv', 'Scripts', 'python.exe');
    if (existsSync(venvPython)) return venvPython;
  } else {
    const venvPython = join(projectRoot, 'python', '.venv', 'bin', 'python3');
    if (existsSync(venvPython)) return venvPython;
  }

  // fallback 到系统 Python
  if (process.platform === 'win32') {
    const candidates = [
      'C:\\Python\\python.exe',
      join(process.env.LOCALAPPDATA || '', 'Programs', 'Python', 'Python311', 'python.exe'),
      join(process.env.LOCALAPPDATA || '', 'Programs', 'Python', 'Python312', 'python.exe'),
      'C:\\Python311\\python.exe',
      'C:\\Python312\\python.exe',
    ];
    for (const candidate of candidates) {
      if (existsSync(candidate)) return candidate;
    }
    return 'python';
  }

  return 'python3';
}

function getServerScriptPath(): string {
  return join(getProjectRoot(), 'python', 'server.py');
}

function processStdoutData(data: Buffer): void {
  stdoutBuffer += data.toString('utf-8');
  const lines = stdoutBuffer.split('\n');
  stdoutBuffer = lines.pop() ?? '';

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    try {
      const response = JSON.parse(trimmed);
      const pending = pendingRequests.get(response.id);
      if (pending) {
        clearTimeout(pending.timer);
        pendingRequests.delete(response.id);

        if (response.error) {
          pending.reject(new Error(response.error.message || 'Python tool error'));
        } else {
          pending.resolve(response.result);
        }
      }
    } catch {
      // Non-JSON output from Python (e.g., debug prints to stdout)
      console.warn('[python-bridge] Non-JSON output:', trimmed);
    }
  }
}

export async function startPythonSidecar(): Promise<void> {
  if (pythonProcess || isStarting) return;
  isStarting = true;

  const pythonPath = getPythonPath();
  const serverPath = getServerScriptPath();

  console.log(`[python-bridge] Starting Python sidecar: ${pythonPath} ${serverPath}`);

  return new Promise((resolve, reject) => {
    try {
      // Windows 上用 cmd /c 包装，避免 Python 路径解析问题
      const isWin = process.platform === 'win32';
      const spawnCmd = isWin ? 'cmd.exe' : pythonPath;
      const spawnArgs = isWin ? ['/c', pythonPath, serverPath] : [serverPath];
      const pythonDir = join(getProjectRoot(), 'python');

      pythonProcess = spawn(spawnCmd, spawnArgs, {
        stdio: ['pipe', 'pipe', 'pipe'],
        cwd: pythonDir,
        shell: false,
      });

      pythonProcess.stdout?.on('data', processStdoutData);

      pythonProcess.stderr?.on('data', (data: Buffer) => {
        const msg = data.toString('utf-8').trim();
        if (msg) console.log(`[python] ${msg}`);
      });

      pythonProcess.on('error', (err) => {
        console.error('[python-bridge] Process error:', err);
        pythonProcess = null;
        isStarting = false;
        isReady = false;
        // Reject all pending requests
        for (const [id, pending] of pendingRequests) {
          clearTimeout(pending.timer);
          pending.reject(new Error(`Python process error: ${err.message}`));
          pendingRequests.delete(id);
        }
      });

      pythonProcess.on('exit', (code) => {
        console.log(`[python-bridge] Process exited with code ${code}`);
        pythonProcess = null;
        isStarting = false;
        isReady = false;
        // Reject all pending requests
        for (const [id, pending] of pendingRequests) {
          clearTimeout(pending.timer);
          pending.reject(new Error('Python process exited'));
          pendingRequests.delete(id);
        }
      });

      // 健康检查（用 raw 请求绕过 isReady 检查）
      setTimeout(async () => {
        try {
          await sendRawRequest('ping', {});
          isReady = true;
          isStarting = false;
          console.log('[python-bridge] Python sidecar ready');
          resolve();
        } catch (err) {
          isStarting = false;
          console.warn('[python-bridge] Ping failed, Python sidecar may not be available:', err);
          // 不 reject，允许在没有 Python 的情况下继续运行
          resolve();
        }
      }, 1000);
    } catch (err) {
      isStarting = false;
      console.warn('[python-bridge] Failed to start Python sidecar:', err);
      resolve(); // 不阻塞应用启动
    }
  });
}

export function stopPythonSidecar(): void {
  if (pythonProcess) {
    try {
      // 发送关闭信号
      const id = `shutdown-${++requestIdCounter}`;
      const msg = JSON.stringify({ id, method: 'shutdown', params: {} }) + '\n';
      pythonProcess.stdin?.write(msg);

      // 给 2 秒优雅关闭，然后强制杀死
      setTimeout(() => {
        if (pythonProcess) {
          pythonProcess.kill();
          pythonProcess = null;
        }
      }, 2000);
    } catch {
      pythonProcess?.kill();
      pythonProcess = null;
    }
  }
}

export function isPythonReady(): boolean {
  return isReady && pythonProcess !== null;
}

// 内部 raw 请求，不检查 isReady（用于健康检查）
function sendRawRequest(method: string, params: Record<string, unknown>, timeoutMs = 10000): Promise<unknown> {
  if (!pythonProcess) {
    return Promise.reject(new Error('Python process not running'));
  }

  const id = `req-${++requestIdCounter}`;

  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      pendingRequests.delete(id);
      reject(new Error(`Python raw request ${method} timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    pendingRequests.set(id, { resolve, reject, timer });

    const message = JSON.stringify({ id, method, params }) + '\n';
    pythonProcess!.stdin?.write(message, (err) => {
      if (err) {
        clearTimeout(timer);
        pendingRequests.delete(id);
        reject(new Error(`Failed to send to Python: ${err.message}`));
      }
    });
  });
}

export async function callPythonTool(method: string, params: Record<string, unknown>, timeoutMs = 30000): Promise<unknown> {
  if (!pythonProcess || !isReady) {
    throw new Error('Python sidecar is not running. Please install Python dependencies first.');
  }

  const id = `req-${++requestIdCounter}`;

  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      pendingRequests.delete(id);
      reject(new Error(`Python tool ${method} timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    pendingRequests.set(id, { resolve, reject, timer });

    const message = JSON.stringify({ id, method, params }) + '\n';
    pythonProcess!.stdin?.write(message, (err) => {
      if (err) {
        clearTimeout(timer);
        pendingRequests.delete(id);
        reject(new Error(`Failed to send to Python: ${err.message}`));
      }
    });
  });
}
