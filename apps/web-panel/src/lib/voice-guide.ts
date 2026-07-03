/**
 * Hook reutilizable para la guía de voz en el panel web de Stoqly.
 *
 * Usa la Web Speech API (window.speechSynthesis) para leer en voz alta.
 * Si el usuario tiene `voiceFeedback` activado en accesibilidad, el texto
 * pasado como `autoText` se lee automáticamente al montar el componente.
 *
 * Mismo contrato de API que el hook móvil (expo-speech):
 *   const { speak, stop, toggle, speaking, voiceFeedback } = useWebVoiceGuide()
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { useA11y } from '../store/accessibility'
import { isTTSSupported } from './tts'

function pickSpanishVoice(): SpeechSynthesisVoice | undefined {
  if (!isTTSSupported()) return undefined
  const voices = window.speechSynthesis.getVoices()
  return voices.find(v => v.lang?.toLowerCase().startsWith('es')) ?? voices[0]
}

export function useWebVoiceGuide(autoText?: string) {
  const voiceFeedback = useA11y(s => s.voiceFeedback)
  const [speaking, setSpeaking] = useState(false)
  // Guarda para que la lectura automática solo se dispare UNA vez por montaje
  const hasAutoRead = useRef(false)

  const stop = useCallback(() => {
    if (isTTSSupported()) window.speechSynthesis.cancel()
    setSpeaking(false)
  }, [])

  const speak = useCallback((text: string) => {
    if (!isTTSSupported() || !text) return
    window.speechSynthesis.cancel()
    const utter = new SpeechSynthesisUtterance(text)
    utter.lang = 'es-ES'
    utter.rate = 0.92
    const voice = pickSpanishVoice()
    if (voice) utter.voice = voice
    utter.onend = () => setSpeaking(false)
    utter.onerror = () => setSpeaking(false)
    setSpeaking(true)
    window.speechSynthesis.speak(utter)
  }, [])

  const toggle = useCallback((text: string) => {
    if (speaking) stop()
    else speak(text)
  }, [speaking, speak, stop])

  // Si voiceFeedback está activo, leer automáticamente al montar (solo una vez)
  useEffect(() => {
    if (voiceFeedback && autoText && !hasAutoRead.current) {
      hasAutoRead.current = true
      const t = setTimeout(() => speak(autoText), 400)
      return () => clearTimeout(t)
    }
  }, [voiceFeedback, autoText, speak])

  // Parar la voz al desmontar el componente
  useEffect(() => {
    return () => { if (isTTSSupported()) window.speechSynthesis.cancel() }
  }, [])

  return { speak, stop, toggle, speaking, voiceFeedback }
}
