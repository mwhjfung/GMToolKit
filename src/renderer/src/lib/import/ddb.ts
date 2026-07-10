/* eslint-disable @typescript-eslint/no-explicit-any */
import { coercePc, type PcUnit, type FeatureCategory, type PcSpell, type PcAction, type ActionType } from '@/lib/store/pcStore'
import { abilityMod, SKILLS, type AbilityKey } from '@/lib/dnd/character'
import srdRaw from '@/lib/api/srd-data.json'

/** Spell name (lowercased) → spell level, from the bundled SRD data. Used to
 *  resolve the real level of subclass-granted spells, whose D&D Beyond feature
 *  tables only list the *class* level at which they're gained, not the spell's. */
const SRD_SPELL_LEVEL = new Map<string, number>()
/** Spell name (lowercased) → canonical, properly-cased name, from SRD data.
 *  Lets us tidy the lowercase names scraped out of D&D Beyond feature tables. */
const SRD_SPELL_NAME = new Map<string, string>()
for (const e of srdRaw as Array<{ type?: string; name?: string; data?: { level?: number } }>) {
  if (e?.type === 'spell' && typeof e?.name === 'string') {
    const key = e.name.trim().toLowerCase()
    SRD_SPELL_NAME.set(key, e.name.trim())
    if (typeof e?.data?.level === 'number') SRD_SPELL_LEVEL.set(key, e.data.level)
  }
}

