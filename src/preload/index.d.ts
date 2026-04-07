import { ElectronAPI } from '@electron-toolkit/preload'
import type { BattleCard } from '../renderer/src/types'

// Custom API interface
interface CustomAPI {
  getCards: () => Promise<BattleCard[]>
  getCard: (id: string) => Promise<BattleCard | undefined>
  createCard: (card: BattleCard) => Promise<BattleCard>
  updateCard: (id: string, updates: Partial<BattleCard>) => Promise<BattleCard | undefined>
  deleteCard: (id: string) => Promise<boolean>
}

declare global {
  interface Window {
    electron: ElectronAPI
    api: unknown
    electronAPI: CustomAPI
  }
}
