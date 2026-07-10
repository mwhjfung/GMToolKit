import type { ContentEntry, ContentType } from '@/types/content'

/**
 * The only place that talks to the Open5e API. Each fetcher returns fully
 * mapped ContentEntry objects so the rest of the app never sees raw API shapes.
 */

const BASE = 'https://api.open5e.com/v1'
const SRD_DOC = 'wotc-srd'

interface Open5eList<T> {
  count: number
  next: string | null
  results: T[]
}

async function fetchAllPages<T>(
  path: string,
  params: Record<string, string> = {}
): Promise<T[]> {
  const url = new URL(`${BASE}/${path}/`)
  url.searchParams.set('limit', '500')
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value)

  const results: T[] = []
  let next: string | null = url.toString()
  let guard = 0
  while (next && guard < 50) {
    const res = await fetch(next)
    if (!res.ok) throw new Error(`Open5e ${path} request failed (${res.status})`)
    const json = (await res.json()) as Open5eList<T>
    results.push(...json.results)
    next = json.next
    guard += 1
  }
  return results
}

// ---- helpers --------------------------------------------------------------

const now = (): number => Date.now()

function firstSentence(text: string, max = 150): string {
  if (!text) return ''
  const flat = text.replace(/\s+/g, ' ').trim()
  const dot = flat.indexOf('. ')
  const base = dot > 0 && dot < max ? flat.slice(0, dot + 1) : flat
  return base.length > max ? `${base.slice(0, max - 1).trimEnd()}…` : base
}

function tidySummary(parts: Array<string | undefined | false>): string {
  return parts.filter((p) => p && String(p).trim()).join(' · ')
}

function truthy(value: unknown): boolean {
  if (typeof value === 'boolean') return value
  if (typeof value === 'string') {
    const v = value.trim().toLowerCase()
    return v !== '' && v !== 'no' && v !== 'false'
  }
  return false
}

// ---- raw shapes (only the fields we read) ---------------------------------

interface RawSpell {
  slug: string
  name: string
  desc?: string
  higher_level?: string
  range?: string
  components?: string
  material?: string
  can_be_cast_as_ritual?: boolean
  ritual?: string
  duration?: string
  concentration?: string
  requires_concentration?: boolean
  casting_time?: string
  level?: string
  level_int?: number
  school?: string
  dnd_class?: string
}

interface RawStatEntry {
  name: string
  desc: string
}

interface RawMonster {
  slug: string
  name: string
  desc?: string
  size?: string
  type?: string
  alignment?: string
  armor_class?: number
  armor_desc?: string
  hit_points?: number
  hit_dice?: string
  speed?: Record<string, number | boolean>
  strength?: number
  dexterity?: number
  constitution?: number
  intelligence?: number
  wisdom?: number
  charisma?: number
  strength_save?: number | null
  dexterity_save?: number | null
  constitution_save?: number | null
  intelligence_save?: number | null
  wisdom_save?: number | null
  charisma_save?: number | null
  skills?: Record<string, number>
  senses?: string
  languages?: string
  damage_vulnerabilities?: string
  damage_resistances?: string
  damage_immunities?: string
  challenge_rating?: string
  special_abilities?: RawStatEntry[] | null
  actions?: RawStatEntry[] | null
  bonus_actions?: RawStatEntry[] | null
  reactions?: RawStatEntry[] | null
  legendary_desc?: string
  legendary_actions?: RawStatEntry[] | null
}

interface RawMagicItem {
  slug: string
  name: string
  type?: string
  desc?: string
  rarity?: string
  requires_attunement?: string
}

interface RawWeapon {
  slug: string
  name: string
  category?: string
  cost?: string
  damage_dice?: string
  damage_type?: string
  weight?: string
  properties?: string[]
}

interface RawCondition {
  slug: string
  name: string
  desc?: string
}

interface RawArchetype {
  slug: string
  name: string
  desc?: string
}

interface RawClass {
  slug: string
  name: string
  desc?: string
  hit_dice?: string
  prof_armor?: string
  prof_weapons?: string
  prof_skills?: string
  prof_saving_throws?: string
  spellcasting_ability?: string
  archetypes?: RawArchetype[]
}

// ---- mappers --------------------------------------------------------------

