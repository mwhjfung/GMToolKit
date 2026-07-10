# JSON Import Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `.json` file import to the Library's ImportDialog — auto-detecting pre-converted ContentEntry arrays (output of `download-5etools.mjs`) and raw 5etools data files, then letting the user bulk-review entries in a grouped checklist before saving.

**Architecture:** A new `parseJson.ts` module handles format detection and maps raw 5etools JSON to ContentEntry objects (same mappers as `scripts/download-5etools.mjs`, ported to TypeScript). `JsonBatchReview.tsx` is a grouped checklist UI replacing the one-at-a-time `ImportReview` for JSON imports. `contentStore` gains a `bulkImport` action. `ImportDialog` forks to the new path when a `.json` file is selected.

**Tech Stack:** React, Zustand, Dexie (IndexedDB), Tailwind, TypeScript, Lucide icons. No test suite in this project — TDD steps are omitted.

---

## File Map

| Action | Path | Responsibility |
|--------|------|----------------|
| Modify | `src/renderer/src/lib/db/content.ts` | Add `bulkPutContent` |
| Modify | `src/renderer/src/lib/store/contentStore.ts` | Add `bulkImport` action |
| Create | `src/renderer/src/lib/import/parseJson.ts` | Auto-detect + map JSON → ContentEntry[] |
| Create | `src/renderer/src/features/library/JsonBatchReview.tsx` | Grouped checklist bulk-review UI |
| Modify | `src/renderer/src/features/library/ImportDialog.tsx` | JSON file branch + route to JsonBatchReview |

---

## Task 1: Add `bulkPutContent` and `bulkImport`

**Files:**
- Modify: `src/renderer/src/lib/db/content.ts`
- Modify: `src/renderer/src/lib/store/contentStore.ts`

- [ ] **Step 1: Add `bulkPutContent` to `content.ts`**

Open `src/renderer/src/lib/db/content.ts`. After the `putContent` function (line 22), add:

```ts
export async function bulkPutContent(entries: ContentEntry[]): Promise<void> {
  await db.content.bulkPut(entries)
}
```

- [ ] **Step 2: Add `bulkImport` to the `ContentState` interface in `contentStore.ts`**

Open `src/renderer/src/lib/store/contentStore.ts`. In the `ContentState` interface (around line 100), add the following line after `bulkRemove`:

```ts
bulkImport: (entries: ContentEntry[]) => Promise<void>
```

- [ ] **Step 3: Add `bulkPutContent` to the imports in `contentStore.ts`**

At line 1, the import from `@/lib/db/content` currently reads:
```ts
import {
  getAllContent,
  putContent,
  deleteContent,
  syncSrd,
  getSetting,
  setSetting,
  type SyncProgress
} from '@/lib/db/content'
```

Add `bulkPutContent` to that import:
```ts
import {
  getAllContent,
  putContent,
  bulkPutContent,
  deleteContent,
  syncSrd,
  getSetting,
  setSetting,
  type SyncProgress
} from '@/lib/db/content'
```

- [ ] **Step 4: Implement `bulkImport` in the store**

In `contentStore.ts`, inside the `create<ContentState>((set, get) => ({` block, add the `bulkImport` implementation after the `bulkRemove` action (around line 354):

```ts
bulkImport: async (entries) => {
  let sources = get().sources
  const activeId = getActiveCampaignId()
  const mapped = entries.map((e) => {
    if (e.source !== 'custom') return e
    const r = ensureSource(sources, e.world, activeId)
    sources = r.sources
    return { ...e, sourceId: r.sourceId, world: r.name }
  })
  await bulkPutContent(mapped)
  void setSetting(SOURCES_KEY, sources)
  const items = await getAllContent()
  set({ items, sources, visibleItems: computeVisible(items, sources) })
},
```

- [ ] **Step 5: Commit**

```bash
git add src/renderer/src/lib/db/content.ts src/renderer/src/lib/store/contentStore.ts
git commit -m "feat: add bulkImport action to contentStore"
```

---

## Task 2: Create `parseJson.ts`

**Files:**
- Create: `src/renderer/src/lib/import/parseJson.ts`

This module is a TypeScript port of the mappers in `scripts/download-5etools.mjs`. It exports a single `parseJson(file, source)` function.

- [ ] **Step 1: Create the file with helpers, lookup tables, and mappers**

Create `src/renderer/src/lib/import/parseJson.ts` with the following content:

