import { useMemo, useState } from 'react'
import { Plus, Trash2, Star } from 'lucide-react'
import { usePcStore, type PcUnit, type PcAction, type ActionType } from '@/lib/store/pcStore'
import { useUiStore } from '@/lib/store/uiStore'
import { useContentStore } from '@/lib/store/contentStore'
import { TagSelect } from '@/components/TagSelect'
import { DAMAGE_TYPES, PROFICIENCIES } from '@/lib/templates/schemas'
import {
  ABILITIES,
  SKILLS,
  CONDITIONS,
  abilityMod,
  fmtMod,
  passivePerception,
  proficiencyBonus,
  saveMod,
  skillMod
} from '@/lib/dnd/character'
import { cn } from '@/lib/cn'

const uuid = (): string =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`

function hpColor(current: number, max: number): string {
  if (max <= 0) return 'bg-ink-faint'
  const pct = current / max
  if (pct > 0.5) return 'bg-success'
  if (pct > 0.25) return 'bg-amber-400'
  return 'bg-danger'
}

function Panel({ children, className }: { children: React.ReactNode; className?: string }): JSX.Element {
  return (
    <div className={cn('rounded-lg border border-border bg-surface-2 p-3', className)}>
      {children}
    </div>
  )
}

function StatTile({
  label,
  value,
  editing,
  raw,
  onChange
}: {
  label: string
  value: string | number
  editing?: boolean
  raw?: number
  onChange?: (n: number) => void
}): JSX.Element {
  return (
    <div className="flex flex-col items-center rounded-lg border border-border bg-surface-2 py-2">
      <div className="text-[9px] font-semibold uppercase tracking-wider text-ink-muted">{label}</div>
      {editing && onChange ? (
        <input
          type="number"
          className="w-14 rounded bg-surface px-1 py-0.5 text-center text-xl font-bold text-ink focus:outline-none"
          value={raw}
          onChange={(e) => onChange(Number(e.target.value))}
        />
      ) : (
        <div className="text-xl font-bold text-ink">{value}</div>
      )}
    </div>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }): JSX.Element {
  return (
    <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-ink-muted">
      {children}
    </div>
  )
}

function TagField({
  label,
  value,
  options,
  onChange
}: {
  label: string
  value: string[]
  options: readonly string[]
  onChange: (v: string[]) => void
}): JSX.Element {
  return (
    <div>
      <SectionLabel>{label}</SectionLabel>
      <TagSelect multi value={value} options={options} onChange={(v) => onChange(v as string[])} />
    </div>
  )
}

function SlotPips({ pc, level }: { pc: PcUnit; level: number }): JSX.Element {
  const useSlot = usePcStore((s) => s.useSlot)
  const restoreSlot = usePcStore((s) => s.restoreSlot)
  const slot = pc.slots[level - 1]
  return (
    <div
      className="flex items-center gap-2"
      onContextMenu={(e) => {
        e.preventDefault()
        restoreSlot(pc.id, level)
      }}
    >
      <span className="w-6 shrink-0 text-xs text-ink-muted">L{level}</span>
      <div className="flex flex-wrap gap-1">
        {Array.from({ length: slot.max }, (_, i) => {
          const filled = i < slot.current
          return (
            <button
              key={i}
              type="button"
              title={filled ? 'Spend slot' : 'Restore slot'}
              onClick={() => (filled ? useSlot(pc.id, level) : restoreSlot(pc.id, level))}
              className={cn(
                'h-3 w-3 rounded-full border transition-colors',
                filled
                  ? 'border-accent bg-accent hover:bg-accent-strong'
                  : 'border-border-strong bg-transparent hover:border-accent'
              )}
            />
          )
        })}
      </div>
      <span className="ml-auto text-xs text-ink-muted">{slot.current}/{slot.max}</span>
    </div>
  )
}

const ACTION_TABS: Array<{ key: 'all' | ActionType | 'limited'; label: string }> = [
  { key: 'all', label: 'All' },
  { key: 'action', label: 'Action' },
  { key: 'bonus', label: 'Bonus' },
  { key: 'reaction', label: 'Reaction' },
  { key: 'other', label: 'Other' },
  { key: 'limited', label: 'Limited uses' }
]

function ActionsBlock({ pc }: { pc: PcUnit }): JSX.Element {
  const updatePc = usePcStore((s) => s.updatePc)
  const openDrawer = useUiStore((s) => s.openDrawer)
  const [tab, setTab] = useState<'all' | ActionType | 'limited'>('all')

  const setActions = (actions: PcAction[]): void => updatePc(pc.id, { actions })
  const add = (): void =>
    setActions([
      ...pc.actions,
      { id: uuid(), name: '', type: tab === 'all' || tab === 'limited' ? 'action' : tab, usesMax: 0, usesCurrent: 0, description: '' }
    ])
  const patch = (id: string, p: Partial<PcAction>): void =>
    setActions(pc.actions.map((a) => (a.id === id ? { ...a, ...p } : a)))
  const remove = (id: string): void => setActions(pc.actions.filter((a) => a.id !== id))

  const shown =
    tab === 'all'
      ? pc.actions
      : tab === 'limited'
        ? pc.actions.filter((a) => a.usesMax > 0)
        : pc.actions.filter((a) => a.type === tab)

  return (
    <div>
      <div className="mb-2 flex flex-wrap gap-1">
        {ACTION_TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={cn(
              'shrink-0 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors',
              tab === t.key
                ? 'border-accent/60 bg-accent/15 text-accent'
                : 'border-border text-ink-muted hover:border-border-strong hover:text-ink'
            )}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className="space-y-2">
        {shown.length === 0 && <p className="text-sm text-ink-muted">Nothing here yet.</p>}
        {shown.map((a) => (
          <div key={a.id} className="rounded-md border border-border bg-surface p-2">
            <div className="flex items-center gap-2">
              {a.contentId ? (
                <button
                  type="button"
                  className="min-w-0 flex-1 truncate text-left text-sm font-medium text-ink hover:text-accent"
                  title="Open in library"
                  onClick={() => openDrawer(a.contentId!)}
                >
                  {a.name}
                </button>
              ) : (
                <input className="input flex-1" placeholder="Action name" value={a.name} onChange={(e) => patch(a.id, { name: e.target.value })} />
              )}
              <select
                value={a.type}
                onChange={(e) => patch(a.id, { type: e.target.value as ActionType })}
                title="Action type"
                className="chip shrink-0 cursor-pointer appearance-none bg-surface-2 pr-4 capitalize focus:border-accent focus:outline-none"
                style={{
                  backgroundImage:
                    "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23999' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E\")",
                  backgroundRepeat: 'no-repeat',
                  backgroundPosition: 'right 4px center'
                }}
              >
                <option value="action">Action</option>
                <option value="bonus">Bonus action</option>
                <option value="reaction">Reaction</option>
                <option value="other">Other</option>
              </select>
              <button type="button" className="icon-btn shrink-0 hover:text-danger" onClick={() => remove(a.id)}>
                <Trash2 size={14} />
              </button>
            </div>
            {a.description && (
              <p className="mt-1 whitespace-pre-line text-xs leading-snug text-ink-muted">{a.description}</p>
            )}
            <div className="mt-1.5 flex items-center gap-2 text-xs text-ink-muted">
              <span>Uses</span>
              <input
                type="number" min={0}
                className="w-14 rounded bg-surface-2 px-1 py-0.5 text-center text-sm text-ink focus:outline-none"
                value={a.usesMax}
                onChange={(e) => {
                  const usesMax = Math.max(0, Number(e.target.value))
                  patch(a.id, { usesMax, usesCurrent: Math.min(a.usesCurrent, usesMax) })
                }}
              />
              {a.usesMax > 0 && (
                <div className="flex flex-wrap gap-1">
                  {Array.from({ length: a.usesMax }, (_, i) => {
                    const filled = i < a.usesCurrent
                    return (
                      <button key={i} type="button"
                        onClick={() => patch(a.id, { usesCurrent: filled ? Math.max(0, a.usesCurrent - 1) : Math.min(a.usesMax, a.usesCurrent + 1) })}
                        className={cn('h-3 w-3 rounded-full border transition-colors', filled ? 'border-accent bg-accent' : 'border-border-strong hover:border-accent')}
                      />
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        ))}
        <button type="button" className="btn-ghost text-sm" onClick={add}>
          <Plus size={14} />
          Add action
        </button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Temp HP pie — drains counter-clockwise as temp HP is lost
// ---------------------------------------------------------------------------

function TempHpPie({ value, max }: { value: number; max: number }): JSX.Element {
  const size = 20
  const cx = size / 2
  const cy = size / 2
  const r = size / 2 - 1
  const pct = max > 0 ? Math.min(1, value / max) : 0

  // Build a clockwise filled wedge starting from the top.
  // As pct decreases the wedge shrinks counter-clockwise from its end.
  let wedge: string | null = null
  if (pct > 0 && pct < 1) {
    const start = -Math.PI / 2
    const end = start + pct * 2 * Math.PI
    const x1 = cx + r * Math.cos(start)
    const y1 = cy + r * Math.sin(start)
    const x2 = cx + r * Math.cos(end)
    const y2 = cy + r * Math.sin(end)
    wedge = `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${pct > 0.5 ? 1 : 0} 1 ${x2} ${y2} Z`
  }

  return (
    <svg width={size} height={size} className="shrink-0" aria-hidden>
      {/* Outline track — always visible */}
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="currentColor" strokeWidth={1} className="text-blue-400/25" />
      {/* Filled wedge */}
      {pct >= 1 && <circle cx={cx} cy={cy} r={r} className="fill-blue-400/75" />}
      {wedge && <path d={wedge} className="fill-blue-400/75" />}
    </svg>
  )
}

export function SheetView({ pc, editing }: { pc: PcUnit; editing?: boolean }): JSX.Element {
  const updatePc = usePcStore((s) => s.updatePc)
  const longRestOne = usePcStore((s) => s.longRestOne)
  const shortRestOne = usePcStore((s) => s.shortRestOne)
  const [hpAmt, setHpAmt] = useState('')
  // Track the "full" value when temp HP was set so the pie drains correctly
  const [tempHpMax, setTempHpMax] = useState(pc.tempHp)

  const applyHp = (sign: number): void => {
    const n = Number(hpAmt)
    if (!n) return
    if (sign === 1) {
      // Damage: drain temp HP before actual HP
      const tempDrained = Math.min(pc.tempHp, n)
      updatePc(pc.id, {
        tempHp: pc.tempHp - tempDrained,
        currentHp: Math.max(0, pc.currentHp - (n - tempDrained))
      })
    } else {
      // Heal: only restores actual HP, never temp
      updatePc(pc.id, { currentHp: Math.min(pc.maxHp, pc.currentHp + n) })
    }
    setHpAmt('')
  }
  const items = useContentStore((s) => s.items)

  const pb = proficiencyBonus(pc.level)
  const dexMod = abilityMod(pc.abilities.dex)
  const wisMod = abilityMod(pc.abilities.wis)
  const intMod = abilityMod(pc.abilities.int)

  // Compute bonuses from linked library feats
  const featBonuses = useMemo(() => {
    let initiativeBonus = 0, acBonus = 0, speedBonus = 0
    let passivePerceptionBonus = 0, passiveInvestigationBonus = 0
    for (const feature of pc.features) {
      if (!feature.contentId) continue
      const entry = items.find((i) => i.id === feature.contentId)
      if (!entry || entry.type !== 'feat') continue
      initiativeBonus += entry.data.initiativeBonus ?? 0
      acBonus += entry.data.acBonus ?? 0
      speedBonus += entry.data.speedBonus ?? 0
      passivePerceptionBonus += entry.data.passivePerceptionBonus ?? 0
      passiveInvestigationBonus += entry.data.passiveInvestigationBonus ?? 0
    }
    return { initiativeBonus, acBonus, speedBonus, passivePerceptionBonus, passiveInvestigationBonus }
  }, [pc.features, items])

  const initiative = dexMod + featBonuses.initiativeBonus
  const ac = pc.ac + featBonuses.acBonus
  const speed = pc.speed + featBonuses.speedBonus
  const pp = passivePerception(pc.abilities, pc.skillProf.includes('perception'), pc.level) + featBonuses.passivePerceptionBonus
  const pi = 10 + skillMod(pc.abilities, SKILLS.find((s) => s.key === 'investigation')!, pc.skillProf.includes('investigation'), pc.level) + featBonuses.passiveInvestigationBonus
  const pinsight = 10 + skillMod(pc.abilities, SKILLS.find((s) => s.key === 'insight')!, pc.skillProf.includes('insight'), pc.level)

  const activeLevels = pc.slots.filter((s) => s.max > 0)

  return (
    <div className="flex h-full min-h-0 flex-col overflow-y-auto lg:flex-row lg:overflow-hidden">
      {/* ── LEFT PANEL: abilities + saves + passives + senses + proficiencies ── */}
      <div className="flex flex-col gap-3 border-b border-border p-3 lg:w-72 lg:shrink-0 lg:overflow-y-auto lg:border-b-0 lg:border-r">
        {/* Ability scores */}
        <Panel>
          <SectionLabel>Ability scores</SectionLabel>
          <div className="grid grid-cols-2 gap-1.5">
            {ABILITIES.map((a) => {
              const score = pc.abilities[a.key]
              const mod = abilityMod(score)
              return (
                <div key={a.key} className="flex flex-col items-center rounded-md border border-border bg-surface py-2">
                  <div className="text-[9px] font-bold uppercase tracking-wider text-ink-muted">{a.label}</div>
                  <div className="text-xl font-bold text-ink">{fmtMod(mod)}</div>
                  {editing ? (
                    <>
                      <input
                        type="number"
                        className="mt-0.5 w-12 rounded border border-border bg-surface-2 px-1 py-0.5 text-center text-xs text-ink focus:border-accent focus:outline-none"
                        value={score}
                        onChange={(e) =>
                          updatePc(pc.id, { abilities: { ...pc.abilities, [a.key]: Number(e.target.value) } })
                        }
                      />
                      <label className="mt-1 flex cursor-pointer items-center gap-1 text-[9px] text-ink-muted">
                        <input
                          type="checkbox"
                          checked={pc.saveProf.includes(a.key)}
                          onChange={() =>
                            updatePc(pc.id, {
                              saveProf: pc.saveProf.includes(a.key)
                                ? pc.saveProf.filter((x) => x !== a.key)
                                : [...pc.saveProf, a.key]
                            })
                          }
                        />
                        save
                      </label>
                    </>
                  ) : (
                    <div className="mt-0.5 rounded-full border border-border px-2 text-xs text-ink-muted">{score}</div>
                  )}
                </div>
              )
            })}
          </div>
        </Panel>

        {/* Saving throws */}
        <Panel>
          <SectionLabel>Saving throws</SectionLabel>
          <div className="grid grid-cols-2 gap-x-3 gap-y-1">
            {ABILITIES.map((a) => {
              const prof = pc.saveProf.includes(a.key)
              return (
                <div key={a.key} className="flex items-center gap-1.5 text-xs">
                  <span className={cn('h-2 w-2 shrink-0 rounded-full border', prof ? 'border-accent bg-accent' : 'border-border-strong')} />
                  <span className="w-7 shrink-0 font-semibold uppercase text-ink-muted">{a.label}</span>
                  <span className={cn(prof ? 'font-medium text-ink' : 'text-ink-muted')}>
                    {fmtMod(saveMod(pc.abilities, a.key, prof, pc.level))}
                  </span>
                </div>
              )
            })}
          </div>
        </Panel>

        {/* Passive scores */}
        <Panel>
          <SectionLabel>Passive scores</SectionLabel>
          <div className="space-y-1">
            {[
              ['Passive Perception', pp],
              ['Passive Investigation', pi],
              ['Passive Insight', pinsight]
            ].map(([label, val]) => (
              <div key={label as string} className="flex items-center justify-between px-1 py-0.5 text-xs">
                <span className="text-ink-muted">{label as string}</span>
                <span className="font-semibold text-ink">{val as number}</span>
              </div>
            ))}
          </div>
        </Panel>

        {/* Senses */}
        {pc.senses.length > 0 && (
          <Panel>
            <SectionLabel>Senses</SectionLabel>
            <div className="flex flex-wrap gap-1">
              {pc.senses.map((s) => (
                <span key={s} className="chip text-[11px]">{s}</span>
              ))}
            </div>
          </Panel>
        )}

        {/* Proficiencies */}
        <Panel>
          <SectionLabel>Proficiencies & training</SectionLabel>
          <div className="space-y-2">
            <TagField label="Armour" value={pc.armorProf} options={PROFICIENCIES} onChange={(v) => updatePc(pc.id, { armorProf: v })} />
            <TagField label="Weapons" value={pc.weaponProf} options={['Simple weapons', 'Martial weapons']} onChange={(v) => updatePc(pc.id, { weaponProf: v })} />
            <TagField label="Tools" value={pc.toolProf} options={["Thieves' tools", "Smith's tools", 'Herbalism kit', 'Disguise kit']} onChange={(v) => updatePc(pc.id, { toolProf: v })} />
            <TagField label="Languages" value={pc.languages} options={['Common', 'Dwarvish', 'Elvish', 'Giant', 'Gnomish', 'Goblin', 'Halfling', 'Orc', 'Abyssal', 'Celestial', 'Draconic', 'Infernal', 'Primordial', 'Sylvan', 'Undercommon']} onChange={(v) => updatePc(pc.id, { languages: v })} />
            {pc.otherProf.length > 0 && (
              <TagField label="Other" value={pc.otherProf} options={[]} onChange={(v) => updatePc(pc.id, { otherProf: v })} />
            )}
          </div>
        </Panel>

        {/* Defenses */}
        <Panel>
          <SectionLabel>Defenses & conditions</SectionLabel>
          <div className="space-y-2">
            <TagField label="Resistances" value={pc.resistances} options={DAMAGE_TYPES} onChange={(v) => updatePc(pc.id, { resistances: v })} />
            <TagField label="Immunities" value={pc.immunities} options={DAMAGE_TYPES} onChange={(v) => updatePc(pc.id, { immunities: v })} />
            <TagField label="Vulnerabilities" value={pc.vulnerabilities} options={DAMAGE_TYPES} onChange={(v) => updatePc(pc.id, { vulnerabilities: v })} />
            <TagField label="Conditions" value={pc.conditions} options={CONDITIONS} onChange={(v) => updatePc(pc.id, { conditions: v })} />
          </div>
        </Panel>
      </div>

      {/* ── CENTER PANEL: skills ── */}
      <div className="flex flex-col border-b border-border p-3 lg:w-56 lg:shrink-0 lg:overflow-y-auto lg:border-b-0 lg:border-r">
        <SectionLabel>Skills</SectionLabel>
        <div className="space-y-1.5">
          {SKILLS.map((sk) => {
            const prof = pc.skillProf.includes(sk.key)
            const row = (
              <>
                <span className={cn('h-2 w-2 shrink-0 rounded-full border', prof ? 'border-accent bg-accent' : 'border-border-strong')} />
                <span className="w-6 shrink-0 font-semibold uppercase text-ink-muted">{sk.ability}</span>
                <span className={cn('flex-1 truncate text-left', prof ? 'font-medium text-ink' : 'text-ink-muted')}>{sk.label}</span>
                <span className="w-6 text-right font-medium text-ink">{fmtMod(skillMod(pc.abilities, sk, prof, pc.level))}</span>
              </>
            )
            return editing ? (
              <button
                key={sk.key}
                type="button"
                title="Toggle proficiency"
                className="flex w-full items-center gap-1.5 rounded px-1 py-0.5 text-xs hover:bg-surface-3"
                onClick={() =>
                  updatePc(pc.id, {
                    skillProf: prof ? pc.skillProf.filter((k) => k !== sk.key) : [...pc.skillProf, sk.key]
                  })
                }
              >
                {row}
              </button>
            ) : (
              <div key={sk.key} className="flex items-center gap-1.5 text-xs">{row}</div>
            )
          })}
        </div>
      </div>

      {/* ── RIGHT PANEL: combat stats + HP + actions ── */}
      <div className="flex flex-col gap-3 p-3 lg:min-w-0 lg:flex-1 lg:overflow-y-auto">
        {/* rest buttons */}
        <div className="flex items-center gap-2">
          <button type="button" className="btn-outline flex-1 text-xs" onClick={() => shortRestOne(pc.id)}>
            Short rest
          </button>
          <button type="button" className="btn-outline flex-1 text-xs" onClick={() => longRestOne(pc.id)}>
            Long rest
          </button>
          <button
            type="button"
            onClick={() => updatePc(pc.id, { inspiration: !pc.inspiration })}
            title="Toggle inspiration"
            className={cn(
              'flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium transition-colors',
              pc.inspiration ? 'border-accent bg-accent/10 text-accent' : 'border-border text-ink-muted hover:border-border-strong'
            )}
          >
            <Star size={13} className={pc.inspiration ? 'fill-accent' : ''} />
            Inspiration
          </button>
        </div>

        {/* top combat stats */}
        <div className="grid grid-cols-4 gap-2">
          <StatTile label="AC" value={ac} editing={editing} raw={pc.ac}
            onChange={(n) => updatePc(pc.id, { ac: n })} />
          <StatTile label="Initiative" value={fmtMod(initiative)} />
          <StatTile label="Speed" value={`${speed} ft`} editing={editing} raw={pc.speed}
            onChange={(n) => updatePc(pc.id, { speed: n })} />
          <StatTile label="Proficiency" value={fmtMod(pb)} />
        </div>

        {/* HP */}
        <Panel>
          <SectionLabel>Hit points</SectionLabel>
          {/* HP bar + temp HP pie inline */}
          <div className="mb-2 flex items-center gap-2">
            <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-surface-3">
              <div
                className={cn('h-full transition-all', hpColor(pc.currentHp, pc.maxHp))}
                style={{ width: `${pc.maxHp > 0 ? Math.min(100, (pc.currentHp / pc.maxHp) * 100) : 0}%` }}
              />
            </div>
            <TempHpPie value={pc.tempHp} max={tempHpMax} />
          </div>
          {/* Controls row */}
          <div className="flex flex-wrap items-center gap-1.5">
            {/* Current HP */}
            <input
              type="number"
              value={pc.currentHp}
              onChange={(e) => updatePc(pc.id, { currentHp: Math.max(0, Number(e.target.value)) })}
              className="w-14 rounded bg-surface px-1 py-0.5 text-center text-lg font-bold text-ink focus:outline-none"
            />
            <span className="text-ink-muted">/</span>
            {/* Max HP */}
            <input
              type="number"
              value={pc.maxHp}
              onChange={(e) => updatePc(pc.id, { maxHp: Math.max(0, Number(e.target.value)) })}
              className="w-14 rounded bg-surface px-1 py-0.5 text-center text-sm text-ink-muted focus:outline-none"
            />
            {/* Damage / heal amount */}
            <input
              type="number"
              value={hpAmt}
              placeholder="±"
              onChange={(e) => setHpAmt(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && applyHp(1)}
              className="ml-1 w-12 rounded border border-border bg-surface-2 px-1 py-0.5 text-center text-sm focus:outline-none"
            />
            <button
              type="button"
              className="rounded bg-danger/15 px-1.5 py-0.5 text-xs text-danger hover:bg-danger/25"
              title="Damage (drains temp first)"
              onClick={() => applyHp(1)}
            >
              −
            </button>
            <button
              type="button"
              className="rounded bg-success/15 px-1.5 py-0.5 text-xs text-success hover:bg-success/25"
              title="Heal"
              onClick={() => applyHp(-1)}
            >
              +
            </button>
            {/* Temp HP */}
            <div className="ml-auto flex items-center gap-1.5">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-blue-400">Tmp</span>
              <input
                type="number"
                value={pc.tempHp}
                onChange={(e) => {
                  const val = Math.max(0, Number(e.target.value))
                  updatePc(pc.id, { tempHp: val })
                  if (val > 0) setTempHpMax(val)
                }}
                className="w-12 rounded bg-surface-2 px-1 py-0.5 text-center text-sm text-ink focus:outline-none"
              />
              <span className="text-ink-muted">/</span>
              <span className="text-sm text-ink-muted">{tempHpMax}</span>
            </div>
          </div>
        </Panel>

        {/* Senses edit (if not on left) */}
        {pc.senses.length === 0 && (
          <Panel>
            <TagField label="Senses" value={pc.senses} options={['Darkvision 60 ft', 'Blindsight', 'Tremorsense', 'Truesight', 'Darkvision 120 ft']} onChange={(v) => updatePc(pc.id, { senses: v })} />
          </Panel>
        )}

        {/* Spell slots */}
        {(editing || activeLevels.length > 0) && (
          <Panel>
            <SectionLabel>Spell slots</SectionLabel>
            {editing ? (
              <div className="grid grid-cols-3 gap-2">
                {pc.slots.map((s) => (
                  <label key={s.level} className="flex items-center gap-2 text-sm">
                    <span className="w-7 text-xs text-ink-muted">L{s.level}</span>
                    <input
                      className="input w-14 px-1 text-center"
                      type="number"
                      min={0}
                      max={9}
                      value={s.max}
                      onChange={(e) => {
                        const max = Math.max(0, Math.min(Number(e.target.value), 9))
                        updatePc(pc.id, {
                          slots: pc.slots.map((sl) =>
                            sl.level === s.level ? { ...sl, max, current: Math.min(sl.current, max) } : sl
                          )
                        })
                      }}
                    />
                  </label>
                ))}
              </div>
            ) : (
              <div className="space-y-1">
                {activeLevels.map((s) => (
                  <SlotPips key={s.level} pc={pc} level={s.level} />
                ))}
              </div>
            )}
          </Panel>
        )}

        {/* Actions */}
        <Panel>
          <SectionLabel>Actions</SectionLabel>
          <ActionsBlock pc={pc} />
        </Panel>
      </div>
    </div>
  )
}
