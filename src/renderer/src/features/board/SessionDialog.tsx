import { useMemo, useState } from 'react'
import { X, Trash2 } from 'lucide-react'
import { useSessionStore, type DashSession, type CarryOver } from '@/lib/store/sessionStore'
import { cn } from '@/lib/cn'

interface SessionDialogProps {
  mode: 'add' | 'edit'
  session?: DashSession
  onClose: () => void
}

const CARRY_LABELS: Array<{ key: keyof CarryOver; label: string }> = [
  { key: 'pins', label: 'Pinned cards' },
  { key: 'initiative', label: 'Initiative tracker' },
  { key: 'notes', label: 'Notes' }
]

/**
 * Create or rename a dashboard session. When creating, the DM ticks what to
 * carry over from the current session; anything unticked starts empty.
 */
export function SessionDialog({ mode, session, onClose }: SessionDialogProps): JSX.Element {
  const sessions = useSessionStore((s) => s.sessions)
  const create = useSessionStore((s) => s.create)
  const rename = useSessionStore((s) => s.rename)
  const remove = useSessionStore((s) => s.remove)

  const nextNum = useMemo(() => Math.max(0, ...sessions.map((s) => s.num)) + 1, [sessions])
  const [name, setName] = useState(mode === 'edit' ? (session?.name ?? '') : `Session ${nextNum}`)
  const [carry, setCarry] = useState<CarryOver>({ pins: true, initiative: false, notes: false })

  const toggle = (k: keyof CarryOver): void => setCarry((c) => ({ ...c, [k]: !c[k] }))

  const save = (): void => {
    if (!name.trim() && mode === 'edit') return
    if (mode === 'add') void create(name, carry)
    else if (session) rename(session.id, name)
    onClose()
  }

  const del = (): void => {
    if (!session) return
    if (
      window.confirm(
        `Delete “${session.name}” and its board, initiative and notes? This can't be undone.`
      )
    ) {
      void remove(session.id)
      onClose()
    }
  }

  return (
    <div className="fixed inset-0 z-40 flex items-start justify-center bg-black/50 p-8">
      <div className="panel mt-[8vh] w-[420px]" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h2 className="text-sm font-semibold text-ink">
            {mode === 'add' ? 'New session' : 'Edit session'}
          </h2>
          <button type="button" className="icon-btn" onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        <div className="space-y-4 p-4">
          <div>
            <label className="label">Name</label>
            <input
              className="input"
              autoFocus
              value={name}
              placeholder={`Session ${nextNum}`}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') save()
              }}
            />
          </div>

          {mode === 'add' && (
            <div>
              <label className="label">Carry over from this session</label>
              <div className="space-y-1.5">
                {CARRY_LABELS.map(({ key, label }) => (
                  <label
                    key={key}
                    className={cn(
                      'flex cursor-pointer items-center gap-2 rounded-md border px-2.5 py-1.5 text-sm',
                      carry[key] ? 'border-accent/50 bg-accent/10 text-ink' : 'border-border text-ink-muted'
                    )}
                  >
                    <input type="checkbox" checked={carry[key]} onChange={() => toggle(key)} />
                    {label}
                  </label>
                ))}
              </div>
              <p className="mt-1 text-xs text-ink-muted">Unticked sections start fresh.</p>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 border-t border-border px-4 py-3">
          {mode === 'edit' && (
            <button type="button" className="btn-ghost text-danger hover:bg-danger/10" onClick={del}>
              <Trash2 size={15} />
              Delete
            </button>
          )}
          <div className="flex-1" />
          <button type="button" className="btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="btn-accent"
            disabled={mode === 'edit' && !name.trim()}
            onClick={save}
          >
            {mode === 'add' ? 'Create session' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}
