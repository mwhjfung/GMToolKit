import './dataMigration'
import { app, shell, BrowserWindow, ipcMain, session } from 'electron'
import { join } from 'path'
import { secretsStore } from './secrets'
import { setupUpdater } from './updater'

// A second launch (app already running in the background, or opened twice)
// would otherwise start a second process pointed at the same userData
// directory — Chromium's IndexedDB takes an exclusive on-disk lock per
// origin, so the second instance can silently never read or write any
// content (including SRD sync). Refuse the second launch and focus the
// existing window instead.
if (!app.requestSingleInstanceLock()) {
  app.quit()
}

let mainWindow: BrowserWindow | null = null

const panelWindows = new Map<number, BrowserWindow>()

// Channels a renderer is allowed to relay to other windows via `panel:broadcast`.
// Without this allowlist, any renderer could impersonate any IPC channel name
// (e.g. `updater:status`) since the relay forwards the payload verbatim.
const ALLOWED_BROADCAST_CHANNELS = ['panel:show', 'panel:closed', 'content:changed', 'panel:ready']

function broadcast(channel: string, senderId: number | null, payload: unknown): void {
  if (mainWindow && !mainWindow.isDestroyed() && mainWindow.webContents.id !== senderId) {
    mainWindow.webContents.send(channel, payload)
  }
  for (const [id, w] of panelWindows) {
    if (id === senderId) continue
    // A window can be destroyed (closed) without its `closed` handler having
    // run yet, or the map entry can lag briefly — never let a stale/destroyed
    // window's webContents.send throw and abort the loop for other windows.
    if (w.isDestroyed()) {
      panelWindows.delete(id)
      continue
    }
    w.webContents.send(channel, payload)
  }
}

function createPanelWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 760,
    height: 640,
    minWidth: 480,
    minHeight: 280,
    show: false,
    backgroundColor: '#140a13',
    autoHideMenuBar: true,
    title: 'GM Toolkit',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false,
      spellcheck: false
    }
  })

  // Capture the id now, before it's ever possible for `closed` to fire.
  // Accessing `win.webContents` *inside* the `closed` handler throws
  // ("Object has been destroyed") because WebContents is already torn down
  // by the time `closed` fires — and since Electron event emitters don't
  // propagate listener exceptions as crashes, that throw would be silently
  // swallowed, leaving a stale entry in `panelWindows` forever and breaking
  // every later broadcast.
  const id = win.webContents.id
  panelWindows.set(id, win)

  win.on('ready-to-show', () => win.show())
  win.on('closed', () => {
    panelWindows.delete(id)
    broadcast('panel:closed', null, id)
  })
  win.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  const rendererUrl = process.env['ELECTRON_RENDERER_URL']
  if (rendererUrl) {
    win.loadURL(`${rendererUrl}#/panel`)
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'), { hash: '/panel' })
  }

  return win
}

function createWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 640,
    minHeight: 680,
    show: false,
    backgroundColor: '#140a13',
    autoHideMenuBar: true,
    title: 'GM Toolkit',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false,
      spellcheck: false
    }
  })

  win.on('ready-to-show', () => win.show())
  win.on('closed', () => {
    if (mainWindow === win) mainWindow = null
  })

  // Open external links in the default browser, never inside the app.
  win.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  const rendererUrl = process.env['ELECTRON_RENDERER_URL']
  if (rendererUrl) {
    win.loadURL(rendererUrl)
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'))
  }

  mainWindow = win
  return win
}

function registerIpc(): void {
  ipcMain.handle('secrets:get', (_e, key: string) => secretsStore.get(key as never))
  ipcMain.handle('secrets:set', (_e, key: string, value: string) => {
    secretsStore.set(key as never, value as never)
  })
  ipcMain.handle('secrets:delete', (_e, key: string) => {
    secretsStore.delete(key as never)
  })

  // Fetch a (public) D&D Beyond character from the main process so the renderer
  // sidesteps CORS. Returns the raw service JSON for the renderer to map.
  ipcMain.handle('ddb:character', async (_e, id: string) => {
    const res = await fetch(
      `https://character-service.dndbeyond.com/character/v5/character/${encodeURIComponent(id)}`,
      { headers: { Accept: 'application/json' } }
    )
    if (!res.ok) throw new Error(`D&D Beyond responded ${res.status}`)
    return res.json()
  })

  ipcMain.handle('panel:open', () => createPanelWindow().webContents.id)

  ipcMain.handle('panel:close', (_e, id: number) => {
    panelWindows.get(id)?.close()
  })

  // Bring a popped-out window forward when content gets routed into it —
  // without this, sending a card to an already-open-but-backgrounded popout
  // is silent: nothing visibly changes in the window the user is looking at.
  ipcMain.handle('panel:focus', (_e, id: number) => {
    const win = panelWindows.get(id)
    if (!win || win.isDestroyed()) return
    if (win.isMinimized()) win.restore()
    win.show()
    win.focus()
  })

  ipcMain.handle('panel:isPanelWindow', (e) => panelWindows.has(e.sender.id))

  ipcMain.on('panel:broadcast', (e, channel: string, payload: unknown) => {
    if (!ALLOWED_BROADCAST_CHANNELS.includes(channel)) return
    broadcast(channel, e.sender.id, payload)
  })
}

app.whenReady().then(() => {
  // Allow the renderer to capture the microphone (Web Speech + Whisper paths).
  // On macOS the OS still shows its own one-time mic prompt on first use.
  session.defaultSession.setPermissionRequestHandler((_wc, permission, callback) => {
    callback(['media', 'audioCapture', 'mediaKeySystem'].includes(permission))
  })
  session.defaultSession.setPermissionCheckHandler((_wc, permission) => {
    return ['media', 'audioCapture'].includes(permission)
  })

  registerIpc()
  const win = createWindow()
  setupUpdater(win)

  app.on('activate', () => {
    // Check the main window specifically, not "any window" — a panel window
    // can still be open (main window closed) on macOS, and clicking the dock
    // icon should still recreate the main window in that case.
    if (mainWindow == null) createWindow()
  })
})

app.on('second-instance', () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore()
    mainWindow.focus()
  }
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