```ts
import type { ContentEntry } from '@/types/content'

// ---- string helpers ---------------------------------------------------------

function stripTags(text: unknown): string {
  if (!text) return ''
  return String(text)
    .replace(/\{@\w[\w-]* ([^|}]+)(?:\|[^}]*)?\}/g, '$1')
    .replace(/\{@h\}/g, '')
    .replace(/\{@recharge (\d+)\}/g, '(Recharge $1–6)')
    .replace(/\{@recharge\}/g, '(Recharge 6)')
    .replace(/\{@atk [^}]+\}/g, '')
    .replace(/\{@[^}]+\}/g, '')
    .replace(/  +/g, ' ')
    .trim()
}

type FiveEntry =
  | string
  | {
      type?: string
      name?: string
      entries?: FiveEntry[]
      entry?: string
      items?: FiveEntry[]
      rows?: unknown[]
      colLabels?: unknown[]
      caption?: string
      attributes?: string[]
      roll?: { exact?: number; min?: number; max?: number }
    }

function renderEntry(e: FiveEntry): string {
  if (!e) return ''
  if (typeof e === 'string') return stripTags(e)
  switch (e.type) {
    case 'entries':
    case 'section': {
      const header = e.name ? `**${stripTags(e.name)}**` : ''
      const body = renderEntries(e.entries)
      return [header, body].filter(Boolean).join('\n')
    }
    case 'list': {
      if (!e.items) return ''
      return e.items
        .map((item) => {
          if (typeof item === 'string') return `- ${stripTags(item)}`
          const i = item as { type?: string; name?: string; entries?: FiveEntry[]; entry?: string }
          if (i.type === 'item') {
            const n = i.name ? `**${stripTags(i.name)}** ` : ''
            return `- ${n}${renderEntries(i.entries ? [i.entry ?? '', ...i.entries] : [i.entry ?? ''])}`
          }
          return `- ${renderEntry(item as FiveEntry)}`
        })
        .join('\n')
    }
    case 'table': {
      const caption = e.caption ? `**${stripTags(e.caption)}**\n` : ''
      if (!e.rows?.length) return caption.trim()
      const cols = (e.colLabels ?? []) as unknown[]
      const header = cols.length
        ? `| ${cols.map((c) => stripTags(typeof c === 'string' ? c : (c as { label?: string }).label ?? '')).join(' | ')} |\n|${cols.map(() => '---|').join('')}`
        : ''
      const rows = e.rows
        .map(
          (row) =>
            '| ' +
            (row as unknown[])
              .map((cell) => {
                if (typeof cell === 'string') return stripTags(cell)
                const c = cell as { type?: string; roll?: { exact?: number; min?: number; max?: number } }
                if (c?.type === 'cell' && c.roll) {
                  return c.roll.exact != null ? String(c.roll.exact) : `${c.roll.min}–${c.roll.max}`
                }
                return renderEntry(cell as FiveEntry)
              })
              .join(' | ') +
            ' |'
        )
        .join('\n')
      return [caption.trim(), header, rows].filter(Boolean).join('\n')
    }
    case 'inset':
    case 'insetReadaloud': {
      const name = e.name ? `> **${stripTags(e.name)}**\n` : ''
      return name + renderEntries(e.entries)
    }
    case 'quote':
      return `*${renderEntries(e.entries)}*`
    case 'abilityDc':
      return `Spell save DC = 8 + proficiency bonus + ${(e.attributes ?? []).join('/')} modifier`
    case 'abilityAttackMod':
      return `Spell attack = proficiency bonus + ${(e.attributes ?? []).join('/')} modifier`
    case 'item': {
      const n = e.name ? `**${stripTags(e.name)}** ` : ''
      const body = e.entries ? renderEntries(e.entries) : stripTags(e.entry ?? '')
      return `- ${n}${body}`
    }
    default:
      return renderEntries(e.entries)
  }
}

function renderEntries(entries: FiveEntry[] | undefined): string {
  if (!entries) return ''
  return entries.map(renderEntry).filter(Boolean).join('\n\n')
}

function firstSentence(text: string, max = 150): string {
  if (!text) return ''
  const flat = text.replace(/\s+/g, ' ').trim()
  const dot = flat.indexOf('. ')
  const base = dot > 0 && dot < max ? flat.slice(0, dot + 1) : flat
  return base.length > max ? `${base.slice(0, max - 1).trimEnd()}…` : base
}

// ---- lookup tables ----------------------------------------------------------

const SCHOOL: Record<string, string> = {
  A: 'Abjuration', C: 'Conjuration', D: 'Divination',
  E: 'Enchantment', V: 'Evocation', I: 'Illusion',
  N: 'Necromancy', T: 'Transmutation', P: 'Conjuration'
}
const SIZE: Record<string, string> = {
  T: 'Tiny', S: 'Small', M: 'Medium', L: 'Large', H: 'Huge', G: 'Gargantuan'
}
const ALIGN: Record<string, string> = {
  L: 'Lawful', N: 'Neutral', C: 'Chaotic', G: 'Good', E: 'Evil', U: 'Unaligned', A: 'Any'
}
const DMG_TYPE: Record<string, string> = {
  A: 'acid', B: 'bludgeoning', C: 'cold', F: 'fire', O: 'force',
  L: 'lightning', N: 'necrotic', P: 'piercing', I: 'poison',
  Y: 'psychic', R: 'radiant', S: 'slashing', T: 'thunder'
}
const PROP: Record<string, string> = {
  '2H': 'two-handed', A: 'ammunition', F: 'finesse', H: 'heavy',
  L: 'light', LD: 'loading', R: 'reach', T: 'thrown', V: 'versatile', S: 'special'
}
const ITEM_TYPE: Record<string, string> = {
  A: 'Armour', G: 'Wondrous Item', M: 'Melee Weapon', R: 'Ranged Weapon',
  S: 'Shield', P: 'Potion', RD: 'Rod', RG: 'Ring', SC: 'Scroll',
  ST: 'Staff', W: 'Wand', HA: 'Heavy Armour', LA: 'Light Armour', MA: 'Medium Armour',
  AT: "Artisan's Tools", GS: 'Gaming Set', GV: 'Generic Variant'
}
const ABILITY: Record<string, string> = {
  str: 'STR', dex: 'DEX', con: 'CON', int: 'INT', wis: 'WIS', cha: 'CHA'
}
const NON_WEAPON_ITEM_TYPES = new Set([
  'G', 'P', 'RD', 'RG', 'SC', 'ST', 'W', 'WD', 'A', 'GV', undefined
])

const toSlug = (name: string): string => name.toLowerCase().replace(/[^a-z0-9]+/g, '-')

// ---- per-type mappers -------------------------------------------------------

function mapSpell(r: unknown, source: string, now: number): ContentEntry {
  const s = r as Record<string, unknown>
  const school = SCHOOL[s.school as string] ?? (s.school as string) ?? ''
  const level = (s.level as number) ?? 0
  const t = (s.time as Array<{ number: number; unit: string; condition?: string }>)?.[0]
  const castingTime = t ? `${t.number} ${t.unit}${t.condition ? `, ${t.condition}` : ''}` : ''
  const rng = s.range as { type?: string; distance?: { type?: string; amount?: number } } | undefined
  let range = ''
  if (rng?.type === 'point') {
    const d = rng.distance
    if (d?.type === 'self') range = 'Self'
    else if (d?.type === 'touch') range = 'Touch'
    else if (d?.type === 'sight') range = 'Sight'
    else if (d?.type === 'unlimited') range = 'Unlimited'
    else if (d?.amount) range = `${d.amount} ${d.type}`
    else range = d?.type ?? ''
  } else if (['radius', 'cone', 'line', 'cube', 'hemisphere', 'sphere'].includes(rng?.type ?? '')) {
    const d = rng?.distance
    range = d?.amount ? `Self (${d.amount}-${d.type} ${rng?.type})` : 'Self'
  } else if (rng?.type === 'special') {
    range = 'Special'
  }
  const comp = (s.components ?? {}) as Record<string, unknown>
  const parts: string[] = []
  if (comp.v) parts.push('V')
  if (comp.s) parts.push('S')
  if (comp.m) parts.push('M')
  const material =
    typeof comp.m === 'object' && comp.m !== null
      ? stripTags((comp.m as { text?: string }).text ?? '')
      : typeof comp.m === 'string'
        ? stripTags(comp.m)
        : undefined
  const dur = (
    s.duration as Array<{
      type?: string
      concentration?: boolean
      duration?: { amount?: number; type?: string }
    }>
  )?.[0]
  let duration = ''
  let concentration = false
  if (dur) {
    if (dur.type === 'instant') duration = 'Instantaneous'
    else if (dur.type === 'permanent') duration = 'Until dispelled'
    else if (dur.type === 'special') duration = 'Special'
    else if (dur.concentration) {
      concentration = true
      const a = dur.duration
      duration = `Concentration, up to ${a?.amount ?? ''} ${a?.type ?? ''}`.trim()
    } else if (dur.duration) {
      const a = dur.duration
      duration = `${a.amount ?? ''} ${a.type ?? ''}`.trim()
    }
  }
  const classes = s.classes as
    | { fromClassList?: Array<{ name: string }>; fromClassListVariant?: Array<{ name: string }> }
    | undefined
  const classLists = [...(classes?.fromClassList ?? []), ...(classes?.fromClassListVariant ?? [])]
  const classNames = [...new Set(classLists.map((c) => c.name))]
  const levelText = level === 0 ? 'Cantrip' : `Level ${level}`
  const name = s.name as string
  return {
    id: `ext:spell:${toSlug(name)}-${toSlug(source)}`,
    type: 'spell',
    source: 'custom',
    slug: toSlug(name),
    name,
    world: source,
    tags: school ? [school] : [],
    summary: [levelText, school, castingTime].filter(Boolean).join(' · '),
    createdAt: now,
    updatedAt: now,
    data: {
      level,
      levelText,
      school,
      castingTime,
      range,
      components: parts.join(', '),
      material: material || undefined,
      duration,
      concentration,
      ritual: !!(s.meta as { ritual?: boolean } | undefined)?.ritual,
      description: renderEntries(s.entries as FiveEntry[]),
      higherLevel: s.entriesHigherLevel
        ? renderEntries(
            (s.entriesHigherLevel as Array<{ entries?: FiveEntry[] }>)[0]?.entries ??
              (s.entriesHigherLevel as FiveEntry[])
          )
        : undefined,
      classes: classNames
    }
  }
}

function mapAlignment(alignment: unknown): string {
  if (!alignment) return 'Unaligned'
  return (alignment as string[])
    .map((a) => {
      if (a === 'U') return 'Unaligned'
      if (a === 'A') return 'Any'
      if (a === 'NX' || a === 'NY') return 'Neutral'
      return ALIGN[a] ?? a
    })
    .join(' ')
}

function mapStatEntries(arr: unknown): Array<{ name: string; desc: string }> {
  if (!arr) return []
  return (arr as Array<{ name?: string; entries?: FiveEntry[] }>).flatMap((e) => {
    if (!e.name && !e.entries) return []
    return [{ name: stripTags(e.name ?? ''), desc: renderEntries(e.entries) }]
  })
}

function mapMonster(r: unknown, source: string, now: number): ContentEntry {
  const m = r as Record<string, unknown>
  const size = SIZE[(m.size as string[])?.[0]] ?? (m.size as string[])?.[0] ?? ''
  const creatureType =
    typeof m.type === 'string' ? m.type : ((m.type as { type?: string })?.type ?? '')
  const alignment = mapAlignment(m.alignment)
  const acEntry = (m.ac as unknown[])?.[0]
  const acNum = typeof acEntry === 'number' ? acEntry : (acEntry as { ac?: number })?.ac ?? ''
  const acFrom =
    typeof acEntry === 'object' &&
    acEntry !== null &&
    (acEntry as { from?: string[] }).from?.length
      ? ` (${(acEntry as { from: string[] }).from.join(', ')})`
      : ''
  const hpData = m.hp as { average?: number; formula?: string } | undefined
  const hp = `${hpData?.average ?? ''}${hpData?.formula ? ` (${hpData.formula})` : ''}`
  const speed = Object.entries((m.speed as Record<string, unknown>) ?? {})
    .filter(([, v]) => v !== false && v !== 0)
    .map(([mode, val]) =>
      typeof val === 'boolean' ? mode : mode === 'walk' ? `${val} ft.` : `${mode} ${val} ft.`
    )
    .join(', ')
  const saves = Object.entries((m.save as Record<string, string>) ?? {})
    .map(([k, v]) => `${ABILITY[k] ?? k} ${v}`)
    .join(', ')
  const skills = Object.entries((m.skill as Record<string, string>) ?? {})
    .map(([k, v]) => `${k[0].toUpperCase()}${k.slice(1)} ${v}`)
    .join(', ')
  const senses = [
    ...((m.senses as string[]) ?? []),
    m.passive != null ? `passive Perception ${m.passive}` : ''
  ]
    .filter(Boolean)
    .join(', ')
  const cr = String((m.cr as { cr?: string } | string | undefined) != null
    ? typeof m.cr === 'object' ? (m.cr as { cr?: string }).cr ?? '' : m.cr
    : '')
  const abil = m as Record<string, number>
  const name = m.name as string
  return {
    id: `ext:monster:${toSlug(name)}-${toSlug(source)}`,
    type: 'monster',
    source: 'custom',
    slug: toSlug(name),
    name,
    world: source,
    tags: [creatureType, size].filter(Boolean),
    summary: [
      [size, creatureType].filter(Boolean).join(' '),
      cr ? `CR ${cr}` : '',
      acNum ? `AC ${acNum}` : '',
      hpData?.average ? `HP ${hpData.average}` : ''
    ]
      .filter(Boolean)
      .join(' · '),
    createdAt: now,
    updatedAt: now,
    data: {
      role: 'monster',
      size,
      creatureType,
      alignment,
      ac: `${acNum}${acFrom}`,
      hp,
      speed,
      abilities: {
        str: abil.str ?? 10,
        dex: abil.dex ?? 10,
        con: abil.con ?? 10,
        int: abil.int ?? 10,
        wis: abil.wis ?? 10,
        cha: abil.cha ?? 10
      },
      saves: saves || undefined,
      skills: skills || undefined,
      senses: senses || undefined,
      languages: Array.isArray(m.languages)
        ? (m.languages as string[]).join(', ')
        : (m.languages as string | undefined) || undefined,
      cr,
      traits: mapStatEntries(m.trait),
      actions: mapStatEntries(m.action),
      bonusActions: mapStatEntries(m.bonus),
      reactions: mapStatEntries(m.reaction),
      legendaryActions: mapStatEntries(m.legendary),
      legendaryDesc: (m.legendary as unknown[])?.length
        ? `${name} can take 3 legendary actions, choosing from the options below.`
        : undefined
    }
  }
}

function mapItem(r: unknown, source: string, now: number): ContentEntry {
  const i = r as Record<string, unknown>
  const typeLabel = ITEM_TYPE[i.type as string] ?? (i.type as string) ?? 'Wondrous Item'
  const rarity = i.rarity === 'none' ? '' : ((i.rarity as string) ?? '')
  const attunement = !!i.reqAttune && i.reqAttune !== false
  const name = i.name as string
  return {
    id: `ext:item:${toSlug(name)}-${toSlug(source)}`,
    type: 'item',
    source: 'custom',
    slug: toSlug(name),
    name,
    world: source,
    tags: rarity ? [rarity] : [],
    summary: [typeLabel, rarity, attunement && 'attunement'].filter(Boolean).join(' · '),
    createdAt: now,
    updatedAt: now,
    data: {
      itemType: typeLabel,
      rarity,
      attunement,
      description: renderEntries(i.entries as FiveEntry[])
    }
  }
}

function mapWeapon(r: unknown, source: string, now: number): ContentEntry {
  const w = r as Record<string, unknown>
  const category = (w.weaponCategory as string) ?? ''
  const dmgDice = (w.dmg1 as string) ?? ''
  const dmgType = DMG_TYPE[w.dmgType as string] ?? (w.dmgType as string) ?? ''
  const props = ((w.property as string[]) ?? []).map((p) => PROP[p] ?? p)
  const cost = w.cost as { quantity?: number; denomination?: string } | undefined
  const name = w.name as string
  return {
    id: `ext:weapon:${toSlug(name)}-${toSlug(source)}`,
    type: 'weapon',
    source: 'custom',
    slug: toSlug(name),
    name,
    world: source,
    tags: category ? [category] : [],
    summary: [category, [dmgDice, dmgType].filter(Boolean).join(' ')].filter(Boolean).join(' · '),
    createdAt: now,
    updatedAt: now,
    data: {
      damageDice: dmgDice,
      damageType: dmgType,
      properties: props,
      weight: w.weight != null ? `${w.weight} lb.` : undefined,
      cost: cost ? `${cost.quantity} ${cost.denomination}` : undefined,
      category
    }
  }
}

function mapClass(
  r: unknown,
  subs: unknown[],
  source: string,
  now: number
): ContentEntry {
  const c = r as Record<string, unknown>
  const hitDie = `d${(c.hd as { faces?: number })?.faces ?? 6}`
  const saves = ((c.proficiency as string[]) ?? []).map((a) => ABILITY[a] ?? a).join(', ')
  const startProf = (c.startingProficiencies ?? {}) as Record<string, string[] | undefined>
  const profParts = [startProf.armor?.join(', '), startProf.weapons?.join(', ')].filter(Boolean)
  const fluff = (c.fluff as Array<{ entries?: FiveEntry[] }>)?.[0]
  const name = c.name as string
  return {
    id: `ext:class:${toSlug(name)}-${toSlug(source)}`,
    type: 'class',
    source: 'custom',
    slug: toSlug(name),
    name,
    world: source,
    tags: [],
    summary: [`Hit die ${hitDie}`, saves ? `saves ${saves}` : ''].filter(Boolean).join(' · '),
    createdAt: now,
    updatedAt: now,
    data: {
      hitDie,
      savingThrows: saves || undefined,
      proficiencies: profParts.join('; ') || undefined,
      spellcastingAbility: c.spellcastingAbility
        ? ABILITY[c.spellcastingAbility as string]
        : undefined,
      description: renderEntries(fluff?.entries ?? []),
      subclasses: (subs as Array<{ name?: string }>).map((s) => s.name ?? '')
    }
  }
}

function mapSubclass(r: unknown, source: string, now: number): ContentEntry {
  const s = r as Record<string, unknown>
  const name = s.name as string
  const className = s.className as string
  return {
    id: `ext:subclass:${toSlug(name)}-${toSlug(className)}-${toSlug(source)}`,
    type: 'subclass',
    source: 'custom',
    slug: `${toSlug(name)}-${toSlug(className)}`,
    name,
    world: source,
    tags: [className],
    summary: `${className} subclass`,
    createdAt: now,
    updatedAt: now,
    data: {
      parentClass: className,
      description: renderEntries(s.entries as FiveEntry[])
    }
  }
}

// ---- auto-detect + dispatch -------------------------------------------------

function isContentEntryArray(value: unknown): value is ContentEntry[] {
  if (!Array.isArray(value) || value.length === 0) return false
  const first = value[0] as Record<string, unknown>
  return (
    typeof first?.id === 'string' &&
    typeof first?.type === 'string' &&
    typeof first?.name === 'string'
  )
}

export async function parseJson(file: File, source: string): Promise<ContentEntry[]> {
  let json: unknown
  try {
    json = JSON.parse(await file.text())
  } catch {
    throw new Error('Not a valid JSON file.')
  }

  // Pre-converted ContentEntry[] (output of download-5etools.mjs)
  if (isContentEntryArray(json)) {
    const entries = json as ContentEntry[]
    if (!source) return entries
    return entries.map((e) => ({ ...e, world: source }))
  }

  // Raw 5etools format — object with well-known keys
  if (json === null || typeof json !== 'object' || Array.isArray(json)) {
    throw new Error(
      'Unrecognised JSON format — expected a ContentEntry array or a 5etools data file.'
    )
  }

  const raw = json as Record<string, unknown>
  const src = source || 'Unknown'
  const now = Date.now()
  const results: ContentEntry[] = []

  if (Array.isArray(raw.spell)) {
    for (const s of raw.spell) results.push(mapSpell(s, src, now))
  }
  if (Array.isArray(raw.monster)) {
    for (const m of raw.monster) results.push(mapMonster(m, src, now))
  }
  if (Array.isArray(raw.item)) {
    for (const i of raw.item) {
      if (NON_WEAPON_ITEM_TYPES.has((i as { type?: string }).type)) {
        results.push(mapItem(i, src, now))
      }
    }
  }
  if (Array.isArray(raw.baseitem)) {
    for (const i of raw.baseitem) {
      const w = i as { type?: string; dmg1?: unknown }
      if ((w.type === 'M' || w.type === 'R') && w.dmg1) {
        results.push(mapWeapon(i, src, now))
      }
    }
  }

  // Classes and their subclasses may coexist in the same file
  if (Array.isArray(raw.class)) {
    const allSubs = Array.isArray(raw.subclass) ? (raw.subclass as unknown[]) : []
    for (const cls of raw.class) {
      const c = cls as { name: string }
      const classSubs = allSubs.filter(
        (s) => (s as { className?: string }).className === c.name
      )
      results.push(mapClass(cls, classSubs, src, now))
      for (const sub of classSubs) {
        results.push(mapSubclass({ ...(sub as object), className: c.name }, src, now))
      }
    }
    // Subclasses for SRD classes (whose class entry isn't in this file)
    for (const sub of allSubs) {
      const s = sub as { name: string; className: string }
      const expectedId = `ext:subclass:${toSlug(s.name)}-${toSlug(s.className)}-${toSlug(src)}`
      if (!results.some((r) => r.id === expectedId)) {
        results.push(mapSubclass(sub, src, now))
      }
    }
  } else if (Array.isArray(raw.subclass)) {
    for (const sub of raw.subclass) results.push(mapSubclass(sub, src, now))
  }

  if (!results.length) {
    throw new Error(
      'Unrecognised JSON format — expected a ContentEntry array or a 5etools data file.'
    )
  }

  return results
}
```

