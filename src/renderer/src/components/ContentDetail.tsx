import type { ReactNode } from 'react'
import { Swords } from 'lucide-react'
import type {
  ContentEntry,
  ContentOfType,
  ContentType,
  StatBlockEntry,
  ClassFeature,
  LeveledSpells
} from '@/types/content'
import { useContentStore } from '@/lib/store/contentStore'
import { useUiStore } from '@/lib/store/uiStore'
import { useCombatStore } from '@/lib/store/combatStore'
import { makeStub } from '@/lib/templates/schemas'
import { TypeBadge, SourceTag } from './ContentBadge'
import { Markdown } from './Markdown'
import { cn } from '@/lib/cn'

// ---- shared bits ----------------------------------------------------------

function Field({ label, children }: { label: string; children: ReactNode }): JSX.Element | null {
  if (children == null || children === '' || (Array.isArray(children) && !children.length)) return null
  return (
    <div className="flex gap-2 text-sm">
      <span className="shrink-0 font-medium text-ink-muted">{label}</span>
      <span className="text-ink">{children}</span>
    </div>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }): JSX.Element {
  return (
    <div className="space-y-2">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-ink-muted">{title}</h3>
      {children}
    </div>
  )
}

/**
 * A reference to another entry, shown by name. If a matching entry exists it
 * opens in the drawer. If not and the parent entry is the user's own (custom),
 * it shows with a dashed underline and creates a blank stub on click so it can
 * be filled in. References on SRD content with no match render as plain text.
 */
function RefLink({
  name,
  type,
  allowCreate,
  world
}: {
  name: string
  type: ContentType
  allowCreate: boolean
  /** Source/world to file a newly-created stub under (the parent entry's). */
  world?: string
}): JSX.Element {
  const existing = useContentStore((s) =>
    s.visibleItems.find((i) => i.type === type && i.name.toLowerCase() === name.toLowerCase())
  )
  const upsert = useContentStore((s) => s.upsert)
  const openDrawer = useUiStore((s) => s.openDrawer)

  if (!existing && !allowCreate) return <span className="text-ink">{name}</span>

  const onClick = async (): Promise<void> => {
    let target = existing
    if (!target) {
      target = { ...makeStub(type, name), world: world ?? '' }
      await upsert(target)
    }
    openDrawer(target.id)
  }

  return (
    <button
      type="button"
      onClick={() => void onClick()}
      title={existing ? `Open ${name}` : `Create “${name}”`}
      className={cn(
        'text-accent hover:underline',
        !existing && 'text-accent/70 underline decoration-dashed underline-offset-2'
      )}
    >
      {name}
    </button>
  )
}

function RefList({
  names,
  type,
  allowCreate,
  world
}: {
  names: string[]
  type: ContentType
  allowCreate: boolean
  world?: string
}): JSX.Element {
  return (
    <span>
      {names.map((n, i) => (
        <span key={`${n}-${i}`}>
          {i > 0 && ', '}
          <RefLink name={n} type={type} allowCreate={allowCreate} world={world} />
        </span>
      ))}
    </span>
  )
}

function StatBlockList({ entries }: { entries: StatBlockEntry[] }): JSX.Element | null {
  if (!entries.length) return null
  return (
    <div className="space-y-2">
      {entries.map((e, i) => (
        <p key={`${e.name}-${i}`} className="whitespace-pre-line text-sm leading-relaxed text-ink-muted">
          {e.name && <span className="font-semibold italic text-ink">{e.name}. </span>}
          {e.desc}
        </p>
      ))}
    </div>
  )
}

function abilityMod(score: number): string {
  const mod = Math.floor((score - 10) / 2)
  return `${mod >= 0 ? '+' : ''}${mod}`
}

// ---- add to initiative ------------------------------------------------------

function AddToInitiativeButton({ entry }: { entry: ContentOfType<'monster'> }): JSX.Element {
  const addUnit = useCombatStore((s) => s.addUnit)
  const hpAvg = parseInt(entry.data.hp) || 0
  const dexMod = Math.floor((entry.data.abilities.dex - 10) / 2)

  const add = (): void => {
    addUnit({
      name: entry.name,
      contentId: entry.id,
      isPC: false,
      initiative: Math.floor(Math.random() * 20) + 1 + dexMod,
      locked: false,
      hpCurrent: hpAvg,
      hpMax: hpAvg,
      hpTemp: 0,
      conditions: []
    })
  }

  return (
    <button type="button" onClick={add} className="btn-outline w-full">
      <Swords size={14} />
      Add to initiative
    </button>
  )
}

