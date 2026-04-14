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
    profile: {
      resumeText: '',
      selfIntroText: ''
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
  },

  replaceAll: (cards: StoreSchema['battleCards']): void => {
    store.set('battleCards', cards)
  }
}

// Config operations
export const configStore = {
  getApiKey: (): string => {
    const raw = store.get('config').deepseekApiKey;
    if (raw === '' || raw === null || raw === undefined) return raw ?? '';

    // Silent migration: if value is plaintext (no encrypted prefix), encrypt it now
    if (isEncryptionAvailable() && typeof raw === 'string' && !raw.startsWith('enc:')) {
      try {
        store.set('config.deepseekApiKey', encryptString(raw));
      } catch (e) {
        console.error('[store] Failed to encrypt API key during migration:', e);
      }
      return raw;
    }

    try {
      return decryptString(raw);
    } catch (e) {
      console.error('[store] Failed to decrypt API key:', e);
      return raw;
    }
  },
  setApiKey: (key: string): void => {
    try {
      store.set('config.deepseekApiKey', encryptString(key));
    } catch (e) {
      console.error('[store] Failed to encrypt API key:', e);
      throw e;
    }
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

// Profile operations
export const profileStore = {
  get: (): StoreSchema['profile'] => store.get('profile'),
  set: (profile: Partial<StoreSchema['profile']>): StoreSchema['profile'] => {
    const current = store.get('profile')
    const next = { ...current, ...profile }
    store.set('profile', next)
    return next
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
  },
  replaceAll: (resources: StoreSchema['resources']): void => {
    store.set('resources', resources)
  }
}

export default store