- [ ] **Step 2: Commit**

```bash
git add src/renderer/src/lib/import/parseJson.ts
git commit -m "feat: add parseJson — auto-detect ContentEntry[] or 5etools JSON"
```

---

## Task 3: Create `JsonBatchReview.tsx`

**Files:**
- Create: `src/renderer/src/features/library/JsonBatchReview.tsx`

- [ ] **Step 1: Create the component**

Create `src/renderer/src/features/library/JsonBatchReview.tsx`:

```tsx
import { useState } from 'react'
import { Search, FileUp, Loader2 } from 'lucide-react'
import { useContentStore } from '@/lib/store/contentStore'
import { CONTENT_TYPE_LABELS, type ContentEntry, type ContentType } from '@/types/content'

const TYPE_ORDER: ContentType[] = [
  'spell', 'monster', 'item', 'weapon', 'condition',
  'class', 'subclass', 'feat', 'background', 'proficiency', 'worldentry', 'homebrew'
]

export function JsonBatchReview({
  drafts,
  sourceName,
  onClose
}: {
  drafts: ContentEntry[]
  sourceName: string
  onClose: () => void
}): JSX.Element {
  const bulkImport = useContentStore((s) => s.bulkImport)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    () => new Set(drafts.map((d) => d.id))
  )
  const [query, setQuery] = useState('')
  const [saving, setSaving] = useState(false)

  const q = query.toLowerCase()
  const filtered = q ? drafts.filter((d) => d.name.toLowerCase().includes(q)) : drafts

  const groups = TYPE_ORDER.map((type) => ({
    type,
    entries: filtered.filter((d) => d.type === type)
  })).filter((g) => g.entries.length > 0)

  const selectedCount = drafts.filter((d) => selectedIds.has(d.id)).length

  const toggleEntry = (id: string): void => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleGroup = (entries: ContentEntry[], allSelected: boolean): void => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      for (const e of entries) {
        if (allSelected) next.delete(e.id)
        else next.add(e.id)
      }
      return next
    })
  }

  const handleImport = async (): Promise<void> => {
    setSaving(true)
    try {
      await bulkImport(drafts.filter((d) => selectedIds.has(d.id)))
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-40 flex items-start justify-center overflow-y-auto bg-black/50 p-8">
      <div className="panel mt-[4vh] w-[600px]" onClick={(e) => e.stopPropagation()}>
        {/* header */}
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div>
            <h2 className="text-sm font-semibold text-ink">Review import</h2>
            <p className="text-xs text-ink-muted">
              {drafts.length} entries{sourceName ? ` · ${sourceName}` : ''}
            </p>
          </div>
          <div className="relative">
            <Search
              size={14}
              className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-muted"
            />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search…"
              className="input w-44 pl-8 text-xs"
            />
          </div>
        </div>

        {/* grouped list */}
        <div className="max-h-[60vh] divide-y divide-border overflow-y-auto">
          {groups.length === 0 ? (
            <p className="p-8 text-center text-sm text-ink-muted">No entries match your search.</p>
          ) : (
            groups.map(({ type, entries }) => {
              const allSelected = entries.every((e) => selectedIds.has(e.id))
              const anySelected = entries.some((e) => selectedIds.has(e.id))
              const groupSelectedCount = entries.filter((e) => selectedIds.has(e.id)).length
              return (
                <div key={type}>
                  <div className="flex items-center gap-2 bg-surface-2 px-4 py-2">
                    <input
                      type="checkbox"
                      checked={allSelected}
                      ref={(el) => {
                        if (el) el.indeterminate = !allSelected && anySelected
                      }}
                      onChange={() => toggleGroup(entries, allSelected)}
                    />
                    <span className="text-xs font-semibold text-ink">
                      {CONTENT_TYPE_LABELS[type]}
                    </span>
                    <span className="ml-auto text-xs text-ink-muted">
                      {groupSelectedCount}/{entries.length}
                    </span>
                  </div>
                  {entries.map((entry) => (
                    <label
                      key={entry.id}
                      className="flex cursor-pointer items-center gap-3 px-4 py-1.5 hover:bg-surface-2"
                    >
                      <input
                        type="checkbox"
                        checked={selectedIds.has(entry.id)}
                        onChange={() => toggleEntry(entry.id)}
                      />
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium text-ink">{entry.name}</div>
                        {entry.summary && (
                          <div className="truncate text-xs text-ink-muted">{entry.summary}</div>
                        )}
                      </div>
                    </label>
                  ))}
                </div>
              )
            })
          )}
        </div>

        {/* footer */}
        <div className="flex items-center justify-between border-t border-border px-4 py-3">
          <button type="button" className="btn-ghost" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button
            type="button"
            className="btn-accent"
            disabled={selectedCount === 0 || saving}
            onClick={() => void handleImport()}
          >
            {saving ? (
              <Loader2 size={15} className="animate-spin" />
            ) : (
              <FileUp size={15} />
            )}
            Import {selectedCount} selected
          </button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/renderer/src/features/library/JsonBatchReview.tsx
git commit -m "feat: add JsonBatchReview grouped checklist component"
```

