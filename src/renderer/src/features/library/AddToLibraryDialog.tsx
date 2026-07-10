import { useState } from 'react'
import { X, Upload } from 'lucide-react'
import { useUiStore } from '@/lib/store/uiStore'
import { TEMPLATES, CREATABLE_TYPES } from '@/lib/templates/schemas'
import { TYPE_META } from '@/components/typeMeta'
import type { ContentType } from '@/types/content'
import { cn } from '@/lib/cn'

export function AddToLibraryDialog({
  sourceName,
  onClose
}: {
  sourceName?: string
  onClose: () => void
}): JSX.Element {
  const openCreate = useUiStore((s) => s.openCreate)
  const openImport = useUiStore((s) => s.openImport)
  const [activeTab, setActiveTab] = useState<'new' | 'import'>('new')

  const pick = (type: ContentType): void => {
    onClose()
    openCreate(type, sourceName ?? '')
  }

  const startImport = (): void => {
    onClose()
    openImport(sourceName ?? '')
  }

  return (
    <div
      className="fixed inset-0 z-40 flex items-start justify-center bg-black/50 p-8"
    >
      <div className="panel mt-[4vh] w-[560px] max-w-full" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h2 className="text-sm font-semibold text-ink">Add to library</h2>
          <button type="button" className="icon-btn" onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        <div className="flex border-b border-border">
          {(['new', 'import'] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setActiveTab(t)}
              className={cn(
                'flex-1 border-b-2 py-2 text-sm font-medium transition-colors',
                activeTab === t
                  ? 'border-accent text-ink'
                  : 'border-transparent text-ink-muted hover:text-ink'
              )}
            >
              {t === 'new' ? 'New entry' : 'Import'}
            </button>
          ))}
        </div>

        {activeTab === 'new' ? (
          <div className="grid grid-cols-2 gap-2 p-4">
            {CREATABLE_TYPES.map((type) => {
              const template = TEMPLATES[type]
              const meta = TYPE_META[type]
              const Icon = meta.icon
              return (
                <button
                  key={type}
                  type="button"
                  onClick={() => pick(type)}
                  className="panel flex items-start gap-3 p-3 text-left transition-colors hover:border-border-strong hover:bg-surface-3"
                >
                  <Icon size={18} className={meta.accent} />
                  <div className="min-w-0">
                    <div className="font-medium text-ink">{template.label}</div>
                    <div className="text-xs text-ink-muted">{template.description}</div>
                  </div>
                </button>
              )
            })}
          </div>
        ) : (
          <div className="space-y-3 p-4">
            <p className="text-sm text-ink-muted">
              Bring in a <strong className="text-ink">JSON</strong> file from 5etools or a previous
              export for bulk import, or a{' '}
              <strong className="text-ink">Word, PDF, text or markdown</strong> file to parse into
              individual drafts. Nothing leaves your machine.
            </p>
            <button type="button" className="btn-accent w-full" onClick={startImport}>
              <Upload size={15} />
              Choose file &amp; import…
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
