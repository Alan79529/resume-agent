import { ipcMain } from 'electron';
import { analyzeJobContent } from '../services/ai';
import type { ExtractedContent } from '../../renderer/src/types';

export function setupAIIPC(): void {
  ipcMain.handle('ai:analyze', async (_, extracted: ExtractedContent) => {
    return analyzeJobContent(extracted);
  });
}
