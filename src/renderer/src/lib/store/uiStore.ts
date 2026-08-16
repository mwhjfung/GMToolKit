import { create } from 'zustand'
import type { ContentEntry, ContentType } from '@/types/content'
import { getSetting, setSetting } from '@/lib/db/content'
import { useSettingsStore } from './settingsStore'

/** Most detail panels that can stack vertically in one column. */
export const MAX_PANELS_PER_COLUMN = 2

export const PANEL_TOO_MANY_MESSAGE =
  'Got too many things open mate, maybe... sort yourself out and close some?'

/** Re-flow a column layout to fit a new column budget (used on width change). */
function repack(cols: string[][], maxCols: number): string[][] {
  const flat = cols.flat()
  const out: string[][] = []
  const base = Math.min(Math.max(1, maxCols), flat.length)
  for (let j = 0; j < base; j += 1) out.push([flat[j]])
  for (let k = base; k < flat.length; k += 1) {
    let placed = false
    for (let j = out.length - 1; j >= 0; j -= 1) {
      if (out[j].length < MAX_PANELS_PER_COLUMN) {
        out[j].push(flat[k])
        placed = true
        break
      }
    }
    if (!placed) break
  }
  return out
}

export type EditorState =
  | { kind: 'closed' }
  | { kind: 'select' }
  | { kind: 'form'; type: ContentType; entry: ContentEntry | null }

interface UiState {
  /**
   * Open detail panels arranged into columns (left→right), each up to
   * MAX_PANELS_PER_COLUMN tall. Opening tiles a new column on the left; with no
   * room it stacks onto the right-most column. The DM can drag panels to
   * re-arrange, so the column structure is stored explicitly. maxPanelColumns is
   * how many columns fit left of the nav, set from the measured layout.
   */
  drawerColumns: string[][]
  maxPanelColumns: number
  /** Transient message shown when there's no room left for another panel. */
  drawerToast: string | null
  /** Content ids shown in *this* window, only meaningful when this renderer is a panel window. */
  panelWindowIds: string[]
  setPanelWindowIds: (ids: string[]) => void
  /**
   * True when this renderer IS a popped-out panel window (resolved once at
   * startup via `window.dmc.panel.isPanelWindow()`). A panel window has no
   * `DetailDrawer` and must never try to spawn another panel window — it can
   * only add to its own local `panelWindowIds`.
   */
  isPanelWindowRenderer: boolean
  setIsPanelWindowRenderer: (v: boolean) => void
  /** Id of the active pop-out panel window, if any. Sticky: once set, further opens route there. */
  activePopoutId: number | null
  /** Content ids currently shown in the active popout window. */
  popoutIds: string[]
  openDrawer: (id: string) => Promise<void>
  /** Explicitly pop a panel out of the local drawer into its own window. */
  openInNewWindow: (id: string) => Promise<void>
  closePanel: (id: string) => void
  closeDrawer: () => void
  /** Replace the column layout (used by drag-to-rearrange). */
  setDrawerColumns: (cols: string[][]) => void
  setMaxPanelColumns: (n: number) => void
  dismissToast: () => void

  /** General-purpose accent toast (rest messages, etc.). */
  appToast: string | null
  showToast: (msg: string) => void
  hideToast: () => void

  /** Whether the voice transcript + keyword feed dock is visible. */
  feedOpen: boolean
  setFeedOpen: (v: boolean) => void
  toggleFeed: () => void

  /** Custom-content editor overlay state. */
  editor: EditorState
  /** Source/world to pre-fill when creating a new entry (from a Library tab). */
  editorDefaultWorld: string
  openTemplateSelect: (defaultWorld?: string) => void
  openCreate: (type: ContentType, defaultWorld?: string) => void
  openEdit: (entry: ContentEntry) => void
  closeEditor: () => void

  /** Document-import overlay. */
  importOpen: boolean
  /** Source/world to pre-fill in the import dialog. */
  importDefaultWorld: string
  openImport: (defaultWorld?: string) => void
  closeImport: () => void

  /** Global search overlay. */
  searchOpen: boolean
  openSearch: () => void
  closeSearch: () => void

  /** PC to auto-select when navigating to the Party page from global search. */
  activePcId: string | null
  setActivePcId: (id: string | null) => void

  /** Collapsed sidebar (icons only). Persisted. */
  sidebarCollapsed: boolean
  toggleSidebar: () => void
  setSidebarCollapsed: (v: boolean) => void
  loadUi: () => Promise<void>
}

