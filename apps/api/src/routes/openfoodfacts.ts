import type { FastifyPluginAsync } from 'fastify'
import { prisma } from '@domtrace/db'

// ── Mapeo categoryId Stoqly → etiqueta OBF ────────────────────────────────────
const CATEGORY_TO_OBF: Record<string, string> = {
  face: 'en:face-creams',
  body: 'en:body-lotions',
  hair: 'en:hair-care',
  makeup: 'en:make-up',
  other: 'en:cosmetics',
}

// ── Contribuir producto a Open Beauty Facts ───────────────────────────────────
// Usa las credenciales OBF_USER / OBF_PASSWORD del .env
// Si no hay credenciales, hace silently no-op.
async function contributeToOBF(params: {
  barcode: string
  name: string
  brand?: string | null
  categoryId?: string | null
  ingredients?: string | null
  userUuid: string   // ID anónimo del usuario Stoqly (salted, para moderación en OBF)
}): Promise<void> {
  const user = process.env.OBF_USER
  const pass = process.env.OBF_PASSWORD
  if (!user || !pass) return   // sin credenciales configuradas → skip silencioso

  const body = new URLSearchParams({
    code: params.barcode,
    product_name: params.name,
    user_id: user,
    password: pass,
    app_name: 'Stoqly',
    app_version: '1.0',
    app_uuid: params.userUuid,
  })
  if (params.brand) body.set('brands', params.brand)
  if (params.categoryId && CATEGORY_TO_OBF[params.categoryId]) {
    body.set('categories', CATEGORY_TO_OBF[params.categoryId])
  }
  if (params.ingredients) body.set('ingredients_text', params.ingredients)

  await fetch('https://world.openbeautyfacts.org/cgi/product_jqm2.pl', {
    method: 'POST',
    headers: {
      'User-Agent': 'Stoqly/1.0 (jtorres@cogelo.es)',
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: body.toString(),
    signal: AbortSignal.timeout(8000),
  })
  // No lanzamos error si falla — es best-effort
}

// ── Mapeo categorías Open Beauty Facts → categoryId de Stoqly ────────────────
const BEAUTY_CATEGORY_MAP: Array<{ tags: string[]; id: string }> = [
  { tags: ['face', 'facial', 'serum', 'eye-care', 'face-cream', 'anti-aging', 'toner', 'moisturiser', 'sunscreen', 'spf', 'sun', 'protector', 'solar'], id: 'face' },
  { tags: ['body', 'body-lotion', 'body-cream', 'deodorant', 'shower', 'bath', 'hand-cream', 'foot'], id: 'body' },
  { tags: ['hair', 'shampoo', 'conditioner', 'hair-mask', 'hair-oil', 'hair-color'], id: 'hair' },
  { tags: ['make-up', 'makeup', 'foundation', 'lipstick', 'mascara', 'eyeshadow', 'blush', 'concealer', 'nail'], id: 'makeup' },
]

function detectBeautyCategory(categoryTags: string[] = []): string | null {
  const joined = categoryTags.join(' ').toLowerCase()
  for (const { tags, id } of BEAUTY_CATEGORY_MAP) {
    if (tags.some(t => joined.includes(t))) return id
  }
  return null
}

// PAO: "12M" → 12, "6M" → 6
function parsePAO(raw?: string | null): number | null {
  if (!raw) return null
  const m = raw.match(/(\d+)\s*[Mm]/)
  return m ? parseInt(m[1]) : null
}

interface OFFProduct {
  product_name?: string
  product_name_es?: string
  brands?: string
  ingredients_text?: string
  ingredients_text_es?: string
  allergens?: string
  allergens_tags?: string[]
  nutriscore_grade?: string
  ecoscore_grade?: string
  nova_group?: number
  energy_100g?: number
  fat_100g?: number
  saturated_fat_100g?: string
  carbohydrates_100g?: number
  sugars_100g?: number
  fiber_100g?: number
  proteins_100g?: number
  salt_100g?: number
  image_url?: string
  quantity?: string
  categories?: string
}

function parseAllergens(tags: string[] = []): string[] {
  return tags.map(t => {
    const code = t.replace('en:', '').replace('fr:', '').toUpperCase()
    const map: Record<string, string> = {
      GLUTEN: 'Gluten', MILK: 'Leche', EGGS: 'Huevos', NUTS: 'Frutos secos',
      PEANUTS: 'Cacahuetes', SOY: 'Soja', FISH: 'Pescado', CRUSTACEANS: 'Crustáceos',
      CELERY: 'Apio', MUSTARD: 'Mostaza', SESAME: 'Sésamo', SULPHITES: 'Sulfitos',
      LUPIN: 'Altramuces', MOLLUSCS: 'Moluscos',
    }
    return map[code] ?? code
  }).filter(Boolean)
}

function parseNutriscore(grade?: string): { label: string; color: string } | null {
  if (!grade) return null
  const map: Record<string, { label: string; color: string }> = {
    a: { label: 'A', color: '#038141' },
    b: { label: 'B', color: '#85BB2F' },
    c: { label: 'C', color: '#FECB02' },
    d: { label: 'D', color: '#EE8100' },
    e: { label: 'E', color: '#E63312' },
  }
  return map[grade.toLowerCase()] ?? null
}

// Normaliza EAN: si el barcode es UPC-A (12 dígitos), prueba también con 0 delante (EAN-13)
function eanVariants(barcode: string): string[] {
  const variants = [barcode]
  if (barcode.length === 12) variants.push('0' + barcode)
  if (barcode.length === 13 && barcode.startsWith('0')) variants.push(barcode.slice(1))
  return [...new Set(variants)]
}

export { contributeToOBF }

export const openfoodfactsRoutes: FastifyPluginAsync = async (app) => {

  // GET /v1/product/:barcode
  // Lookup unificado con cascada de 8 fuentes + base de datos comunitaria Stoqly
  app.get('/product/:barcode', async (req, reply) => {
    const { barcode } = req.params as { barcode: string }
    if (!barcode || !/^\d{8,14}$/.test(barcode)) {
      return reply.status(400).send({ error: 'Código de barras inválido' })
    }

    const headers = { 'User-Agent': 'Stoqly/1.0 (jtorres@cogelo.es)' }
    const variants = eanVariants(barcode)

    // ── 1. Open Food Facts ────────────────────────────────────────────────────
    for (const bc of variants) {
      try {
        const url = `https://world.openfoodfacts.org/api/v2/product/${bc}.json?fields=product_name,product_name_es,brands,ingredients_text,ingredients_text_es,allergens_tags,nutriscore_grade,ecoscore_grade,nova_group,nutriments,image_url,quantity,categories`
        const res = await fetch(url, { headers, signal: AbortSignal.timeout(6000) })
        if (res.ok) {
          const data = await res.json() as any
          if (data.status === 1 && data.product) {
            const p = data.product
            const nutriments = p.nutriments ?? {}
            return reply.send({
              source: 'food',
              barcode,
              name: p.product_name_es ?? p.product_name ?? null,
              brand: p.brands ?? null,
              quantity: p.quantity ?? null,
              imageUrl: p.image_url ?? null,
              ingredients: p.ingredients_text_es ?? p.ingredients_text ?? null,
              allergens: parseAllergens(p.allergens_tags),
              nutriscore: parseNutriscore(p.nutriscore_grade),
              ecoscore: p.ecoscore_grade?.toUpperCase() ?? null,
              novaGroup: p.nova_group ?? null,
              nutriments: {
                energia: nutriments['energy-kcal_100g'] ?? null,
                grasas: nutriments['fat_100g'] ?? null,
                grasasSaturadas: nutriments['saturated-fat_100g'] ?? null,
                carbohidratos: nutriments['carbohydrates_100g'] ?? null,
                azucares: nutriments['sugars_100g'] ?? null,
                fibra: nutriments['fiber_100g'] ?? null,
                proteinas: nutriments['proteins_100g'] ?? null,
                sal: nutriments['salt_100g'] ?? null,
              },
              categoryId: null,
              paoMonths: null,
            })
          }
        }
      } catch { /* siguiente */ }
    }

    // ── 2–4. Open Beauty Facts (v0 world, v0 fr, v2 world) ───────────────────
    // Probamos dominios/versiones distintas: Yuka (empresa francesa) contribuye
    // principalmente a fr.openbeautyfacts.org antes que a world.
    const beautyEndpoints = [
      'https://world.openbeautyfacts.org/api/v0/product',
      'https://fr.openbeautyfacts.org/api/v0/product',
      'https://world.openbeautyfacts.org/api/v2/product',
      'https://world.openproductsfacts.org/api/v0/product',
    ]

    for (const base of beautyEndpoints) {
      for (const bc of variants) {
        try {
          const url = base.includes('v2')
            ? `${base}/${bc}?fields=product_name,product_name_es,brands,ingredients_text,ingredients_text_es,categories_tags,categories,image_url,image_front_url,quantity,periods_after_opening`
            : `${base}/${bc}.json`
          const res = await fetch(url, { headers, signal: AbortSignal.timeout(7000) })
          if (!res.ok) continue
          const data = await res.json() as any
          if (data.status !== 1 || !data.product) continue

          const p = data.product
          const paoRaw = p.periods_after_opening
            ?? p.periods_after_opening_tags?.[0]?.replace(/^[a-z]{2}:/, '')
            ?? p['periods-after-opening']
            ?? null
          const paoMonths = parsePAO(paoRaw)
          const categoryId = detectBeautyCategory([
            ...(p.categories_tags ?? []),
            ...(p.categories?.split(',').map((s: string) => s.trim()) ?? []),
          ])

          return reply.send({
            source: 'beauty',
            barcode,
            name: p.product_name_es ?? p.product_name ?? null,
            brand: p.brands ?? null,
            quantity: p.quantity ?? null,
            imageUrl: p.image_url ?? p.image_front_url ?? null,
            ingredients: p.ingredients_text_es ?? p.ingredients_text ?? null,
            categoryId,
            paoMonths,
            allergens: [],
            nutriscore: null,
            ecoscore: null,
            novaGroup: null,
            nutriments: null,
          })
        } catch { /* siguiente */ }
      }
    }

    // ── 5. Open EAN Database (base europea, gratis) ───────────────────────────
    for (const bc of variants) {
      try {
        const res = await fetch(
          `https://opengtindb.org/?ean=${bc}&cmd=ean&lang=EN&mtype=json`,
          { headers: { ...headers, 'Accept': 'application/json' }, signal: AbortSignal.timeout(5000) }
        )
        if (res.ok) {
          const text = await res.text()
          // opengtindb puede devolver JSON o XML según el cliente
          if (text.startsWith('{') || text.startsWith('[')) {
            const data = JSON.parse(text) as any
            const entry = Array.isArray(data) ? data[0] : data
            if (entry?.name && entry.name !== 'none') {
              const categoryId = detectBeautyCategory([
                entry.cat?.toLowerCase() ?? '',
                entry.name?.toLowerCase() ?? '',
              ])
              return reply.send({
                source: 'ean',
                barcode,
                name: entry.name ?? null,
                brand: entry.vendor ?? null,
                quantity: null,
                imageUrl: null,
                ingredients: null,
                categoryId,
                paoMonths: null,
                allergens: [],
                nutriscore: null,
                ecoscore: null,
                novaGroup: null,
                nutriments: null,
              })
            }
          }
        }
      } catch { /* siguiente */ }
    }

    // ── 6. UPC Item DB ────────────────────────────────────────────────────────
    for (const bc of variants) {
      try {
        const upcRes = await fetch(`https://api.upcitemdb.com/prod/trial/lookup?upc=${bc}`, {
          headers,
          signal: AbortSignal.timeout(6000),
        })
        if (upcRes.ok) {
          const upcData = await upcRes.json() as any
          const item = upcData.items?.[0]
          if (item) {
            const title: string = item.title ?? ''
            const brand: string = item.brand ?? ''
            const categoryId = detectBeautyCategory([
              ...(item.category?.split('>').map((s: string) => s.trim().toLowerCase()) ?? []),
              title.toLowerCase(), brand.toLowerCase(),
            ])
            return reply.send({
              source: 'upc',
              barcode,
              name: title || null,
              brand: brand || null,
              quantity: item.size ?? null,
              imageUrl: item.images?.[0] ?? null,
              ingredients: item.description ?? null,
              categoryId,
              paoMonths: null,
              allergens: [],
              nutriscore: null,
              ecoscore: null,
              novaGroup: null,
              nutriments: null,
            })
          }
        }
      } catch { /* siguiente */ }
    }

    // ── 7. Base de datos comunitaria Stoqly ───────────────────────────────────
    // Cuando alguien añade un producto manualmente con barcode, queda disponible
    // para el resto de usuarios que escaneen el mismo código. Red de datos propia.
    try {
      const allBarcodes = variants
      const communityItem = await prisma.item.findFirst({
        where: {
          barcode: { in: allBarcodes },
          name: { not: '' },
          status: { notIn: ['DISCARDED'] },
        },
        orderBy: { createdAt: 'desc' },
        select: {
          name: true,
          categoryId: true,
          paoMonths: true,
          allergens: true,
          notes: true,
        },
      })
      if (communityItem?.name) {
        return reply.send({
          source: 'community',
          barcode,
          name: communityItem.name,
          brand: null,
          quantity: null,
          imageUrl: null,
          ingredients: communityItem.notes ?? null,
          categoryId: communityItem.categoryId,
          paoMonths: communityItem.paoMonths,
          allergens: communityItem.allergens ?? [],
          nutriscore: null,
          ecoscore: null,
          novaGroup: null,
          nutriments: null,
        })
      }
    } catch { /* DB no disponible */ }

    return reply.status(404).send({ error: 'Producto no encontrado. Añádelo manualmente — quedará guardado para otros usuarios de Stoqly.' })
  })

  // POST /v1/product/contribute — contribuir un producto manualmente a OBF + BD Stoqly
  // Se llama desde el frontend cuando el usuario añade un producto con barcode
  // que no fue encontrado en ninguna base de datos externa.
  app.post('/product/contribute', { preHandler: [app.authenticate] }, async (req, reply) => {
    const userId = (req.user as { id: string }).id
    const { barcode, name, brand, categoryId, ingredients } = req.body as {
      barcode: string
      name: string
      brand?: string
      categoryId?: string
      ingredients?: string
    }

    if (!barcode || !/^\d{8,14}$/.test(barcode) || !name?.trim()) {
      return reply.status(400).send({ error: 'barcode y name son obligatorios' })
    }

    // Contribuir a OBF en background (best-effort, no bloquea)
    contributeToOBF({
      barcode,
      name: name.trim(),
      brand: brand?.trim() || null,
      categoryId: categoryId || null,
      ingredients: ingredients?.trim() || null,
      userUuid: `stoqly-${userId.slice(0, 8)}`,
    }).catch(() => {})

    return reply.send({ ok: true, message: 'Producto enviado a la base de datos comunitaria. ¡Gracias!' })
  })

  // GET /v1/openfoodfacts/:barcode — endpoint legacy (mantener compatibilidad)
  app.get('/openfoodfacts/:barcode', async (req, reply) => {
    const { barcode } = req.params as { barcode: string }
    if (!barcode || !/^\d{8,14}$/.test(barcode)) {
      return reply.status(400).send({ error: 'Código de barras inválido' })
    }

    try {
      const url = `https://world.openfoodfacts.org/api/v2/product/${barcode}.json?fields=product_name,product_name_es,brands,ingredients_text,ingredients_text_es,allergens_tags,nutriscore_grade,ecoscore_grade,nova_group,nutriments,image_url,quantity,categories`
      const response = await fetch(url, {
        headers: { 'User-Agent': 'Stoqly/1.0 (jtorres@cogelo.es)' },
        signal: AbortSignal.timeout(6000),
      })

      if (!response.ok) {
        return reply.status(404).send({ error: 'Producto no encontrado' })
      }

      const data = await response.json() as any
      if (data.status !== 1 || !data.product) {
        return reply.status(404).send({ error: 'Producto no encontrado en Open Food Facts' })
      }

      const p = data.product as OFFProduct
      const nutriments = data.product.nutriments ?? {}

      return reply.send({
        barcode,
        name: p.product_name_es ?? p.product_name ?? null,
        brand: p.brands ?? null,
        quantity: p.quantity ?? null,
        ingredients: p.ingredients_text_es ?? p.ingredients_text ?? null,
        allergens: parseAllergens(p.allergens_tags),
        nutriscore: parseNutriscore(p.nutriscore_grade),
        ecoscore: p.ecoscore_grade?.toUpperCase() ?? null,
        novaGroup: p.nova_group ?? null,
        imageUrl: p.image_url ?? null,
        nutriments: {
          energia: nutriments['energy-kcal_100g'] ?? null,
          grasas: nutriments['fat_100g'] ?? null,
          grasasSaturadas: nutriments['saturated-fat_100g'] ?? null,
          carbohidratos: nutriments['carbohydrates_100g'] ?? null,
          azucares: nutriments['sugars_100g'] ?? null,
          fibra: nutriments['fiber_100g'] ?? null,
          proteinas: nutriments['proteins_100g'] ?? null,
          sal: nutriments['salt_100g'] ?? null,
        },
      })
    } catch (e: any) {
      if (e.name === 'TimeoutError') {
        return reply.status(504).send({ error: 'Open Food Facts no responde' })
      }
      app.log.error(e)
      return reply.status(500).send({ error: 'Error consultando Open Food Facts' })
    }
  })
}
