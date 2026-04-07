import type { BattleCard } from '../types'

declare global {
  interface Window {
    electronAPI: {
      getCards: () => Promise<BattleCard[]>
      getCard: (id: string) => Promise<BattleCard | undefined>
      createCard: (card: BattleCard) => Promise<BattleCard>
      updateCard: (id: string, updates: Partial<BattleCard>) => Promise<BattleCard | undefined>
      deleteCard: (id: string) => Promise<boolean>
    }
  }
}

export const api = window.electronAPI
