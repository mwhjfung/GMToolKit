const { execFileSync } = require('node:child_process')
const { join } = require('node:path')

// No paid Apple Developer certificate, so electron-builder produces an
// unsigned .app. On Apple Silicon, macOS refuses to even launch a fully
// unsigned binary and shows a misleading "is damaged" error instead of the
// usual "unidentified developer" Gatekeeper prompt. An ad-hoc signature
// satisfies that OS-level requirement (the "unidentified developer" prompt
// still applies, right-click Open handles it).
module.exports = async function afterSign(context) {
  if (context.electronPlatformName !== 'darwin') return
  const appName = context.packager.appInfo.productFilename
  const appPath = join(context.appOutDir, `${appName}.app`)
  // codesign refuses to sign a bundle carrying resource forks / Finder
  // metadata xattrs, which packaging can leave behind — strip them first.
  execFileSync('xattr', ['-cr', appPath], { stdio: 'inherit' })
  execFileSync('codesign', ['--force', '--deep', '--sign', '-', appPath], { stdio: 'inherit' })
}
