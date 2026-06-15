/**
 * Parseo de cadenas GS1 (Element Strings) procedentes de códigos 2D
 * (GS1 DataMatrix o GS1 QR Code) escaneados con la cámara.
 *
 * Estos códigos combinan varios "Application Identifiers" (AI) en una
 * misma cadena, p.ej:
 *   (01)08410000123456(17)260930(10)L240612A
 * que codifica GTIN=08410000123456, caducidad=2026-09-30, lote=L240612A.
 *
 * Permite a Stoqly autocompletar lote y caducidad al escanear, en lugar
 * de pedirlos siempre a mano. Es independiente del calendario GS1
 * Sunrise 2027: si un fabricante ya imprime un DataMatrix con estos
 * datos, Stoqly los aprovecha hoy mismo.
 */

export interface GS1Data {
  /** GTIN completo (14 dígitos) tal como viene en el AI(01)/(02) */
  gtin?: string
  /** GTIN normalizado a EAN-13 (sin el cero de relleno inicial) cuando aplica */
  ean?: string
  lotNumber?: string
  expiryDate?: string // ISO yyyy-mm-dd
  productionDate?: string // ISO yyyy-mm-dd
  serial?: string
  raw: string
}

// Carácter separador de grupo (FNC1) usado entre AIs de longitud variable
const GS = ''

// Longitudes fijas de los AIs más habituales (el resto son de longitud variable
// y terminan con el separador GS o con el final de la cadena)
const FIXED_LENGTHS: Record<string, number> = {
  '00': 18, // SSCC
  '01': 14, // GTIN
  '02': 14, // GTIN del contenido (logística)
  '11': 6,  // fecha de producción (AAMMDD)
  '12': 6,  // fecha límite de venta (AAMMDD)
  '13': 6,  // fecha de envasado (AAMMDD)
  '15': 6,  // fecha de consumo preferente (AAMMDD)
  '17': 6,  // fecha de caducidad (AAMMDD)
  '20': 2,  // variante de producto
}

// AIs de longitud variable que nos interesan (lote, serie, cantidad...)
const VARIABLE_AIS = new Set(['10', '21', '22', '30', '37', '90', '91', '92', '93'])

/** Convierte una fecha GS1 (AAMMDD) a ISO yyyy-mm-dd. DD=00 -> último día del mes. */
function gs1DateToISO(yyMMdd: string): string | undefined {
  if (!/^\d{6}$/.test(yyMMdd)) return undefined
  const yy = parseInt(yyMMdd.slice(0, 2), 10)
  const mm = yyMMdd.slice(2, 4)
  let dd = yyMMdd.slice(4, 6)
  const year = yy <= 50 ? 2000 + yy : 1900 + yy
  if (dd === '00') {
    const lastDay = new Date(year, parseInt(mm, 10), 0).getDate()
    dd = String(lastDay).padStart(2, '0')
  }
  return `${year}-${mm}-${dd}`
}

/**
 * Intenta interpretar `data` (lo que devuelve la cámara al escanear un código
 * de barras/QR/DataMatrix) como un GS1 Element String.
 *
 * Devuelve `null` si la cadena es un EAN/UPC plano (o cualquier otra cosa que
 * no parezca GS1), en cuyo caso debe tratarse como un código de barras normal.
 */
export function parseGS1(data: string): GS1Data | null {
  if (!data) return null

  // Algunos lectores antepones el prefijo de simbología ]d2 (DataMatrix) o
  // ]Q1/]Q3 (QR), o el propio carácter FNC1 (GS). Los quitamos si están.
  let s = data.replace(/^\](?:d2|Q[13])/, '').replace(new RegExp(`^${GS}`), '')

  // Un EAN-8/12/13 o GTIN-14 "a secas" son solo dígitos y no son GS1
  if (/^\d{8}$|^\d{12,14}$/.test(s)) return null
  // Cualquier otra cadena puramente numérica corta tampoco es GS1
  if (/^\d+$/.test(s) && s.length < 14) return null

  const result: GS1Data = { raw: data }
  let i = 0
  let foundAny = false

  while (i < s.length) {
    const ai2 = s.slice(i, i + 2)
    let ai: string | undefined
    let value: string | undefined

    if (FIXED_LENGTHS[ai2] !== undefined) {
      ai = ai2
      const len = FIXED_LENGTHS[ai]
      value = s.slice(i + 2, i + 2 + len)
      i += 2 + len
    } else if (VARIABLE_AIS.has(ai2)) {
      ai = ai2
      i += 2
      const gsIdx = s.indexOf(GS, i)
      const end = gsIdx === -1 ? s.length : gsIdx
      value = s.slice(i, end)
      i = end + (gsIdx === -1 ? 0 : 1)
    } else {
      // AI no reconocido o cadena corrupta: paramos aquí con lo que tengamos
      break
    }

    if (ai && value !== undefined) {
      foundAny = true
      switch (ai) {
        case '01':
        case '02':
          result.gtin = value
          result.ean = value.length === 14 && value.startsWith('0') ? value.slice(1) : value
          break
        case '10':
          result.lotNumber = value
          break
        case '17':
          result.expiryDate = gs1DateToISO(value)
          break
        case '15':
          if (!result.expiryDate) result.expiryDate = gs1DateToISO(value)
          break
        case '11':
          result.productionDate = gs1DateToISO(value)
          break
        case '21':
          result.serial = value
          break
      }
    }
  }

  return foundAny ? result : null
}
