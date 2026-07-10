import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { useUiStore } from '@/lib/store/uiStore'

export function Toast(): JSX.Element | null {
  const drawerMsg = useUiStore((s) => s.drawerToast)
  const dismissDrawer = useUiStore((s) => s.dismissToast)
  const appMsg = useUiStore((s) => s.appToast)
  const hideApp = useUiStore((s) => s.hideToast)

  useEffect(() => {
    if (!drawerMsg) return
    const t = setTimeout(dismissDrawer, 5000)
    return () => clearTimeout(t)
  }, [drawerMsg, dismissDrawer])

  useEffect(() => {
    if (!appMsg) return
    const t = setTimeout(hideApp, 4000)
    return () => clearTimeout(t)
  }, [appMsg, hideApp])

  return createPortal(
    <div
      aria-live="polite"
      aria-atomic="true"
      className="pointer-events-none fixed bottom-6 left-1/2 z-[80] flex -translate-x-1/2 flex-col items-center gap-2"
    >
      {appMsg && (
        <div
          role="alert"
          aria-live="assertive"
          aria-atomic="true"
          key={appMsg}
          className="animate-toast-in pointer-events-auto flex items-center gap-3 rounded-lg border border-accent bg-accent px-4 py-2.5 text-sm font-medium shadow-2xl"
          style={{ color: 'rgb(var(--accent-fg))' }}
        >
          <span>{appMsg}</span>
          <button
            type="button"
            aria-label="Dismiss notification"
            className="ml-1 shrink-0 rounded-full p-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-current/60"
            style={{ color: 'rgb(var(--accent-fg))' }}
            onClick={hideApp}
          >
            <X size={13} aria-hidden="true" />
          </button>
        </div>
      )}
      {drawerMsg && (
        <div
          role="status"
          aria-live="polite"
          aria-atomic="true"
          key={drawerMsg}
          className="animate-toast-in pointer-events-auto flex max-w-md items-start gap-3 rounded-lg border border-border bg-surface px-4 py-3 text-sm text-ink shadow-2xl"
        >
          <span>{drawerMsg}</span>
          <button
            type="button"
            aria-label="Dismiss notification"
            className="icon-btn -mr-1 shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
            onClick={dismissDrawer}
          >
            <X size={14} aria-hidden="true" />
          </button>
        </div>
      )}
    </div>,
    document.body
  )
}
