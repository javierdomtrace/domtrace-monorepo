// ── Lectura en voz alta (Web Speech API) ──────────────────────────────
// Utilidad ligera para anunciar mensajes por voz (accesibilidad visual/motora).
// No requiere backend: usa window.speechSynthesis del navegador.

let pending: string[] = []
let speaking = false

export function isTTSSupported(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window
}

function pickSpanishVoice(): SpeechSynthesisVoice | undefined {
  if (!isTTSSupported()) return undefined
  const voices = window.speechSynthesis.getVoices()
  return voices.find(v => v.lang?.toLowerCase().startsWith('es')) ?? voices[0]
}

function playNext() {
  if (pending.length === 0) {
    speaking = false
    return
  }
  speaking = true
  const text = pending.shift()!
  const utter = new SpeechSynthesisUtterance(text)
  utter.lang = 'es-ES'
  utter.rate = 1
  const voice = pickSpanishVoice()
  if (voice) utter.voice = voice
  utter.onend = playNext
  utter.onerror = playNext
  window.speechSynthesis.speak(utter)
}

/**
 * Encola un mensaje para ser leído en voz alta. Si la lectura está
 * desactivada o el navegador no soporta TTS, no hace nada.
 */
export function speak(text: string, enabled: boolean) {
  if (!enabled || !text || !isTTSSupported()) return
  pending.push(text)
  if (!speaking) playNext()
}

/** Cancela cualquier lectura en curso o en cola. */
export function stopSpeaking() {
  pending = []
  speaking = false
  if (isTTSSupported()) window.speechSynthesis.cancel()
}