---

## Task 4: Update `ImportDialog.tsx`

**Files:**
- Modify: `src/renderer/src/features/library/ImportDialog.tsx`

- [ ] **Step 1: Add imports for the new module and component**

At the top of `src/renderer/src/features/library/ImportDialog.tsx`, add two imports after the existing import block:

```ts
import { parseJson } from '@/lib/import/parseJson'
import { JsonBatchReview } from './JsonBatchReview'
```

- [ ] **Step 2: Add `'json-review'` to the `Phase` type**

Change line 13 from:
```ts
type Phase = 'pick' | 'parsing' | 'review' | 'error'
```
to:
```ts
type Phase = 'pick' | 'parsing' | 'review' | 'json-review' | 'error'
```

- [ ] **Step 3: Add `isJson` state**

Inside `ImportDialog`, after the existing `useState` declarations (around line 35), add:

```ts
const [isJson, setIsJson] = useState(false)
```

- [ ] **Step 4: Update the file `onChange` handler to set `isJson`**

The current file input's `onChange` is:
```tsx
onChange={(e) => {
  setFile(e.target.files?.[0] ?? null)
  setPhase('pick')
}}
```

Replace it with:
```tsx
onChange={(e) => {
  const f = e.target.files?.[0] ?? null
  setFile(f)
  setIsJson(f?.name.toLowerCase().endsWith('.json') ?? false)
  setPhase('pick')
}}
```

