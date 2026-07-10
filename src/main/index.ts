import { app, shell, BrowserWindow, ipcMain, session } from 'electron'
import { join } from 'path'
import { secretsStore } from './secrets'
import { setupUpdater } from './updater'

function createWindow(): BrowserWindow {
  const mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1080,
    minHeight: 680,
    show: false,
    backgroundColor: '#08070f',
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

  mainWindow.on('ready-to-show', () => mainWindow.show())

  // Open external links in the default browser, never inside the app.
  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  const rendererUrl = process.env['ELECTRON_RENDERER_URL']
  if (rendererUrl) {
    mainWindow.loadURL(rendererUrl)
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  return mainWindow
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
  const mainWindow = createWindow()
  setupUpdater(mainWindow)

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
