import { useEffect } from 'react'
import { X } from 'lucide-react'
import { ContentDetail } from '@/components/ContentDetail'
import { useContentStore, subscribeContentSync } from '@/lib/store/contentStore'
import { useCampaignStore } from '@/lib/store/campaignStore'
import { useSessionStore } from '@/lib/store/sessionStore'
import { useSettingsStore } from '@/lib/store/settingsStore'
import { useUiStore } from '@/lib/store/uiStore'

export function PanelWindowApp(): JSX.Element {
  const loadContent = useContentStore((s) => s.load)
  const items = useContentStore((s) => s.items)
  const loadCampaigns = useCampaignStore((s) => s.load)
  const loadSessions = useSessionStore((s) => s.load)
  const loadAppSettings = useSettingsStore((s) => s.load)
  const ids = useUiStore((s) => s.panelWindowIds)
  const setPanelWindowIds = useUiStore((s) => s.setPanelWindowIds)
  const setIsPanelWindowRenderer = useUiStore((s) => s.setIsPanelWindowRenderer)

  // Mirror AppLayout's bootstrap: campaigns, then that campaign's sessions,
  // then content — otherwise getActiveCampaignId() reads '' in this window,
  // which causes any upsert here (e.g. RefLink's auto-stub creation) to
  // pollute the shared Source list with a campaign-less source, and filters
  // all existing custom content out of this window's visibleItems. Also load
  // settings so the theme is applied here too (a light-mode user shouldn't
  // get a dark pop-out window by default).
  useEffect(() => {
    void (async () => {
      await loadCampaigns()
      await loadSessions()
      await loadContent()
    })()
    void loadAppSettings()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // This renderer IS a panel window (this component only ever mounts on the
  // /panel route), but resolve it via the same isPanelWindow() IPC used
  // elsewhere rather than assuming, so uiStore.openDrawer's guard is driven
  // by the authoritative main-process answer.
  useEffect(() => {
    void window.dmc.panel.isPanelWindow().then(setIsPanelWindowRenderer)
  }, [setIsPanelWindowRenderer])

  // Content edited/created/deleted in the main window doesn't touch this
  // window's Zustand cache (Dexie is shared, in-memory state isn't) —
  // refetch here whenever the main window broadcasts a change.
  useEffect(() => {
    return subscribeContentSync()
  }, [])

  useEffect(() => {
    const unsubscribe = window.dmc.panel.onBroadcast('panel:show', (payload) => {
      setPanelWindowIds(payload as string[])
    })
    // Ask the main window for the current state. The immediate `panel:show`
    // broadcast sent right after `window.dmc.panel.open()` resolves can be
    // lost — this component (and its listener above) may not exist yet when
    // that first broadcast is sent. `panel:ready` asks for it again, so this
    // window ends up populated whether it lands the first time or not.
    window.dmc.panel.broadcast('panel:ready', null)
    return unsubscribe
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
