import { app, dialog, type BrowserWindow } from 'electron';
import { autoUpdater } from 'electron-updater';

function log(message: string, extra?: unknown): void {
  if (extra === undefined) {
    console.log(`[updater] ${message}`);
    return;
  }
  console.log(`[updater] ${message}`, extra);
}

export function setupAutoUpdater(mainWindow: BrowserWindow): void {
  if (!app.isPackaged) {
    log('Skip auto update in development mode.');
    return;
  }

  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on('checking-for-update', () => log('Checking for updates...'));
  autoUpdater.on('update-available', (info) => log('Update available.', info.version));
  autoUpdater.on('update-not-available', () => log('No updates found.'));
  autoUpdater.on('download-progress', (progress) => {
    const percent = progress.percent.toFixed(1);
    log(`Download progress: ${percent}%`);
  });
  autoUpdater.on('error', (error) => log('Auto update failed.', error));
  autoUpdater.on('update-downloaded', async () => {
    const result = await dialog.showMessageBox(mainWindow, {
      type: 'info',
      title: '发现新版本',
      message: '更新已下载完成，是否现在重启并安装？',
      buttons: ['立即重启', '稍后'],
      defaultId: 0,
      cancelId: 1
    });

    if (result.response === 0) {
      autoUpdater.quitAndInstall();
    }
  });

  setTimeout(() => {
    autoUpdater.checkForUpdatesAndNotify().catch((error) => {
      log('checkForUpdatesAndNotify failed.', error);
    });
  }, 3000);
}
