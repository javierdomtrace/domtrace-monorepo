export const theme = {
  brand:   '#1D9E75',
  teal:    '#4ECDC4',
  bg:      '#0F1923',
  surface: '#1A2633',
  border:  '#263545',
  text:    '#EEF3F6',
  muted:   '#7A9BB5',
  danger:  '#E24B4A',
  warn:    '#EF9F27',
} as const

// Paleta de alto contraste: fondo negro puro, texto blanco puro,
// bordes y acentos muy saturados para maxima legibilidad.
export const themeHC = {
  brand:   '#00FFC2',
  teal:    '#00FFEE',
  bg:      '#000000',
  surface: '#0A0A0A',
  border:  '#FFFFFF',
  text:    '#FFFFFF',
  muted:   '#CCCCCC',
  danger:  '#FF5C5C',
  warn:    '#FFD23F',
} as const

export type Theme = {
  brand: string
  teal: string
  bg: string
  surface: string
  border: string
  text: string
  muted: string
  danger: string
  warn: string
}

// Devuelve la paleta activa segun el ajuste de alto contraste
export function getTheme(highContrast: boolean): Theme {
  return highContrast ? themeHC : theme
}