// ---- per-type detail bodies ----------------------------------------------

function SpellDetail({ entry }: { entry: ContentOfType<'spell'> }): JSX.Element {
  const d = entry.data
  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <Field label="Level">{d.level === 0 ? 'Cantrip' : d.levelText}</Field>
        <Field label="School">{d.school}</Field>
        <Field label="Casting time">{d.castingTime}</Field>
        <Field label="Range">{d.range}</Field>
        <Field label="Components">
          {d.components}
          {d.material ? ` (${d.material})` : ''}
        </Field>
        <Field label="Duration">{d.duration}</Field>
        {(d.concentration || d.ritual) && (
          <Field label="Tags">
            {[d.concentration && 'Concentration', d.ritual && 'Ritual'].filter(Boolean).join(', ')}
          </Field>
        )}
        {d.classes.length > 0 && (
          <Field label="Classes">
            <RefList
              names={d.classes}
              type="class"
              allowCreate={entry.source === 'custom'}
              world={entry.world}
            />
          </Field>
        )}
      </div>
      {d.description && (
        <Section title="Description">
          <Markdown>{d.description}</Markdown>
        </Section>
      )}
      {d.higherLevel && (
        <Section title="At higher levels">
          <Markdown>{d.higherLevel}</Markdown>
        </Section>
      )}
    </div>
  )
}

function MonsterDetail({ entry, hideAddToInitiative }: { entry: ContentOfType<'monster'>; hideAddToInitiative?: boolean }): JSX.Element {
  const d = entry.data
  const abilities: Array<[string, number]> = [
    ['STR', d.abilities.str],
    ['DEX', d.abilities.dex],
    ['CON', d.abilities.con],
    ['INT', d.abilities.int],
    ['WIS', d.abilities.wis],
    ['CHA', d.abilities.cha]
  ]
  return (
    <div className="space-y-4">
      {!hideAddToInitiative && <AddToInitiativeButton entry={entry} />}
      <p className="text-sm italic text-ink-muted">
        {[d.size, d.creatureType, d.alignment].filter(Boolean).join(' · ')}
      </p>
      <div className="space-y-1">
        <Field label="Armour class">{d.ac}</Field>
        <Field label="Hit points">{d.hp}</Field>
        <Field label="Speed">{d.speed}</Field>
        <Field label="Challenge">{d.cr}</Field>
      </div>

      <div className="grid grid-cols-6 gap-1.5">
        {abilities.map(([name, score]) => (
          <div key={name} className="rounded-md border border-border bg-surface-2 p-2 text-center">
            <div className="text-[10px] font-semibold tracking-wider text-ink-muted">{name}</div>
            <div className="text-sm text-ink">{score}</div>
            <div className="text-xs text-ink-muted">{abilityMod(score)}</div>
          </div>
        ))}
      </div>

      <div className="space-y-1">
        <Field label="Saves">{d.saves}</Field>
        <Field label="Skills">{d.skills}</Field>
        <Field label="Senses">{d.senses}</Field>
        <Field label="Languages">{d.languages}</Field>
        {(d.vulnerabilities?.length ?? 0) > 0 && (
          <Field label="Vulnerabilities">{d.vulnerabilities!.join(', ')}</Field>
        )}
        {(d.resistances?.length ?? 0) > 0 && (
          <Field label="Resistances">{d.resistances!.join(', ')}</Field>
        )}
        {(d.immunities?.length ?? 0) > 0 && (
          <Field label="Immunities">{d.immunities!.join(', ')}</Field>
        )}
      </div>

      {(d.spellcastingAbility || (d.spellsByLevel?.length ?? 0) > 0) && (
        <Section title="Spellcasting">
          {(d.spellcastingAbility || d.spellSaveDc || d.spellAttackBonus) && (
            <p className="text-sm text-ink-muted">
              {[
                d.spellcastingAbility && `Ability: ${d.spellcastingAbility}`,
                d.spellSaveDc && `Save DC ${d.spellSaveDc}`,
                d.spellAttackBonus && `${d.spellAttackBonus} to hit`
              ]
                .filter(Boolean)
                .join(' · ')}
            </p>
          )}
          <div className="space-y-1">
            {(d.spellsByLevel ?? []).map((row) => (
              <Field key={row.level} label={row.level === 0 ? 'Cantrips' : `Level ${row.level}`}>
                <RefList
                  names={row.spells}
                  type="spell"
                  allowCreate={entry.source === 'custom'}
                  world={entry.world}
                />
              </Field>
            ))}
          </div>
        </Section>
      )}

      {d.traits.length > 0 && (
        <Section title="Traits">
          <StatBlockList entries={d.traits} />
        </Section>
      )}
      {d.actions.length > 0 && (
        <Section title="Actions">
          <StatBlockList entries={d.actions} />
        </Section>
      )}
      {d.bonusActions.length > 0 && (
        <Section title="Bonus actions">
          <StatBlockList entries={d.bonusActions} />
        </Section>
      )}
      {d.reactions.length > 0 && (
        <Section title="Reactions">
          <StatBlockList entries={d.reactions} />
        </Section>
      )}
      {(d.legendaryActions.length > 0 || d.legendaryDesc) && (
        <Section title="Legendary actions">
          {d.legendaryDesc && <p className="text-sm text-ink-muted">{d.legendaryDesc}</p>}
          <StatBlockList entries={d.legendaryActions} />
        </Section>
      )}
      {d.lore && (
        <Section title="Lore">
          <Markdown>{d.lore}</Markdown>
        </Section>
      )}
    </div>
  )
}

