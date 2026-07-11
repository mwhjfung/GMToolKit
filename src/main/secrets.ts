import Store from 'electron-store'

/**
 * Secrets live in the main process only, never in the renderer's IndexedDB.
 * electron-store's encryptionKey is obfuscation, not real security — fine for a
 * single personal machine.
 */
interface SecretsSchema {
  anthropicApiKey?: string
}

export const secretsStore = new Store<SecretsSchema>({
  name: 'dm-command-secrets',
  encryptionKey: 'dm-command-local-obfuscation',
  clearInvalidConfig: true
})
