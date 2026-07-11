import { app } from 'electron'
import { copyFileSync, existsSync, mkdirSync, readdirSync, writeFileSync } from 'fs'
import { dirname, join } from 'path'

const LEGACY_APP_NAME = 'DM Command'
const MIGRATION_MARKER = '.migrated-from-dm-command'

// Chromium scratch/cache dirs — large, regenerated automatically, not user data.
const SKIP_DIRS = new Set([
  'Cache',
  'Code Cache',
  'GPUCache',
  'DawnCache',
  'DawnGraphiteCache',
  'GrShaderCache',
  'ShaderCache',
  'blob_storage'
])

function copyDirRecursive(src: string, dest: string): void {
  mkdirSync(dest, { recursive: true })
  for (const entry of readdirSync(src, { withFileTypes: true })) {
    if (entry.isDirectory() && SKIP_DIRS.has(entry.name)) continue
    const srcPath = join(src, entry.name)
    const destPath = join(dest, entry.name)
    if (entry.isDirectory()) {
      copyDirRecursive(srcPath, destPath)
    } else if (entry.isFile()) {
      copyFileSync(srcPath, destPath)
    }
  }
}

/**
 * The app was renamed from "DM Command" to "GM Toolkit" in 0.5.0 (appId and
 * productName both changed). Electron derives the userData directory from the
 * app name, so that rename silently pointed every existing install at a
 * fresh, empty profile on update — campaigns, library content and settings
 * were still on disk under the old name, just orphaned and invisible to the
 * app. This runs once, before anything else touches userData (import this
 * module first in main/index.ts), and copies the old profile over if the new
 * one looks unused. Any future app/productName rename needs the same kind of
 * migration or it will repeat this data loss.
 */
export function migrateLegacyUserData(): void {
  const userDataPath = app.getPath('userData')
  const legacyPath = join(dirname(userDataPath), LEGACY_APP_NAME)

  if (legacyPath === userDataPath || !existsSync(legacyPath)) return
  if (existsSync(join(userDataPath, MIGRATION_MARKER))) return
  // The new-named profile already has real data — don't clobber it.
  if (existsSync(join(userDataPath, 'IndexedDB'))) return

  try {
    copyDirRecursive(legacyPath, userDataPath)
    writeFileSync(join(userDataPath, MIGRATION_MARKER), new Date().toISOString())
  } catch (error) {
    console.error('Failed to migrate legacy "DM Command" user data:', error)
  }
}

migrateLegacyUserData()
