import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native'
import { useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { theme } from '@/theme'

const ITEMS = [
  { href: '/more/receive', icon: '📥', label: 'Recibir compra', desc: 'Registra un pedido o ticket de compra' },
  { href: '/more/dinner', icon: '🍳', label: 'Qué cocino', desc: 'Sugerencias de recetas con lo que tienes' },
  { href: '/more/supplements', icon: '💊', label: 'Suplementos', desc: 'Vitaminas y suplementos, tomas y stock' },
  { href: '/more/cosmetics', icon: '🧴', label: 'Cosméticos y belleza', desc: 'Control de PAO de cremas y maquillaje' },
  { href: '/more/medications', icon: '💉', label: 'Medicamentos', desc: 'Botiquín, tomas y reciclaje SIGRE' },
  { href: '/more/baby', icon: '👶', label: 'Bebés', desc: 'Tomas, pañales y artículos del bebé' },
  { href: '/more/wine', icon: '🍷', label: 'Vinos y bodega', desc: 'Ficha de vinos, valoraciones y notas de cata' },
  { href: '/more/calendar', icon: '📅', label: 'Calendario', desc: 'Eventos y recordatorios del hogar' },
  { href: '/more/accessibility', icon: '♿', label: 'Accesibilidad', desc: 'Voz, vibración y tamaño de texto' },
] as const

export default function MoreScreen() {
  const router = useRouter()
  const insets = useSafeAreaInsets()

  return (
    <View style={styles.screen}>
      <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
        <Text style={styles.title}>Más</Text>
        <Text style={styles.subtitle}>Todas las secciones de Stoqly</Text>
      </View>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 24 }} showsVerticalScrollIndicator={false}>
        {ITEMS.map(item => (
          <TouchableOpacity key={item.href} style={styles.card} activeOpacity={0.85} onPress={() => router.push(item.href as any)}>
            <View style={styles.iconWrap}>
              <Text style={{ fontSize: 22 }}>{item.icon}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardLabel}>{item.label}</Text>
              <Text style={styles.cardDesc}>{item.desc}</Text>
            </View>
            <Text style={styles.chevron}>›</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  screen:    { flex: 1, backgroundColor: theme.bg },
  header:    { paddingHorizontal: 20, paddingBottom: 16 },
  title:     { color: theme.text, fontSize: 24, fontWeight: '900' },
  subtitle:  { color: theme.muted, fontSize: 14, marginTop: 2 },
  card:      { flexDirection: 'row', alignItems: 'center', backgroundColor: theme.surface, borderRadius: 16, padding: 16, marginBottom: 10, borderWidth: 1, borderColor: theme.border, gap: 14 },
  iconWrap:  { width: 44, height: 44, borderRadius: 12, backgroundColor: theme.bg, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: theme.border },
  cardLabel: { color: theme.text, fontSize: 15, fontWeight: '700' },
  cardDesc:  { color: theme.muted, fontSize: 12, marginTop: 2 },
  chevron:   { color: theme.muted, fontSize: 22 },
})
