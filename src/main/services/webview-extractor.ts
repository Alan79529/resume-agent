// Webview 内容提取服务 - 从 IPC handler 中抽离，供 Agent 工具复用
import { webContents } from 'electron';
import { readFileSync } from 'node:fs';
import type { ExtractedContent } from '../../shared/types';

const BOSS_CITY_CODES: Record<string, string> = {
  '全国': '100010000',
  '北京': '101010100',
  '上海': '101020100',
  '深圳': '101280600',
  '广州': '101280100',
  '杭州': '101210100',
  '成都': '101270100',
  '南京': '101190100',
  '武汉': '101200100',
  '西安': '101110100',
  '厦门': '101230200',
  '长沙': '101250100',
  '苏州': '101190400',
  '天津': '101030100',
  '重庆': '101040100',
  '郑州': '101180100',
  '东莞': '101281600',
  '青岛': '101120200',
  '合肥': '101220100',
  '昆明': '101290100',
  '福州': '101230100',
  '济南': '101120100',
  '宁波': '101210400',
  '大连': '101070200',
  '珠海': '101280700',
};

let readabilityScript: string | null = null;

function loadReadabilityScript(): string {
  if (readabilityScript !== null) return readabilityScript;
  try {
    const readabilityPath = require.resolve('@mozilla/readability/Readability.js');
    readabilityScript = readFileSync(readabilityPath, 'utf-8');
  } catch {
    readabilityScript = '';
  }
  return readabilityScript;
}

export async function extractWebviewContent(webContentId: number): Promise<ExtractedContent> {
  const wc = webContents.fromId(webContentId);
  if (!wc) {
    throw new Error('Webview not found');
  }

  const script = loadReadabilityScript();

  // 复用现有 webview IPC 中的完整提取逻辑
  const { setupWebviewIPC } = await import('../ipc/webview');

  // 直接通过 webContents 执行提取
  // 由于提取逻辑较长，我们通过 IPC handler 间接调用
  const { ipcMain } = await import('electron');

  return new Promise((resolve, reject) => {
    // 临时注册一个一次性 handler 来复用提取逻辑
    const channel = `webview:extract:agent:${Date.now()}`;

    // 直接调用已有的 webview:extract 逻辑
    // 通过触发 IPC 来复用
    wc.executeJavaScript(`
      (async () => {
        ${script}

        const url = window.location.href;
        const title = document.title;

        const stripPrivateUse = (text) =>
          Array.from(String(text || ''))
            .filter((char) => {
              const code = char.codePointAt(0) || 0;
              const inBmpPrivate = code >= 0xe000 && code <= 0xf8ff;
              const inSupPrivateA = code >= 0xf0000 && code <= 0xffffd;
              const inSupPrivateB = code >= 0x100000 && code <= 0x10fffd;
              return !inBmpPrivate && !inSupPrivateA && !inSupPrivateB;
            })
            .join('');
        const cleanRawText = (value) =>
          stripPrivateUse(value)
            .replace(/\\uFFFD/g, '')
            .replace(/[\\u200B-\\u200D\\uFEFF]/g, '')
            .replace(/\\ufeff/g, '');
        const textOf = (node) =>
          node && typeof node.innerText === 'string' ? cleanRawText(node.innerText).trim() : '';

        let article = null;
        try {
          if (typeof Readability !== 'undefined') {
            article = new Readability(document.cloneNode(true)).parse();
          }
        } catch (e) {}

        let content = '';
        let extractedTitle = title;
        let source = 'fallback';
        let pageType = 'unknown';

        if (article && article.textContent) {
          content = article.textContent;
          source = 'readability';
        }

        if (!content) {
          content = document.body.innerText;
        }

        return {
          url,
          title: cleanRawText(extractedTitle) || title,
          content: cleanRawText(content).substring(0, 15000),
          pageType,
          timestamp: Date.now(),
          source
        };
      })()
    `).then(resolve).catch(reject);
  });
}