function ItemDetail({ entry }: { entry: ContentOfType<'item'> }): JSX.Element {
  const d = entry.data
  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <Field label="Type">{d.itemType}</Field>
        <Field label="Rarity">{d.rarity}</Field>
        <Field label="Attunement">{d.attunement ? 'Required' : 'No'}</Field>
        <Field label="Charges">{d.charges}</Field>
      </div>
      {d.description && (
        <Section title="Description">
          <Markdown>{d.description}</Markdown>
        </Section>
      )}
      {d.effects && (
        <Section title="Effects">
          <Markdown>{d.effects}</Markdown>
        </Section>
      )}
    </div>
  )
}

function WeaponDetail({ entry }: { entry: ContentOfType<'weapon'> }): JSX.Element {
  const d = entry.data
  return (
    <div className="space-y-1">
      <Field label="Category">{d.category}</Field>
      <Field label="Damage">{[d.damageDice, d.damageType].filter(Boolean).join(' ')}</Field>
      <Field label="Properties">{d.properties.join(', ')}</Field>
      <Field label="Weight">{d.weight}</Field>
      <Field label="Cost">{d.cost}</Field>
      {d.rarity && <Field label="Rarity">{d.rarity}</Field>}
      {d.attunement != null && <Field label="Attunement">{d.attunement ? 'Required' : 'No'}</Field>}
    </div>
  )
}

function ConditionDetail({ entry }: { entry: ContentOfType<'condition'> }): JSX.Element {
  const d = entry.data
  return (
    <div className="space-y-4">
      {d.description && <Markdown>{d.description}</Markdown>}
      {d.effects && (
        <Section title="Effects">
          <Markdown>{d.effects}</Markdown>
        </Section>
      )}
      {d.howToRemove && (
        <Section title="How to remove">
          <Markdown>{d.howToRemove}</Markdown>
        </Section>
      )}
    </div>
  )
}

function FeaturesList({ features }: { features: ClassFeature[] }): JSX.Element | null {
  if (!features.length) return null
  const sorted = [...features].sort((a, b) => a.level - b.level)
  return (
    <div className="space-y-2">
      {sorted.map((f, i) => (
        <p key={`${f.level}-${f.name}-${i}`} className="whitespace-pre-line text-sm leading-relaxed text-ink-muted">
          <span className="font-semibold text-ink">
            Lvl {f.level} · {f.name}.{' '}
          </span>
          {f.desc}
        </p>
      ))}
    </div>
  )
}

function SpellsByLevelList({
  rows,
  allowCreate,
  world
}: {
  rows: LeveledSpells[]
  allowCreate: boolean
  world?: string
}): JSX.Element | null {
  if (!rows.length) return null
  const sorted = [...rows].sort((a, b) => a.level - b.level)
  return (
    <div className="space-y-1">
      {sorted.map((r, i) => (
        <p key={`${r.level}-${i}`} className="text-sm text-ink-muted">
          <span className="font-medium text-ink">{r.level === 0 ? 'Cantrips' : `Lvl ${r.level}`}: </span>
          <RefList names={r.spells} type="spell" allowCreate={allowCreate} world={world} />
        </p>
      ))}
    </div>
  )
}

