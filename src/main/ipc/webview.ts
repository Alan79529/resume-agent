import { ipcMain, webContents } from 'electron';
import type { ExtractedContent } from '../../renderer/src/types';

export function setupWebviewIPC(): void {
  ipcMain.handle('webview:extract', async (_, webContentId: number): Promise<ExtractedContent> => {
    const wc = webContents.fromId(webContentId);
    if (!wc) {
      throw new Error('Webview not found');
    }

    const result = await wc.executeJavaScript(`
      (() => {
        const url = window.location.href;
        const title = document.title;
        const content = document.body.innerText;
        
        // Detect page type
        let pageType = 'unknown';
        if (url.includes('zhipin.com/job_detail')) {
          pageType = 'jd';
        } else if (url.includes('zhipin.com/gongs')) {
          pageType = 'company';
        } else if (url.includes('nowcoder.com/discuss')) {
          pageType = 'experience';
        } else if (url.includes('nowcoder.com/company')) {
          pageType = 'company';
        }
        
        return {
          url,
          title,
          content: content.substring(0, 50000), // Limit size
          pageType,
          timestamp: Date.now()
        };
      })()
    `);

    return result;
  });
}
