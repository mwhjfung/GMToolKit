import type { ContentEntry, ContentType, WorldEntryKind } from '@/types/content'

export type FieldKind =
  | 'text'
  | 'textarea'
  | 'number'
  | 'select'
  | 'boolean'
  | 'markdown'
  | 'csv'
  | 'tag'
  | 'tags'
  | 'abilities'
  | 'statblocks'
  | 'features'
  | 'leveledSpells'

export interface FieldDef {
  key: string
  label: string
  kind: FieldKind
  options?: readonly string[]
  placeholder?: string
}

export interface TemplateDef {
  type: ContentType
  label: string
  description: string
  fields: FieldDef[]
}

export const SCHOOLS = [
  'Abjuration',
  'Conjuration',
  'Divination',
  'Enchantment',
  'Evocation',
  'Illusion',
  'Necromancy',
  'Transmutation'
] as const

export const RARITIES = ['Common', 'Uncommon', 'Rare', 'Very Rare', 'Legendary', 'Artifact'] as const
export const SIZES = ['Tiny', 'Small', 'Medium', 'Large', 'Huge', 'Gargantuan'] as const
export const DAMAGE_TYPES = [
  'Acid',
  'Bludgeoning',
  'Cold',
  'Fire',
  'Force',
  'Lightning',
  'Necrotic',
  'Piercing',
  'Poison',
  'Psychic',
  'Radiant',
  'Slashing',
  'Thunder'
] as const
export const WEAPON_PROPERTIES = [
  'Ammunition',
  'Finesse',
  'Heavy',
  'Light',
  'Loading',
  'Range',
  'Reach',
  'Special',
  'Thrown',
  'Two-handed',
  'Versatile'
] as const
export const WEAPON_CATEGORIES = [
  'Simple Melee',
  'Simple Ranged',
  'Martial Melee',
  'Martial Ranged'
] as const
export const PROFICIENCIES = [
  'Light armor',
  'Medium armor',
  'Heavy armor',
  'Shields',
  'Simple weapons',
  'Martial weapons'
] as const
export const PROFICIENCY_CATEGORIES = [
  'Armor',
  'Weapon',
  'Tool',
  'Skill',
  'Saving Throw',
  'Language',
  'Other'
] as const
export const WORLD_KINDS: readonly WorldEntryKind[] = [
  'Location',
  'Faction',
  'Event',
  'Deity',
  'Plane'
]

