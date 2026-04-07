import { ipcMain } from 'electron'
import { cardStore } from '../store'
import type { BattleCard } from '../../renderer/src/types'

export function setupCardIPC(): void {
  ipcMain.handle('cards:getAll', () => cardStore.getAll())

  ipcMain.handle('cards:getById', (_, id: string) => cardStore.getById(id))

  ipcMain.handle('cards:create', (_, card: BattleCard) => {
    cardStore.create(card)
    return card
  })

  ipcMain.handle('cards:update', (_, id: string, updates: Partial<BattleCard>) => {
    cardStore.update(id, updates)
    return cardStore.getById(id)
  })

  ipcMain.handle('cards:delete', (_, id: string) => {
    cardStore.delete(id)
    return true
  })
}
