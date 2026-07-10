import { useEffect, useRef, useState } from 'react'
import { ChevronsUpDown, Check, Plus, Pencil, Trash2, X } from 'lucide-react'
import { useCampaignStore } from '@/lib/store/campaignStore'
import { useUiStore } from '@/lib/store/uiStore'
import { cn } from '@/lib/cn'

const EMOJI_CATEGORIES: Array<{ label: string; emoji: string[] }> = [
  {
    label: 'D&D / Fantasy',
    emoji: [
      '🎲','⚔️','🐉','🏰','🗡️','🛡️','🔥','❄️','💀','👑',
      '🌲','🌊','⭐','📜','🧙','👹','🏔️','🌌','💎','🔮',
      '🪄','🏹','🔑','🗝️','⚡','🩸','🌑','🌕','🧿','🗺️',
      '🕯️','⚗️','🧪','📿','🎭','☠️','🌪️','🦇','🕷️','🦂',
    ]
  },
  {
    label: 'Creatures',
    emoji: [
      '🐺','🦁','🐻','🦊','🦅','🐍','🦄','🐲','🦎','🦈',
      '🦣','🦬','🦋','🐊','🦭','🦝','🦌','🐗','🦏','🐘',
    ]
  },
  {
    label: 'People',
    emoji: [
      '🧙','🧝','🧛','🧟','🧌','🧜','🧚','👹','👺','🤺',
      '🏇','🧗','🤴','👸','🧔','🗣️','👁️','🧠','💪','🦾',
    ]
  },
  {
    label: 'Nature',
    emoji: [
      '🌳','🌵','🌺','🍄','🌙','🌈','⛰️','🌊','🌿','🍀',
      '🌸','💧','🌾','🌻','🏞️','🌄','🌅','🌠','🪨','🍃',
    ]
  },
  {
    label: 'Objects',
    emoji: [
      '📜','🗺️','💰','🏆','👑','🎪','📯','🪗','🎺','🥁',
      '🛶','⛵','🚢','🏕️','⛺','🪤','🔭','📖','🗓️','✉️',
    ]
  },
  {
    label: 'Symbols',
    emoji: [
      '✨','💥','🌟','🌀','☁️','⛅','🔴','🟠','🟡','🟢',
      '🔵','🟣','⚫','⚪','🌐','♾️','⚜️','🔱','♦️','🃏',
    ]
  },
]

