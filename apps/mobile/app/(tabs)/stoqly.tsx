import { useState, useRef, useEffect } from 'react'
import {
  View, Text, ScrollView, TextInput, TouchableOpacity,
  KeyboardAvoidingView, Platform, ActivityIndicator, Animated, StyleSheet,
} from 'react-native'
import * as Haptics from 'expo-haptics'
import * as Speech from 'expo-speech'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { api } from '@/lib/api'
import { useAuth } from '@/store/auth'
import { theme } from '@/theme'

interface Message { role: 'user' | 'assistant'; content: string; id: string }

const QUICK_ACTIONS = [
  { label: '¿Qué me caduca?',     prompt: '¿Qué productos me caducan pronto?' },
  { label: '¿Qué ceno hoy?',      prompt: '¿Qué puedo cenar con lo que tengo en casa?' },
  { label: 'Proponer compra',     prompt: 'Propón una lista de la compra con lo que me falta' },
  { label: '¿Qué hay en nevera?', prompt: '¿Qué tengo en la nevera ahora mismo?' },
]

function TypingDots() {
  const dot1 = useRef(new Animated.Value(0)).current
  const dot2 = useRef(new Animated.Value(0)).current
  const dot3 = useRef(new Animated.Value(0)).current

  useEffect(() => {
    const anim = (d: Animated.Value, delay: number) =>
      Animated.loop(Animated.sequence([
        Animated.delay(delay),
        Animated.timing(d, { toValue: -4, duration: 300, useNativeDriver: true }),
        Animated.timing(d, { toValue: 0,  duration: 300, useNativeDriver: true }),
      ]))
    Animated.parallel([anim(dot1, 0), anim(dot2, 150), anim(dot3, 300)]).start()
  }, [])

  return (
    <View style={styles.dotsRow}>
      {[dot1, dot2, dot3].map((d, i) => (
        <Animated.View key={i} style={[styles.dot, { transform: [{ translateY: d }] }]} />
      ))}
    </View>
  )
}

