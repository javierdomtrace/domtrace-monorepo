// Tipos compartidos — copiados de packages/types para evitar dependencia workspace en EAS Build

export type Tier = 'FREE' | 'HOGAR' | 'EXPERTO' | 'ENTERPRISE'
export type ItemStatus = 'OK' | 'EXPIRING_SOON' | 'EXPIRED' | 'CONSUMED' | 'DISCARDED'
export type TagStatus = 'UNREGISTERED' | 'PENDING_WRITE' | 'ACTIVE' | 'REASSIGNING' | 'LOCKED'
export type ExpedicionEstado = 'EXPEDIDA' | 'EN_TRANSITO' | 'ENTREGADA' | 'INCIDENCIA'
export type AccessibilityMode = 'VOICE' | 'VIBRATION' | 'SILENT' | 'COMBINED'

export interface ApiOk<T> { data: T }
export interface ApiError { error: string; code: string; statusCode: number }

export interface ItemDTO {
  id: string
  name: string
  barcode?: string
  epc?: string
  categoryId?: string
  expiryDate?: string
  openedAt?: string
  paoMonths?: number
  quantity: number
  unit: string
  status: ItemStatus
  price?: number
  allergens: string[]
  notes?: string
  imageUrl?: string
  zoneId?: string
  zoneName?: string
  daysUntilExpiry?: number
  createdAt: string
  updatedAt: string
}

export interface CreateItemBody {
  name: string
  barcode?: string
  epc?: string
  expiryDate?: string
  openedAt?: string
  paoMonths?: number
  quantity?: number
  unit?: string
  zoneId?: string
  tagId?: string
  price?: number
  allergens?: string[]
  notes?: string
}

export interface StoqlyContext {
  userId: string
  userName: string
  householdId: string
  assistantName: string
  allergens: string[]
  supermarket?: string
  accessibilityMode: AccessibilityMode
  humorEnabled: boolean
  pantry: ItemDTO[]
  expiringSoon: ItemDTO[]
  recentHistory: ChatMessage[]
}

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  timestamp: string
}

export type StoqlyAction =
  | { type: 'add_item'; payload: CreateItemBody }
  | { type: 'consume_item'; payload: { itemId: string; quantity?: number } }
  | { type: 'discard_item'; payload: { itemId: string } }
  | { type: 'add_to_shopping_list'; payload: { name: string; quantity?: number; unit?: string } }
  | { type: 'get_recipes'; payload?: { ingredients?: string[] } }
  | { type: 'get_expiring_soon'; payload?: { days?: number } }
