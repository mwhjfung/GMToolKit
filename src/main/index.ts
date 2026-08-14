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

function broadcast(channel: string, senderId: number | null, payload: unknown): void {
  if (mainWindow && mainWindow.webContents.id !== senderId) {
    mainWindow.webContents.send(channel, payload)
  }
  for (const [id, w] of panelWindows) {
    if (id !== senderId) w.webContents.send(channel, payload)
  }
}

function createPanelWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 420,
    height: 640,
    minWidth: 320,
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

  win.on('ready-to-show', () => win.show())
  win.on('closed', () => {
    const id = win.webContents.id
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

  panelWindows.set(win.webContents.id, win)
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

  ipcMain.handle('panel:isPanelWindow', (e) => panelWindows.has(e.sender.id))

  ipcMain.on('panel:broadcast', (e, channel: string, payload: unknown) => {
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
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
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
