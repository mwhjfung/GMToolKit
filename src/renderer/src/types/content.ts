export type ContentType =
  | 'spell'
  | 'monster'
  | 'item'
  | 'weapon'
  | 'condition'
  | 'class'
  | 'subclass'
  | 'proficiency'
  | 'worldentry'
  | 'feat'
  | 'background'
  | 'homebrew'
  | 'action'

export type ContentSource = 'srd' | 'custom'

/** Fields every content entry carries, regardless of type. */
export interface ContentCommon {
  id: string
  source: ContentSource
  name: string
  /** One-line summary shown on cards. */
  summary: string
  tags: string[]
  /** Markdown notes (mainly custom entries). */
  notes?: string
  /** Source / world this belongs to (display name, mirrors the linked Source). */
  world?: string
  /** Id of the custom Source this entry lives in (custom entries only). */
  sourceId?: string
  /** Open5e slug for SRD entries (used to dedupe on re-sync). */
  slug?: string
  /** User-marked as homebrew content. */
  homebrew?: boolean
  createdAt: number
  updatedAt: number
}

export interface SpellData {
  level: number
  levelText: string
  school: string
  castingTime: string
  range: string
  components: string
  material?: string
  duration: string
  concentration: boolean
  ritual: boolean
  description: string
  higherLevel?: string
  classes: string[]
}

export interface StatBlockEntry {
  name: string
  desc: string
}

export interface MonsterData {
  /** Custom entries distinguish a roaming monster from a named NPC. */
  role: 'monster' | 'npc'
  size: string
  creatureType: string
  alignment: string
  ac: string
  hp: string
  speed: string
  abilities: { str: number; dex: number; con: number; int: number; wis: number; cha: number }
  saves?: string
  skills?: string
  senses?: string
  languages?: string
  cr: string
  traits: StatBlockEntry[]
  actions: StatBlockEntry[]
  bonusActions: StatBlockEntry[]
  reactions: StatBlockEntry[]
  legendaryActions: StatBlockEntry[]
  legendaryDesc?: string
  lore?: string
}

export interface ItemData {
  itemType: string
  rarity: string
  attunement: boolean
  description: string
  charges?: string
  effects?: string
}

export interface WeaponData {
  damageDice: string
  damageType: string
  properties: string[]
  weight?: string
  cost?: string
  category?: string
  rarity?: string
  attunement?: boolean
}

export interface ConditionData {
  description: string
  effects?: string
  howToRemove?: string
}

export interface ClassFeature {
  level: number
  name: string
  desc: string
}

export interface LeveledSpells {
  level: number
  spells: string[]
}

export interface ClassData {
  hitDie: string
  primaryAbility?: string
  savingThrows?: string
  proficiencies?: string
  bonusProficiencies?: string[]
  spellcastingAbility?: string
  description: string
  subclasses: string[]
  features?: ClassFeature[]
  spellsByLevel?: LeveledSpells[]
}

export interface SubclassData {
  parentClass: string
  description: string
  bonusProficiencies?: string[]
  features?: ClassFeature[]
  spellsByLevel?: LeveledSpells[]
}

export interface ProficiencyData {
  /** Armour, Weapon, Tool, Skill, Saving Throw, Language, Other. */
  category: string
  description: string
}

export type WorldEntryKind = 'Location' | 'Faction' | 'Event' | 'Deity' | 'Plane'

export interface WorldEntryData {
  entryType: WorldEntryKind
  description: string
  /** Names of other entries this connects to. */
  connections: string[]
}

export interface FeatData {
  prerequisite?: string
  description: string
  /** Flat numeric bonuses applied to derived character stats. */
  initiativeBonus?: number
  acBonus?: number
  speedBonus?: number
  passivePerceptionBonus?: number
  passiveInvestigationBonus?: number
}

export interface BackgroundData {
  description: string
  feature?: string
  featureDescription?: string
  skillProficiencies?: string
  toolProficiencies?: string
  languages?: string
  equipment?: string
}

export interface HomebrewData {
  category?: string
  description: string
}

export interface ActionData {
  range?: string
  description: string
}

interface TypedData {
  spell: SpellData
  monster: MonsterData
  item: ItemData
  weapon: WeaponData
  condition: ConditionData
  class: ClassData
  subclass: SubclassData
  proficiency: ProficiencyData
  worldentry: WorldEntryData
  feat: FeatData
  background: BackgroundData
  homebrew: HomebrewData
  action: ActionData
}

export type ContentEntry = {
  [K in ContentType]: ContentCommon & { type: K; data: TypedData[K] }
}[ContentType]

export type ContentOfType<K extends ContentType> = Extract<ContentEntry, { type: K }>

export const CONTENT_TYPE_LABELS: Record<ContentType, string> = {
  spell: 'Spell',
  monster: 'Monster',
  item: 'Item',
  weapon: 'Weapon',
  condition: 'Condition',
  class: 'Class',
  subclass: 'Subclass',
  proficiency: 'Proficiency',
  worldentry: 'World entry',
  feat: 'Feat',
  background: 'Background',
  homebrew: 'Homebrew',
  action: 'Action'
}