function ClassDetail({ entry }: { entry: ContentOfType<'class'> }): JSX.Element {
  const d = entry.data
  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <Field label="Hit die">{d.hitDie}</Field>
        <Field label="Primary ability">{d.primaryAbility}</Field>
        <Field label="Saving throws">{d.savingThrows}</Field>
        <Field label="Spellcasting">{d.spellcastingAbility}</Field>
        <Field label="Proficiencies">{d.proficiencies}</Field>
        {d.bonusProficiencies && d.bonusProficiencies.length > 0 && (
          <Field label="Bonus proficiencies">
            <RefList
              names={d.bonusProficiencies}
              type="proficiency"
              allowCreate={entry.source === 'custom'}
              world={entry.world}
            />
          </Field>
        )}
      </div>
      {d.subclasses.length > 0 && (
        <Field label="Subclasses">
          <RefList
            names={d.subclasses}
            type="subclass"
            allowCreate={entry.source === 'custom'}
            world={entry.world}
          />
        </Field>
      )}
      {d.features && d.features.length > 0 && (
        <Section title="Features by level">
          <FeaturesList features={d.features} />
        </Section>
      )}
      {d.spellsByLevel && d.spellsByLevel.length > 0 && (
        <Section title="Spells by level">
          <SpellsByLevelList
            rows={d.spellsByLevel}
            allowCreate={entry.source === 'custom'}
            world={entry.world}
          />
        </Section>
      )}
      {d.description && (
        <Section title="Description">
          <Markdown>{d.description}</Markdown>
        </Section>
      )}
    </div>
  )
}

function SubclassDetail({ entry }: { entry: ContentOfType<'subclass'> }): JSX.Element {
  const d = entry.data
  return (
    <div className="space-y-4">
      {d.parentClass && (
        <Field label="Parent class">
          <RefLink
            name={d.parentClass}
            type="class"
            allowCreate={entry.source === 'custom'}
            world={entry.world}
          />
        </Field>
      )}
      {d.description && (
        <Section title="Description">
          <Markdown>{d.description}</Markdown>
        </Section>
      )}
      {d.features && d.features.length > 0 && (
        <Section title="Features by level">
          <FeaturesList features={d.features} />
        </Section>
      )}
      {d.spellsByLevel && d.spellsByLevel.length > 0 && (
        <Section title="Spells by level">
          <SpellsByLevelList
            rows={d.spellsByLevel}
            allowCreate={entry.source === 'custom'}
            world={entry.world}
          />
        </Section>
      )}
      {d.bonusProficiencies && d.bonusProficiencies.length > 0 && (
        <Field label="Bonus proficiencies">
          <RefList
            names={d.bonusProficiencies}
            type="proficiency"
            allowCreate={entry.source === 'custom'}
            world={entry.world}
          />
        </Field>
      )}
    </div>
  )
}

function ProficiencyDetail({ entry }: { entry: ContentOfType<'proficiency'> }): JSX.Element {
  const d = entry.data
  return (
    <div className="space-y-4">
      <Field label="Category">{d.category}</Field>
      {d.description && (
        <Section title="Description">
          <Markdown>{d.description}</Markdown>
        </Section>
      )}
    </div>
  )
}

function WorldEntryDetail({ entry }: { entry: ContentOfType<'worldentry'> }): JSX.Element {
  const d = entry.data
  return (
    <div className="space-y-4">
      <Field label="Type">{d.entryType}</Field>
      {d.connections.length > 0 && (
        <Field label="Connections">
          <RefList
            names={d.connections}
            type="worldentry"
            allowCreate={entry.source === 'custom'}
            world={entry.world}
          />
        </Field>
      )}
      {d.description && (
        <Section title="Description">
          <Markdown>{d.description}</Markdown>
        </Section>
      )}
    </div>
  )
}

function FeatDetail({ entry }: { entry: Extract<ContentEntry, { type: 'feat' }> }): JSX.Element {
  const d = entry.data
  const bonuses: Array<[string, number]> = [
    ['Initiative', d.initiativeBonus ?? 0],
    ['AC', d.acBonus ?? 0],
    ['Speed (ft)', d.speedBonus ?? 0],
    ['Passive Perception', d.passivePerceptionBonus ?? 0],
    ['Passive Investigation', d.passiveInvestigationBonus ?? 0]
  ].filter(([, v]) => v !== 0) as Array<[string, number]>

  return (
    <div className="space-y-4">
      {d.prerequisite && <Field label="Prerequisite">{d.prerequisite}</Field>}
      {bonuses.length > 0 && (
        <Field label="Stat bonuses">
          <div className="flex flex-wrap gap-2">
            {bonuses.map(([label, v]) => (
              <span key={label} className="chip">
                {label}: {v > 0 ? `+${v}` : v}
              </span>
            ))}
          </div>
        </Field>
      )}
      {d.description && (
        <Section title="Description">
          <Markdown>{d.description}</Markdown>
        </Section>
      )}
    </div>
  )
}

