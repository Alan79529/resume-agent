import { ipcMain, dialog, BrowserWindow } from 'electron';
import { promises as fs } from 'node:fs';
import { basename } from 'node:path';
import { configStore, profileStore, cardStore, resourceStore } from '../store';
import type { AppDataBackup, BattleCard, ResourceFile, DataTransferResult } from '../../shared/types';

function getOwnerWindow(): BrowserWindow | undefined {
  return BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0];
}

function createBackupPayload(): AppDataBackup {
  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    battleCards: cardStore.getAll(),
    profile: profileStore.get(),
    resources: resourceStore.getAll()
  };
}

function isBattleCards(value: unknown): value is BattleCard[] {
  return Array.isArray(value);
}

function isResources(value: unknown): value is ResourceFile[] {
  return Array.isArray(value);
}

function parseBackupPayload(json: string): AppDataBackup {
  const parsed = JSON.parse(json) as Partial<AppDataBackup>;
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('备份文件格式无效');
  }

  if (!isBattleCards(parsed.battleCards)) {
    throw new Error('备份文件缺少 battleCards 数组');
  }

  if (!parsed.profile || typeof parsed.profile !== 'object') {
    throw new Error('备份文件缺少 profile 对象');
  }

  if (!isResources(parsed.resources)) {
    throw new Error('备份文件缺少 resources 数组');
  }

  return {
    version: 1,
    exportedAt: typeof parsed.exportedAt === 'string' ? parsed.exportedAt : new Date().toISOString(),
    battleCards: parsed.battleCards,
    profile: {
      resumeText: typeof parsed.profile.resumeText === 'string' ? parsed.profile.resumeText : '',
      selfIntroText: typeof parsed.profile.selfIntroText === 'string' ? parsed.profile.selfIntroText : ''
    },
    resources: parsed.resources
  };
}

export function setupConfigIPC(): void {
  ipcMain.handle('config:getApiKey', () => configStore.getApiKey());
  ipcMain.handle('config:setApiKey', (_, key: string) => {
    configStore.setApiKey(key);
    return true;
  });
  ipcMain.handle('config:getApiBaseUrl', () => configStore.getApiBaseUrl());
  ipcMain.handle('config:setApiBaseUrl', (_, url: string) => {
    configStore.setApiBaseUrl(url);
    return true;
  });
  ipcMain.handle('config:getModel', () => configStore.getModel());
  ipcMain.handle('config:setModel', (_, model: string) => {
    configStore.setModel(model);
    return true;
  });
  ipcMain.handle('config:getProfile', () => profileStore.get());
  ipcMain.handle('config:setProfile', (_, profile: { resumeText?: string; selfIntroText?: string }) => {
    return profileStore.set(profile);
  });

  ipcMain.handle('config:exportData', async (): Promise<DataTransferResult> => {
    const ownerWindow = getOwnerWindow();
    const now = new Date();
    const defaultName = `resume-agent-backup-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}.json`;

    const dialogResult = await dialog.showSaveDialog(ownerWindow, {
      title: '导出数据',
      defaultPath: defaultName,
      filters: [{ name: 'JSON', extensions: ['json'] }]
    });

    if (dialogResult.canceled || !dialogResult.filePath) {
      return { success: false, message: '已取消导出' };
    }

    const payload = createBackupPayload();
    await fs.writeFile(dialogResult.filePath, JSON.stringify(payload, null, 2), 'utf-8');

    return {
      success: true,
      message: '导出成功',
      filePath: dialogResult.filePath
    };
  });

  ipcMain.handle('config:importData', async (): Promise<DataTransferResult> => {
    const ownerWindow = getOwnerWindow();
    const dialogResult = await dialog.showOpenDialog(ownerWindow, {
      title: '导入数据',
      properties: ['openFile'],
      filters: [{ name: 'JSON', extensions: ['json'] }]
    });

    if (dialogResult.canceled || dialogResult.filePaths.length === 0) {
      return { success: false, message: '已取消导入' };
    }

    const filePath = dialogResult.filePaths[0];

    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const backup = parseBackupPayload(content);

      cardStore.replaceAll(backup.battleCards);
      resourceStore.replaceAll(backup.resources);
      profileStore.set(backup.profile);

      return {
        success: true,
        message: `导入成功：${basename(filePath)}`,
        filePath
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : '导入失败';
      return {
        success: false,
        message: `导入失败：${message}`,
        filePath
      };
    }
  });
}
