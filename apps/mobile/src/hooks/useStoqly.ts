import { useState, useCallback } from 'react'
import * as Speech from 'expo-speech'
import * as Haptics from 'expo-haptics'
import type { ChatMessage, AccessibilityMode } from '../types'

interface UseStoqlyOptions {
  accessibilityMode: AccessibilityMode
  assistantName: string
  humorEnabled: boolean
}

interface StoqlyResponse {
  reply: string
  actions: Array<{ type: string; payload: unknown }>
}

export function useStoqly({ accessibilityMode, assistantName }: UseStoqlyOptions) {
  const [history, setHistory] = useState<ChatMessage[]>([])
  const [isThinking, setIsThinking] = useState(false)

  const speak = useCallback((text: string) => {
    if (accessibilityMode === 'VOICE' || accessibilityMode === 'COMBINED') {
      Speech.speak(text, {
        language: 'es-ES',
        rate: 0.9,   // Ligeramente más lento — más natural
        pitch: 1.1,  // Ligero tono Stoqly
      })
    }
    if (accessibilityMode === 'VIBRATION' || accessibilityMode === 'COMBINED') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
    }
  }, [accessibilityMode])

  const sendMessage = useCallback(async (message: string): Promise<StoqlyResponse | null> => {
    setIsThinking(true)
    if (accessibilityMode === 'VIBRATION' || accessibilityMode === 'COMBINED') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    }
    try {
      const res = await fetch(`${process.env.EXPO_PUBLIC_API_URL}/v1/stoqly/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${'' /* token store */}` },
        body: JSON.stringify({ message, history: history.slice(-10) }),
      })
      const data: StoqlyResponse = await res.json()
      setHistory(prev => [
        ...prev,
        { role: 'user', content: message, timestamp: new Date().toISOString() },
        { role: 'assistant', content: data.reply, timestamp: new Date().toISOString() },
      ])
      speak(data.reply)
      return data
    } catch {
      speak('Uy, algo ha fallado. Prueba de nuevo en un momento.')
      return null
    } finally {
      setIsThinking(false)
    }
  }, [history, speak, accessibilityMode])

  return { sendMessage, isThinking, history, stopSpeaking: Speech.stop }
}
