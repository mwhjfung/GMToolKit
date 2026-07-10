export type ThemeMode = 'light' | 'dark'

/** Preset primary colours offered in settings (plus a custom picker). */
export const ACCENT_PRESETS = ['#1fe0ff', '#a472ff', '#ff3d8b', '#22e29a', '#38bdf8', '#d98a3d', '#ff5470']

function hexToRgb(hex: string): [number, number, number] | null {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim())
  if (!m) return null
  const n = parseInt(m[1], 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

const triplet = ([r, g, b]: [number, number, number]): string => `${r} ${g} ${b}`

const darken = ([r, g, b]: [number, number, number], amt = 0.18): [number, number, number] => [
  Math.round(r * (1 - amt)),
  Math.round(g * (1 - amt)),
  Math.round(b * (1 - amt))
]

const blend = (
  base: [number, number, number],
  tint: [number, number, number],
  amount: number
): [number, number, number] => [
  Math.round(base[0] * (1 - amount) + tint[0] * amount),
  Math.round(base[1] * (1 - amount) + tint[1] * amount),
  Math.round(base[2] * (1 - amount) + tint[2] * amount)
]

/** Black or white text for the given accent, by perceived luminance. */
const foreground = ([r, g, b]: [number, number, number]): string =>
  (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.6 ? '0 0 0' : '255 255 255'

const DARK_BASES = {
  bg:        [8,   7,   15]  as [number, number, number],
  surface:   [15,  15,  24]  as [number, number, number],
  surface2:  [22,  22,  31]  as [number, number, number],
  surface3:  [31,  31,  43]  as [number, number, number],
}

const LIGHT_BASES = {
  bg:        [236, 240, 246] as [number, number, number],
  surface:   [255, 255, 255] as [number, number, number],
  surface2:  [238, 242, 248] as [number, number, number],
  surface3:  [226, 232, 242] as [number, number, number],
}

/**
 * Apply the (cyberpunk) theme in light or dark, plus an optional primary-colour
 * override that recolours the accent while keeping the rest of the palette. Pass
 * an empty accent to use the theme's own primary.
 */
export function applyTheme(mode: ThemeMode, accent: string): void {
  const root = document.documentElement
  root.dataset.theme = `cyberpunk-${mode}`

  const rgb = accent ? hexToRgb(accent) : null
  if (rgb) {
    root.style.setProperty('--accent', triplet(rgb))
    root.style.setProperty('--accent-strong', triplet(darken(rgb)))
    root.style.setProperty('--accent-fg', foreground(rgb))

    const bases = mode === 'dark' ? DARK_BASES : LIGHT_BASES
    root.style.setProperty('--bg',        triplet(blend(bases.bg,       rgb, 0.04)))
    root.style.setProperty('--surface',   triplet(blend(bases.surface,  rgb, 0.025)))
    root.style.setProperty('--surface-2', triplet(blend(bases.surface2, rgb, 0.02)))
    root.style.setProperty('--surface-3', triplet(blend(bases.surface3, rgb, 0.02)))
  } else {
    root.style.removeProperty('--accent')
    root.style.removeProperty('--accent-strong')
    root.style.removeProperty('--accent-fg')
    root.style.removeProperty('--bg')
    root.style.removeProperty('--surface')
    root.style.removeProperty('--surface-2')
    root.style.removeProperty('--surface-3')
  }
}
