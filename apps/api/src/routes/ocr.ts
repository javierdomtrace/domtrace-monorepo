import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const LabelScanBody = z.object({
  // Foto en base64 SIN el prefijo "data:image/jpeg;base64,"
  image: z.string().min(100),
  mediaType: z.enum(['image/jpeg', 'image/png', 'image/webp']).default('image/jpeg'),
})

const ALLOWED_MEDIA_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif'])

export const ocrRoutes: FastifyPluginAsync = async (app) => {

  // POST /v1/ocr/label-scan — extrae fecha de caducidad y lote de una foto de etiqueta
  app.post('/ocr/label-scan', {
    preHandler: [app.authenticate],
    bodyLimit: 12 * 1024 * 1024, // hasta ~12MB para fotos en base64
  }, async (req, reply) => {
    const parsed = LabelScanBody.safeParse(req.body)
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Datos de imagen inválidos', code: 'BAD_REQUEST' })
    }
    const { image, mediaType } = parsed.data

    if (!ALLOWED_MEDIA_TYPES.has(mediaType)) {
      return reply.status(400).send({ error: 'Tipo de imagen no soportado', code: 'BAD_REQUEST' })
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      return reply.status(503).send({ error: 'OCR no configurado (falta ANTHROPIC_API_KEY)', code: 'NOT_CONFIGURED' })
    }

    const prompt = `Esta es una foto del envase de un producto de alimentación o droguería. Busca la FECHA DE CADUCIDAD (o "consumir preferentemente antes de") y el NÚMERO DE LOTE impresos en el envase (normalmente cerca del código de barras, a menudo grabados o impresos con tinta poco contrastada).

Responde ÚNICAMENTE con JSON, sin texto adicional ni markdown, con este formato exacto:
{
  "expiryDate": "YYYY-MM-DD" | null,
  "lotNumber": "texto del lote tal cual aparece" | null,
  "confidence": "alta" | "media" | "baja",
  "notes": "aclaración breve si hay ambigüedad (ej: formato de fecha dudoso), o null"
}

Reglas:
- Si la fecha aparece en formato DD/MM/AAAA o similar, conviértela a YYYY-MM-DD. Si el día no es visible o el formato es solo MM/AAAA, usa el día 01 y dilo en "notes".
- Si no encuentras fecha o lote con claridad, pon null en ese campo en vez de inventar.
- "confidence" refleja tu seguridad global de la lectura.`

    try {
      const response = await anthropic.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 400,
        messages: [{
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: mediaType as any, data: image } },
            { type: 'text', text: prompt },
          ],
        }],
      })

      const block = response.content.find(b => b.type === 'text')
      const raw = block?.type === 'text' ? block.text.trim() : '{}'
      const jsonMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/) ?? raw.match(/(\{[\s\S]*\})/)
      const jsonStr = jsonMatch ? (jsonMatch[1] ?? jsonMatch[0]) : raw
      const result = JSON.parse(jsonStr)

      return reply.send({
        data: {
          expiryDate: result.expiryDate ?? null,
          lotNumber: result.lotNumber ?? null,
          confidence: result.confidence ?? 'baja',
          notes: result.notes ?? null,
        },
      })
    } catch (e: any) {
      app.log.error({ err: e.message }, 'ocr/label-scan error')
      return reply.status(500).send({ error: 'No se pudo procesar la imagen', code: 'OCR_ERROR' })
    }
  })
}
