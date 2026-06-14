import { useA11y, FONT_SCALE } from '@/store/accessibility'
import { getTheme, type Theme } from '@/theme'

/**
 * Hook central de accesibilidad. Combina el store global (persistido) con
 * helpers listos para usar en cualquier pantalla:
 *  - theme: paleta normal o de alto contraste segun el ajuste activo
 *  - fontScale: factor (1 / 1.15 / 1.3) para multiplicar cualquier fontSize
 *  - scale(px): aplica fontScale a un tamano de fuente y redondea
 *  - reducedMotion: si esta activo, las animaciones deben omitirse o acortarse
 *  - animDuration(ms): devuelve 0 si reducedMotion, si no devuelve ms
 */
export function useA11yTheme(): {
  theme: Theme
  fontScale: number
  scale: (px: number) => number
  highContrast: boolean
  reducedMotion: boolean
  screenReaderHints: boolean
  voiceFeedback: boolean
  animDuration: (ms: number) => number
} {
  const highContrast = useA11y(s => s.highContrast)
  const fontSize = useA11y(s => s.fontSize)
  const reducedMotion = useA11y(s => s.reducedMotion)
  const screenReaderHints = useA11y(s => s.screenReaderHints)
  const voiceFeedback = useA11y(s => s.voiceFeedback)

  const fontScale = FONT_SCALE[fontSize]

  return {
    theme: getTheme(highContrast),
    fontScale,
    scale: (px: number) => Math.round(px * fontScale),
    highContrast,
    reducedMotion,
    screenReaderHints,
    voiceFeedback,
    animDuration: (ms: number) => (reducedMotion ? 0 : ms),
  }
}
