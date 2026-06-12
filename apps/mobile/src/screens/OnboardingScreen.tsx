import React, { useState } from 'react'
import { View, Text, TouchableOpacity, TextInput, StyleSheet, Animated } from 'react-native'
import * as Speech from 'expo-speech'
import * as Haptics from 'expo-haptics'

type Step = 'welcome' | 'name' | 'household' | 'allergens' | 'supermarket' | 'accessibility' | 'done'

const SUPERMARKETS = ['Mercadona', 'Carrefour', 'Lidl', 'Aldi', 'El Corte Inglés', 'Otro']
const ALLERGENS = ['Gluten', 'Lactosa', 'Frutos secos', 'Huevo', 'Marisco', 'Soja', 'Apio', 'Mostaza']
const ACCESSIBILITY_MODES = [
  { id: 'VOICE', label: '🔊 Voz', desc: 'Stoqly te habla' },
  { id: 'VIBRATION', label: '📳 Vibración', desc: 'Solo texto y vibración' },
  { id: 'SILENT', label: '🔔 Silencioso', desc: 'Solo notificaciones visuales' },
  { id: 'COMBINED', label: '♿ Combinado', desc: 'Voz + vibración' },
]

export function OnboardingScreen({ onComplete }: { onComplete: (data: OnboardingData) => void }) {
  const [step, setStep] = useState<Step>('welcome')
  const [name, setName] = useState('')
  const [householdSize, setHouseholdSize] = useState<'solo' | 'varios' | null>(null)
  const [selectedAllergens, setSelectedAllergens] = useState<string[]>([])
  const [supermarket, setSupermarket] = useState('')
  const [accessibilityMode, setAccessibilityMode] = useState('VOICE')

  const speak = (text: string) => {
    Speech.speak(text, { language: 'es-ES', rate: 0.9, pitch: 1.1 })
  }

  const next = (nextStep: Step, voiceLine?: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    if (voiceLine) speak(voiceLine)
    setStep(nextStep)
  }

  const toggleAllergen = (a: string) => {
    setSelectedAllergens(prev =>
      prev.includes(a) ? prev.filter(x => x !== a) : [...prev, a]
    )
  }

  if (step === 'welcome') {
    speak('Hola, soy Stoqly. Voy a ayudarte a que nunca te falte nada en casa y no vuelvas a tirar comida. ¿Empezamos?')
    return (
      <View style={s.container}>
        <Text style={s.logo}>Stoqly</Text>
        <Text style={s.tagline}>Tu asistente de hogar</Text>
        <Text style={s.question}>
          "Hola, soy Stoqly. Voy a ayudarte a que nunca te falte nada en casa y no vuelvas a tirar comida."
        </Text>
        <TouchableOpacity style={s.btnPrimary} onPress={() => next('name', '¿Cómo te llamo?')}>
          <Text style={s.btnText}>¡Empezamos!</Text>
        </TouchableOpacity>
      </View>
    )
  }

  if (step === 'name') return (
    <View style={s.container}>
      <Text style={s.question}>¿Cómo te llamo?</Text>
      <TextInput
        style={s.input}
        placeholder="Tu nombre"
        value={name}
        onChangeText={setName}
        autoFocus
        onSubmitEditing={() => name && next('household', `Hola ${name}, ¿vives solo o sois varios en casa?`)}
      />
      <TouchableOpacity
        style={[s.btnPrimary, !name && s.disabled]}
        disabled={!name}
        onPress={() => next('household', `Hola ${name}, ¿vives solo o sois varios en casa?`)}
      >
        <Text style={s.btnText}>Siguiente</Text>
      </TouchableOpacity>
    </View>
  )

  if (step === 'household') return (
    <View style={s.container}>
      <Text style={s.question}>¿Vives solo o sois varios en casa?</Text>
      <TouchableOpacity
        style={[s.btnOption, householdSize === 'solo' && s.btnSelected]}
        onPress={() => { setHouseholdSize('solo'); next('allergens', '¿Tú o alguien en casa tiene alguna alergia o intolerancia?') }}
      >
        <Text style={s.btnOptionText}>Solo/a</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[s.btnOption, householdSize === 'varios' && s.btnSelected]}
        onPress={() => { setHouseholdSize('varios'); next('allergens', '¿Alguien en casa tiene alguna alergia o intolerancia?') }}
      >
        <Text style={s.btnOptionText}>Varios</Text>
      </TouchableOpacity>
    </View>
  )

  if (step === 'allergens') return (
    <View style={s.container}>
      <Text style={s.question}>¿Hay alguna alergia o intolerancia en casa?</Text>
      <Text style={s.hint}>Selecciona todas las que apliquen</Text>
      <View style={s.chips}>
        {ALLERGENS.map(a => (
          <TouchableOpacity
            key={a}
            style={[s.chip, selectedAllergens.includes(a) && s.chipSelected]}
            onPress={() => toggleAllergen(a)}
          >
            <Text style={[s.chipText, selectedAllergens.includes(a) && s.chipTextSelected]}>{a}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <TouchableOpacity
        style={s.btnPrimary}
        onPress={() => next('supermarket', '¿Dónde sueles hacer la compra?')}
      >
        <Text style={s.btnText}>{selectedAllergens.length === 0 ? 'Ninguna' : 'Siguiente'}</Text>
      </TouchableOpacity>
    </View>
  )

  if (step === 'supermarket') return (
    <View style={s.container}>
      <Text style={s.question}>¿Dónde sueles hacer la compra?</Text>
      <View style={s.chips}>
        {SUPERMARKETS.map(s_ => (
          <TouchableOpacity
            key={s_}
            style={[s.chip, supermarket === s_ && s.chipSelected]}
            onPress={() => setSupermarket(s_)}
          >
            <Text style={[s.chipText, supermarket === s_ && s.chipTextSelected]}>{s_}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <TouchableOpacity
        style={[s.btnPrimary, !supermarket && s.disabled]}
        disabled={!supermarket}
        onPress={() => next('accessibility', '¿Cómo prefieres que te avise?')}
      >
        <Text style={s.btnText}>Siguiente</Text>
      </TouchableOpacity>
    </View>
  )

  if (step === 'accessibility') return (
    <View style={s.container}>
      <Text style={s.question}>¿Cómo prefieres que te avise?</Text>
      {ACCESSIBILITY_MODES.map(m => (
        <TouchableOpacity
          key={m.id}
          style={[s.btnOption, accessibilityMode === m.id && s.btnSelected]}
          onPress={() => setAccessibilityMode(m.id)}
        >
          <Text style={s.btnOptionText}>{m.label}</Text>
          <Text style={s.btnOptionDesc}>{m.desc}</Text>
        </TouchableOpacity>
      ))}
      <TouchableOpacity
        style={s.btnPrimary}
        onPress={() => {
          speak(`Perfecto, ${name}. Ya sé lo suficiente para empezar. Cuando llegues a casa con algo, solo dímelo o pásale el móvil por encima y yo me encargo.`)
          next('done')
        }}
      >
        <Text style={s.btnText}>Empezar</Text>
      </TouchableOpacity>
    </View>
  )

  if (step === 'done') {
    setTimeout(() => onComplete({ name, householdSize: householdSize!, selectedAllergens, supermarket, accessibilityMode }), 2000)
    return (
      <View style={s.container}>
        <Text style={s.logo}>✓</Text>
        <Text style={s.question}>¡Listo, {name}!</Text>
        <Text style={s.hint}>Tu despensa está lista</Text>
      </View>
    )
  }

  return null
}

interface OnboardingData {
  name: string
  householdSize: 'solo' | 'varios'
  selectedAllergens: string[]
  supermarket: string
  accessibilityMode: string
}

const TEAL = '#4ECDC4'
const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F0F1A', padding: 32, justifyContent: 'center' },
  logo: { fontSize: 48, fontWeight: '800', color: TEAL, textAlign: 'center', marginBottom: 8 },
  tagline: { fontSize: 16, color: '#888', textAlign: 'center', marginBottom: 48 },
  question: { fontSize: 22, color: '#FFF', fontWeight: '600', marginBottom: 32, lineHeight: 30 },
  hint: { fontSize: 14, color: '#888', marginBottom: 16 },
  input: { backgroundColor: '#1E1E2E', borderRadius: 12, padding: 16, fontSize: 18, color: '#FFF', marginBottom: 24, borderWidth: 1, borderColor: '#333' },
  btnPrimary: { backgroundColor: TEAL, borderRadius: 12, padding: 18, alignItems: 'center', marginTop: 8 },
  btnText: { color: '#0F0F1A', fontSize: 16, fontWeight: '700' },
  btnOption: { backgroundColor: '#1E1E2E', borderRadius: 12, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: '#333' },
  btnSelected: { borderColor: TEAL, backgroundColor: '#0D2E2C' },
  btnOptionText: { color: '#FFF', fontSize: 16, fontWeight: '600' },
  btnOptionDesc: { color: '#888', fontSize: 13, marginTop: 4 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 24 },
  chip: { backgroundColor: '#1E1E2E', borderRadius: 20, paddingHorizontal: 16, paddingVertical: 8, borderWidth: 1, borderColor: '#333' },
  chipSelected: { backgroundColor: '#0D2E2C', borderColor: TEAL },
  chipText: { color: '#AAA', fontSize: 14 },
  chipTextSelected: { color: TEAL, fontWeight: '600' },
  disabled: { opacity: 0.4 },
})
