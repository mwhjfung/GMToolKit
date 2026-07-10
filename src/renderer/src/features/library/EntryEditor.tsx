import { useEffect } from 'react'
import { useUiStore } from '@/lib/store/uiStore'
import { TemplateSelector } from './TemplateSelector'
import { EntryForm } from './EntryForm'

/** App-level host for the custom-content editor overlay (reachable from anywhere). */
export function EntryEditor(): JSX.Element | null {
  const editor = useUiStore((s) => s.editor)
  const openCreate = useUiStore((s) => s.openCreate)
  const close = useUiStore((s) => s.closeEditor)

  useEffect(() => {
    if (editor.kind === 'closed') return
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') close()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [editor.kind, close])

  if (editor.kind === 'closed') return null

  return (
    <div
      className="fixed inset-0 z-40 flex items-start justify-center overflow-y-auto bg-black/50 p-8"
    >
      <div className="mt-[4vh]" onClick={(e) => e.stopPropagation()}>
        {editor.kind === 'select' ? (
          <TemplateSelector onPick={openCreate} onClose={close} />
        ) : (
          <EntryForm type={editor.type} entry={editor.entry} onClose={close} />
        )}
      </div>
    </div>
  )
}