export async function searchBossInWebview(
  webContentId: number,
  keyword: string,
  city = '全国',
  page = 1
): Promise<{ jobs: Array<Record<string, string>>; source: string; url: string; error?: string }> {
  const wc = webContents.fromId(webContentId);
  if (!wc) {
    throw new Error('Webview not found');
  }

  const cityCode = BOSS_CITY_CODES[city] || BOSS_CITY_CODES['全国'];
  const url = `https://www.zhipin.com/web/geek/job?query=${encodeURIComponent(keyword)}&city=${cityCode}&page=${page}`;

  console.log('[webview-boss] navigating logged-in webview', JSON.stringify({ keyword, city, page, url }));
  await wc.loadURL(url);

  const result = await wc.executeJavaScript(`
    (async () => {
      const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
      const textOf = (node) => (node && typeof node.innerText === 'string' ? node.innerText.replace(/\\s+/g, ' ').trim() : '');
      const attr = (node, name) => (node && node.getAttribute ? node.getAttribute(name) || '' : '');
      const waitForAny = async (selectors, timeoutMs) => {
        const start = Date.now();
        while (Date.now() - start < timeoutMs) {
          for (const selector of selectors) {
            const found = document.querySelector(selector);
            if (found) return found;
          }
          await sleep(250);
        }
        return null;
      };

      await waitForAny([
        '.job-card-wrapper',
        '[class*="job-card"]',
        '.search-job-result',
        '.job-list-box',
        '.login-dialog',
        '.verify-slider',
        '[class*="security"]'
      ], 9000);

      const finalUrl = window.location.href;
      const bodyText = textOf(document.body);
      if (finalUrl.includes('/web/user') || /登录|注册|安全验证|验证/.test(bodyText.slice(0, 3000))) {
        return {
          jobs: [],
          source: 'zhipin-webview',
          url: finalUrl,
          error: 'Boss直聘当前页面仍要求登录或安全验证，请在右侧浏览器完成验证后重试。'
        };
      }

      const cards = Array.from(document.querySelectorAll(
        '.job-card-wrapper, [class*="job-card"], .search-job-result .job-list li, .job-list-box .job-card-wrapper'
      ));

      const pickText = (root, selectors) => {
        for (const selector of selectors) {
          const el = root.querySelector(selector);
          const value = textOf(el);
          if (value) return value;
        }
        return '';
      };

      const jobs = [];
      for (const card of cards.slice(0, 12)) {
        const title = pickText(card, ['.job-name', '[class*="job-name"]', '.job-title', '[class*="job-title"]']);
        const company = pickText(card, ['.company-name a', '[class*="company-name"]', '.info-company .name', '.company-name']);
        const salary = pickText(card, ['.salary', '[class*="salary"]', '.job-limit .red', '.salary-wrap']);
        const location = pickText(card, ['.job-area', '[class*="job-area"]', '.job-limit .info-desc', '.job-area-wrapper']);
        const tagNodes = Array.from(card.querySelectorAll('.tag-list span, .job-tags span, [class*="tag"] span'));
        const description = tagNodes.map(textOf).filter(Boolean).join(', ');
        const link = card.querySelector('a[href*="/job_detail"], a[href*="job_detail"]');
        const href = attr(link, 'href');
        const jobUrl = href ? (href.startsWith('/') ? 'https://www.zhipin.com' + href : href) : '';

        if (title || company) {
          jobs.push({ title, company, salary, location, url: jobUrl, description });
        }
      }

      return {
        jobs,
        source: 'zhipin-webview',
        url: finalUrl,
        error: jobs.length ? undefined : '当前已登录 Boss 页面未解析到职位卡，可能是页面结构变化或搜索结果为空。'
      };
    })()
  `);

  console.log('[webview-boss] parsed jobs', JSON.stringify({ count: result?.jobs?.length ?? 0, error: result?.error }));
  return result;
}
