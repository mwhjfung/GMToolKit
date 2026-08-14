import { useEffect } from 'react'
import { X } from 'lucide-react'
import { ContentDetail } from '@/components/ContentDetail'
import { useContentStore, subscribeContentSync } from '@/lib/store/contentStore'
import { useUiStore } from '@/lib/store/uiStore'

export function PanelWindowApp(): JSX.Element {
  const loadContent = useContentStore((s) => s.load)
  const items = useContentStore((s) => s.items)
  const ids = useUiStore((s) => s.panelWindowIds)
  const setPanelWindowIds = useUiStore((s) => s.setPanelWindowIds)

  useEffect(() => {
    void loadContent()
  }, [loadContent])

  // Content edited/created/deleted in the main window doesn't touch this
  // window's Zustand cache (Dexie is shared, in-memory state isn't) —
  // refetch here whenever the main window broadcasts a change.
  useEffect(() => {
    return subscribeContentSync()
  }, [])

  useEffect(() => {
    return window.dmc.panel.onBroadcast('panel:show', (payload) => {
      setPanelWindowIds(payload as string[])
    })
  }, [setPanelWindowIds])

  return (
    <div className="flex h-screen flex-col divide-y divide-border bg-surface text-ink">
      {ids.length === 0 && (
        <div className="flex flex-1 items-center justify-center text-sm text-ink-muted">
          Nothing open
        </div>
      )}
      {ids.map((id) => {
        const entry = items.find((i) => i.id === id)
        if (!entry) return null
        return (
          <div key={id} className="flex min-h-0 flex-1 flex-col">
            <div className="flex items-center justify-end border-b border-border px-2 py-1.5">
              <button
                type="button"
                className="icon-btn"
                title="Close"
                onClick={() => setPanelWindowIds(ids.filter((i) => i !== id))}
              >
                <X size={16} />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-4">
              <ContentDetail entry={entry} />
            </div>
          </div>
        )
      })}
    </div>
  )
}
