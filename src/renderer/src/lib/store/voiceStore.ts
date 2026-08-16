import { create } from 'zustand'
import type { ContentType } from '@/types/content'
import type { Session } from '@/types/db'
import { CaptureEngine } from '@/lib/voice/captureEngine'
// @huggingface/transformers (the speech model runtime) is a multi-megabyte
// dependency that only matters once the user actually starts listening —
// importing it dynamically here keeps it out of the app's startup bundle.
import type { WhisperProgress } from '@/lib/voice/whisperEngine'
import { buildKeywordIndex, matchText, normalize, type KeywordIndex } from '@/lib/keywords'
import { CONTENT_TYPE_LABELS } from '@/types/content'
import { useContentStore } from './contentStore'
import { getActiveCampaignId } from './activeCampaign'
import { db } from '@/lib/db/db'
import { getSetting, setSetting } from '@/lib/db/content'

export type VoiceStatus = 'idle' | 'starting' | 'listening' | 'error'
export type Sensitivity = 'exact' | 'balanced' | 'loose'
export type SuppressMinutes = 0 | 1 | 5 | 10

export interface KeywordHit {
  hitId: string
  contentId: string
  term: string
  type: ContentType
  matched: string
  at: number
}

export interface TranscriptHit {
  term: string
  matched: string
  contentId: string
  type: ContentType
}

export interface TranscriptLine {
  id: string
  text: string
  at: number
  hits: TranscriptHit[]
}

export interface VoiceSettings {
  sensitivity: Sensitivity
  ignoreList: string[]
  enabledTypes: ContentType[]
  suppressMinutes: SuppressMinutes
  /** Preferred microphone (empty = system default). */
  micDeviceId: string
}

const ALL_TYPES = Object.keys(CONTENT_TYPE_LABELS) as ContentType[]

const DEFAULT_SETTINGS: VoiceSettings = {
  sensitivity: 'balanced',
  ignoreList: [],
  enabledTypes: [...ALL_TYPES],
  suppressMinutes: 5,
  micDeviceId: ''
}

const SETTINGS_KEY = 'voiceSettings'
const ALIASES_KEY = 'keywordAliases'
const MAX_TRANSCRIPT_LINES = 400