- [ ] **Step 5: Add `.json` to the file input `accept`**

Change:
```tsx
accept=".docx,.pdf,.txt,.md,.markdown"
```
to:
```tsx
accept=".docx,.pdf,.txt,.md,.markdown,.json"
```

- [ ] **Step 6: Conditionally hide split-strategy and Claude UI for JSON files**

The split-strategy section starts with `{!useClaude && (`. Wrap both the Claude toggle and the split section in `{!isJson && (`:

```tsx
{!isJson && (
  <>
    <label
      className={cn(
        'flex items-start gap-2 rounded-md border p-2.5',
        useClaude ? 'border-accent/60 bg-accent/10' : 'border-border',
        !hasKey && 'opacity-60'
      )}
    >
      <input
        type="checkbox"
        className="mt-0.5"
        checked={useClaude}
        disabled={!hasKey}
        onChange={(e) => setUseClaude(e.target.checked)}
      />
      <div>
        <div className="flex items-center gap-1.5 text-sm font-medium text-ink">
          <Sparkles size={14} className="text-accent" />
          Smart parse with Claude
        </div>
        <div className="text-xs text-ink-muted">
          {hasKey
            ? 'Claude reads the whole document and extracts correctly-typed entries — best for messy PDFs. Costs a few cents.'
            : 'Add an Anthropic key in Settings → AI to enable this.'}
        </div>
      </div>
    </label>

    {!useClaude && (
      <>
        <div>
          <label className="label">These entries are…</label>
          <select
            className="input"
            value={type}
            onChange={(e) => setType(e.target.value as ImportType)}
          >
            <option value="mixed">Mixed — best guess per entry</option>
            {CREATABLE_TYPES.map((t) => (
              <option key={t} value={t}>
                All {TEMPLATES[t].label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="label">Split into entries by</label>
          <div className="space-y-1.5">
            {STRATEGIES.map((opt) => (
              <label
                key={opt.value}
                className={cn(
                  'flex cursor-pointer gap-2 rounded-md border p-2 text-sm',
                  strategy === opt.value
                    ? 'border-accent/60 bg-accent/10'
                    : 'border-border hover:border-border-strong'
                )}
              >
                <input
                  type="radio"
                  name="strategy"
                  checked={strategy === opt.value}
                  onChange={() => setStrategy(opt.value)}
                  className="mt-0.5"
                />
                <div>
                  <div className="font-medium text-ink">{opt.label}</div>
                  <div className="text-xs text-ink-muted">{opt.desc}</div>
                </div>
              </label>
            ))}
          </div>
        </div>

        {strategy === 'table' && (
          <div className="flex items-start gap-2 rounded-md border border-info/40 bg-info/10 p-2.5 text-xs text-info">
            <Info size={14} className="mt-0.5 shrink-0" />
            Table mode reads Word (.docx) and markdown tables only — a PDF is just
            positioned text with no real table structure, so use Headings or Paragraphs for
            those.
          </div>
        )}
      </>
    )}
  </>
)}

{isJson && (
  <p className="rounded-md border border-border bg-surface-2 p-2.5 text-xs text-ink-muted">
    JSON files are parsed directly — no splitting needed.
  </p>
)}
```

