import { create } from 'zustand'
import { getSetting, setSetting } from '@/lib/db/content'
import { getActiveCampaignId } from './activeCampaign'
import { defaultAbilities, type Abilities, type AbilityKey } from '@/lib/dnd/character'
import { useUiStore } from './uiStore'

export interface SpellSlotLevel {
  level: number
  max: number
  current: number
}

export type ActionType = 'action' | 'bonus' | 'reaction' | 'other'

/** A spell known or prepared by this character (optionally linked to a library entry). */
export interface PcSpell {
  id: string
  name: string
  /** Spell level; 0 = cantrip. */
  level: number
  prepared: boolean
  contentId?: string
}

/** An action, bonus action, reaction or other — with an optional use counter. */
export interface PcAction {
  id: string
  name: string
  type: ActionType
  usesMax: number
  usesCurrent: number
  description: string
  contentId?: string
}

/** An inventory item (optionally linked to a library weapon/item). */
export interface PcItem {
  id: string
  name: string
  quantity: number
  equipped: boolean
  requiresAttunement: boolean
  attuned: boolean
  contentId?: string
  notes: string
}

export type FeatureCategory = 'class' | 'species' | 'feat' | 'other'

export interface PcFeature {
  id: string
  name: string
  category: FeatureCategory
  description: string
  /** Links to a library feat entry to apply its mechanical bonuses. */
  contentId?: string
}

export interface PcBackground {
  name: string
  alignment: string
  gender: string
  eyes: string
  size: string
  height: string
  faith: string
  hair: string
  skin: string
  age: string
  weight: string
  appearance: string
  personality: string
  ideals: string
  bonds: string
  flaws: string
}

/** A titled free-text block (Notes tab). */
export interface PcSection {
  id: string
  title: string
  text: string
}

export interface PcUnit {
  id: string
  name: string
  /** Optional nickname/alias shown beside the name in the sheet header. */
  alias?: string
  /** Name of the player controlling this character. */
  playerName?: string
  /** Links to a library background entry. */
  backgroundContentId?: string
  race: string
  charClass: string
  level: number
  // health
  maxHp: number
  currentHp: number
  tempHp: number
  // core
  ac: number
  speed: number
  inspiration: boolean
  abilities: Abilities
  saveProf: AbilityKey[]
  skillProf: string[]
  slots: SpellSlotLevel[]
  // senses / training (tag lists)
  senses: string[]
  armorProf: string[]
  weaponProf: string[]
  toolProf: string[]
  languages: string[]
  otherProf: string[]
  // defences
  resistances: string[]
  immunities: string[]
  vulnerabilities: string[]
  conditions: string[]
  // structured tabs
  actions: PcAction[]
  inventory: PcItem[]
  spells: PcSpell[]
  features: PcFeature[]
  background: PcBackground
  noteSections: PcSection[]
}

const stateKey = (): string => `pcs:${getActiveCampaignId()}`

