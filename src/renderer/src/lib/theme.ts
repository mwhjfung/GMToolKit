export type ThemeMode = 'light' | 'dark'

/** Switch between the two static palettes defined in index.css. */
export function applyTheme(mode: ThemeMode): void {
  document.documentElement.dataset.theme = mode
}