function EmojiPicker({
  value,
  onChange
}: {
  value: string | undefined
  onChange: (v: string | undefined) => void
}): JSX.Element {
  const [search, setSearch] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const q = search.trim().toLowerCase()
  const allEmoji = EMOJI_CATEGORIES.flatMap((c) => c.emoji)
  const filteredAll = q
    ? allEmoji.filter((e) => {
        try { return e.toLowerCase().includes(q) } catch { return false }
      })
    : null

  return (
    <div className="space-y-1.5">
      {/* Custom emoji input */}
      <div className="flex items-center gap-1.5">
        <div className="relative flex-1">
          <input
            ref={inputRef}
            type="text"
            className="input h-7 pr-8 text-sm"
            placeholder="Type or paste any emoji…"
            value={search}
            onChange={(e) => {
              const val = e.target.value
              setSearch(val)
              const chars = [...val]
              if (chars.length === 1) onChange(val)
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && search.trim()) {
                onChange(search.trim())
                setSearch('')
              }
            }}
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-ink-muted hover:text-ink"
            >
              <X size={11} />
            </button>
          )}
        </div>
        <button
          type="button"
          onClick={() => onChange(undefined)}
          className={cn(
            'flex h-7 items-center rounded px-2 text-[11px] text-ink-muted hover:bg-surface-3',
            !value && 'ring-1 ring-accent'
          )}
        >
          None
        </button>
      </div>

      {/* Category grid */}
      <div className="max-h-40 overflow-y-auto p-0.5">
        {filteredAll ? (
          <div className="flex flex-wrap gap-0.5 px-0.5 py-0.5">
            {filteredAll.length === 0 ? (
              <p className="py-2 text-center text-[11px] text-ink-muted w-full">No match — try pasting above</p>
            ) : (
              filteredAll.map((e, i) => (
                <EmojiBtn key={i} emoji={e} selected={value === e} onSelect={onChange} />
              ))
            )}
          </div>
        ) : (
          EMOJI_CATEGORIES.map((cat) => (
            <div key={cat.label}>
              <p className="px-0.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-ink-muted">
                {cat.label}
              </p>
              <div className="flex flex-wrap gap-0.5">
                {cat.emoji.map((e) => (
                  <EmojiBtn key={e} emoji={e} selected={value === e} onSelect={onChange} />
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

function EmojiBtn({
  emoji,
  selected,
  onSelect
}: {
  emoji: string
  selected: boolean
  onSelect: (e: string) => void
}): JSX.Element {
  return (
    <button
      type="button"
      onClick={() => onSelect(emoji)}
      className={cn(
        'flex h-7 w-7 items-center justify-center rounded text-base hover:bg-surface-3',
        selected && 'ring-1 ring-accent'
      )}
    >
      {emoji}
    </button>
  )
}

export function CampaignSwitcher(): JSX.Element {
  const campaigns = useCampaignStore((s) => s.campaigns)
  const activeId = useCampaignStore((s) => s.activeId)
  const setActive = useCampaignStore((s) => s.setActive)
  const create = useCampaignStore((s) => s.create)
  const update = useCampaignStore((s) => s.update)
  const remove = useCampaignStore((s) => s.remove)
  const collapsed = useUiStore((s) => s.sidebarCollapsed)
  const setSidebarCollapsed = useUiStore((s) => s.setSidebarCollapsed)

  const [open, setOpen] = useState(false)
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const [newIcon, setNewIcon] = useState<string | undefined>('🎲')
  const [renaming, setRenaming] = useState(false)
  const [renameText, setRenameText] = useState('')
  const [renameIcon, setRenameIcon] = useState<string | undefined>(undefined)
  const ref = useRef<HTMLDivElement>(null)

  const active = campaigns.find((c) => c.id === activeId)

  useEffect(() => {
    const onDown = (e: MouseEvent): void => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
        setCreating(false)
        setRenaming(false)
      }
    }
    window.addEventListener('mousedown', onDown)
    return () => window.removeEventListener('mousedown', onDown)
  }, [])

  if (collapsed) {
    return (
      <div className="border-t border-border p-2">
        <button
          type="button"
          onClick={() => setSidebarCollapsed(false)}
          title={`Campaign: ${active?.name ?? ''}`}
          className="flex h-9 w-full items-center justify-center rounded-md text-lg leading-none hover:bg-surface-3"
        >
          {active?.icon ?? '🎲'}
        </button>
      </div>
    )
  }

  const doCreate = (): void => {
    if (!newName.trim()) return
    void create(newName.trim(), newIcon)
    setNewName('')
    setNewIcon('🎲')
    setCreating(false)
    setOpen(false)
  }

  const saveRename = (): void => {
    if (!active) return
    update(active.id, { name: renameText.trim() || active.name, icon: renameIcon })
    setRenaming(false)
  }

  return (
    <div ref={ref} className="relative border-t border-border p-2">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-3 rounded-md px-3 py-1.5 hover:bg-surface-3"
      >
        <span className="flex w-[17px] shrink-0 items-center justify-center text-[15px] leading-none">
          {active?.icon ?? '🎲'}
        </span>
        <span className="flex-1 truncate text-left text-[13px] font-medium text-ink">
          {active?.name ?? '—'}
        </span>
        <ChevronsUpDown size={13} className="shrink-0 text-ink-muted" />
      </button>

      {open && (
        <div className="absolute bottom-2 left-full z-50 ml-2 w-72 rounded-md border border-border bg-surface p-1 text-[13px] shadow-2xl">
          <div className="max-h-48 overflow-y-auto">
            {campaigns.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => {
                  setActive(c.id)
                  setOpen(false)
                }}
                className={cn(
                  'flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm',
                  c.id === activeId ? 'text-accent' : 'text-ink hover:bg-surface-3'
                )}
              >
                <span className="w-5 shrink-0 text-center text-sm leading-none">{c.icon ?? '🎲'}</span>
                <span className="flex-1 truncate">{c.name}</span>
                {c.id === activeId && <Check size={13} className="shrink-0" />}
              </button>
            ))}
          </div>

          <div className="my-1 border-t border-border" />

          {creating ? (
            <div className="space-y-2 p-1">
              <div className="flex gap-1">
                <input
                  autoFocus
                  className="input h-7 text-sm"
                  placeholder="Campaign name"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && doCreate()}
                />
                <button type="button" className="btn-accent shrink-0" onClick={doCreate}>
                  Add
                </button>
              </div>
              <EmojiPicker value={newIcon} onChange={setNewIcon} />
            </div>
          ) : !renaming ? (
            <button
              type="button"
              onClick={() => setCreating(true)}
              className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm text-ink-muted hover:bg-surface-3"
            >
              <Plus size={13} />
              New campaign
            </button>
          ) : null}

          {active &&
            (renaming ? (
              <div className="space-y-2 p-1">
                <div className="flex gap-1">
                  <input
                    autoFocus
                    className="input h-7 text-sm"
                    value={renameText}
                    onChange={(e) => setRenameText(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && saveRename()}
                  />
                  <button type="button" className="btn-outline shrink-0" onClick={saveRename}>
                    Save
                  </button>
                </div>
                <EmojiPicker value={renameIcon} onChange={setRenameIcon} />
              </div>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setRenameText(active.name)
                  setRenameIcon(active.icon)
                  setRenaming(true)
                }}
                className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm text-ink-muted hover:bg-surface-3"
              >
                <Pencil size={13} />
                Rename / emoji
              </button>
            ))}

          {active && campaigns.length > 1 && (
            <button
              type="button"
              onClick={() => {
                if (
                  window.confirm(
                    `Delete campaign "${active.name}" and its party, board and combat? Your content library is untouched.`
                  )
                ) {
                  void remove(active.id)
                }
                setOpen(false)
              }}
              className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm text-danger hover:bg-danger/10"
            >
              <Trash2 size={13} />
              Delete
            </button>
          )}
        </div>
      )}
    </div>
  )
}
