import type { BattleCard, ExtractedContent } from '../types'

declare global {
  interface Window {
    electronAPI: {
      getCards: () => Promise<BattleCard[]>
      getCard: (id: string) => Promise<BattleCard | undefined>
      createCard: (card: BattleCard) => Promise<BattleCard>
      updateCard: (id: string, updates: Partial<BattleCard>) => Promise<BattleCard | undefined>
      deleteCard: (id: string) => Promise<boolean>
      extractWebview: (webContentId: number) => Promise<ExtractedContent>
    }
  }
}

export const api = window.electronAPI
