import { create } from 'zustand'
import { getSetting, setSetting } from '@/lib/db/content'
import { applyTheme, type ThemeMode } from '@/lib/theme'

export const LLM_MODELS = [
  { id: 'claude-sonnet-4-6', label: 'Claude Sonnet 4.6 — balanced (recommended)' },
  { id: 'claude-opus-4-8', label: 'Claude Opus 4.8 — most capable, pricier' },
  { id: 'claude-haiku-4-5', label: 'Claude Haiku 4.5 — cheapest, fastest' }
]

const KEY_NAME = 'anthropicApiKey'
const DEFAULT_MODEL = 'claude-sonnet-4-6'

interface SettingsState {
  hasKey: boolean
  keyPreview: string
  llmModel: string
  llmTemperature: number
  /** When on, sources can be shared across campaigns (campaign picker appears). */
  shareCustomContent: boolean
  themeMode: ThemeMode
  load: () => Promise<void>
  setKey: (key: string) => Promise<void>
  clearKey: () => Promise<void>
  setLlmModel: (model: string) => void
  setLlmTemperature: (t: number) => void
  setShareCustomContent: (v: boolean) => void
  setThemeMode: (m: ThemeMode) => void
}

const preview = (key: string | undefined): string =>
  key ? `${key.slice(0, 6)}…${key.slice(-4)}` : ''

export const useSettingsStore = create<SettingsState>((set) => ({
  hasKey: false,
  keyPreview: '',
  llmModel: DEFAULT_MODEL,
  llmTemperature: 0.7,
  shareCustomContent: false,
  themeMode: 'dark',

  load: async () => {
    const [key, model, temp, share, themeMode] = await Promise.all([
      window.dmc.secrets.get(KEY_NAME),
      getSetting<string>('llmModel'),
      getSetting<number>('llmTemperature'),
      getSetting<boolean>('shareCustomContent'),
      getSetting<ThemeMode>('themeMode')
    ])
    const m = themeMode ?? 'dark'
    applyTheme(m)
    set({
      hasKey: Boolean(key),
      keyPreview: preview(key),
      llmModel: model ?? DEFAULT_MODEL,
      llmTemperature: temp ?? 0.7,
      shareCustomContent: share ?? false,
      themeMode: m
    })
  },

  setKey: async (key) => {
    await window.dmc.secrets.set(KEY_NAME, key)
    set({ hasKey: Boolean(key), keyPreview: preview(key) })
  },

  clearKey: async () => {
    await window.dmc.secrets.delete(KEY_NAME)
    set({ hasKey: false, keyPreview: '' })
  },

  setLlmModel: (model) => {
    set({ llmModel: model })
    void setSetting('llmModel', model)
  },

  setLlmTemperature: (t) => {
    set({ llmTemperature: t })
    void setSetting('llmTemperature', t)
  },

  setShareCustomContent: (v) => {
    set({ shareCustomContent: v })
    void setSetting('shareCustomContent', v)
  },

  setThemeMode: (m) => {
    set({ themeMode: m })
    applyTheme(m)
    void setSetting('themeMode', m)
  }
}))