export default function StoqlyScreen() {
  const { user } = useAuth()
  const insets = useSafeAreaInsets()
  const scrollRef = useRef<ScrollView>(null)
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '0',
      role: 'assistant',
      content: `¡Hola${user?.name ? `, ${user.name.split(' ')[0]}` : ''}! 👋 Soy Stoqly. ¿En qué te ayudo hoy?`,
    },
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [speaking, setSpeaking] = useState(false)

  const scrollToBottom = () => setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100)

  const send = async (text?: string) => {
    const msg = (text ?? input).trim()
    if (!msg || loading) return
    setInput('')
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)

    const userMsg: Message = { id: Date.now().toString(), role: 'user', content: msg }
    const history = messages.map(m => ({ role: m.role, content: m.content }))

    setMessages(prev => [...prev, userMsg])
    setLoading(true)
    scrollToBottom()

    try {
      const res = await api.post<{ reply: string }>('/stoqly/chat', {
        message: msg, history, maxTokens: 512,
      })
      const assistantMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: res.reply,
      }
      setMessages(prev => [...prev, assistantMsg])
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      scrollToBottom()
    } catch {
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: 'Ups, algo ha fallado. ¿Lo intentamos de nuevo?',
      }])
    } finally { setLoading(false) }
  }

  const speakLast = async () => {
    const last = [...messages].reverse().find(m => m.role === 'assistant')
    if (!last) return
    if (speaking) { Speech.stop(); setSpeaking(false); return }
    setSpeaking(true)
    await Speech.speak(last.content, {
      language: 'es-ES', rate: 0.95, pitch: 1.05,
      onDone: () => setSpeaking(false),
      onError: () => setSpeaking(false),
    })
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.screen}
      keyboardVerticalOffset={0}
    >
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
        <View>
          <Text style={styles.headerTitle}>✦ Stoqly</Text>
          <Text style={styles.headerSub}>Tu asistente de hogar</Text>
        </View>
        <TouchableOpacity
          onPress={speakLast}
          style={[styles.speakBtn, { backgroundColor: speaking ? 'rgba(29,158,117,0.2)' : theme.border }]}
        >
          <Text style={{ fontSize: 18 }}>{speaking ? '🔊' : '🔈'}</Text>
        </TouchableOpacity>
      </View>

      {/* Messages */}
      <ScrollView
        ref={scrollRef}
        style={styles.flex1}
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8 }}
        showsVerticalScrollIndicator={false}
        onContentSizeChange={scrollToBottom}
      >
        {messages.map(msg => (
          <View
            key={msg.id}
            style={[styles.msgWrap, msg.role === 'user' ? styles.msgUser : styles.msgAssistant]}
          >
            {msg.role === 'assistant' && (
              <View style={styles.botLabel}>
                <View style={styles.botAvatar}>
                  <Text style={{ fontSize: 10, color: '#fff' }}>✦</Text>
                </View>
                <Text style={styles.botName}>Stoqly</Text>
              </View>
            )}
            <View style={[
              styles.bubble,
              msg.role === 'user' ? styles.bubbleUser : styles.bubbleAssistant,
            ]}>
              <Text style={[
                styles.bubbleText,
                { color: msg.role === 'user' ? '#fff' : theme.text },
              ]}>
                {msg.content}
              </Text>
            </View>
          </View>
        ))}

        {loading && (
          <View style={styles.typingBubble}>
            <TypingDots />
          </View>
        )}
      </ScrollView>

      {/* Quick actions */}
      {messages.length <= 2 && !loading && (
        <ScrollView
          horizontal
          style={{ paddingHorizontal: 16, marginBottom: 8 }}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 8, paddingRight: 16 }}
        >
          {QUICK_ACTIONS.map(a => (
            <TouchableOpacity
              key={a.label}
              onPress={() => send(a.prompt)}
              style={styles.quickBtn}
            >
              <Text style={styles.quickText}>{a.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {/* Input */}
      <View style={styles.inputRow}>
        <View style={styles.inputWrap}>
          <TextInput
            style={styles.textInput}
            placeholder="Escríbele a Stoqly..."
            placeholderTextColor={theme.muted}
            value={input}
            onChangeText={setInput}
            multiline
            returnKeyType="send"
            onSubmitEditing={() => send()}
            blurOnSubmit
          />
        </View>
        <TouchableOpacity
          onPress={() => send()}
          disabled={!input.trim() || loading}
          style={[styles.sendBtn, { opacity: !input.trim() || loading ? 0.4 : 1 }]}
        >
          {loading
            ? <ActivityIndicator color="#fff" size="small" />
            : <Text style={styles.sendArrow}>↑</Text>
          }
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  screen:          { flex: 1, backgroundColor: theme.bg },
  flex1:           { flex: 1 },
  header:          {
    paddingHorizontal: 20, paddingBottom: 12,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderBottomWidth: 1, borderBottomColor: theme.border,
  },
  headerTitle:     { color: theme.text, fontSize: 20, fontWeight: '900' },
  headerSub:       { color: theme.muted, fontSize: 12 },
  speakBtn:        { width: 40, height: 40, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  msgWrap:         { marginBottom: 12, maxWidth: '85%' },
  msgUser:         { alignSelf: 'flex-end' },
  msgAssistant:    { alignSelf: 'flex-start' },
  botLabel:        { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  botAvatar:       { width: 20, height: 20, borderRadius: 10, backgroundColor: theme.brand, alignItems: 'center', justifyContent: 'center' },
  botName:         { color: theme.brand, fontSize: 12, fontWeight: '700' },
  bubble:          { borderRadius: 16, paddingHorizontal: 16, paddingVertical: 12 },
  bubbleUser:      { backgroundColor: theme.brand, borderBottomRightRadius: 4 },
  bubbleAssistant: { backgroundColor: theme.surface, borderBottomLeftRadius: 4, borderWidth: 1, borderColor: theme.border },
  bubbleText:      { fontSize: 14, lineHeight: 22 },
  typingBubble:    { alignSelf: 'flex-start', marginBottom: 12, backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border, borderRadius: 16, borderBottomLeftRadius: 4, paddingHorizontal: 16, paddingVertical: 12 },
  dotsRow:         { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 4 },
  dot:             { width: 8, height: 8, borderRadius: 4, backgroundColor: theme.brand },
  quickBtn:        { backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border, borderRadius: 16, paddingHorizontal: 16, paddingVertical: 10 },
  quickText:       { color: theme.text, fontSize: 14 },
  inputRow:        { paddingHorizontal: 16, paddingBottom: 16, flexDirection: 'row', alignItems: 'flex-end', gap: 12 },
  inputWrap:       { flex: 1, backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border, borderRadius: 16, paddingHorizontal: 16, paddingVertical: 12, minHeight: 48, maxHeight: 120 },
  textInput:       { color: theme.text, fontSize: 14 },
  sendBtn:         { width: 48, height: 48, backgroundColor: theme.brand, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  sendArrow:       { color: '#fff', fontSize: 20 },
})