export const useUiStore = create<UiState>((set, get) => ({
  drawerColumns: [],
  maxPanelColumns: 2,
  drawerToast: null,
  openDrawer: async (id) => {
    if (get().isPanelWindowRenderer) {
      // Already inside a popped-out panel window — there's no DetailDrawer
      // to route to and it must never spawn another panel window. Just add
      // the id to this window's own local stack.
      const ids = get().panelWindowIds.includes(id) ? get().panelWindowIds : [...get().panelWindowIds, id]
      set({ panelWindowIds: ids })
      // Tell the main window too — otherwise its `popoutIds` goes stale and
      // the next card *it* opens here re-broadcasts the old list, silently
      // dropping this one.
      window.dmc.panel.broadcast('panel:show', ids)
      return
    }
    const alwaysNew = useSettingsStore.getState().alwaysOpenInNewWindow
    const active = get().activePopoutId
    if (alwaysNew || active != null) {
      if (active == null) {
        const winId = await window.dmc.panel.open()
        set({ activePopoutId: winId, popoutIds: [id] })
        window.dmc.panel.broadcast('panel:show', [id])
        void window.dmc.panel.focus(winId)
        return
      }
      const ids = get().popoutIds.includes(id) ? get().popoutIds : [...get().popoutIds, id]
      set({ popoutIds: ids })
      window.dmc.panel.broadcast('panel:show', ids)
      // The popout may already be open but backgrounded — without bringing
      // it forward, routing content there is silent from the user's point
      // of view (they clicked something in the main window and nothing
      // visibly happened) until they happen to switch to it themselves.
      void window.dmc.panel.focus(active)
      return
    }
    set((s) => {
      if (s.drawerColumns.some((c) => c.includes(id))) return s // already open
      const cols = s.drawerColumns.map((c) => [...c])
      if (cols.length < Math.max(1, s.maxPanelColumns)) {
        cols.unshift([id]) // new column, newest on the left
        return { drawerColumns: cols, drawerToast: null }
      }
      for (let j = cols.length - 1; j >= 0; j -= 1) {
        if (cols[j].length < MAX_PANELS_PER_COLUMN) {
          cols[j].push(id) // stack onto the right-most column with room
          return { drawerColumns: cols, drawerToast: null }
        }
      }
      return { drawerToast: PANEL_TOO_MANY_MESSAGE }
    })
  },
  openInNewWindow: async (id) => {
    set((s) => ({
      drawerColumns: s.drawerColumns.map((c) => c.filter((p) => p !== id)).filter((c) => c.length > 0)
    }))
    const active = get().activePopoutId
    if (active != null) {
      // A popout is already open (sticky) — target it instead of spawning another.
      const ids = get().popoutIds.includes(id) ? get().popoutIds : [...get().popoutIds, id]
      set({ popoutIds: ids })
      window.dmc.panel.broadcast('panel:show', ids)
      return
    }
    try {
      const winId = await window.dmc.panel.open()
      set({ activePopoutId: winId, popoutIds: [id] })
      window.dmc.panel.broadcast('panel:show', [id])
    } catch (err) {
      // Window creation failed — don't leave the panel removed from the UI
      // with no recovery, put it back as its own column in the local drawer.
      console.error('Failed to open panel window', err)
      set((s) => ({ drawerColumns: [[id], ...s.drawerColumns] }))
    }
  },
  closePanel: (id) =>
    set((s) => ({
      drawerColumns: s.drawerColumns.map((c) => c.filter((p) => p !== id)).filter((c) => c.length > 0)
    })),
  closeDrawer: () => set({ drawerColumns: [] }),
  setDrawerColumns: (cols) => set({ drawerColumns: cols.filter((c) => c.length > 0) }),
  setMaxPanelColumns: (n) =>
    set((s) => {
      if (n === s.maxPanelColumns) return s // no real change — keep manual layout
      return { maxPanelColumns: n, drawerColumns: repack(s.drawerColumns, n) }
    }),
  dismissToast: () => set({ drawerToast: null }),
  panelWindowIds: [],
  setPanelWindowIds: (ids) => set({ panelWindowIds: ids }),
  isPanelWindowRenderer: false,
  setIsPanelWindowRenderer: (v) => set({ isPanelWindowRenderer: v }),
  activePopoutId: null,
  popoutIds: [],

  appToast: null,
  showToast: (msg) => set({ appToast: msg }),
  hideToast: () => set({ appToast: null }),

  feedOpen: false,
  setFeedOpen: (v) => set({ feedOpen: v }),
  toggleFeed: () => set((s) => ({ feedOpen: !s.feedOpen })),

  editor: { kind: 'closed' },
  editorDefaultWorld: '',
  openTemplateSelect: (defaultWorld = '') =>
    set({ editor: { kind: 'select' }, editorDefaultWorld: defaultWorld }),
  openCreate: (type, defaultWorld) =>
    set((s) => ({
      editor: { kind: 'form', type, entry: null },
      editorDefaultWorld: defaultWorld ?? s.editorDefaultWorld
    })),
  openEdit: (entry) => set({ editor: { kind: 'form', type: entry.type, entry } }),
  closeEditor: () => set({ editor: { kind: 'closed' }, editorDefaultWorld: '' }),

  importOpen: false,
  importDefaultWorld: '',
  openImport: (defaultWorld = '') => set({ importOpen: true, importDefaultWorld: defaultWorld }),
  closeImport: () => set({ importOpen: false, importDefaultWorld: '' }),

  searchOpen: false,
  openSearch: () => set({ searchOpen: true }),
  closeSearch: () => set({ searchOpen: false }),

  activePcId: null,
  setActivePcId: (id) => set({ activePcId: id }),

  sidebarCollapsed: false,
  toggleSidebar: () =>
    set((s) => {
      const v = !s.sidebarCollapsed
      void setSetting('sidebarCollapsed', v)
      return { sidebarCollapsed: v }
    }),
  setSidebarCollapsed: (v) => {
    void setSetting('sidebarCollapsed', v)
    set({ sidebarCollapsed: v })
  },
  loadUi: async () => {
    const v = await getSetting<boolean>('sidebarCollapsed')
    if (v != null) set({ sidebarCollapsed: v })
  }
}))
