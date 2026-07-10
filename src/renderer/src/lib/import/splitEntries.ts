import { HEADING_MARK, type ExtractedDoc } from './extractText'
import { parseFields, splitDamage } from './parseFields'
import { makeNewEntry, recomputeSummary, TEMPLATES } from '@/lib/templates/schemas'
import type { ContentEntry, ContentType } from '@/types/content'

export type SplitStrategy = 'table' | 'headings' | 'paragraphs' | 'single'

interface RawEntry {
  name: string
  body: string
}

const STOPWORDS = new Set(['of', 'the', 'and', 'a', 'an', 'to', 'in', 'with', 'on'])

function looksLikeHeading(line: string): boolean {
  const t = line.trim()
  if (!t || t.length > 60) return false
  if (/[.!?,:;]$/.test(t)) return false
  const words = t.split(/\s+/)
  if (words.length > 9) return false
  const isAllCaps = /[A-Z]/.test(t) && t === t.toUpperCase()
  const isTitleCase = words.every(
    (w) => /^[A-Z0-9("']/.test(w) || STOPWORDS.has(w.toLowerCase())
  )
  return isAllCaps || isTitleCase
}

function splitByHeadings(text: string): RawEntry[] {
  const lines = text.split('\n')
  const hasMarks = lines.some((l) => l.startsWith(HEADING_MARK))
  const entries: RawEntry[] = []
  let current: RawEntry | null = null

  for (const rawLine of lines) {
    const isMark = rawLine.startsWith(HEADING_MARK)
    const line = isMark ? rawLine.slice(HEADING_MARK.length) : rawLine
    const isHeading = line.trim() !== '' && (isMark || (!hasMarks && looksLikeHeading(line)))
    if (isHeading) {
      if (current) entries.push(current)
      current = { name: line.trim(), body: '' }
    } else if (current) {
      current.body += (current.body ? '\n' : '') + line
    } else if (line.trim()) {
      current = { name: line.trim().slice(0, 60), body: '' }
    }
  }
  if (current) entries.push(current)
  return entries.map((e) => ({ name: e.name, body: e.body.trim() })).filter((e) => e.name)
}

function splitByParagraphs(text: string): RawEntry[] {
  return text
    .replace(new RegExp(HEADING_MARK, 'g'), '')
    .split(/\n\s*\n/)
    .map((b) => b.trim())
    .filter(Boolean)
    .map((block) => {
      const lines = block.split('\n')
      return {
        name: (lines[0] ?? '').trim().slice(0, 80),
        body: lines.slice(1).join('\n').trim()
      }
    })
    .filter((e) => e.name)
}

function splitSingle(text: string, fallbackName: string): RawEntry[] {
  return [{ name: fallbackName, body: text.replace(new RegExp(HEADING_MARK, 'g'), '').trim() }]
}

function firstSentence(s: string, max = 120): string {
  const flat = s.replace(/\s+/g, ' ').trim()
  if (!flat) return ''
  const dot = flat.indexOf('. ')
  const base = dot > 0 && dot < max ? flat.slice(0, dot + 1) : flat
  return base.length > max ? `${base.slice(0, max - 1)}…` : base
}

function applyBody(entry: ContentEntry, body: string): void {
  const data = entry.data as unknown as Record<string, unknown>
  if (entry.type === 'monster') data.lore = body
  else if (entry.type === 'weapon') entry.notes = body
  else data.description = body
}

function makeDraft(type: ContentType, name: string, body: string): ContentEntry {
  const entry = makeNewEntry(type)
  entry.name = name
  applyBody(entry, body)
  Object.assign(entry.data as unknown as Record<string, unknown>, parseFields(type, body))
  entry.summary = recomputeSummary(entry) || firstSentence(body)
  return entry
}

// ---- table import ---------------------------------------------------------

type Target =
  | { slot: 'name' }
  | { slot: 'tags' }
  | { slot: 'world' }
  | { slot: 'notes' }
  | { slot: 'desc' }
  | { slot: 'data'; key: string; multi?: boolean; number?: boolean; bool?: boolean }

const COMMON: Record<string, Target> = {
  name: { slot: 'name' },
  title: { slot: 'name' },
  tags: { slot: 'tags' },
  source: { slot: 'world' },
  world: { slot: 'world' },
  notes: { slot: 'notes' },
  description: { slot: 'desc' },
  desc: { slot: 'desc' },
  effect: { slot: 'desc' },
  effects: { slot: 'desc' },
  lore: { slot: 'desc' }
}

const BY_TYPE: Partial<Record<ContentType, Record<string, Target>>> = {
  weapon: {
    weapon: { slot: 'name' },
    damage: { slot: 'data', key: 'damageDice' },
    dmg: { slot: 'data', key: 'damageDice' },
    'damage dice': { slot: 'data', key: 'damageDice' },
    'damage type': { slot: 'data', key: 'damageType' },
    'dmg type': { slot: 'data', key: 'damageType' },
    type: { slot: 'data', key: 'damageType' },
    properties: { slot: 'data', key: 'properties', multi: true },
    property: { slot: 'data', key: 'properties', multi: true },
    'weapon properties': { slot: 'data', key: 'properties', multi: true },
    traits: { slot: 'data', key: 'properties', multi: true },
    props: { slot: 'data', key: 'properties', multi: true },
    weight: { slot: 'data', key: 'weight' },
    cost: { slot: 'data', key: 'cost' },
    price: { slot: 'data', key: 'cost' },
    category: { slot: 'data', key: 'category' },
    rarity: { slot: 'data', key: 'rarity' },
    attunement: { slot: 'data', key: 'attunement', bool: true }
  },
  monster: {
    monster: { slot: 'name' },
    creature: { slot: 'name' },
    ac: { slot: 'data', key: 'ac' },
    'armor class': { slot: 'data', key: 'ac' },
    'armour class': { slot: 'data', key: 'ac' },
    hp: { slot: 'data', key: 'hp' },
    'hit points': { slot: 'data', key: 'hp' },
    speed: { slot: 'data', key: 'speed' },
    cr: { slot: 'data', key: 'cr' },
    challenge: { slot: 'data', key: 'cr' },
    'challenge rating': { slot: 'data', key: 'cr' },
    saves: { slot: 'data', key: 'saves' },
    'saving throws': { slot: 'data', key: 'saves' },
    skills: { slot: 'data', key: 'skills' },
    senses: { slot: 'data', key: 'senses' },
    languages: { slot: 'data', key: 'languages' },
    size: { slot: 'data', key: 'size' },
    type: { slot: 'data', key: 'creatureType' },
    alignment: { slot: 'data', key: 'alignment' }
  },
  spell: {
    spell: { slot: 'name' },
    level: { slot: 'data', key: 'level', number: true },
    school: { slot: 'data', key: 'school' },
    'casting time': { slot: 'data', key: 'castingTime' },
    range: { slot: 'data', key: 'range' },
    components: { slot: 'data', key: 'components' },
    duration: { slot: 'data', key: 'duration' },
    classes: { slot: 'data', key: 'classes', multi: true }
  },
  item: {
    item: { slot: 'name' },
    type: { slot: 'data', key: 'itemType' },
    rarity: { slot: 'data', key: 'rarity' },
    attunement: { slot: 'data', key: 'attunement', bool: true },
    charges: { slot: 'data', key: 'charges' }
  }
}

function normHeader(h: string): string {
  return h.toLowerCase().replace(/\s+/g, ' ').trim()
}

function fieldTarget(field: { key: string; kind: string }): Target {
  return {
    slot: 'data',
    key: field.key,
    multi: field.kind === 'tags' || field.kind === 'csv',
    number: field.kind === 'number',
    bool: field.kind === 'boolean'
  }
}

function matchHeader(header: string, type: ContentType): Target | null {
  const h = normHeader(header)
  const typed = BY_TYPE[type]?.[h]
  if (typed) return typed
  if (COMMON[h]) return COMMON[h]
  // Exact match against the template's own field labels/keys.
  for (const field of TEMPLATES[type].fields) {
    if (normHeader(field.label) === h || field.key.toLowerCase() === h) return fieldTarget(field)
  }
  // Last resort: whole-word containment ("Weapon Properties" → properties).
  const synonyms = { ...COMMON, ...(BY_TYPE[type] ?? {}) }
  const escape = (s: string): string => s.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')
  for (const key of Object.keys(synonyms).sort((a, b) => b.length - a.length)) {
    if (new RegExp(`\\b${escape(key)}\\b`).test(h)) return synonyms[key]
  }
  for (const field of TEMPLATES[type].fields) {
    if (h.includes(normHeader(field.label))) return fieldTarget(field)
  }
  return null
}

function splitList(cell: string): string[] {
  return cell
    .split(/[,;\n]/)
    .map((s) => s.trim())
    .filter(Boolean)
}

function appendLine(existing: string | undefined, line: string): string {
  return existing ? `${existing}\n${line}` : line
}

function buildFromRow(
  type: ContentType,
  headers: string[],
  targets: Array<Target | null>,
  row: string[]
): ContentEntry | null {
  const entry = makeNewEntry(type)
  const data = entry.data as unknown as Record<string, unknown>
  const unmapped: string[] = []
  let name = ''

  headers.forEach((header, i) => {
    const cell = (row[i] ?? '').trim()
    if (!cell) return
    const target = targets[i]
    if (!target) {
      unmapped.push(`${header}: ${cell}`)
      return
    }
    switch (target.slot) {
      case 'name':
        name = cell
        break
      case 'tags':
        entry.tags = splitList(cell)
        break
      case 'world':
        entry.world = cell
        break
      case 'notes':
        entry.notes = appendLine(entry.notes, cell)
        break
      case 'desc':
        applyBody(entry, cell)
        break
      case 'data':
        if (target.multi) data[target.key] = splitList(cell)
        else if (target.number) data[target.key] = Number(cell.replace(/[^0-9.-]/g, '')) || 0
        else if (target.bool) data[target.key] = /^(y|yes|true|1|x|✓|✔|requires)/i.test(cell)
        else data[target.key] = cell
        break
    }
  })

  if (!name) return null
  entry.name = name
  if (unmapped.length) entry.notes = appendLine(entry.notes, unmapped.join('\n'))
  // Split a combined "1d4 bludgeoning" damage cell when there's no separate type column.
  if (type === 'weapon' && typeof data.damageDice === 'string' && !data.damageType) {
    const { dice, type: dtype } = splitDamage(data.damageDice)
    if (dtype) {
      data.damageDice = dice
      data.damageType = dtype
    }
  }
  if (type === 'spell' && typeof data.level === 'number') {
    data.levelText = data.level === 0 ? 'Cantrip' : `Level ${data.level}`
  }
  entry.summary = recomputeSummary(entry)
  return entry
}

function splitFromTables(tables: string[][][], type: ContentType): ContentEntry[] {
  const out: ContentEntry[] = []
  for (const table of tables) {
    if (table.length < 2) continue
    const headers = table[0].map((h) => h.trim())
    const targets = headers.map((h) => matchHeader(h, type))
    if (!targets.some((t) => t?.slot === 'name')) targets[0] = { slot: 'name' }
    for (let r = 1; r < table.length; r += 1) {
      const entry = buildFromRow(type, headers, targets, table[r])
      if (entry) out.push(entry)
    }
  }
  return out
}

// ---- type guessing (for "Mixed" imports) ----------------------------------

export type ImportType = ContentType | 'mixed'

function guessType(name: string, body: string): ContentType {
  const t = `${name}\n${body}`.toLowerCase()
  const score: Record<ContentType, number> = {
    spell: 0,
    monster: 0,
    item: 0,
    weapon: 0,
    condition: 0,
    class: 0,
    subclass: 0,
    proficiency: 0,
    worldentry: 0,
    feat: 0,
    background: 0,
    homebrew: 0,
    action: 0
  }
  if (/\bcasting time\b/.test(t)) score.spell += 2
  if (/\b\d+(?:st|nd|rd|th)[-\s]level\b/.test(t) || /\bcantrip\b/.test(t)) score.spell += 2
  if (/\b(abjuration|conjuration|divination|enchantment|evocation|illusion|necromancy|transmutation)\b/.test(t))
    score.spell += 2
  if (/\bat higher levels\b/.test(t)) score.spell += 1

  if (/\barmou?r class\b/.test(t)) score.monster += 2
  if (/\bhit points\b/.test(t)) score.monster += 2
  if (/\bchallenge\b/.test(t)) score.monster += 1
  if (/\b\d{1,2}\s*\([+-]\d+\)/.test(t)) score.monster += 2

  if (/\b\d+d\d+\b/.test(t) && /\b(piercing|slashing|bludgeoning)\b/.test(t)) score.weapon += 2
  if (/\b(two-handed|finesse|versatile|ammunition|thrown|reach|loading)\b/.test(t)) score.weapon += 1

  if (/\b(very rare|uncommon|legendary|artifact|wondrous item)\b/.test(t)) score.item += 2
  if (/\brequires attunement\b/.test(t)) score.item += 2

  let best: ContentType = 'spell'
  let bestScore = 0
  for (const k of Object.keys(score) as ContentType[]) {
    if (score[k] > bestScore) {
      bestScore = score[k]
      best = k
    }
  }
  return bestScore > 0 ? best : 'spell'
}

function guessTypeFromHeaders(headers: string[]): ContentType {
  const h = headers.map((x) => x.toLowerCase()).join(' ')
  if (/armou?r class|hit points|challenge/.test(h)) return 'monster'
  if (/casting time|\bschool\b|\bcomponents\b|spell level/.test(h)) return 'spell'
  if (/\bdamage\b|propert/.test(h)) return 'weapon'
  if (/rarity|attunement/.test(h)) return 'item'
  return 'spell'
}

// ---- entry point ----------------------------------------------------------

export function splitEntries(
  doc: ExtractedDoc,
  strategy: SplitStrategy,
  type: ImportType,
  fileName: string
): ContentEntry[] {
  if (strategy === 'table') {
    const resolved =
      type === 'mixed' ? guessTypeFromHeaders(doc.tables[0]?.[0] ?? []) : type
    return splitFromTables(doc.tables, resolved)
  }

  let raws: RawEntry[]
  if (strategy === 'single') raws = splitSingle(doc.text, fileName.replace(/\.[^.]+$/, ''))
  else if (strategy === 'paragraphs') raws = splitByParagraphs(doc.text)
  else raws = splitByHeadings(doc.text)
  return raws.map((r) => makeDraft(type === 'mixed' ? guessType(r.name, r.body) : type, r.name, r.body))
}
