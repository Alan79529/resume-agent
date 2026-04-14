import { ipcMain, webContents } from 'electron';
import { readFileSync } from 'node:fs';
import type { ExtractedContent } from '../../shared/types';

function loadReadabilityScript(): string {
  try {
    const readabilityPath = require.resolve('@mozilla/readability/Readability.js');
    return readFileSync(readabilityPath, 'utf-8');
  } catch (error) {
    console.warn('[webview:extract] Failed to load Readability.js; fallback to body text only.', error);
    return '';
  }
}

const readabilityScript = loadReadabilityScript();

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
          if (typeof Readability !== 'undefined') {
            article = new Readability(document.cloneNode(true)).parse();
          }
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
