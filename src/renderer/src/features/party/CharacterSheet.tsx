import { useState } from 'react'
import { Pencil, Check } from 'lucide-react'
import { usePcStore, type PcUnit } from '@/lib/store/pcStore'
import { TagSelect } from '@/components/TagSelect'
import { SheetView } from './SheetView'
import { InventoryTab } from './InventoryTab'
import { SpellsTab } from './SpellsTab'
import { FeaturesTab } from './FeaturesTab'
import { BackgroundTab } from './BackgroundTab'
import { NotesTab } from './NotesTab'
import { cn } from '@/lib/cn'

type TabKey = 'sheet' | 'inventory' | 'spells' | 'features' | 'background' | 'notes'

const TABS: Array<{ key: TabKey; label: string }> = [
  { key: 'sheet', label: 'Character sheet' },
  { key: 'inventory', label: 'Inventory' },
  { key: 'spells', label: 'Spells' },
  { key: 'features', label: 'Features & traits' },
  { key: 'background', label: 'Background' },
  { key: 'notes', label: 'Notes' }
]

const D5E_RACES = [
  'Human', 'Elf', 'High Elf', 'Wood Elf', 'Dark Elf (Drow)', 'Dwarf', 'Hill Dwarf', 'Mountain Dwarf',
  'Halfling', 'Lightfoot Halfling', 'Stout Halfling', 'Dragonborn', 'Gnome', 'Forest Gnome', 'Rock Gnome',
  'Half-Elf', 'Half-Orc', 'Tiefling', 'Aasimar', 'Goliath', 'Tabaxi', 'Kenku', 'Lizardfolk',
  'Yuan-Ti Pureblood', 'Triton', 'Firbolg', 'Bugbear', 'Goblin', 'Hobgoblin', 'Kobold', 'Orc',
  'Tortle', 'Harengon', 'Owlin', 'Fairy', 'Satyr', 'Leonin', 'Minotaur', 'Centaur'
]

const D5E_CLASSES = [
  'Artificer', 'Barbarian', 'Bard', 'Cleric', 'Druid', 'Fighter', 'Monk',
  'Paladin', 'Ranger', 'Rogue', 'Sorcerer', 'Warlock', 'Wizard', 'Blood Hunter'
]

export function CharacterSheet({
  pc,
  editing,
  onToggleEdit
}: {
  pc: PcUnit
  editing: boolean
  onToggleEdit: () => void
}): JSX.Element {
  const [active, setActive] = useState<TabKey>('sheet')
  const updatePc = usePcStore((s) => s.updatePc)
  const classValues = pc.charClass.split('/').map((s) => s.trim()).filter(Boolean)

  const subtitleLine = [
    pc.race,
    pc.charClass,
    pc.level ? `Level ${pc.level}` : '',
    pc.playerName ? `Player: ${pc.playerName}` : '',
    pc.background?.alignment ?? ''
  ].filter(Boolean).join(' · ')

  return (
    <div className="flex h-full flex-col">
      {/* Character identity header — always visible, doesn't scroll */}
      <div className="shrink-0 border-b border-border px-5 py-3">
        <div className="flex items-center justify-between gap-4">
          {editing ? (
            <>
              <div className="grid min-w-0 flex-1 grid-cols-2 gap-2 lg:grid-cols-4">
                <div>
                  <label className="label">Name</label>
                  <input className="input" autoFocus value={pc.name}
                    onChange={(e) => updatePc(pc.id, { name: e.target.value })} />
                </div>
                <div>
                  <label className="label">Alias</label>
                  <input className="input" value={pc.alias ?? ''}
                    onChange={(e) => updatePc(pc.id, { alias: e.target.value || undefined })} />
                </div>
                <div>
                  <label className="label">Player</label>
                  <input className="input" value={pc.playerName ?? ''}
                    onChange={(e) => updatePc(pc.id, { playerName: e.target.value || undefined })} />
                </div>
                <div>
                  <label className="label">Level</label>
                  <input className="input" type="number" min={1} max={20} value={pc.level}
                    onChange={(e) => updatePc(pc.id, { level: Math.max(1, Number(e.target.value) || 1) })} />
                </div>
                <div className="col-span-2">
                  <label className="label">Race</label>
                  <TagSelect value={pc.race} options={D5E_RACES} placeholder="Bugbear, Elf…"
                    onChange={(v) => updatePc(pc.id, { race: Array.isArray(v) ? (v[0] ?? '') : (v as string) })} />
                </div>
                <div className="col-span-2">
                  <label className="label">Class(es)</label>
                  <TagSelect multi value={classValues} options={D5E_CLASSES} placeholder="Rogue, Barbarian…"
                    onChange={(v) => updatePc(pc.id, { charClass: (v as string[]).join(' / ') })} />
                </div>
              </div>
              <button type="button" className="btn-accent shrink-0 text-xs" onClick={onToggleEdit}>
                <Check size={13} />
                Done
              </button>
            </>
          ) : (
            <>
              <div className="min-w-0">
                <div className="flex min-w-0 items-baseline gap-2">
                  <span className="truncate text-sm font-semibold text-ink">{pc.name || 'Unnamed'}</span>
                  {pc.alias && (
                    <span className="shrink-0 text-xs italic text-ink-muted">"{pc.alias}"</span>
                  )}
                </div>
                {subtitleLine && (
                  <p className="mt-0.5 truncate text-[11px] text-ink-muted">{subtitleLine}</p>
                )}
              </div>
              <button type="button" className="btn-ghost shrink-0 text-xs" onClick={onToggleEdit}>
                <Pencil size={13} />
                Edit sheet
              </button>
            </>
          )}
        </div>
      </div>

      {/* Sub-tabs */}
      <div className="flex shrink-0 overflow-x-auto border-b border-border px-2">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setActive(t.key)}
            className={cn(
              'shrink-0 whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium transition-colors',
              active === t.key
                ? 'border-accent text-ink'
                : 'border-transparent text-ink-muted hover:text-ink'
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="min-h-0 flex-1 overflow-y-auto">
        {active === 'sheet' && <SheetView pc={pc} editing={editing} />}
        {active === 'inventory' && <InventoryTab pc={pc} />}
        {active === 'spells' && <SpellsTab pc={pc} />}
        {active === 'features' && <FeaturesTab pc={pc} />}
        {active === 'background' && <BackgroundTab pc={pc} />}
        {active === 'notes' && <NotesTab pc={pc} />}
      </div>
    </div>
  )
}
