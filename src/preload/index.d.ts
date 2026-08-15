export interface UpdaterStatus {
  phase: 'idle' | 'checking' | 'available' | 'downloading' | 'ready' | 'error'
  version?: string
  percent?: number
  message?: string
  releaseUrl?: string
}

export interface DmcApi {
  secrets: {
    get: (key: string) => Promise<string | undefined>
    set: (key: string, value: string) => Promise<void>
    delete: (key: string) => Promise<void>
  }
  ddb: {
    character: (id: string) => Promise<unknown>
  }
  updater: {
    check: () => Promise<void>
    download: () => Promise<void>
    install: (releaseUrl?: string) => Promise<void>
    onStatus: (cb: (status: UpdaterStatus) => void) => () => void
  }
  panel: {
    open: () => Promise<number>
    close: (id: number) => Promise<void>
    focus: (id: number) => Promise<void>
    isPanelWindow: () => Promise<boolean>
    broadcast: (channel: string, payload: unknown) => void
    onBroadcast: (channel: string, cb: (payload: unknown) => void) => () => void
  }
  platform: string
}

declare global {
  interface Window {
    dmc: DmcApi
  }
}