function mapSpell(r: RawSpell): ContentEntry {
  const ts = now()
  const level = r.level_int ?? 0
  const levelText = level === 0 ? 'Cantrip' : r.level || `Level ${level}`
  const classes = (r.dnd_class ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
  return {
    id: `srd:spell:${r.slug}`,
    type: 'spell',
    source: 'srd',
    slug: r.slug,
    name: r.name,
    summary: tidySummary([levelText, r.school, r.casting_time]),
    tags: r.school ? [r.school] : [],
    createdAt: ts,
    updatedAt: ts,
    data: {
      level,
      levelText,
      school: r.school ?? '',
      castingTime: r.casting_time ?? '',
      range: r.range ?? '',
      components: r.components ?? '',
      material: r.material || undefined,
      duration: r.duration ?? '',
      concentration: truthy(r.requires_concentration) || truthy(r.concentration),
      ritual: truthy(r.can_be_cast_as_ritual) || truthy(r.ritual),
      description: r.desc ?? '',
      higherLevel: r.higher_level || undefined,
      classes
    }
  }
}

function flattenSpeed(speed?: Record<string, number | boolean>): string {
  if (!speed) return ''
  return Object.entries(speed)
    .map(([mode, value]) =>
      typeof value === 'boolean' ? mode : mode === 'walk' ? `${value} ft.` : `${mode} ${value} ft.`
    )
    .join(', ')
}

function collectSaves(r: RawMonster): string {
  const map: Array<[string, number | null | undefined]> = [
    ['Str', r.strength_save],
    ['Dex', r.dexterity_save],
    ['Con', r.constitution_save],
    ['Int', r.intelligence_save],
    ['Wis', r.wisdom_save],
    ['Cha', r.charisma_save]
  ]
  return map
    .filter(([, v]) => v != null)
    .map(([k, v]) => `${k} ${(v as number) >= 0 ? '+' : ''}${v}`)
    .join(', ')
}

function collectSkills(skills?: Record<string, number>): string {
  if (!skills) return ''
  return Object.entries(skills)
    .map(([k, v]) => `${k[0].toUpperCase()}${k.slice(1)} ${v >= 0 ? '+' : ''}${v}`)
    .join(', ')
}

/** Open5e damage lists use ';' between qualifier groups, ',' inside them —
 * e.g. "fire; bludgeoning, piercing, and slashing from nonmagical attacks".
 * Split on ';' always; split a group on ',' only when it has no qualifier. */
function parseDamageList(raw: string | undefined): string[] {
  if (!raw?.trim()) return []
  return raw.split(';').flatMap((group) => {
    const g = group.trim()
    if (!g) return []
    if (g.includes(' from ')) return [g]
    return g.split(',').map((s) => s.replace(/^and /, '').trim()).filter(Boolean)
  })
}

function mapMonster(r: RawMonster): ContentEntry {
  const ts = now()
  const ac = `${r.armor_class ?? ''}${r.armor_desc ? ` (${r.armor_desc})` : ''}`.trim()
  const hp = `${r.hit_points ?? ''}${r.hit_dice ? ` (${r.hit_dice})` : ''}`.trim()
  return {
    id: `srd:monster:${r.slug}`,
    type: 'monster',
    source: 'srd',
    slug: r.slug,
    name: r.name,
    summary: tidySummary([
      [r.size, r.type].filter(Boolean).join(' '),
      r.challenge_rating ? `CR ${r.challenge_rating}` : '',
      ac ? `AC ${r.armor_class}` : '',
      r.hit_points ? `HP ${r.hit_points}` : ''
    ]),
    tags: [r.type, r.size].filter(Boolean) as string[],
    createdAt: ts,
    updatedAt: ts,
    data: {
      role: 'monster',
      size: r.size ?? '',
      creatureType: r.type ?? '',
      alignment: r.alignment ?? '',
      ac,
      hp,
      speed: flattenSpeed(r.speed),
      abilities: {
        str: r.strength ?? 10,
        dex: r.dexterity ?? 10,
        con: r.constitution ?? 10,
        int: r.intelligence ?? 10,
        wis: r.wisdom ?? 10,
        cha: r.charisma ?? 10
      },
      saves: collectSaves(r) || undefined,
      skills: collectSkills(r.skills) || undefined,
      senses: r.senses || undefined,
      languages: r.languages || undefined,
      vulnerabilities: parseDamageList(r.damage_vulnerabilities),
      resistances: parseDamageList(r.damage_resistances),
      immunities: parseDamageList(r.damage_immunities),
      cr: r.challenge_rating ?? '',
      traits: r.special_abilities ?? [],
      actions: r.actions ?? [],
      bonusActions: r.bonus_actions ?? [],
      reactions: r.reactions ?? [],
      legendaryActions: r.legendary_actions ?? [],
      legendaryDesc: r.legendary_desc || undefined,
      lore: r.desc || undefined
    }
  }
}

function mapMagicItem(r: RawMagicItem): ContentEntry {
  const ts = now()
  const attunement = truthy(r.requires_attunement)
  return {
    id: `srd:item:${r.slug}`,
    type: 'item',
    source: 'srd',
    slug: r.slug,
    name: r.name,
    summary: tidySummary([r.type || 'Wondrous item', r.rarity, attunement && 'attunement']),
    tags: r.rarity ? [r.rarity] : [],
    createdAt: ts,
    updatedAt: ts,
    data: {
      itemType: r.type ?? '',
      rarity: r.rarity ?? '',
      attunement,
      description: r.desc ?? ''
    }
  }
}

function mapWeapon(r: RawWeapon): ContentEntry {
  const ts = now()
  return {
    id: `srd:weapon:${r.slug}`,
    type: 'weapon',
    source: 'srd',
    slug: r.slug,
    name: r.name,
    summary: tidySummary([r.category, [r.damage_dice, r.damage_type].filter(Boolean).join(' ')]),
    tags: r.category ? [r.category] : [],
    createdAt: ts,
    updatedAt: ts,
    data: {
      damageDice: r.damage_dice ?? '',
      damageType: r.damage_type ?? '',
      properties: r.properties ?? [],
      weight: r.weight || undefined,
      cost: r.cost || undefined,
      category: r.category || undefined
    }
  }
}

function mapCondition(r: RawCondition): ContentEntry {
  const ts = now()
  return {
    id: `srd:condition:${r.slug}`,
    type: 'condition',
    source: 'srd',
    slug: r.slug,
    name: r.name,
    summary: firstSentence(r.desc ?? ''),
    tags: [],
    createdAt: ts,
    updatedAt: ts,
    data: { description: r.desc ?? '' }
  }
}

function mapClass(r: RawClass): ContentEntry {
  const ts = now()
  return {
    id: `srd:class:${r.slug}`,
    type: 'class',
    source: 'srd',
    slug: r.slug,
    name: r.name,
    summary: tidySummary([
      r.hit_dice ? `Hit die ${r.hit_dice}` : '',
      r.spellcasting_ability ? `casts with ${r.spellcasting_ability}` : ''
    ]),
    tags: [],
    createdAt: ts,
    updatedAt: ts,
    data: {
      hitDie: r.hit_dice ?? '',
      savingThrows: r.prof_saving_throws || undefined,
      proficiencies:
        [r.prof_armor, r.prof_weapons, r.prof_skills].filter(Boolean).join('; ') || undefined,
      spellcastingAbility: r.spellcasting_ability || undefined,
      description: r.desc ?? '',
      subclasses: (r.archetypes ?? []).map((a) => a.name)
    }
  }
}

function mapSubclasses(r: RawClass): ContentEntry[] {
  const ts = now()
  return (r.archetypes ?? []).map((a) => ({
    id: `srd:subclass:${a.slug}`,
    type: 'subclass',
    source: 'srd',
    slug: a.slug,
    name: a.name,
    summary: `${r.name} subclass`,
    tags: [r.name],
    createdAt: ts,
    updatedAt: ts,
    data: { parentClass: r.name, description: a.desc ?? '' }
  }))
}

// ---- per-type fetchers ----------------------------------------------------

async function fetchSpells(): Promise<ContentEntry[]> {
  const raw = await fetchAllPages<RawSpell>('spells', { document__slug: SRD_DOC })
  return raw.map(mapSpell)
}

async function fetchMonsters(): Promise<ContentEntry[]> {
  const raw = await fetchAllPages<RawMonster>('monsters', { document__slug: SRD_DOC })
  return raw.map(mapMonster)
}

async function fetchMagicItems(): Promise<ContentEntry[]> {
  const raw = await fetchAllPages<RawMagicItem>('magicitems', { document__slug: SRD_DOC })
  return raw.map(mapMagicItem)
}

async function fetchWeapons(): Promise<ContentEntry[]> {
  const raw = await fetchAllPages<RawWeapon>('weapons')
  return raw.map(mapWeapon)
}

async function fetchConditions(): Promise<ContentEntry[]> {
  const raw = await fetchAllPages<RawCondition>('conditions')
  return raw.map(mapCondition)
}

async function fetchClasses(): Promise<ContentEntry[]> {
  const raw = await fetchAllPages<RawClass>('classes')
  return raw.flatMap((r) => [mapClass(r), ...mapSubclasses(r)])
}

export interface SrdGroup {
  /** Coarse label used for sync progress; not a strict ContentType. */
  label: string
  types: ContentType[]
  fetch: () => Promise<ContentEntry[]>
}

export const SRD_GROUPS: SrdGroup[] = [
  { label: 'Spells', types: ['spell'], fetch: fetchSpells },
  { label: 'Monsters', types: ['monster'], fetch: fetchMonsters },
  { label: 'Magic items', types: ['item'], fetch: fetchMagicItems },
  { label: 'Weapons', types: ['weapon'], fetch: fetchWeapons },
  { label: 'Conditions', types: ['condition'], fetch: fetchConditions },
  { label: 'Classes & subclasses', types: ['class', 'subclass'], fetch: fetchClasses }
]
