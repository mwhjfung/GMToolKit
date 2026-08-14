import { useEffect, useState } from 'react'
import { Outlet } from 'react-router-dom'
import { X, Download, ExternalLink } from 'lucide-react'
import { Sidebar } from './Sidebar'
import { DetailDrawer } from '@/components/DetailDrawer'
import { Toast } from '@/components/Toast'
import { VoiceDock } from '@/features/voice/VoiceDock'
import { EntryEditor } from '@/features/library/EntryEditor'
import { ImportDialog } from '@/features/library/ImportDialog'
import { useContentStore, subscribeContentSync } from '@/lib/store/contentStore'
import { useVoiceStore } from '@/lib/store/voiceStore'
import { useSettingsStore } from '@/lib/store/settingsStore'
import { useCombatStore } from '@/lib/store/combatStore'
import { usePcStore } from '@/lib/store/pcStore'
import { useCampaignStore } from '@/lib/store/campaignStore'
import { useSessionStore } from '@/lib/store/sessionStore'
import { useNotesStore } from '@/lib/store/notesStore'
import { useUiStore } from '@/lib/store/uiStore'
type UpdaterStatus = { phase: string; version?: string; percent?: number; message?: string; releaseUrl?: string }

function UpdateBanner(): JSX.Element | null {
  const [status, setStatus] = useState<UpdaterStatus>({ phase: 'idle' })
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    return window.dmc.updater.onStatus(setStatus)
  }, [])

  if (dismissed || status.phase !== 'available') return null

  const isMac = window.dmc.platform === 'darwin'

  return (
    <div className="flex shrink-0 items-center gap-2 bg-accent px-4 py-1.5 text-sm text-white">
      <span className="flex-1">
        v{status.version} is available
      </span>
      {isMac && status.releaseUrl ? (
        <button
          type="button"
          className="flex items-center gap-1 rounded px-2 py-0.5 font-medium hover:bg-white/20"
          onClick={() => void window.dmc.updater.install(status.releaseUrl)}
        >
          <ExternalLink size={13} />
          Download
        </button>
      ) : (
        <button
          type="button"
          className="flex items-center gap-1 rounded px-2 py-0.5 font-medium hover:bg-white/20"
          onClick={() => void window.dmc.updater.download()}
        >
          <Download size={13} />
          Download
        </button>
      )}
      <button
        type="button"
        className="rounded p-0.5 hover:bg-white/20"
        onClick={() => setDismissed(true)}
      >
        <X size={14} />
      </button>
    </div>
  )
}

export function AppLayout(): JSX.Element {
  const loadCampaigns = useCampaignStore((s) => s.load)
  const loadSessions = useSessionStore((s) => s.load)
  const loadContent = useContentStore((s) => s.load)
  const loadVoiceSettings = useVoiceStore((s) => s.loadSettings)
  const loadAppSettings = useSettingsStore((s) => s.load)
  const loadCombat = useCombatStore((s) => s.load)
  const loadPcs = usePcStore((s) => s.load)
  const loadNotes = useNotesStore((s) => s.load)
  const loadUi = useUiStore((s) => s.loadUi)
  const importOpen = useUiStore((s) => s.importOpen)
  const openSearch = useUiStore((s) => s.openSearch)

  // Global ⌘K / Ctrl+K shortcut
  useEffect(() => {
    const handle = (e: KeyboardEvent): void => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        openSearch()
      }
    }
    window.addEventListener('keydown', handle)
    return () => window.removeEventListener('keydown', handle)
  }, [openSearch])

  // Clear sticky popout routing once the popout window it points at closes.
  useEffect(() => {
    return window.dmc.panel.onBroadcast('panel:closed', (closedId) => {
      const s = useUiStore.getState()
      if (s.activePopoutId === closedId) {
        useUiStore.setState({ activePopoutId: null, popoutIds: [] })
      }
    })
  }, [])

  // Content edited/created/deleted in the panel popout window doesn't touch
  // this window's Zustand cache (Dexie is shared, in-memory state isn't) —
  // refetch here whenever the other window broadcasts a change.
  useEffect(() => {
    return subscribeContentSync()
  }, [])

  useEffect(() => {
    void (async () => {
      // Campaigns, then that campaign's sessions, so the per-session stores
      // (pins, combat, notes) read the right scope.
      await loadCampaigns()
      await loadSessions()
      await Promise.all([loadContent(), loadCombat(), loadPcs(), loadNotes()])
    })()
    void loadVoiceSettings()
    void loadAppSettings()
    void loadUi()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-bg text-ink">
      <UpdateBanner />
      <div className="flex min-h-0 flex-1 overflow-hidden">
        <Sidebar />
        <main className="relative min-h-0 min-w-0 flex-1 overflow-hidden">
          <Outlet />
          <DetailDrawer />
        </main>
        <VoiceDock />
      </div>
      <EntryEditor />
      {importOpen && <ImportDialog />}
      <Toast />
    </div>
  )
}