const uuid = (): string =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`

function thresholdFor(sensitivity: Sensitivity): { fuzzy: boolean; threshold?: number } {
  switch (sensitivity) {
    case 'exact':
      return { fuzzy: false }
    case 'loose':
      return { fuzzy: true, threshold: 0.66 }
    default:
      return { fuzzy: true, threshold: 0.8 }
  }
}

// ---- module-level engine state (kept out of React state) ------------------

const capture = new CaptureEngine()
let index: KeywordIndex | null = null
let queue: Float32Array[] = []
let processing = false
const lastSurfaced = new Map<string, number>()
let sessionStartedAt = 0

interface VoiceState {
  status: VoiceStatus
  error: string | null
  modelProgress: number | null
  level: number
  transcriptLines: TranscriptLine[]
  feed: KeywordHit[]
  settings: VoiceSettings
  /** Learned corrections: normalized spoken phrase → content id. */
  aliases: Record<string, string>
  start: () => Promise<void>
  stop: () => Promise<void>
  clearFeed: () => void
  dismiss: (hitId: string) => void
  /** Manually push a library entry into the feed (from transcript selection). */
  surfaceContent: (contentId: string) => void
  /** Correct a transcript word to a chosen entry, learn it as an alias, surface it. */
  applyCorrection: (lineId: string, selectedText: string, contentId: string) => void
  /** Re-link an existing transcript hit to a different content entry (no alias learning). */
  reassignHit: (lineId: string, matched: string, contentId: string) => void
  /** Remove a learned correction. */
  removeAlias: (phrase: string) => void
  updateSettings: (patch: Partial<VoiceSettings>) => void
  loadSettings: () => Promise<void>
}

export const useVoiceStore = create<VoiceState>((set, get) => {
  const handleTranscript = (text: string): void => {
    const now = Date.now()
    const { settings } = get()
    const matches = index ? matchText(index, text, thresholdFor(settings.sensitivity)) : []

    // Matches allowed to highlight (ignore-list + type filters), regardless of
    // repeat-suppression — a spoken name should stay highlighted every time.
    const ignored = new Set(settings.ignoreList.map((x) => normalize(x)))
    const allowed = matches.filter(
      (m) => !ignored.has(normalize(m.term)) && settings.enabledTypes.includes(m.type)
    )
    const lineHits: TranscriptHit[] = allowed.map((m) => ({
      term: m.term,
      matched: m.matched,
      contentId: m.id,
      type: m.type
    }))
    const line: TranscriptLine = { id: uuid(), text, at: now, hits: lineHits }
    set((s) => ({ transcriptLines: [...s.transcriptLines, line].slice(-MAX_TRANSCRIPT_LINES) }))

    // Cards: repeat-suppression on top of the allowed matches.
    const hits: KeywordHit[] = []
    for (const m of allowed) {
      if (settings.suppressMinutes > 0) {
        const last = lastSurfaced.get(m.id)
        if (last && now - last < settings.suppressMinutes * 60000) continue
      }
      lastSurfaced.set(m.id, now)
      hits.push({
        hitId: uuid(),
        contentId: m.id,
        term: m.term,
        type: m.type,
        matched: m.matched,
        at: now
      })
    }
    if (hits.length) {
      set((s) => ({ feed: [...hits.reverse(), ...s.feed].slice(0, 200) }))
    }
  }

  const processQueue = async (): Promise<void> => {
    if (processing) return
    processing = true
    try {
      while (queue.length) {
        const chunk = queue.shift()
        if (!chunk) break
        let text = ''
        try {
          const { transcribeSamples } = await import('@/lib/voice/whisperEngine')
          text = await transcribeSamples(chunk)
        } catch {
          continue
        }
        if (text) handleTranscript(text)
      }
    } finally {
      processing = false
    }
  }

  return {
    status: 'idle',
    error: null,
    modelProgress: null,
    level: 0,
    transcriptLines: [],
    feed: [],
    settings: DEFAULT_SETTINGS,
    aliases: {},

    loadSettings: async () => {
      const [saved, aliases] = await Promise.all([
        getSetting<Partial<VoiceSettings>>(SETTINGS_KEY),
        getSetting<Record<string, string>>(ALIASES_KEY)
      ])
      if (saved) set({ settings: { ...DEFAULT_SETTINGS, ...saved } })
      if (aliases) set({ aliases })
    },

    updateSettings: (patch) => {
      const settings = { ...get().settings, ...patch }
      set({ settings })
      void setSetting(SETTINGS_KEY, settings)
    },

    removeAlias: (phrase) => {
      const aliases = { ...get().aliases }
      delete aliases[phrase]
      set({ aliases })
      void setSetting(ALIASES_KEY, aliases)
      index = buildKeywordIndex(useContentStore.getState().visibleItems, aliases)
    },

    start: async () => {
      const status = get().status
      if (status === 'listening' || status === 'starting') return
      set({ status: 'starting', error: null, modelProgress: null })

      index = buildKeywordIndex(useContentStore.getState().visibleItems, get().aliases)

      try {
        const { loadWhisper } = await import('@/lib/voice/whisperEngine')
        await loadWhisper(undefined, (p: WhisperProgress) => {
          const pct = p.progress ?? (p.total ? ((p.loaded ?? 0) / p.total) * 100 : null)
          set({ modelProgress: pct != null ? Math.round(pct) : null })
        })
      } catch (err) {
        set({ status: 'error', error: `Could not load the speech model: ${String(err)}` })
        return
      }
      set({ modelProgress: null })

      queue = []
      processing = false
      lastSurfaced.clear()
      sessionStartedAt = Date.now()

      await capture.start(
        {
          onChunk: (samples) => {
            queue.push(samples)
            if (queue.length > 6) queue.shift()
            void processQueue()
          },
          onLevel: (rms) => set({ level: rms }),
          onError: (message) => set({ status: 'error', error: message })
        },
        get().settings.micDeviceId || undefined
      )

      if (get().status === 'starting') set({ status: 'listening' })
    },

    stop: async () => {
      capture.stop()
      queue = []
      const lines = get().transcriptLines
      set({ status: 'idle', level: 0 })

      if (lines.length > 0) {
        const now = Date.now()
        const startedAt = sessionStartedAt || now
        const session: Session = {
          id: `session:${startedAt}`,
          campaignId: getActiveCampaignId(),
          title: new Date(startedAt).toLocaleString(),
          startedAt,
          endedAt: now,
          transcript: lines.join('\n'),
          createdAt: now,
          updatedAt: now
        }
        try {
          await db.sessions.put(session)
        } catch {
          /* non-fatal */
        }
      }
    },

    clearFeed: () => set({ feed: [] }),

    dismiss: (hitId) => set((s) => ({ feed: s.feed.filter((h) => h.hitId !== hitId) })),

    surfaceContent: (contentId) => {
      const entry = useContentStore.getState().visibleItems.find((i) => i.id === contentId)
      if (!entry) return
      const now = Date.now()
      lastSurfaced.set(entry.id, now)
      set((s) => ({
        feed: [
          {
            hitId: uuid(),
            contentId: entry.id,
            term: entry.name,
            type: entry.type,
            matched: entry.name,
            at: now
          },
          ...s.feed.filter((h) => h.contentId !== entry.id)
        ].slice(0, 200)
      }))
    },

    reassignHit: (lineId, matched, contentId) => {
      const entry = useContentStore.getState().visibleItems.find((i) => i.id === contentId)
      if (!entry) return
      set((s) => ({
        transcriptLines: s.transcriptLines.map((l) => {
          if (l.id !== lineId) return l
          return {
            ...l,
            hits: l.hits.map((h) =>
              h.matched === matched
                ? { ...h, contentId: entry.id, term: entry.name, type: entry.type }
                : h
            )
          }
        })
      }))
    },

    applyCorrection: (lineId, selectedText, contentId) => {
      const items = useContentStore.getState().visibleItems
      const entry = items.find((i) => i.id === contentId)
      if (!entry) return

      // Learn the alias so this mistranscription auto-matches next time.
      const phrase = normalize(selectedText)
      const canonical = normalize(entry.name)
      let aliases = get().aliases
      if (phrase && phrase !== canonical && aliases[phrase] !== entry.id) {
        aliases = { ...aliases, [phrase]: entry.id }
        set({ aliases })
        void setSetting(ALIASES_KEY, aliases)
      }
      index = buildKeywordIndex(items, aliases)

      // Replace the word in the transcript line and re-highlight it.
      const { settings } = get()
      set((s) => ({
        transcriptLines: s.transcriptLines.map((l) => {
          if (l.id !== lineId) return l
          const newText = l.text.replace(selectedText, entry.name)
          const matches = index ? matchText(index, newText, thresholdFor(settings.sensitivity)) : []
          const hits: TranscriptHit[] = matches
            .filter(
              (m) =>
                !settings.ignoreList.includes(normalize(m.term)) &&
                settings.enabledTypes.includes(m.type)
            )
            .map((m) => ({ term: m.term, matched: m.matched, contentId: m.id, type: m.type }))
          return { ...l, text: newText, hits }
        })
      }))

      get().surfaceContent(entry.id)
    }
  }
})
