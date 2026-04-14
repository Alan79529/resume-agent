import Store from 'electron-store'
import type { StoreSchema } from '../../renderer/src/types'
import { encryptString, decryptString, isEncryptionAvailable } from '../services/secure-storage'

const DEFAULT_API_BASE_URL = 'https://api.deepseek.com/v1/chat/completions'
const DEFAULT_MODEL = 'deepseek-chat'
const DEFAULT_REMINDER_MINUTES = 60

function sanitizeVisibleText(value: unknown): string {
  if (typeof value !== 'string') return ''
  const stripPrivateUse = (text: string) =>
    Array.from(text)
      .filter((char) => {
        const code = char.codePointAt(0) ?? 0
        const inBmpPrivate = code >= 0xe000 && code <= 0xf8ff
        const inSupPrivateA = code >= 0xf0000 && code <= 0xffffd
        const inSupPrivateB = code >= 0x100000 && code <= 0x10fffd
        return !inBmpPrivate && !inSupPrivateA && !inSupPrivateB
      })
      .join('')

  return stripPrivateUse(value)
    .replace(/\uFFFD/g, '')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/\ufeff/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function hasUsefulChars(value: string): boolean {
  return /[\u4e00-\u9fa5A-Za-z]/.test(value)
}

function normalizeCompanyName(value: unknown): string {
  const clean = sanitizeVisibleText(value).replace(/招聘$/i, '').trim()
  return clean && hasUsefulChars(clean) ? clean : '未知公司'
}

function normalizePositionName(value: unknown): string {
  const clean = sanitizeVisibleText(value).trim()
  if (!clean || !hasUsefulChars(clean)) return '未知岗位'
  if (/^(?:元\/天|元\/月|万\/年)$/i.test(clean)) return '未知岗位'
  return clean
}

function sanitizeCard(card: StoreSchema['battleCards'][0]): StoreSchema['battleCards'][0] {
  const companyName = normalizeCompanyName(card.companyName)
  const positionName = normalizePositionName(card.positionName)
  const companyLocation = sanitizeVisibleText(card.companyLocation)
  const scheduleLocation = sanitizeVisibleText(card.schedule?.location ?? '')

  return {
    ...card,
    companyName,
    positionName,
    companyLocation,
    schedule: {
      ...card.schedule,
      location: scheduleLocation
    }
  }
}

function normalizeCards(cards: StoreSchema['battleCards']): { cards: StoreSchema['battleCards']; changed: boolean } {
  let changed = false
  const normalized = cards.map((card) => {
    const next = sanitizeCard(card)
    if (
      next.companyName !== card.companyName
      || next.positionName !== card.positionName
      || next.companyLocation !== card.companyLocation
      || next.schedule.location !== card.schedule.location
    ) {
      changed = true
    }
    return next
  })
  return { cards: normalized, changed }
}

const store = new Store<StoreSchema>({
  name: 'resume-agent-data',
  deserialize: (value) => {
    const normalized = typeof value === 'string' ? value.replace(/^\uFEFF/, '') : ''
    return JSON.parse(normalized)
  },
  defaults: {
    battleCards: [],
    config: {
      deepseekApiKey: '',
      apiBaseUrl: DEFAULT_API_BASE_URL,
      model: DEFAULT_MODEL,
      defaultReminderMinutes: DEFAULT_REMINDER_MINUTES
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
  getAll: (): StoreSchema['battleCards'] => {
    const cards = store.get('battleCards')
    const normalized = normalizeCards(cards)
    if (normalized.changed) {
      store.set('battleCards', normalized.cards)
    }
    return normalized.cards
  },

  getById: (id: string): StoreSchema['battleCards'][0] | undefined => {
    const cards = cardStore.getAll()
    return cards.find((c) => c.id === id)
  },

  create: (card: StoreSchema['battleCards'][0]): void => {
    const cards = cardStore.getAll()
    store.set('battleCards', [...cards, sanitizeCard(card)])
  },

  update: (id: string, updates: Partial<StoreSchema['battleCards'][0]>): void => {
    const cards = cardStore.getAll()
    const index = cards.findIndex((c) => c.id === id)
    if (index !== -1) {
      cards[index] = sanitizeCard({ ...cards[index], ...updates, updatedAt: new Date().toISOString() })
      store.set('battleCards', cards)
    }
  },

  delete: (id: string): void => {
    const cards = cardStore.getAll()
    store.set('battleCards', cards.filter((c) => c.id !== id))
  },

  replaceAll: (cards: StoreSchema['battleCards']): void => {
    store.set('battleCards', normalizeCards(cards).cards)
  }
}

// Config operations
export const configStore = {
  getConfig: (): StoreSchema['config'] => {
    const raw = (store.get('config') ?? {}) as Partial<StoreSchema['config']>
    const normalized: StoreSchema['config'] = {
      deepseekApiKey: typeof raw.deepseekApiKey === 'string' ? raw.deepseekApiKey : '',
      apiBaseUrl: typeof raw.apiBaseUrl === 'string' && raw.apiBaseUrl.trim()
        ? raw.apiBaseUrl.trim()
        : DEFAULT_API_BASE_URL,
      model: typeof raw.model === 'string' && raw.model.trim()
        ? raw.model.trim()
        : DEFAULT_MODEL,
      defaultReminderMinutes: typeof raw.defaultReminderMinutes === 'number' && Number.isFinite(raw.defaultReminderMinutes)
        ? raw.defaultReminderMinutes
        : DEFAULT_REMINDER_MINUTES
    }

    if (
      raw.deepseekApiKey !== normalized.deepseekApiKey
      || raw.apiBaseUrl !== normalized.apiBaseUrl
      || raw.model !== normalized.model
      || raw.defaultReminderMinutes !== normalized.defaultReminderMinutes
    ) {
      store.set('config', normalized)
    }

    return normalized
  },
  getApiKey: (): string => {
    const raw = configStore.getConfig().deepseekApiKey;
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
  getApiBaseUrl: (): string => configStore.getConfig().apiBaseUrl,
  setApiBaseUrl: (url: string): void => {
    const normalized = url.trim()
    store.set('config.apiBaseUrl', normalized || DEFAULT_API_BASE_URL)
  },
  getModel: (): string => configStore.getConfig().model,
  setModel: (model: string): void => {
    const normalized = model.trim()
    store.set('config.model', normalized || DEFAULT_MODEL)
  },
  getDefaultReminder: (): number => configStore.getConfig().defaultReminderMinutes,
  setDefaultReminder: (minutes: number): void => {
    const normalized = Number.isFinite(minutes) ? minutes : DEFAULT_REMINDER_MINUTES
    store.set('config.defaultReminderMinutes', normalized)
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
