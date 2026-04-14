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
      (async () => {
        ${readabilityScript}

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
        const includesAny = (text, keywords) => keywords.some((keyword) => text.includes(keyword));
        const includesAll = (text, keywords) => keywords.every((keyword) => text.includes(keyword));
        const normalizeLine = (value) => cleanRawText(String(value || '')).replace(/\\s+/g, ' ').trim();
        const stripSalaryPart = (value) =>
          normalizeLine(value).replace(/\\s*\\d+(?:\\.\\d+)?(?:\\s*-\\s*\\d+(?:\\.\\d+)?)?\\s*(?:k|K|千|万|元\\/天|元\\/月|万\\/年)/g, '').trim();
        const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

        const recruiterNoise = [
          '女士',
          '先生',
          '活跃',
          '沟通',
          '微信',
          '举报',
          '招聘者',
          '招聘经理',
          '招聘主管',
          '校招经理',
          '校园招聘',
          'hr',
          'HR',
          '人事',
          '猎头',
          '招聘顾问'
        ];
        const jobKeywords = ['工程师', '开发', '实习', '算法', '测试', '产品', '运营', '岗位', 'AI', 'Agent', '后端', '前端'];
        const companyKeywords = ['有限公司', '公司', '科技', '信息', '集团', '网络', '教育', '软件', '银行'];

        function dedupe(values) {
          return Array.from(new Set(values.map((v) => normalizeLine(v)).filter(Boolean)));
        }

        function cleanBossDocumentTitle(rawTitle) {
          const base = normalizeLine(rawTitle)
            .replace(/\\s*[_-]\\s*BOSS直聘.*$/i, '')
            .replace(/\\s*-\\s*BOSS.*$/i, '')
            .trim();
          if (!base) return '';

          const parts = dedupe(
            base
              .split(/[·|｜-]/)
              .map((part) => stripSalaryPart(part))
              .map((part) => normalizeLine(part))
              .filter(Boolean)
          );

          if (parts.length === 0) {
            return base;
          }

          const positionPart = parts.find(
            (part) => includesAny(part, jobKeywords) && !includesAny(part, recruiterNoise)
          );

          const companyPart =
            parts.find((part) => includesAny(part, companyKeywords) && !includesAny(part, recruiterNoise)) ||
            parts.find((part) => !includesAny(part, recruiterNoise)) ||
            '';

          if (companyPart && positionPart && companyPart !== positionPart) {
            return companyPart + ' - ' + positionPart;
          }

          return positionPart || companyPart || base;
        }

        function scoreTitle(value, bonus) {
          const text = normalizeLine(value);
          if (!text) return -999;
          let score = bonus || 0;
          if (text.length >= 2 && text.length <= 30) score += 3;
          if (text.length <= 45) score += 1;
          if (includesAny(text, jobKeywords)) score += 8;
          if (includesAny(text, recruiterNoise)) score -= 12;
          if (/^[\\u4e00-\\u9fa5]{1,4}(女士|先生)/.test(text)) score -= 15;
          if (/活跃|沟通|招聘者|招聘经理/.test(text)) score -= 10;
          if ((text.match(/[，。:：]/g) || []).length >= 2) score -= 4;
          return score;
        }

        function scoreCompany(value, bonus) {
          const text = normalizeLine(value);
          if (!text) return -999;
          let score = bonus || 0;
          if (text.length >= 2 && text.length <= 40) score += 2;
          if (includesAny(text, companyKeywords)) score += 7;
          if (includesAny(text, recruiterNoise)) score -= 10;
          if (/(女士|先生)$/.test(text)) score -= 12;
          if (includesAny(text, jobKeywords)) score -= 3;
          return score;
        }

        function clickExpandButtons(root) {
          const elements = Array.from((root || document).querySelectorAll('button,a,span,div'));
          let clicked = 0;
          for (const el of elements) {
            const text = normalizeLine(el.textContent || '');
            if (!text) continue;
            if (text === '查看更多信息' || text === '展开' || text === '展开更多' || text === '查看更多') {
              try {
                el.click();
                clicked += 1;
              } catch (e) {
                // ignore
              }
            }
          }
          return clicked;
        }

        async function warmupBossDetail() {
          if (!window.location.hostname.includes('zhipin.com')) {
            return;
          }

          clickExpandButtons(document);
          await sleep(120);

          const containers = Array.from(document.querySelectorAll('.job-detail-box, .job-detail, .job-detail-content, .job-card-right, .job-detail-wrap'));
          for (const container of containers) {
            try {
              const maxScroll = container.scrollHeight - container.clientHeight;
              if (maxScroll > 200) {
                container.scrollTop = maxScroll;
                await sleep(80);
                container.scrollTop = 0;
              }
            } catch (e) {
              // ignore
            }
          }

          try {
            window.scrollTo(0, document.body.scrollHeight);
            await sleep(80);
            window.scrollTo(0, 0);
          } catch (e) {
            // ignore
          }

          clickExpandButtons(document);
          await sleep(120);
        }

        function extractBossJobDetail() {
          if (!window.location.hostname.includes('zhipin.com')) {
            return null;
          }

          const blockKeywords = ['职位描述', '工作地址', '公司', '立即沟通'];
          const selectorCandidates = [
            '.job-detail-box',
            '.job-detail',
            '.job-detail-wrap',
            '.job-detail-content',
            '.job-card-right',
            '[ka=job-detail]'
          ];

          const candidates = [];
          for (const selector of selectorCandidates) {
            const elements = document.querySelectorAll(selector);
            for (const element of elements) {
              const text = textOf(element);
              if (!text || text.length < 120) continue;
              const rect = element.getBoundingClientRect();

              const score =
                (includesAny(text, blockKeywords) ? 3 : 0) +
                (includesAll(text, ['职位描述', '工作地址']) ? 6 : 0) +
                (rect.left >= window.innerWidth * 0.45 ? 2 : 0) +
                Math.min(3, Math.floor(text.length / 1200));

              if (score > 0) {
                candidates.push({ element, text, score });
              }
            }
          }

          if (candidates.length === 0) {
            return null;
          }

          candidates.sort((a, b) => b.score - a.score);
          const best = candidates[0];

          const titleSelectorCandidates = [
            '.job-title .job-name',
            '.job-title .name',
            '.job-primary .job-name',
            '.job-primary .name',
            '.job-header .job-name',
            '.job-header .name',
            '.job-name',
            'h1',
            'h2'
          ];

          const companySelectorCandidates = [
            '.company-name',
            '.company-info .name',
            '.company-info a',
            '[class*=company-name]',
            '[class*=company] a',
            '[class*=brand]'
          ];

          const titleRawCandidates = [];
          for (let i = 0; i < titleSelectorCandidates.length; i++) {
            const selector = titleSelectorCandidates[i];
            const nodes = best.element.querySelectorAll(selector);
            for (const node of nodes) {
              const value = stripSalaryPart(textOf(node));
              if (value && value.length <= 80) {
                titleRawCandidates.push({ value, bonus: 20 - i });
              }
            }
          }

          const topLines = best.text
            .split('\\n')
            .map((line) => normalizeLine(line))
            .filter(Boolean)
            .slice(0, 28);

          for (let i = 0; i < topLines.length; i++) {
            const line = topLines[i];
            const clean = stripSalaryPart(line);
            if (clean) {
              titleRawCandidates.push({ value: clean, bonus: 6 - Math.min(i, 6) });
            }
          }

          const titleCandidates = dedupe(titleRawCandidates.map((item) => item.value))
            .map((value) => {
              const matched = titleRawCandidates.find((item) => item.value === value);
              const bonus = matched ? matched.bonus : 0;
              return { value, score: scoreTitle(value, bonus) };
            })
            .sort((a, b) => b.score - a.score);

          const jobTitle = titleCandidates[0] && titleCandidates[0].score > 4 ? titleCandidates[0].value : '';

          const companyRawCandidates = [];
          for (let i = 0; i < companySelectorCandidates.length; i++) {
            const selector = companySelectorCandidates[i];
            const nodes = best.element.querySelectorAll(selector);
            for (const node of nodes) {
              const value = normalizeLine(textOf(node));
              if (value && value.length <= 80) {
                companyRawCandidates.push({ value, bonus: 16 - i });
              }
            }
          }

          for (let i = 0; i < topLines.length; i++) {
            const line = topLines[i];
            if (includesAny(line, companyKeywords)) {
              companyRawCandidates.push({ value: line, bonus: 6 - Math.min(i, 6) });
            }
          }

          const companyCandidates = dedupe(companyRawCandidates.map((item) => item.value))
            .map((value) => {
              const matched = companyRawCandidates.find((item) => item.value === value);
              const bonus = matched ? matched.bonus : 0;
              return { value, score: scoreCompany(value, bonus) };
            })
            .sort((a, b) => b.score - a.score);

          const companyName = companyCandidates[0] && companyCandidates[0].score > 3 ? companyCandidates[0].value : '';

          const mergedTitle =
            jobTitle && companyName
              ? companyName + ' - ' + jobTitle
              : jobTitle || companyName || cleanBossDocumentTitle(title);

          return {
            title: cleanBossDocumentTitle(mergedTitle) || cleanBossDocumentTitle(title) || title,
            content: textOf(best.element),
            pageType: 'jd'
          };
        }

        await warmupBossDetail();

        let article = null;
        try {
          if (typeof Readability !== 'undefined') {
            article = new Readability(document.cloneNode(true)).parse();
          }
        } catch (e) {
          // ignore
        }

        let content = '';
        let extractedTitle = title;
        let source = 'fallback';
        let pageType = 'unknown';

        const bossDetail = extractBossJobDetail();
        if (bossDetail) {
          content = bossDetail.content;
          extractedTitle = bossDetail.title;
          pageType = bossDetail.pageType;
        }

        if (article && article.textContent) {
          if (!content || content.length < 120) {
            content = article.textContent;
            source = 'readability';
          }
        }

        if (!content) {
          content = document.body.innerText;
        }

        if (pageType === 'unknown' && url.includes('zhipin.com/job_detail')) {
          pageType = 'jd';
        } else if (pageType === 'unknown' && window.location.hostname.includes('zhipin.com') && url.includes('/web/geek/job')) {
          if (content.includes('职位描述') || content.includes('工作地址') || content.includes('任职要求')) {
            pageType = 'jd';
          }
        } else if (pageType === 'unknown' && url.includes('zhipin.com/gongs')) {
          pageType = 'company';
        } else if (pageType === 'unknown' && url.includes('nowcoder.com/discuss')) {
          pageType = 'experience';
        } else if (pageType === 'unknown' && url.includes('nowcoder.com/company')) {
          pageType = 'company';
        }

        return {
          url,
          title: cleanBossDocumentTitle(extractedTitle) || normalizeLine(extractedTitle) || title,
          content: cleanRawText(content).substring(0, 15000),
          pageType,
          timestamp: Date.now(),
          source
        };
      })()
    `);

    return result;
  });
}
