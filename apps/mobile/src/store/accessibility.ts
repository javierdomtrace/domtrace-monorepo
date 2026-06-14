import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import AsyncStorage from '@react-native-async-storage/async-storage'

// ── Mismo modelo que el panel web (apps/web-panel/src/store/accessibility.ts) ──
export type FontSize = 'normal' | 'large' | 'xlarge'
export type A11yMode = 'none' | 'visual' | 'motor' | 'cognitive' | 'deaf'

interface AccessibilityStore {
  // Visual
  highContrast: boolean
  fontSize: FontSize
  // Movimiento
  reducedMotion: boolean
  // Lector de pantalla
  screenReaderHints: boolean
  // Voz
  voiceFeedback: boolean
  // Perfil activo
  activeMode: A11yMode
  // Acciones
  toggleHighContrast: () => void
  setFontSize: (size: FontSize) => void
  toggleReducedMotion: () => void
  toggleScreenReaderHints: () => void
  toggleVoiceFeedback: () => void
  setMode: (mode: A11yMode) => void
  reset: () => void
}

const defaults = {
  highContrast: false,
  fontSize: 'normal' as FontSize,
  reducedMotion: false,
  screenReaderHints: false,
  voiceFeedback: false,
  activeMode: 'none' as A11yMode,
}

export const useA11y = create<AccessibilityStore>()(
  persist(
    (set) => ({
      ...defaults,
      toggleHighContrast: () => set(s => ({ highContrast: !s.highContrast })),
      setFontSize: (fontSize) => set({ fontSize }),
      toggleReducedMotion: () => set(s => ({ reducedMotion: !s.reducedMotion })),
      toggleScreenReaderHints: () => set(s => ({ screenReaderHints: !s.screenReaderHints })),
      toggleVoiceFeedback: () => set(s => ({ voiceFeedback: !s.voiceFeedback })),
      // Perfiles rapidos - mismos presets que el panel web
      setMode: (mode) => {
        if (mode === 'visual')         set({ activeMode: mode, highContrast: true, fontSize: 'xlarge', screenReaderHints: true, voiceFeedback: true })
        else if (mode === 'motor')     set({ activeMode: mode, reducedMotion: true, fontSize: 'large', voiceFeedback: true })
        else if (mode === 'cognitive') set({ activeMode: mode, fontSize: 'large', reducedMotion: true })
        else if (mode === 'deaf')      set({ activeMode: mode, screenReaderHints: false })
        else                            set({ activeMode: 'none' })
      },
      reset: () => set(defaults),
    }),
    {
      name: 'stoqly-a11y-mobile',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
)

// Factores de escala de texto aplicados en toda la app
export const FONT_SCALE: Record<FontSize, number> = {
  normal: 1,
  large: 1.15,
  xlarge: 1.3,
}
