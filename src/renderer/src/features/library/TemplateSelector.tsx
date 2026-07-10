import { X } from 'lucide-react'
import { TEMPLATES, CREATABLE_TYPES } from '@/lib/templates/schemas'
import { TYPE_META } from '@/components/typeMeta'
import type { ContentType } from '@/types/content'

interface TemplateSelectorProps {
  onPick: (type: ContentType) => void
  onClose: () => void
}

export function TemplateSelector({ onPick, onClose }: TemplateSelectorProps): JSX.Element {
  return (
    <div className="panel w-[560px] max-w-full">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <h2 className="text-sm font-semibold text-ink">New entry — choose a template</h2>
        <button type="button" className="icon-btn" onClick={onClose}>
          <X size={16} />
        </button>
      </div>
      <div className="grid grid-cols-2 gap-2 p-4">
        {CREATABLE_TYPES.map((type) => {
          const template = TEMPLATES[type]
          const meta = TYPE_META[type]
          const Icon = meta.icon
          return (
            <button
              key={type}
              type="button"
              onClick={() => onPick(type)}
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
    </div>
  )
}
