// ── Patrones de vibración Stoqly ─────────────────────────────────────
// Compatibles con la API Vibration del navegador y Expo Haptics en móvil
// Diseñados para ser reconocibles por personas con discapacidad visual (objetivo ONCE)

export const VIBRATION_PATTERNS = {
  // 🚨 Alerta urgente: 3 pulsos cortos + 1 largo
  URGENT: [100, 50, 100, 50, 100, 100, 300],
  // ⚠️ Alerta normal: 2 pulsos cortos
  ALERT: [100, 50, 100],
  // ✅ Confirmación de acción: 1 pulso suave
  CONFIRM: [50],
  // ❌ Error: 2 pulsos largos
  ERROR: [300, 100, 300],
  // ✦ Stoqly hablando: 3 pulsos suaves
  STOQLY: [50, 30, 50, 30, 50],
  // 🛒 Producto añadido a lista: pulso + pausa + pulso corto
  ITEM_ADDED: [80, 40, 40],
  // 🍷 Alerta vino: 2 cortos + 1 medio (especial bodega)
  WINE: [80, 40, 80, 100, 150],
  // 👶 Alerta bebé: 4 pulsos cortos (máxima atención)
  BABY: [80, 30, 80, 30, 80, 30, 80],
}

export function vibrate(pattern: keyof typeof VIBRATION_PATTERNS | number[]) {
  if (!('vibrate' in navigator)) return
  const p = Array.isArray(pattern) ? pattern : VIBRATION_PATTERNS[pattern]
  navigator.vibrate(p)
}

export function stopVibration() {
  if ('vibrate' in navigator) navigator.vibrate(0)
}
