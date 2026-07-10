import { useRef, useState } from 'react'
import { X, Trash2, Sparkles, Upload, Loader2, AlertTriangle } from 'lucide-react'
import { usePcStore, newPc, type PcUnit } from '@/lib/store/pcStore'
import { useContentStore } from '@/lib/store/contentStore'
import { TagSelect } from '@/components/TagSelect'
import { ABILITIES, SKILLS, type AbilityKey } from '@/lib/dnd/character'
import { importFromDndBeyond } from '@/lib/import/ddb'
import { parseCharactersFromFile } from '@/lib/data/partyData'
import { getAllContent } from '@/lib/db/content'
import { autoLinkAndSeed } from '@/lib/import/autoLink'
import { cn } from '@/lib/cn'

type Draft = Omit<PcUnit, 'id'>

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

const stripId = (pc: PcUnit): Draft => {
  const { id: _id, ...rest } = pc
  return rest
}

export function CharacterDialog({
  mode,
  pc,
  onClose,
  onDone
}: {
  mode: 'add' | 'edit'
  pc?: PcUnit
  onClose: () => void
  onDone?: (msg: string) => void
}): JSX.Element {
  const addPc = usePcStore((s) => s.addPc)
  const updatePc = usePcStore((s) => s.updatePc)
  const removePc = usePcStore((s) => s.removePc)
  const bulkImport = useContentStore((s) => s.bulkImport)
  const [view, setView] = useState<'create' | 'import'>('create')
  const [d, setD] = useState<Draft>(() => (pc ? stripId(pc) : newPc()))

  // ---- import state ----
  const [url, setUrl] = useState('')
  const [busy, setBusy] = useState(false)
  const [importError, setImportError] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  const set = <K extends keyof Draft>(k: K, v: Draft[K]): void => setD((p) => ({ ...p, [k]: v }))
  const classValues = d.charClass.split('/').map((s) => s.trim()).filter(Boolean)
  const setClasses = (vals: string[]): void => set('charClass', vals.join(' / '))
  const setAbility = (k: AbilityKey, v: number): void =>
    setD((p) => ({ ...p, abilities: { ...p.abilities, [k]: v } }))
  const toggleSave = (k: AbilityKey): void =>
    setD((p) => ({
      ...p,
      saveProf: p.saveProf.includes(k) ? p.saveProf.filter((x) => x !== k) : [...p.saveProf, k]
    }))
  const toggleSkill = (k: string): void =>
    setD((p) => ({
      ...p,
      skillProf: p.skillProf.includes(k) ? p.skillProf.filter((x) => x !== k) : [...p.skillProf, k]
    }))
  const setSlotMax = (level: number, raw: number): void => {
    const max = Math.max(0, Math.min(raw, 9))
    setD((p) => ({
      ...p,
      slots: p.slots.map((s) =>
        s.level === level ? { ...s, max, current: Math.min(s.current, max) } : s
      )
    }))
  }

  const save = (): void => {
    if (!d.name.trim()) return
    const out = { ...d, name: d.name.trim() }
    if (mode === 'add') addPc(out)
    else if (pc) updatePc(pc.id, out)
    onClose()
  }

  const del = (): void => {
    if (pc && window.confirm(`Delete "${pc.name || 'this character'}"? This can't be undone.`)) {
      removePc(pc.id)
      onClose()
    }
  }

  const importDdb = async (): Promise<void> => {
    setBusy(true)
    setImportError('')
    try {
      const raw = await importFromDndBeyond(url)
      const allContent = await getAllContent()
      const { pc: imported, newEntries } = autoLinkAndSeed(raw, allContent, `${raw.name || 'PC'} (imported)`)
      if (newEntries.length) await bulkImport(newEntries)
      addPc(imported)
      const linked =
        imported.inventory.filter((i) => i.contentId).length +
        imported.spells.filter((s) => s.contentId).length +
        imported.features.filter((f) => f.contentId).length +
        imported.actions.filter((a) => a.contentId).length +
        (imported.backgroundContentId ? 1 : 0)
      const created = newEntries.length
      const detail =
        linked > 0
          ? created > 0
            ? ` — linked ${linked} and created ${created} library entries`
            : ` — linked ${linked} library entr${linked === 1 ? 'y' : 'ies'}`
          : ''
      onDone?.(`Imported ${imported.name || 'character'} from D&D Beyond${detail}. Double-check AC, HP and spell slots.`)
      onClose()
    } catch (e) {
      setImportError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  const importFile = async (file: File): Promise<void> => {
    setBusy(true)
    setImportError('')
    try {
      const pcs = await parseCharactersFromFile(file)
      if (!pcs.length) throw new Error('No characters found in that file.')
      const allContent = await getAllContent()
      let totalLinked = 0
      let totalCreated = 0
      for (const raw of pcs) {
        const { pc: imported, newEntries } = autoLinkAndSeed(raw, allContent, `${raw.name || 'PC'} (imported)`)
        if (newEntries.length) {
          await bulkImport(newEntries)
          allContent.push(...newEntries)
          totalCreated += newEntries.length
        }
        totalLinked +=
          imported.inventory.filter((i) => i.contentId).length +
          imported.spells.filter((s) => s.contentId).length +
          imported.features.filter((f) => f.contentId).length +
          imported.actions.filter((a) => a.contentId).length +
          (imported.backgroundContentId ? 1 : 0)
        addPc(imported)
      }
      const n = pcs.length
      const detail =
        totalLinked > 0
          ? totalCreated > 0
            ? ` — linked ${totalLinked} and created ${totalCreated} library entries`
            : ` — linked ${totalLinked} library entr${totalLinked === 1 ? 'y' : 'ies'}`
          : ''
      onDone?.(`Imported ${n} character${n === 1 ? '' : 's'} from file${detail}.`)
      onClose()
    } catch (e) {
      setImportError(String(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-40 flex items-start justify-center overflow-y-auto bg-black/50 p-8"
    >
      <div className="panel mt-[5vh] w-[580px] max-w-full" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div className="flex items-center gap-3">
            <h2 className="text-sm font-semibold text-ink">
              {mode === 'add' ? 'New character' : 'Edit character'}
            </h2>
            {mode === 'add' && (
              <div className="flex items-center gap-0.5 rounded-md border border-border p-0.5">
                {(['create', 'import'] as const).map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setView(v)}
                    className={cn(
                      'rounded px-2.5 py-0.5 text-xs font-medium transition-colors',
                      view === v
                        ? 'bg-accent text-accent-fg'
                        : 'text-ink-muted hover:text-ink'
                    )}
                  >
                    {v === 'create' ? 'Create' : 'Import'}
                  </button>
                ))}
              </div>
            )}
          </div>
          <button type="button" className="icon-btn" onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        {view === 'import' ? (
          <div className="space-y-4 p-4">
            <div>
              <label className="label flex items-center gap-1.5">
                <Sparkles size={13} className="text-accent" />
                From D&amp;D Beyond
              </label>
              <div className="flex gap-2">
                <input
                  className="input"
                  placeholder="dndbeyond.com/characters/… or character id"
                  value={url}
                  autoFocus
                  onChange={(e) => setUrl(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && !busy && void importDdb()}
                />
                <button
                  type="button"
                  className="btn-accent shrink-0"
                  disabled={busy || !url.trim()}
                  onClick={() => void importDdb()}
                >
                  {busy ? <Loader2 size={15} className="animate-spin" /> : null}
                  Import
                </button>
              </div>
              <p className="mt-1 text-xs text-ink-muted">
                The character's D&amp;D Beyond sharing must be set to Public. Weapons, feats and
                background are auto-linked to your library (or created if missing). AC, HP and spell
                slots are re-derived and worth a quick check.
              </p>
            </div>

            <div className="flex items-center gap-2 text-xs text-ink-muted">
              <div className="h-px flex-1 bg-border" />
              or
              <div className="h-px flex-1 bg-border" />
            </div>

            <div>
              <label className="label">From a JSON file</label>
              <button
                type="button"
                className="btn-outline"
                disabled={busy}
                onClick={() => fileRef.current?.click()}
              >
                <Upload size={15} />
                Choose file…
              </button>
              <input
                ref={fileRef}
                type="file"
                accept=".json"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0]
                  if (f) void importFile(f)
                  e.target.value = ''
                }}
              />
            </div>

            {importError && (
              <div className="flex items-start gap-2 rounded-md border border-danger/40 bg-danger/10 p-2.5 text-sm text-danger">
                <AlertTriangle size={15} className="mt-0.5 shrink-0" />
                {importError}
              </div>
            )}
          </div>
        ) : (
          <>
            <div className="max-h-[72vh] space-y-4 overflow-y-auto p-4">
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="label">Name</label>
                  <input
                    className="input"
                    autoFocus
                    value={d.name}
                    onChange={(e) => set('name', e.target.value)}
                    placeholder="Character name"
                  />
                </div>
                <div>
                  <label className="label">Alias</label>
                  <input
                    className="input"
                    value={d.alias ?? ''}
                    onChange={(e) => set('alias', e.target.value || undefined)}
                    placeholder="Nickname, title…"
                  />
                </div>
                <div>
                  <label className="label">Player name</label>
                  <input
                    className="input"
                    value={d.playerName ?? ''}
                    onChange={(e) => set('playerName', e.target.value || undefined)}
                    placeholder="Player's name"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Race</label>
                  <TagSelect
                    value={d.race}
                    options={D5E_RACES}
                    placeholder="Bugbear, Elf…"
                    onChange={(v) => set('race', Array.isArray(v) ? (v[0] ?? '') : (v as string))}
                  />
                </div>
                <div>
                  <label className="label">Class(es)</label>
                  <TagSelect
                    multi
                    value={classValues}
                    options={D5E_CLASSES}
                    placeholder="Rogue, Barbarian…"
                    onChange={(v) => setClasses(v as string[])}
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                {(
                  [
                    ['Level', 'level'],
                    ['AC', 'ac'],
                    ['Speed', 'speed'],
                    ['Max HP', 'maxHp'],
                    ['Current HP', 'currentHp'],
                    ['Temp HP', 'tempHp']
                  ] as Array<[string, 'level' | 'ac' | 'speed' | 'maxHp' | 'currentHp' | 'tempHp']>
                ).map(([label, key]) => (
                  <div key={key}>
                    <label className="label">{label}</label>
                    <input
                      className="input px-2 text-center"
                      type="number"
                      value={d[key]}
                      onChange={(e) => set(key, Number(e.target.value))}
                    />
                  </div>
                ))}
              </div>

              <div>
                <label className="label">Ability scores &amp; saves</label>
                <div className="grid grid-cols-6 gap-2">
                  {ABILITIES.map((a) => (
                    <div key={a.key} className="text-center">
                      <div className="text-[10px] font-semibold uppercase text-ink-muted">{a.label}</div>
                      <input
                        className="input px-1 text-center"
                        type="number"
                        value={d.abilities[a.key]}
                        onChange={(e) => setAbility(a.key, Number(e.target.value))}
                      />
                      <label className="mt-1 flex cursor-pointer items-center justify-center gap-1 text-[10px] text-ink-muted">
                        <input
                          type="checkbox"
                          checked={d.saveProf.includes(a.key)}
                          onChange={() => toggleSave(a.key)}
                        />
                        save
                      </label>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <label className="label">Skill proficiencies</label>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                  {SKILLS.map((sk) => (
                    <label key={sk.key} className="flex cursor-pointer items-center gap-1.5 text-sm text-ink-muted">
                      <input
                        type="checkbox"
                        checked={d.skillProf.includes(sk.key)}
                        onChange={() => toggleSkill(sk.key)}
                      />
                      {sk.label}
                      <span className="text-[10px] uppercase text-ink-muted">{sk.ability}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="label">Spell slots — max per level</label>
                <div className="grid grid-cols-3 gap-2">
                  {d.slots.map((s) => (
                    <label key={s.level} className="flex items-center gap-2 text-sm">
                      <span className="w-7 text-xs text-ink-muted">L{s.level}</span>
                      <input
                        className="input w-14 px-1 text-center"
                        type="number"
                        min={0}
                        max={9}
                        value={s.max}
                        onChange={(e) => setSlotMax(s.level, Number(e.target.value))}
                      />
                    </label>
                  ))}
                </div>
              </div>

              <p className="text-xs text-ink-muted">
                Senses, proficiencies, defences, conditions, actions and the other tabs are edited on the
                sheet itself.
              </p>
            </div>

            <div className="flex items-center gap-2 border-t border-border px-4 py-3">
              {mode === 'edit' && (
                <button type="button" className="btn-ghost text-danger hover:bg-danger/10" onClick={del}>
                  <Trash2 size={15} />
                  Delete
                </button>
              )}
              <div className="flex-1" />
              <button type="button" className="btn-ghost" onClick={onClose}>Cancel</button>
              <button type="button" className="btn-accent" disabled={!d.name.trim()} onClick={save}>
                {mode === 'add' ? 'Create' : 'Save'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
