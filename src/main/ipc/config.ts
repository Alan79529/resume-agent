import { ipcMain } from 'electron';
import { configStore } from '../store';

export function setupConfigIPC(): void {
  ipcMain.handle('config:getApiKey', () => configStore.getApiKey());
  ipcMain.handle('config:setApiKey', (_, key: string) => {
    configStore.setApiKey(key);
    return true;
  });
}