export const TEMPLATES: Record<ContentType, TemplateDef> = {
  spell: {
    type: 'spell',
    label: 'Spell',
    description: 'A spell with level, school, casting details and effect.',
    fields: [
      { key: 'level', label: 'Level (0 = cantrip)', kind: 'number' },
      { key: 'school', label: 'School', kind: 'select', options: SCHOOLS },
      { key: 'castingTime', label: 'Casting time', kind: 'text', placeholder: '1 action' },
      { key: 'range', label: 'Range', kind: 'text', placeholder: '60 feet' },
      { key: 'components', label: 'Components', kind: 'text', placeholder: 'V, S, M' },
      { key: 'material', label: 'Material', kind: 'text' },
      { key: 'duration', label: 'Duration', kind: 'text', placeholder: 'Instantaneous' },
      { key: 'concentration', label: 'Concentration', kind: 'boolean' },
      { key: 'ritual', label: 'Ritual', kind: 'boolean' },
      { key: 'classes', label: 'Classes', kind: 'csv', placeholder: 'Wizard, Sorcerer' },
      { key: 'description', label: 'Description', kind: 'markdown' },
      { key: 'higherLevel', label: 'At higher levels', kind: 'markdown' }
    ]
  },
  monster: {
    type: 'monster',
    label: 'Monster / NPC',
    description: 'A stat block for a creature or named NPC.',
    fields: [
      { key: 'role', label: 'Role', kind: 'select', options: ['monster', 'npc'] },
      { key: 'size', label: 'Size', kind: 'select', options: SIZES },
      { key: 'creatureType', label: 'Type', kind: 'text', placeholder: 'aberration' },
      { key: 'alignment', label: 'Alignment', kind: 'text', placeholder: 'lawful evil' },
      { key: 'ac', label: 'Armour Class', kind: 'text', placeholder: '18 (natural armor)' },
      { key: 'hp', label: 'Hit Points', kind: 'text', placeholder: '180 (19d10 + 76)' },
      { key: 'speed', label: 'Speed', kind: 'text', placeholder: '10 ft., fly 20 ft. (hover)' },
      { key: 'abilities', label: 'Ability scores', kind: 'abilities' },
      { key: 'saves', label: 'Saving throws', kind: 'text' },
      { key: 'skills', label: 'Skills', kind: 'text' },
      { key: 'senses', label: 'Senses', kind: 'text' },
      { key: 'languages', label: 'Languages', kind: 'text' },
      { key: 'vulnerabilities', label: 'Damage vulnerabilities', kind: 'tags', options: DAMAGE_TYPES },
      { key: 'resistances', label: 'Damage resistances', kind: 'tags', options: DAMAGE_TYPES },
      { key: 'immunities', label: 'Damage immunities', kind: 'tags', options: DAMAGE_TYPES },
      { key: 'cr', label: 'Challenge', kind: 'text', placeholder: '13' },
      { key: 'spellcastingAbility', label: 'Spellcasting ability', kind: 'select', options: ['Strength', 'Dexterity', 'Constitution', 'Intelligence', 'Wisdom', 'Charisma'] },
      { key: 'spellSaveDc', label: 'Spell save DC', kind: 'text', placeholder: '15' },
      { key: 'spellAttackBonus', label: 'Spell attack bonus', kind: 'text', placeholder: '+7' },
      { key: 'spellsByLevel', label: 'Spells by level', kind: 'leveledSpells' },
      { key: 'traits', label: 'Traits', kind: 'statblocks' },
      { key: 'actions', label: 'Actions', kind: 'statblocks' },
      { key: 'bonusActions', label: 'Bonus actions', kind: 'statblocks' },
      { key: 'reactions', label: 'Reactions', kind: 'statblocks' },
      { key: 'legendaryDesc', label: 'Legendary actions intro', kind: 'textarea' },
      { key: 'legendaryActions', label: 'Legendary actions', kind: 'statblocks' },
      { key: 'lore', label: 'Lore', kind: 'markdown' }
    ]
  },
  item: {
    type: 'item',
    label: 'Item / Magic Item',
    description: 'A piece of gear or a magic item.',
    fields: [
      { key: 'itemType', label: 'Type', kind: 'text', placeholder: 'Wondrous item' },
      { key: 'rarity', label: 'Rarity', kind: 'tag', options: RARITIES },
      { key: 'attunement', label: 'Requires attunement', kind: 'boolean' },
      { key: 'charges', label: 'Charges', kind: 'text' },
      { key: 'description', label: 'Description', kind: 'markdown' },
      { key: 'effects', label: 'Effects', kind: 'markdown' }
    ]
  },
  weapon: {
    type: 'weapon',
    label: 'Weapon',
    description: 'A weapon with damage and properties.',
    fields: [
      { key: 'damageDice', label: 'Damage dice', kind: 'text', placeholder: '1d8' },
      { key: 'damageType', label: 'Damage type', kind: 'tag', options: DAMAGE_TYPES },
      { key: 'properties', label: 'Properties', kind: 'tags', options: WEAPON_PROPERTIES },
      { key: 'weight', label: 'Weight', kind: 'text' },
      { key: 'cost', label: 'Cost', kind: 'text' },
      { key: 'category', label: 'Category', kind: 'tag', options: WEAPON_CATEGORIES },
      { key: 'rarity', label: 'Rarity', kind: 'tag', options: RARITIES },
      { key: 'attunement', label: 'Requires attunement', kind: 'boolean' }
    ]
  },
  condition: {
    type: 'condition',
    label: 'Condition',
    description: 'A status condition and how it works.',
    fields: [
      { key: 'description', label: 'Description', kind: 'markdown' },
      { key: 'effects', label: 'Effects', kind: 'markdown' },
      { key: 'howToRemove', label: 'How to remove', kind: 'markdown' }
    ]
  },
  class: {
    type: 'class',
    label: 'Class',
    description: 'A character class.',
    fields: [
      { key: 'hitDie', label: 'Hit die', kind: 'text', placeholder: 'd8' },
      { key: 'primaryAbility', label: 'Primary ability', kind: 'text' },
      { key: 'savingThrows', label: 'Saving throws', kind: 'text' },
      { key: 'spellcastingAbility', label: 'Spellcasting ability', kind: 'text' },
      { key: 'proficiencies', label: 'Proficiencies', kind: 'textarea' },
      { key: 'bonusProficiencies', label: 'Bonus proficiencies', kind: 'tags', options: PROFICIENCIES },
      { key: 'subclasses', label: 'Subclasses', kind: 'csv' },
      { key: 'features', label: 'Features by level', kind: 'features' },
      { key: 'spellsByLevel', label: 'Spells by level', kind: 'leveledSpells' },
      { key: 'description', label: 'Description', kind: 'markdown' }
    ]
  },
  subclass: {
    type: 'subclass',
    label: 'Subclass',
    description: 'A subclass under a parent class.',
    fields: [
      { key: 'parentClass', label: 'Parent class', kind: 'text' },
      { key: 'bonusProficiencies', label: 'Bonus proficiencies', kind: 'tags', options: PROFICIENCIES },
      { key: 'features', label: 'Features by level', kind: 'features' },
      { key: 'spellsByLevel', label: 'Spells by level', kind: 'leveledSpells' },
      { key: 'description', label: 'Description', kind: 'markdown' }
    ]
  },
  proficiency: {
    type: 'proficiency',
    label: 'Proficiency',
    description: 'A proficiency — armour, weapon, tool, skill, language and the like.',
    fields: [
      { key: 'category', label: 'Category', kind: 'select', options: PROFICIENCY_CATEGORIES },
      { key: 'description', label: 'Description', kind: 'markdown' }
    ]
  },
  worldentry: {
    type: 'worldentry',
    label: 'World Entry',
    description: 'A location, faction, event, deity or plane in your world.',
    fields: [
      { key: 'entryType', label: 'Kind', kind: 'select', options: WORLD_KINDS },
      { key: 'connections', label: 'Connections', kind: 'csv' },
      { key: 'description', label: 'Description', kind: 'markdown' }
    ]
  },
  feat: {
    type: 'feat',
    label: 'Feat',
    description: 'A character feat with optional mechanical bonuses.',
    fields: [
      { key: 'prerequisite', label: 'Prerequisite', kind: 'text', placeholder: '4th level or higher' },
      { key: 'description', label: 'Description', kind: 'markdown' },
      { key: 'initiativeBonus', label: 'Initiative bonus', kind: 'number' },
      { key: 'acBonus', label: 'AC bonus', kind: 'number' },
      { key: 'speedBonus', label: 'Speed bonus (ft)', kind: 'number' },
      { key: 'passivePerceptionBonus', label: 'Passive Perception bonus', kind: 'number' },
      { key: 'passiveInvestigationBonus', label: 'Passive Investigation bonus', kind: 'number' }
    ]
  },
  background: {
    type: 'background',
    label: 'Background',
    description: 'A character background — Acolyte, Soldier, Sage and the like.',
    fields: [
      { key: 'skillProficiencies', label: 'Skill proficiencies', kind: 'text' },
      { key: 'toolProficiencies', label: 'Tool proficiencies', kind: 'text' },
      { key: 'languages', label: 'Languages', kind: 'text' },
      { key: 'equipment', label: 'Starting equipment', kind: 'text' },
      { key: 'feature', label: 'Feature name', kind: 'text' },
      { key: 'featureDescription', label: 'Feature description', kind: 'textarea' },
      { key: 'description', label: 'Description / personality tables', kind: 'markdown' }
    ]
  },
  homebrew: {
    type: 'homebrew',
    label: 'Homebrew',
    description: 'Custom homebrew content — rules, items, lore, anything.',
    fields: [
      { key: 'category', label: 'Category', kind: 'text', placeholder: 'House rule, variant, etc.' },
      { key: 'description', label: 'Description', kind: 'markdown' }
    ]
  },
  action: {
    type: 'action',
    label: 'Action',
    description: 'A combat action, bonus action, reaction or other ability.',
    fields: [
      { key: 'range', label: 'Range / reach', kind: 'text', placeholder: '5 ft.' },
      { key: 'description', label: 'Description', kind: 'markdown' }
    ]
  }
}

