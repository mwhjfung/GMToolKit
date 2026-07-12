import { resolve } from 'path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'
import { readFileSync } from 'fs'

const { version } = JSON.parse(readFileSync('./package.json', 'utf-8')) as { version: string }

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()]
  },
  preload: {
    plugins: [externalizeDepsPlugin()]
  },
  renderer: {
    resolve: {
      alias: {
        '@': resolve('src/renderer/src')
      }
    },
    plugins: [react()],
    define: {
      __APP_VERSION__: JSON.stringify(version),
      // Some npm packages (e.g. react-draggable, used by react-grid-layout)
      // reference process.env directly, assuming a bundler-provided Node
      // shim. The renderer has no Node globals (nodeIntegration: false), so
      // without this it throws "process is not defined" at runtime.
      'process.env': {}
    }
  }
})
