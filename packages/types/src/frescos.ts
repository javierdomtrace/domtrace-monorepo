// ── Conocimiento de productos frescos ───────────────────────────────
// Usado por Stoqly para calcular vida útil y dar consejos de conservación

export interface TipoFrescoInfo {
  id: string
  label: string
  ejemplos: string[]
  vidaUtilDias: number        // vida útil media desde la compra
  conservacion: string        // consejo de conservación
  consejoDia50: string        // mensaje de Stoqly al 50% de vida útil
  consejoDia80: string        // mensaje al 80%
  consejoDia100: string       // mensaje al 100%+
  recetasFinales: string[]    // qué hacer cuando está a punto de pasarse
  alertaConBebe?: string      // aviso especial si hay bebés (ej: no dar miel)
}

export const TIPOS_FRESCOS: Record<string, TipoFrescoInfo> = {
  TUBERCULO: {
    id: 'TUBERCULO',
    label: 'Tubérculos',
    ejemplos: ['Patata', 'Boniato', 'Yuca', 'Ñame'],
    vidaUtilDias: 18,
    conservacion: 'Lugar fresco, oscuro y seco. Nunca en la nevera (se azucaran). Alejados de las cebollas.',
    consejoDia50: 'Están perfectos para cualquier receta.',
    consejoDia80: 'Ya llevan bastantes días — empieza a pensar en usarlos pronto.',
    consejoDia100: 'Pueden estar empezando a brotar. Úsalos ya. ¿Tortilla, puré o patatas al horno?',
    recetasFinales: ['Puré de patatas', 'Tortilla española', 'Patatas al horno', 'Patatas bravas', 'Croquetas'],
  },
  RAIZ: {
    id: 'RAIZ',
    label: 'Raíces',
    ejemplos: ['Zanahoria', 'Remolacha', 'Nabo', 'Chirivía', 'Rábano'],
    vidaUtilDias: 12,
    conservacion: 'Nevera en bolsa perforada o recipiente con tapa. Retirar las hojas si las tienen.',
    consejoDia50: 'Están en su mejor momento.',
    consejoDia80: 'Lleva tiempo en la nevera — úsalas esta semana.',
    consejoDia100: 'Pueden estar un poco blandas. Mejor para crema o zumo que crudas.',
    recetasFinales: ['Crema de zanahoria', 'Zumo de zanahoria y jengibre', 'Ensalada rallada', 'Hummus de remolacha'],
  },
  HOJA: {
    id: 'HOJA',
    label: 'Verduras de hoja',
    ejemplos: ['Espinacas', 'Lechuga', 'Acelgas', 'Rúcula', 'Canónigos', 'Col'],
    vidaUtilDias: 4,
    conservacion: 'Nevera envueltas en papel de cocina húmedo dentro de bolsa. No lavar hasta usar.',
    consejoDia50: 'Aún están bien, pero las verduras de hoja duran poco.',
    consejoDia80: 'Ya llevan 3 días — cocínalas hoy o mañana.',
    consejoDia100: 'Pueden estar empezando a marchitarse. Mejor saltearlas o hacer una crema.',
    recetasFinales: ['Salteado de espinacas', 'Crema de verduras', 'Smoothie verde', 'Tortilla de espinacas'],
    alertaConBebe: 'Las espinacas y acelgas no son adecuadas para bebés menores de 12 meses por su contenido en nitratos.',
  },
  TOMATE: {
    id: 'TOMATE',
    label: 'Tomates',
    ejemplos: ['Tomate', 'Tomate cherry', 'Tomate pera'],
    vidaUtilDias: 5,
    conservacion: 'NUNCA en la nevera — pierde sabor y textura. Temperatura ambiente, fuera de la luz directa.',
    consejoDia50: 'En su punto óptimo de sabor.',
    consejoDia80: 'Ya están muy maduros — perfectos para cocinar.',
    consejoDia100: 'Muy maduros. Úsalos hoy en salsa, pisto o gazpacho antes de que se estropeen.',
    recetasFinales: ['Pisto', 'Salsa de tomate casera', 'Gazpacho', 'Tomates asados', 'Pan con tomate'],
  },
  ALLIUM: {
    id: 'ALLIUM',
    label: 'Cebollas, ajos y puerros',
    ejemplos: ['Cebolla', 'Ajo', 'Puerro', 'Cebolleta', 'Chalota'],
    vidaUtilDias: 25,
    conservacion: 'Lugar seco, oscuro y ventilado. Nunca junto a las patatas (se aceleran mutuamente). El ajo en tarro de cristal.',
    consejoDia50: 'Aguantan muy bien, sin preocupación.',
    consejoDia80: 'Empieza a usarlos con más frecuencia.',
    consejoDia100: 'Pueden estar empezando a brotar. Sigue siendo comestible — retira los brotes verdes.',
    recetasFinales: ['Sofrito base', 'Crema de puerros', 'Cebolla caramelizada', 'Sopa de cebolla'],
  },
  FRUTA_CLIM: {
    id: 'FRUTA_CLIM',
    label: 'Frutas climatéricas',
    ejemplos: ['Plátano', 'Mango', 'Aguacate', 'Kiwi', 'Pera', 'Melocotón', 'Nectarina'],
    vidaUtilDias: 5,
    conservacion: 'Fuera de la nevera hasta que estén maduros. Una vez maduros: nevera o pelar y congelar. El plátano acelera la maduración de otras frutas — mantenlo separado.',
    consejoDia50: 'Madurando bien.',
    consejoDia80: 'Están en su punto óptimo de sabor — el momento perfecto para comerlos.',
    consejoDia100: 'Muy maduros. Perfectos para smoothie, helado natural o congela en trozos.',
    recetasFinales: ['Smoothie de plátano', 'Helado de mango', 'Guacamole', 'Batido de frutas', 'Pan de plátano'],
  },
  FRUTA_NO_CLIM: {
    id: 'FRUTA_NO_CLIM',
    label: 'Frutas no climatéricas',
    ejemplos: ['Fresas', 'Uvas', 'Cerezas', 'Arándanos', 'Frambuesas', 'Sandía', 'Melón'],
    vidaUtilDias: 3,
    conservacion: 'Nevera desde el principio. Sin lavar hasta el momento de comer. Las fresas mejor en una sola capa.',
    consejoDia50: 'Perfectas y en su mejor momento.',
    consejoDia80: 'Cómelas hoy o mañana — no aguantan mucho más.',
    consejoDia100: 'Pueden estar pasándose. Úsalas hoy en mermelada, zumo o macedonía.',
    recetasFinales: ['Mermelada casera', 'Zumo de fresas', 'Macedonía', 'Sorbete', 'Coulis para yogur'],
    alertaConBebe: 'Las fresas, frambuesas y kiwi pueden ser alergénicos. Introducir con precaución después de los 6 meses.',
  },
  CITRICO: {
    id: 'CITRICO',
    label: 'Cítricos',
    ejemplos: ['Naranja', 'Limón', 'Mandarina', 'Pomelo', 'Lima'],
    vidaUtilDias: 10,
    conservacion: 'Temperatura ambiente 1 semana, o nevera hasta 3-4 semanas. El limón cortado: nevera en recipiente cerrado.',
    consejoDia50: 'En perfecto estado.',
    consejoDia80: 'Empieza a usarlos o ponlos en la nevera para alargar su vida.',
    consejoDia100: 'Pueden estar empezando a secarse por dentro. Úsalos para zumo o ralladura.',
    recetasFinales: ['Zumo natural', 'Ralladura para repostería', 'Limonada', 'Mermelada de naranja', 'Vinagreta de limón'],
  },
  HIERBA: {
    id: 'HIERBA',
    label: 'Hierbas aromáticas',
    ejemplos: ['Perejil', 'Cilantro', 'Albahaca', 'Cebollino', 'Eneldo', 'Menta'],
    vidaUtilDias: 4,
    conservacion: 'Nevera como un ramo en un vaso con agua y bolsa por encima, o envueltas en papel húmedo.',
    consejoDia50: 'Frescas y aromáticas.',
    consejoDia80: 'Úsalas hoy — están empezando a perder aroma.',
    consejoDia100: 'Se están marchitando. Haz un pesto, machácalas con aceite o congélalas picadas en cubiteras.',
    recetasFinales: ['Pesto', 'Aceite aromatizado', 'Congelar en cubiteras con aceite de oliva', 'Chimichurri'],
  },
}

// Calcular % de vida útil consumida
export function calcularVidaUtil(fechaCompra: Date, vidaUtilDias: number): {
  diasDesdeCompra: number
  porcentajeConsumido: number
  estado: 'fresco' | 'usar-pronto' | 'urgente' | 'pasado'
  mensaje: string
  tipo: TipoFrescoInfo
} {
  const dias = Math.floor((Date.now() - fechaCompra.getTime()) / 86400000)
  const pct = Math.round((dias / vidaUtilDias) * 100)
  const estado = pct < 50 ? 'fresco' : pct < 80 ? 'usar-pronto' : pct < 100 ? 'urgente' : 'pasado'
  return { diasDesdeCompra: dias, porcentajeConsumido: pct, estado, mensaje: '', tipo: {} as TipoFrescoInfo }
}

// Días estimados restantes
export function diasRestantes(fechaCompra: Date, vidaUtilDias: number): number {
  const diasUsados = Math.floor((Date.now() - fechaCompra.getTime()) / 86400000)
  return Math.max(0, vidaUtilDias - diasUsados)
}
