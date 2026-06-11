import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type FontSize = 'normal' | 'large' | 'xlarge'
export type A11yMode = 'none' | 'visual' | 'motor' | 'cognitive' | 'deaf'

interface AccessibilityStore {
  // Visual
  highContrast: boolean
  fontSize: FontSize
  // Motion
  reducedMotion: boolean
  // Screen reader
  screenReaderHints: boolean
  // Voz
  voiceFeedback: boolean
  // Profiles
  activeMode: A11yMode
  // Actions
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
      setMode: (mode) => {
        // Presets per mode
        if (mode === 'visual')    set({ activeMode: mode, highContrast: true, fontSize: 'xlarge', screenReaderHints: true, voiceFeedback: true })
        else if (mode === 'motor')     set({ activeMode: mode, reducedMotion: true, fontSize: 'large', voiceFeedback: true })
        else if (mode === 'cognitive') set({ activeMode: mode, fontSize: 'large', reducedMotion: true })
        else if (mode === 'deaf')      set({ activeMode: mode, screenReaderHints: false })
        else                           set({ activeMode: 'none' })
      },
      reset: () => set(defaults),
    }),
    { name: 'stoqly-a11y' }
  )
)
