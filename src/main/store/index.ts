import Store from 'electron-store'
import type { StoreSchema } from '../../renderer/src/types'
import { encryptString, decryptString, isEncryptionAvailable } from '../services/secure-storage'

const store = new Store<StoreSchema>({
  name: 'resume-agent-data',
  defaults: {
    battleCards: [],
    config: {
      deepseekApiKey: '',
      apiBaseUrl: 'https://api.deepseek.com/v1/chat/completions',
      model: 'deepseek-chat',
      defaultReminderMinutes: 60
    },
    resources: []
  }
})

// Card operations
export const cardStore = {
  getAll: (): StoreSchema['battleCards'] => store.get('battleCards'),

  getById: (id: string): StoreSchema['battleCards'][0] | undefined => {
    const cards = store.get('battleCards')
    return cards.find((c) => c.id === id)
  },

  create: (card: StoreSchema['battleCards'][0]): void => {
    const cards = store.get('battleCards')
    store.set('battleCards', [...cards, card])
  },

  update: (id: string, updates: Partial<StoreSchema['battleCards'][0]>): void => {
    const cards = store.get('battleCards')
    const index = cards.findIndex((c) => c.id === id)
    if (index !== -1) {
      cards[index] = { ...cards[index], ...updates, updatedAt: new Date().toISOString() }
      store.set('battleCards', cards)
    }
  },

  delete: (id: string): void => {
    const cards = store.get('battleCards')
    store.set('battleCards', cards.filter((c) => c.id !== id))
  }
}

// Config operations
export const configStore = {
  getApiKey: (): string => {
    const raw = store.get('config').deepseekApiKey;
    if (raw === '' || raw === null || raw === undefined) return raw ?? '';
    try {
      return decryptString(raw);
    } catch (e) {
      // Legacy plaintext migration: if decryption fails, assume plaintext
      if (isEncryptionAvailable() && typeof raw === 'string') {
        store.set('config.deepseekApiKey', encryptString(raw));
      }
      return raw;
    }
  },
  setApiKey: (key: string): void => {
    store.set('config.deepseekApiKey', encryptString(key));
  },
  getApiBaseUrl: (): string => store.get('config').apiBaseUrl,
  setApiBaseUrl: (url: string): void => {
    store.set('config.apiBaseUrl', url)
  },
  getModel: (): string => store.get('config').model,
  setModel: (model: string): void => {
    store.set('config.model', model)
  },
  getDefaultReminder: (): number => store.get('config').defaultReminderMinutes,
  setDefaultReminder: (minutes: number): void => {
    store.set('config.defaultReminderMinutes', minutes)
  }
}

// Resource operations
export const resourceStore = {
  getAll: (): StoreSchema['resources'] => store.get('resources'),
  create: (resource: StoreSchema['resources'][0]): void => {
    const resources = store.get('resources')
    store.set('resources', [...resources, resource])
  },
  delete: (id: string): void => {
    const resources = store.get('resources')
    store.set('resources', resources.filter((r) => r.id !== id))
  }
}

export default store