function BackgroundDetail({ entry }: { entry: Extract<ContentEntry, { type: 'background' }> }): JSX.Element {
  const d = entry.data
  return (
    <div className="space-y-4">
      {(d.skillProficiencies || d.toolProficiencies || d.languages || d.equipment) && (
        <Section title="Proficiencies & equipment">
          {d.skillProficiencies && <Field label="Skills">{d.skillProficiencies}</Field>}
          {d.toolProficiencies && <Field label="Tools">{d.toolProficiencies}</Field>}
          {d.languages && <Field label="Languages">{d.languages}</Field>}
          {d.equipment && <Field label="Equipment">{d.equipment}</Field>}
        </Section>
      )}
      {d.feature && (
        <Section title={d.feature}>
          {d.featureDescription && <Markdown>{d.featureDescription}</Markdown>}
        </Section>
      )}
      {d.description && (
        <Section title="Background">
          <Markdown>{d.description}</Markdown>
        </Section>
      )}
    </div>
  )
}

function ActionDetail({ entry }: { entry: Extract<ContentEntry, { type: 'action' }> }): JSX.Element {
  const d = entry.data
  return (
    <div className="space-y-4">
      {d.range && <Field label="Range / reach">{d.range}</Field>}
      {d.description && (
        <Section title="Description">
          <Markdown>{d.description}</Markdown>
        </Section>
      )}
    </div>
  )
}

function HomebrewDetail({ entry }: { entry: Extract<ContentEntry, { type: 'homebrew' }> }): JSX.Element {
  const d = entry.data
  return (
    <div className="space-y-4">
      {d.category && <Field label="Category">{d.category}</Field>}
      {d.description && (
        <Section title="Description">
          <Markdown>{d.description}</Markdown>
        </Section>
      )}
    </div>
  )
}

function DetailBody({ entry, hideAddToInitiative }: { entry: ContentEntry; hideAddToInitiative?: boolean }): JSX.Element {
  switch (entry.type) {
    case 'spell':
      return <SpellDetail entry={entry} />
    case 'monster':
      return <MonsterDetail entry={entry} hideAddToInitiative={hideAddToInitiative} />
    case 'item':
      return <ItemDetail entry={entry} />
    case 'weapon':
      return <WeaponDetail entry={entry} />
    case 'condition':
      return <ConditionDetail entry={entry} />
    case 'class':
      return <ClassDetail entry={entry} />
    case 'subclass':
      return <SubclassDetail entry={entry} />
    case 'proficiency':
      return <ProficiencyDetail entry={entry} />
    case 'worldentry':
      return <WorldEntryDetail entry={entry} />
    case 'feat':
      return <FeatDetail entry={entry} />
    case 'background':
      return <BackgroundDetail entry={entry} />
    case 'homebrew':
      return <HomebrewDetail entry={entry} />
    case 'action':
      return <ActionDetail entry={entry} />
    default: {
      // Reachable for a persisted entry whose type predates a schema change
      // (ContentType is a closed union at the TS level, but data on disk
      // isn't bound by that — the switch above narrows `entry` to `never`
      // here, hence the cast back) — show something instead of silently
      // rendering nothing.
      const raw = entry as ContentEntry
      return <p className="text-sm text-ink-muted">No display available for content type "{raw.type}".</p>
    }
  }
}

export function ContentDetail({ entry, hideAddToInitiative }: { entry: ContentEntry; hideAddToInitiative?: boolean }): JSX.Element {
  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <TypeBadge type={entry.type} />
          <SourceTag source={entry.source} homebrew={entry.homebrew} />
        </div>
        <h2 className="text-xl font-semibold text-ink">{entry.name}</h2>
        {entry.world && <p className="text-sm text-ink-muted">{entry.world}</p>}
        {entry.tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {entry.tags.map((t) => (
              <span key={t} className="chip">
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </span>
            ))}
          </div>
        )}
      </div>

      <DetailBody entry={entry} hideAddToInitiative={hideAddToInitiative} />

      {entry.notes && (
        <Section title="Notes">
          <Markdown>{entry.notes}</Markdown>
        </Section>
      )}
    </div>
  )
}