export const CREATABLE_TYPES: ContentType[] = (Object.keys(TEMPLATES) as ContentType[]).filter(
  (t) => t !== 'homebrew'
)

const uuid = (): string =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`

/**
 * Given the names of an entry's siblings (e.g. same-type content) and the
 * name being duplicated, returns the next "Base N" name. Strips any existing
 * trailing " N" from the source name first, so duplicating a duplicate
 * increments cleanly instead of stacking numbers.
 */
export function nextDuplicateName(existingNames: string[], name: string): string {
  const trimmed = name.trim()
  const sourceMatch = trimmed.match(/^(.*)\s+(\d+)$/)
  const base = sourceMatch ? sourceMatch[1] : trimmed
  const baseLower = base.toLowerCase()

  let max = 1
  for (const n of existingNames) {
    const m = n.trim().match(/^(.*)\s+(\d+)$/)
    const nBase = (m ? m[1] : n.trim()).toLowerCase()
    if (nBase !== baseLower) continue
    const num = m ? parseInt(m[2], 10) : 1
    if (num > max) max = num
  }
  return `${base} ${max + 1}`
}

export function makeNewEntry(type: ContentType): ContentEntry {
  const ts = Date.now()
  const base = {
    id: `custom:${uuid()}`,
    source: 'custom' as const,
    name: '',
    summary: '',
    tags: [] as string[],
    notes: '',
    world: '',
    createdAt: ts,
    updatedAt: ts
  }
  switch (type) {
    case 'spell':
      return {
        ...base,
        type,
        data: {
          level: 1,
          levelText: 'Level 1',
          school: '',
          castingTime: '',
          range: '',
          components: '',
          duration: '',
          concentration: false,
          ritual: false,
          description: '',
          classes: []
        }
      }
    case 'monster':
      return {
        ...base,
        type,
        data: {
          role: 'npc',
          size: 'Medium',
          creatureType: '',
          alignment: '',
          ac: '',
          hp: '',
          speed: '',
          abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
          vulnerabilities: [],
          resistances: [],
          immunities: [],
          cr: '',
          spellsByLevel: [],
          traits: [],
          actions: [],
          bonusActions: [],
          reactions: [],
          legendaryActions: []
        }
      }
    case 'item':
      return {
        ...base,
        type,
        data: { itemType: '', rarity: '', attunement: false, description: '' }
      }
    case 'weapon':
      return {
        ...base,
        type,
        data: { damageDice: '', damageType: '', properties: [] }
      }
    case 'condition':
      return { ...base, type, data: { description: '' } }
    case 'class':
      return {
        ...base,
        type,
        data: {
          hitDie: '',
          description: '',
          subclasses: [],
          bonusProficiencies: [],
          features: [],
          spellsByLevel: []
        }
      }
    case 'subclass':
      return {
        ...base,
        type,
        data: {
          parentClass: '',
          description: '',
          bonusProficiencies: [],
          features: [],
          spellsByLevel: []
        }
      }
    case 'proficiency':
      return { ...base, type, data: { category: '', description: '' } }
    case 'worldentry':
      return { ...base, type, data: { entryType: 'Location', description: '', connections: [] } }
    case 'feat':
      return { ...base, type, data: { prerequisite: '', description: '' } }
    case 'background':
      return { ...base, type, data: { description: '', feature: '', featureDescription: '' } }
    case 'homebrew':
      return { ...base, type, data: { category: '', description: '' } }
    case 'action':
      return { ...base, type, data: { range: '', description: '' } }
  }
}

function tidy(parts: Array<string | undefined | false>): string {
  return parts.filter((p) => p && String(p).trim()).join(' · ')
}

export function recomputeSummary(entry: ContentEntry): string {
  switch (entry.type) {
    case 'spell': {
      const d = entry.data
      return tidy([d.level === 0 ? 'Cantrip' : `Level ${d.level}`, d.school, d.castingTime])
    }
    case 'monster': {
      const d = entry.data
      return tidy([
        [d.size, d.creatureType].filter(Boolean).join(' '),
        d.cr && `CR ${d.cr}`,
        d.role === 'npc' && 'NPC'
      ])
    }
    case 'item': {
      const d = entry.data
      return tidy([d.itemType || 'Item', d.rarity, d.attunement && 'attunement'])
    }
    case 'weapon': {
      const d = entry.data
      return tidy([d.category, [d.damageDice, d.damageType].filter(Boolean).join(' ')])
    }
    case 'condition':
      return 'Condition'
    case 'class': {
      const d = entry.data
      return tidy([d.hitDie && `Hit die ${d.hitDie}`, d.spellcastingAbility])
    }
    case 'subclass':
      return `${entry.data.parentClass || 'Subclass'} subclass`
    case 'proficiency':
      return entry.data.category ? `${entry.data.category} proficiency` : 'Proficiency'
    case 'worldentry':
      return entry.data.entryType
    case 'feat':
      return entry.data.prerequisite ? `Prerequisite: ${entry.data.prerequisite}` : 'Feat'
    case 'background':
      return entry.data.feature ? `Feature: ${entry.data.feature}` : 'Background'
    case 'homebrew':
      return entry.data.category ? entry.data.category : 'Homebrew'
    case 'action':
      return entry.data.range ? `Range: ${entry.data.range}` : 'Action'
  }
}

/**
 * A blank "stub" entry of a given type — named but otherwise empty. Used to
 * auto-create library entries for things referenced by name (e.g. a spell
 * listed on a subclass) so they can be opened and filled in later. Summary is
 * left blank so cards clearly read as "no details yet".
 */
export function makeStub(type: ContentType, name: string): ContentEntry {
  const e = makeNewEntry(type)
  e.name = name.trim()
  e.summary = ''
  return e
}

export interface ContentRef {
  type: ContentType
  name: string
}

/**
 * The names an entry points at that ought to exist as their own library
 * entries — subclasses and spells under a class, the parent class and spells
 * under a subclass, the classes on a spell, the connections on a world entry.
 * (Proficiencies are plain descriptive tags, not their own content type, so
 * they're deliberately not included.)
 */
export function collectReferences(entry: ContentEntry): ContentRef[] {
  const refs: ContentRef[] = []
  switch (entry.type) {
    case 'spell':
      for (const c of entry.data.classes) refs.push({ type: 'class', name: c })
      break
    case 'class':
      for (const s of entry.data.subclasses) refs.push({ type: 'subclass', name: s })
      for (const p of entry.data.bonusProficiencies ?? []) refs.push({ type: 'proficiency', name: p })
      for (const row of entry.data.spellsByLevel ?? [])
        for (const s of row.spells) refs.push({ type: 'spell', name: s })
      break
    case 'subclass':
      if (entry.data.parentClass) refs.push({ type: 'class', name: entry.data.parentClass })
      for (const p of entry.data.bonusProficiencies ?? []) refs.push({ type: 'proficiency', name: p })
      for (const row of entry.data.spellsByLevel ?? [])
        for (const s of row.spells) refs.push({ type: 'spell', name: s })
      break
    case 'worldentry':
      for (const c of entry.data.connections) refs.push({ type: 'worldentry', name: c })
      break
    case 'monster':
      for (const row of entry.data.spellsByLevel ?? [])
        for (const s of row.spells) refs.push({ type: 'spell', name: s })
      break
  }
  return refs.filter((r) => r.name.trim().length > 0)
}