- [ ] **Step 7: Fork `parse()` for JSON files**

Replace the existing `parse` function:

```ts
const parse = async (): Promise<void> => {
  if (!file) return
  setPhase('parsing')
  setError('')
  try {
    if (isJson) {
      const result = await parseJson(file, source.trim())
      setDrafts(result)
      setPhase('json-review')
      return
    }
    const doc = await extractText(file)
    let result = useClaude ? await smartParse(doc.text) : splitEntries(doc, strategy, type, file.name)
    const src = source.trim()
    if (src) result = result.map((e) => ({ ...e, world: src }))
    if (!result.length) {
      setError(
        useClaude
          ? 'Claude returned no entries — the document may be empty or not recognised.'
          : strategy === 'table'
            ? 'No table rows found — make sure the file has a table with a header row (Word or markdown), or pick a different split.'
            : 'No entries found — try a different split, or check the file has text in it.'
      )
      setPhase('error')
      return
    }
    setDrafts(result)
    setPhase('review')
  } catch (err) {
    setError(String(err))
    setPhase('error')
  }
}
```

- [ ] **Step 8: Render `JsonBatchReview` for the `'json-review'` phase**

The existing render block checks `phase === 'review'` to show `<ImportReview>`. Add `json-review` alongside it:

```tsx
{phase === 'review' ? (
  <ImportReview drafts={drafts} onClose={closeImport} />
) : phase === 'json-review' ? (
  <JsonBatchReview drafts={drafts} sourceName={source} onClose={closeImport} />
) : (
  <div className="panel w-[520px]">
    {/* … rest of the pick/parsing/error UI unchanged … */}
  </div>
)}
```

