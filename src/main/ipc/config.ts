import { ipcMain } from 'electron';
import { configStore } from '../store';

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
}
