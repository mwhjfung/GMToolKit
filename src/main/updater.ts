import { app, shell, BrowserWindow, ipcMain } from 'electron'
import { autoUpdater } from 'electron-updater'

export type UpdaterPhase = 'idle' | 'checking' | 'available' | 'downloading' | 'ready' | 'error'

export interface UpdaterStatus {
  phase: UpdaterPhase
  version?: string
  percent?: number
  message?: string
  releaseUrl?: string
}

// ── Change these two constants to match your GitHub repo ──────────────────────
const GITHUB_OWNER = 'mwhjfung'
const GITHUB_REPO = 'GMToolKit'
// ─────────────────────────────────────────────────────────────────────────────

let _win: BrowserWindow | null = null

function send(status: UpdaterStatus): void {
  if (_win && !_win.isDestroyed()) _win.webContents.send('updater:status', status)
}

async function checkViaGitHubApi(): Promise<void> {
  send({ phase: 'checking' })
  const res = await fetch(
    `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/releases/latest`,
    { headers: { Accept: 'application/vnd.github.v3+json' } }
  )
  if (!res.ok) throw new Error(`GitHub API responded ${res.status}`)
  const rel = (await res.json()) as { tag_name: string; html_url: string }
  const latest = rel.tag_name.replace(/^v/, '')
  if (latest !== app.getVersion()) {
    send({ phase: 'available', version: latest, releaseUrl: rel.html_url })
  } else {
    send({ phase: 'idle' })
  }
}

export function setupUpdater(mainWindow: BrowserWindow): void {
  _win = mainWindow

  if (process.platform === 'darwin') {
    // macOS unsigned builds can't silently replace themselves — check via GitHub
    // API and let the user download the new DMG from the releases page.
    ipcMain.handle('updater:check', () =>
      checkViaGitHubApi().catch((e) => send({ phase: 'error', message: String(e) }))
    )
    ipcMain.handle('updater:download', () => undefined)
    ipcMain.handle('updater:install', (_e, releaseUrl: string) =>
      shell.openExternal(releaseUrl)
    )
  } else {
    // Windows: electron-updater downloads and applies the NSIS update silently.
    autoUpdater.autoDownload = false
    autoUpdater.autoInstallOnAppQuit = false

    autoUpdater.on('checking-for-update', () => send({ phase: 'checking' }))
    autoUpdater.on('update-available', (info) =>
      send({ phase: 'available', version: info.version })
    )
    autoUpdater.on('update-not-available', () => send({ phase: 'idle' }))
    autoUpdater.on('download-progress', (p) =>
      send({ phase: 'downloading', percent: Math.round(p.percent) })
    )
    autoUpdater.on('update-downloaded', (info) =>
      send({ phase: 'ready', version: info.version })
    )
    autoUpdater.on('error', (err) => send({ phase: 'error', message: err.message }))

    ipcMain.handle('updater:check', () =>
      autoUpdater.checkForUpdates().catch((e) => send({ phase: 'error', message: String(e) }))
    )
    ipcMain.handle('updater:download', () => autoUpdater.downloadUpdate())
    ipcMain.handle('updater:install', () => autoUpdater.quitAndInstall(false, true))
  }

  // Silent background check 5 s after launch (only in packaged builds — dev has no release server)
  if (app.isPackaged) {
    setTimeout(() => {
      if (process.platform === 'darwin') {
        checkViaGitHubApi().catch(() => undefined)
      } else {
        autoUpdater.checkForUpdates().catch(() => undefined)
      }
    }, 5_000)
  }
}