- [ ] **Step 9: Commit**

```bash
git add src/renderer/src/features/library/ImportDialog.tsx
git commit -m "feat: add JSON import path to ImportDialog"
```

---

## Task 5: Smoke-test in the running app

- [ ] **Step 1: Download test files**

Run the existing download script to get pre-converted JSON files into `~/Desktop/5etools-content/`:

```bash
node scripts/download-5etools.mjs
```

This outputs `spells.json`, `monsters.json`, `items.json`, `weapons.json`, `classes.json`, `subclasses.json`.

- [ ] **Step 2: Start the dev app**

```bash
npm run dev
```

- [ ] **Step 3: Test pre-converted ContentEntry[] import**

1. Open the Library → Import
2. Select `~/Desktop/5etools-content/spells.json`
3. Confirm: Claude toggle and split-strategy are hidden; the "JSON files are parsed directly" note is visible
4. Enter a source name (e.g. "Xanathar's")
5. Click "Parse & review"
6. Confirm: `JsonBatchReview` opens with a list of spells grouped under "Spell"
7. Deselect a few entries, click "Import N selected"
8. Confirm: entries appear in the Library under the "Xanathar's" source tab

- [ ] **Step 4: Test raw 5etools JSON import**

Download a non-PHB raw file from 5etools-src, e.g.:
```
https://raw.githubusercontent.com/5etools-mirror-3/5etools-src/main/data/spells/spells-xge.json
```
Save it to `~/Downloads/spells-xge.json`.

1. Open Library → Import
2. Select `~/Downloads/spells-xge.json`
3. Enter source name "Xanathar's Guide"
4. Click "Parse & review"
5. Confirm: entries appear in `JsonBatchReview`, all pre-selected
6. Import and verify they appear in the Library

- [ ] **Step 5: Test error case — bad JSON**

1. Create `~/Downloads/bad.json` with content `not json`
2. Try to import it
3. Confirm: error message "Not a valid JSON file." is shown

- [ ] **Step 6: Final commit**

```bash
git add -A
git commit -m "feat: JSON import — 5etools and ContentEntry[] files via grouped batch review"
```