const uuid = (): string =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`

const num = (v: unknown, fallback = 0): number => {
  const n = Number(v)
  return Number.isFinite(n) ? n : fallback
}

const ABILITY_KEYS: AbilityKey[] = ['str', 'dex', 'con', 'int', 'wis', 'cha']
const ABILITY_NAMES = ['strength', 'dexterity', 'constitution', 'intelligence', 'wisdom', 'charisma']

const kebabToCamel = (s: string): string => s.replace(/-([a-z])/g, (_m, c: string) => c.toUpperCase())

/** Pull a numeric character id out of a D&D Beyond URL or a bare id. */
export function parseDdbId(input: string): string | null {
  const s = input.trim()
  const m = s.match(/characters\/(\d+)/)
  if (m) return m[1]
  if (/^\d+$/.test(s)) return s
  return null
}

function findById(arr: any, id: number): any {
  return Array.isArray(arr) ? arr.find((x) => x?.id === id) : undefined
}

function mapDdb(data: any): Partial<PcUnit> {
  const mods: any[] = []
  if (data?.modifiers && typeof data.modifiers === 'object') {
    for (const v of Object.values(data.modifiers)) if (Array.isArray(v)) mods.push(...v)
  }
  const hasProf = (subType: string): boolean =>
    mods.some((x) => x?.type === 'proficiency' && x?.subType === subType)

  // Ability scores: base + manual/racial bonus + modifier bonuses, or an override.
  const abilities = {} as Record<AbilityKey, number>
  ABILITY_KEYS.forEach((key, idx) => {
    const id = idx + 1
    const base = num(findById(data?.stats, id)?.value, 10)
    const bonus = num(findById(data?.bonusStats, id)?.value, 0)
    const override = findById(data?.overrideStats, id)?.value
    const modBonus = mods
      .filter((x) => x?.type === 'bonus' && x?.subType === `${ABILITY_NAMES[idx]}-score`)
      .reduce((a, x) => a + num(x?.value, 0), 0)
    abilities[key] = override != null ? num(override, 10) : base + bonus + modBonus
  })

  const saveProf = ABILITY_KEYS.filter((_k, idx) => hasProf(`${ABILITY_NAMES[idx]}-saving-throws`))
  const skillKeys = new Set(SKILLS.map((s) => s.key))
  const skillProf = [
    ...new Set(
      mods
        .filter((x) => x?.type === 'proficiency' && typeof x?.subType === 'string')
        .map((x) => kebabToCamel(x.subType))
        .filter((k) => skillKeys.has(k))
    )
  ]

  // Classes / level.
  const classes: any[] = Array.isArray(data?.classes) ? data.classes : []
  const level = classes.reduce((a, c) => a + num(c?.level, 0), 0) || 1
  const charClass = classes
    .map((c) => {
      const name = c?.definition?.name ?? ''
      const sub = c?.subclassDefinition?.name
      return sub ? `${name} (${sub})` : name
    })
    .filter(Boolean)
    .join(' / ')

  const race = data?.race?.fullName ?? data?.race?.baseRaceName ?? data?.race?.baseName ?? ''

  // HP (re-derived: hit-dice total + CON per level + bonuses, less damage taken).
  const conMod = abilityMod(abilities.con)
  const overrideHp = data?.overrideHitPoints
  const maxHp =
    overrideHp != null
      ? num(overrideHp)
      : num(data?.baseHitPoints) + conMod * level + num(data?.bonusHitPoints)
  const currentHp = Math.max(0, maxHp - num(data?.removedHitPoints))

  // AC (best-effort from equipped armour + DEX + shield + AC bonuses).
  const inv: any[] = Array.isArray(data?.inventory) ? data.inventory : []
  const dexMod = abilityMod(abilities.dex)
  let ac = 10 + dexMod
  const armor = inv.find(
    (i) => i?.equipped && num(i?.definition?.armorClass) > 0 && [1, 2, 3].includes(i?.definition?.armorTypeId)
  )
  if (armor) {
    const baseAc = num(armor.definition.armorClass, 10)
    const type = armor.definition.armorTypeId
    ac = baseAc + (type === 1 ? dexMod : type === 2 ? Math.min(dexMod, 2) : 0)
  }
  const shield = inv.find((i) => i?.equipped && i?.definition?.armorTypeId === 4)
  if (shield) ac += num(shield.definition?.armorClass, 2)
  ac += mods
    .filter((x) => x?.type === 'bonus' && x?.subType === 'armor-class')
    .reduce((a, x) => a + num(x?.value, 0), 0)

  // Speed (walking) + senses (darkvision).
  const speed = num(data?.race?.weightSpeeds?.normal?.walk, num(data?.weightSpeeds?.normal?.walk, 30))

  // Background characteristics + personality.
  const traits = data?.traits ?? {}
  const str = (v: unknown): string => (typeof v === 'string' ? v : v != null ? String(v) : '')
  const background = {
    name: str(data?.background?.definition?.name),
    alignment: '',
    appearance: '',
    gender: str(data?.gender),
    eyes: str(data?.eyes),
    size: str(data?.race?.size),
    height: str(data?.height),
    faith: str(data?.faith),
    hair: str(data?.hair),
    skin: str(data?.skin),
    age: str(data?.age),
    weight: str(data?.weight),
    personality: str(traits.personalityTraits),
    ideals: str(traits.ideals),
    bonds: str(traits.bonds),
    flaws: str(traits.flaws)
  }

  // Inventory items.
  const inventory = inv.map((i) => ({
    id: uuid(),
    name: i?.definition?.name ?? 'Item',
    quantity: num(i?.quantity, 1),
    equipped: Boolean(i?.equipped),
    requiresAttunement: Boolean(i?.definition?.canAttune),
    attuned: Boolean(i?.isAttuned),
    notes: ''
  }))

  // Backstory → a note.
  const noteSections: Array<{ id: string; title: string; text: string }> = []
  const backstory = data?.notes?.backstory
  if (typeof backstory === 'string' && backstory.trim()) {
    noteSections.push({ id: uuid(), title: 'Backstory', text: backstory })
  }

  // Features & traits: racial traits, class features, feats (HTML stripped).
  const strip = (html: unknown): string =>
    typeof html === 'string'
      ? html
          .replace(/<[^>]*>/g, ' ')
          .replace(/&nbsp;/g, ' ')
          .replace(/&amp;/g, '&')
          .replace(/&rsquo;/g, '’')
          .replace(/\s+/g, ' ')
          .trim()
      : ''
  const features: Array<{ id: string; name: string; category: FeatureCategory; description: string }> = []
  const seen = new Set<string>()
  const pushFeat = (name: unknown, desc: unknown, category: FeatureCategory): void => {
    const n = typeof name === 'string' ? name.trim() : ''
    if (!n || seen.has(`${category}:${n}`)) return
    seen.add(`${category}:${n}`)
    features.push({ id: uuid(), name: n, category, description: strip(desc) })
  }
  for (const t of data?.race?.racialTraits ?? [])
    pushFeat(t?.definition?.name, t?.definition?.description ?? t?.definition?.snippet, 'species')
  for (const c of classes)
    for (const f of c?.classFeatures ?? [])
      pushFeat(f?.definition?.name, f?.definition?.description ?? f?.definition?.snippet, 'class')
  for (const f of data?.feats ?? [])
    pushFeat(f?.definition?.name, f?.definition?.description ?? f?.definition?.snippet, 'feat')

  // Spells — from classSpells (per-class known/prepared) plus every key in the
  // spells object (race/class/feat/background/item/…). Iterating all keys keeps
  // us forward-compatible with new DDB categories, and falling back across the
  // definition/spell name + level fields means a spell is never silently dropped
  // when its entry is shaped differently than expected.
  const spellSeen = new Set<string>()
  const spells: PcSpell[] = []
  // Levels seen in this payload's structured spell data — preferred over SRD
  // when resolving a granted spell's level (covers homebrew the PC also has).
  const knownLevel = new Map<string, number>()
  const addSpell = (name: unknown, level: unknown, prepared: boolean): void => {
    const clean = typeof name === 'string' ? name.trim() : ''
    const key = clean.toLowerCase()
    if (!key || spellSeen.has(key)) return
    spellSeen.add(key)
    spells.push({ id: uuid(), name: clean, level: num(level, 0), prepared })
  }
  const addFromList = (list: unknown): void => {
    if (!Array.isArray(list)) return
    for (const sp of list) {
      const def = sp?.definition
      const name = def?.name ?? sp?.name
      if (!name) continue
      const lvl = def?.level ?? sp?.level
      if (typeof name === 'string' && Number.isFinite(Number(lvl))) {
        knownLevel.set(name.trim().toLowerCase(), num(lvl, 0))
      }
      addSpell(name, lvl, Boolean(sp?.prepared || sp?.alwaysPrepared || sp?.countsAsKnownSpell))
    }
  }
  for (const cs of data?.classSpells ?? []) addFromList(cs?.spells)
  const spellsObj = data?.spells
  if (spellsObj && typeof spellsObj === 'object') {
    for (const list of Object.values(spellsObj)) addFromList(list)
  }

  // Subclass-granted, always-prepared spells (Paladin oath / Cleric domain /
  // Druid circle …). D&D Beyond doesn't expose these as structured spell
  // entries — they live only as a text table inside the granting feature's
  // description, e.g. "Paladin Level Spells 3rd guiding bolt, heroism 5th …".
  // Parse that table, keep rows up to the character's level in the class, and
  // resolve each spell's real level from the payload or the bundled SRD data.
  const resolveLevel = (name: string): number => {
    const key = name.toLowerCase()
    return knownLevel.get(key) ?? SRD_SPELL_LEVEL.get(key) ?? 1
  }
  const parseGrantedSpells = (descHtml: unknown, classLevel: number): void => {
    const text = strip(descHtml)
    if (!text) return
    // Anchor on the progression table header "<Class> Level Spells <digit>".
    // Skip "Spell Level Spells" tables (Warlock expanded lists) — those rows are
    // keyed by spell level, not class level, so the gating below wouldn't apply.
    const header = text.match(/(\w+)\s+Level\s+Spells?\s+(?=\d)/i)
    if (!header || header[1].toLowerCase() === 'spell') return
    const table = text.slice((header.index ?? 0) + header[0].length)
    const rowRe = /(\d+)(?:st|nd|rd|th)\s+(.+?)(?=\s+\d+(?:st|nd|rd|th)\s|$)/gi
    let m: RegExpExecArray | null
    while ((m = rowRe.exec(table))) {
      if (num(m[1], 99) > classLevel) continue
      for (const raw of m[2].split(/\s*,\s*/)) {
        const nm = raw.replace(/[.;:]+$/, '').trim()
        // Reject sentence fragments — real spell names have no digits/periods
        // and are short.
        if (!nm || /[.0-9]/.test(nm) || nm.split(/\s+/).length > 5) continue
        // Prefer SRD's canonical casing; otherwise title-case the scraped name.
        const display =
          SRD_SPELL_NAME.get(nm.toLowerCase()) ??
          nm.replace(/\b\w/g, (ch) => ch.toUpperCase())
        addSpell(display, resolveLevel(nm), true)
      }
    }
  }
  for (const c of classes) {
    const classLevel = num(c?.level, 0)
    for (const f of c?.classFeatures ?? []) {
      const def = f?.definition ?? f
      const fname = typeof def?.name === 'string' ? def.name : ''
      if (!/spell/i.test(fname)) continue
      parseGrantedSpells(def?.description ?? def?.snippet, classLevel)
    }
  }

  // ---------------------------------------------------------------------------
  // Proficiencies — armor, weapons, tools (skip skills + saving throws).
  // ---------------------------------------------------------------------------
  const armorProf: string[] = []
  const weaponProf: string[] = []
  const toolProf: string[] = []
  const otherProf: string[] = []
  const seenProf = new Set<string>()
  const savingThrowSubs = new Set(ABILITY_NAMES.map((n) => `${n}-saving-throws`))

  for (const m of mods) {
    if (m?.type !== 'proficiency') continue
    const st = typeof m?.subType === 'string' ? m.subType.toLowerCase() : ''
    const fn = typeof m?.friendlySubtypeName === 'string' ? m.friendlySubtypeName.trim() : st
    if (!fn) continue
    if (savingThrowSubs.has(st)) continue
    if (skillKeys.has(kebabToCamel(st))) continue
    const key = fn.toLowerCase()
    if (seenProf.has(key)) continue
    seenProf.add(key)

    if (st.includes('armor') || st === 'shields' || st === 'shield' || fn.toLowerCase().includes('armor') || fn.toLowerCase() === 'shields') {
      armorProf.push(fn)
    } else if (st.includes('weapon') || fn.toLowerCase().includes('weapon')) {
      weaponProf.push(fn)
    } else if (/tool|kit|supplies|instrument|vehicle|set|utensil/i.test(fn)) {
      toolProf.push(fn)
    } else {
      otherProf.push(fn)
    }
  }

  // ---------------------------------------------------------------------------
  // Defenses — resistances, immunities, vulnerabilities (from modifiers).
  // ---------------------------------------------------------------------------
  const resistances: string[] = []
  const immunities: string[] = []
  const vulnerabilities: string[] = []
  const seenDef = { resistance: new Set<string>(), immunity: new Set<string>(), vulnerability: new Set<string>() }

  for (const m of mods) {
    const mtype = m?.type as string
    if (!Object.prototype.hasOwnProperty.call(seenDef, mtype)) continue
    const fn = typeof m?.friendlySubtypeName === 'string' ? m.friendlySubtypeName.trim() : ''
    if (!fn) continue
    const key = fn.toLowerCase()
    const bucket = seenDef[mtype as keyof typeof seenDef]
    if (bucket.has(key)) continue
    bucket.add(key)
    if (mtype === 'resistance') resistances.push(fn)
    else if (mtype === 'immunity') immunities.push(fn)
    else if (mtype === 'vulnerability') vulnerabilities.push(fn)
  }

  // ---------------------------------------------------------------------------
  // Senses — darkvision from modifiers; blindsight / tremorsense / truesight
  // from data.senses if present.
  // ---------------------------------------------------------------------------
  const senses: string[] = []
  const dvMod = mods.find((m) => m?.subType === 'darkvision' && num(m?.value, 0) > 0)
  if (dvMod) senses.push(`Darkvision ${num(dvMod.value)} ft`)
  const senseData = data?.senses as Record<string, number> | undefined
  if (senseData) {
    const senseMap: Array<[string, string]> = [
      ['darkvision', 'Darkvision'],
      ['blindsight', 'Blindsight'],
      ['tremorsense', 'Tremorsense'],
      ['truesight', 'Truesight']
    ]
    for (const [key, label] of senseMap) {
      const val = num(senseData[key], 0)
      if (val <= 0) continue
      const entry = `${label} ${val} ft`
      if (!senses.some((s) => s.startsWith(label))) senses.push(entry)
    }
  }

  // ---------------------------------------------------------------------------
  // Actions — class / racial / feat / other actions and bonus actions.
  // data.actions can be { race: [...], class: [...], feat: [...], ... }
  // or occasionally a flat array.
  // ---------------------------------------------------------------------------
  const mapActionType = (id: number): ActionType => {
    if (id === 1) return 'action'
    if (id === 3) return 'bonus'
    if (id === 4) return 'reaction'
    return 'other'
  }

  const rawActions: any[] = []
  if (Array.isArray(data?.actions)) {
    rawActions.push(...data.actions)
  } else if (data?.actions && typeof data.actions === 'object') {
    for (const v of Object.values(data.actions as Record<string, unknown>)) {
      if (Array.isArray(v)) rawActions.push(...v)
    }
  }

  const seenAction = new Set<string>()
  const actions: PcAction[] = []
  for (const a of rawActions) {
    const name = typeof a?.name === 'string' ? a.name.trim() : ''
    if (!name || seenAction.has(name.toLowerCase())) continue
    seenAction.add(name.toLowerCase())
    const activationTypeId = num(a?.activation?.activationTypeId ?? a?.actionTypeId, 1)
    const type = mapActionType(activationTypeId)
    const usesMax = num(a?.limitedUse?.maxUses ?? a?.limitedUse?.numberUsed, 0)
    const desc = strip(a?.description ?? a?.snippet ?? '')
    actions.push({ id: uuid(), name, type, usesMax, usesCurrent: usesMax, description: desc })
  }

  return {
    name: data?.name ?? '',
    race,
    charClass,
    level,
    maxHp,
    currentHp,
    ac,
    speed,
    abilities,
    saveProf,
    skillProf,
    spells,
    senses,
    armorProf,
    weaponProf,
    toolProf,
    otherProf,
    resistances,
    immunities,
    vulnerabilities,
    actions,
    languages: [
      ...new Set(
        mods
          .filter((x) => x?.type === 'language' && typeof x?.friendlySubtypeName === 'string')
          .map((x) => x.friendlySubtypeName as string)
      )
    ],
    background,
    inventory,
    features,
    noteSections
  }
}

/** Fetch a public D&D Beyond character and map it into our shape. */
export async function importFromDndBeyond(input: string): Promise<Omit<PcUnit, 'id'>> {
  const id = parseDdbId(input)
  if (!id) throw new Error('Could not find a character id in that — paste a dndbeyond.com/characters/… link or the id.')

  if (!window.dmc?.ddb?.character) {
    throw new Error('The D&D Beyond fetch isn’t loaded yet — fully restart the app (stop and re-run the dev server), then try again.')
  }

  const res = (await window.dmc.ddb.character(id)) as any
  const data = res?.data ?? (res?.id ? res : null)
  if (!data || !data.name) {
    throw new Error(
      "Couldn't read that character. Make sure its D&D Beyond sharing is set to Public, then try again."
    )
  }
  return coercePc(mapDdb(data))
}