const uuid = (): string =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`

const emptySlots = (): SpellSlotLevel[] =>
  Array.from({ length: 9 }, (_, i) => ({ level: i + 1, max: 0, current: 0 }))

const emptyBackground = (): PcBackground => ({
  name: '',
  alignment: '',
  gender: '',
  eyes: '',
  size: '',
  height: '',
  faith: '',
  hair: '',
  skin: '',
  age: '',
  weight: '',
  appearance: '',
  personality: '',
  ideals: '',
  bonds: '',
  flaws: ''
})

const arr = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x) => typeof x === 'string') : [])

// Older PCs (and JSON/D&D Beyond imports) may be missing fields — fill them in.
type RawPc = Partial<PcUnit> & {
  alias?: string
  playerName?: string
  // legacy fields from the earlier generic-tabs model
  notes?: string
  tabs?: Array<{ label?: string; sections?: Array<{ title?: string; text?: string }> }>
}

function migrateNotes(raw: RawPc): PcSection[] {
  if (Array.isArray(raw.noteSections)) return raw.noteSections
  const out: PcSection[] = []
  if (typeof raw.notes === 'string' && raw.notes.trim())
    out.push({ id: uuid(), title: 'Notes', text: raw.notes })
  if (Array.isArray(raw.tabs)) {
    for (const t of raw.tabs)
      for (const s of t.sections ?? [])
        if (s?.text || s?.title)
          out.push({ id: uuid(), title: s.title || t.label || 'Section', text: s.text ?? '' })
  }
  return out
}

/** Normalize a possibly-partial or imported character into full fields. */
export function coercePc(raw: RawPc): Omit<PcUnit, 'id'> {
  return {
    name: raw.name ?? '',
    alias: raw.alias ?? undefined,
    playerName: (raw as RawPc).playerName ?? undefined,
    backgroundContentId: raw.backgroundContentId ?? undefined,
    race: raw.race ?? '',
    charClass: raw.charClass ?? '',
    level: raw.level ?? 1,
    maxHp: raw.maxHp ?? 0,
    currentHp: raw.currentHp ?? raw.maxHp ?? 0,
    tempHp: raw.tempHp ?? 0,
    ac: raw.ac ?? 10,
    speed: raw.speed ?? 30,
    inspiration: Boolean(raw.inspiration),
    abilities: raw.abilities ?? defaultAbilities(),
    saveProf: arr(raw.saveProf) as AbilityKey[],
    skillProf: arr(raw.skillProf),
    slots: raw.slots ?? emptySlots(),
    senses: arr(raw.senses),
    armorProf: arr(raw.armorProf),
    weaponProf: arr(raw.weaponProf),
    toolProf: arr(raw.toolProf),
    languages: arr(raw.languages),
    otherProf: arr(raw.otherProf),
    resistances: arr(raw.resistances),
    immunities: arr(raw.immunities),
    vulnerabilities: arr(raw.vulnerabilities),
    conditions: arr(raw.conditions),
    actions: Array.isArray(raw.actions) ? raw.actions : [],
    inventory: Array.isArray(raw.inventory) ? raw.inventory : [],
    spells: Array.isArray(raw.spells) ? raw.spells : [],
    features: Array.isArray(raw.features) ? raw.features : [],
    background: { ...emptyBackground(), ...(raw.background ?? {}) },
    noteSections: migrateNotes(raw)
  }
}

function normalizePc(raw: RawPc & { id: string }): PcUnit {
  return { id: raw.id, ...coercePc(raw) }
}

export const newPc = (): Omit<PcUnit, 'id'> => coercePc({})

interface PcState {
  pcs: PcUnit[]
  loaded: boolean
  load: () => Promise<void>
  addPc: (pc: Omit<PcUnit, 'id'>) => string
  updatePc: (id: string, patch: Partial<PcUnit>) => void
  removePc: (id: string) => void
  reorderPcs: (from: number, to: number) => void
  setSlotMax: (id: string, level: number, max: number) => void
  useSlot: (id: string, level: number) => void
  restoreSlot: (id: string, level: number) => void
  longRest: () => void
  shortRest: () => void
  longRestOne: (id: string) => void
  shortRestOne: (id: string) => void
}

export const usePcStore = create<PcState>((set, get) => {
  const persist = (): void => {
    void setSetting(stateKey(), get().pcs)
  }

  const mapSlots = (id: string, fn: (slot: SpellSlotLevel) => SpellSlotLevel): void => {
    set((s) => ({ pcs: s.pcs.map((p) => (p.id === id ? { ...p, slots: p.slots.map(fn) } : p)) }))
    persist()
  }

  return {
    pcs: [],
    loaded: false,

    load: async () => {
      const saved = await getSetting<Array<RawPc & { id: string }>>(stateKey())
      set({ pcs: (saved ?? []).map(normalizePc), loaded: true })
    },

    addPc: (pc) => {
      const id = uuid()
      set((s) => ({ pcs: [...s.pcs, { ...pc, id }] }))
      persist()
      return id
    },

    updatePc: (id, patch) => {
      set((s) => ({ pcs: s.pcs.map((p) => (p.id === id ? { ...p, ...patch } : p)) }))
      persist()
    },

    removePc: (id) => {
      set((s) => ({ pcs: s.pcs.filter((p) => p.id !== id) }))
      persist()
    },

    reorderPcs: (from, to) => {
      set((s) => {
        const pcs = [...s.pcs]
        const [moved] = pcs.splice(from, 1)
        pcs.splice(to, 0, moved)
        return { pcs }
      })
      persist()
    },

    setSlotMax: (id, level, max) => {
      const clamped = Math.max(0, Math.min(max, 9))
      mapSlots(id, (slot) =>
        slot.level === level
          ? { ...slot, max: clamped, current: Math.min(slot.current, clamped) }
          : slot
      )
    },

    useSlot: (id, level) => {
      mapSlots(id, (slot) =>
        slot.level === level ? { ...slot, current: Math.max(0, slot.current - 1) } : slot
      )
    },

    restoreSlot: (id, level) => {
      mapSlots(id, (slot) =>
        slot.level === level ? { ...slot, current: Math.min(slot.max, slot.current + 1) } : slot
      )
    },

    longRest: () => {
      const pcs = get().pcs
      set((s) => ({
        pcs: s.pcs.map((p) => ({
          ...p,
          currentHp: p.maxHp,
          tempHp: 0,
          slots: p.slots.map((sl) => ({ ...sl, current: sl.max })),
          actions: p.actions.map((a) => ({ ...a, usesCurrent: a.usesMax }))
        }))
      }))
      persist()
      const n = pcs.length
      useUiStore.getState().showToast(
        `Long rest — ${n} character${n !== 1 ? 's' : ''} fully restored`
      )
    },

    shortRest: () => {
      const pcs = get().pcs
      set((s) => ({
        pcs: s.pcs.map((p) =>
          /warlock/i.test(p.charClass)
            ? { ...p, slots: p.slots.map((sl) => ({ ...sl, current: sl.max })) }
            : p
        )
      }))
      persist()
      const n = pcs.length
      useUiStore.getState().showToast(
        `Short rest — ${n} character${n !== 1 ? 's' : ''} rested`
      )
    },

    longRestOne: (id) => {
      const pc = get().pcs.find((p) => p.id === id)
      set((s) => ({
        pcs: s.pcs.map((p) =>
          p.id === id
            ? {
                ...p,
                currentHp: p.maxHp,
                tempHp: 0,
                slots: p.slots.map((sl) => ({ ...sl, current: sl.max })),
                actions: p.actions.map((a) => ({ ...a, usesCurrent: a.usesMax }))
              }
            : p
        )
      }))
      persist()
      useUiStore.getState().showToast(
        `Long rest — ${pc?.name ?? 'Character'} fully restored`
      )
    },

    shortRestOne: (id) => {
      const pc = get().pcs.find((p) => p.id === id)
      set((s) => ({
        pcs: s.pcs.map((p) =>
          p.id === id
            ? {
                ...p,
                slots: /warlock/i.test(p.charClass)
                  ? p.slots.map((sl) => ({ ...sl, current: sl.max }))
                  : p.slots
              }
            : p
        )
      }))
      persist()
      useUiStore.getState().showToast(
        `Short rest — ${pc?.name ?? 'Character'} rested`
      )
    }
  }
})
