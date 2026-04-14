import { ipcMain, webContents } from 'electron';
import type { ExtractedContent } from '../../shared/types';

// @ts-ignore — Vite ?raw import bundles the file content at compile time
import readabilityScript from '@mozilla/readability/Readability.js?raw';

export function setupWebviewIPC(): void {
  ipcMain.handle('webview:extract', async (_, webContentId: number): Promise<ExtractedContent> => {
    const wc = webContents.fromId(webContentId);
    if (!wc) {
      throw new Error('Webview not found');
    }

    const result = await wc.executeJavaScript(`
      (() => {
        ${readabilityScript}
        
        const url = window.location.href;
        const title = document.title;
        
        let article = null;
        try {
          article = new Readability(document.cloneNode(true)).parse();
        } catch (e) {
          // Readability failed
        }
        
        let content = '';
        let source = 'fallback';
        if (article && article.textContent) {
          content = article.textContent;
          source = 'readability';
        } else {
          content = document.body.innerText;
        }
        
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
          content: content.substring(0, 15000),
          pageType,
          timestamp: Date.now(),
          source
        };
      })()
    `);

    return result;
  });
}
