import React, { useState, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api'
import { Plus, Check, Trash2, ScanLine, BarChart2, ShoppingCart, RefreshCw, Euro, Sparkles, X, ExternalLink, Copy, CheckCheck, Send } from 'lucide-react'

// ── Tipos ────────────────────────────────────────────────────────────

interface ShoppingItem {
  id: string; name: string; quantity: number; unit: string
  supermarket?: string; checked: boolean; addedBy: string
  precio?: number
}

interface Comparison {
  supermarket: string; emoji: string; total: number
  items: Array<{ name: string; precio: number; nota?: string }>
  notas?: string; disponibilidadZona?: string
}

interface ComparisonResponse {
  stoqlyMsg: string; comparativa: Comparison[]; recomendacion: string
}

interface ProposalItem {
  tempId: string; name: string; quantity: number; unit: string
  motivo: 'minimos' | 'caduca' | 'sugerido' | 'manual'; nota?: string
  discarded: boolean
}

interface SuperPrices { Mercadona?: number; Carrefour?: number; Lidl?: number; Alcampo?: number; Dia?: number }

// ── Constantes ────────────────────────────────────────────────────────

const SUPERS = [
  { id: 'mercadona', label: 'Mercadona', emoji: '🔵', color: '#1E6DB7', url: 'https://tienda.mercadona.es/search?query=' },
  { id: 'carrefour', label: 'Carrefour', emoji: '🔴', color: '#C00', url: 'https://www.carrefour.es/search?q=' },
  { id: 'lidl', label: 'Lidl', emoji: '🟡', color: '#F5C400', url: 'https://www.lidl.es/q/' },
  { id: 'alcampo', label: 'Alcampo', emoji: '🟠', color: '#E8871A', url: 'https://www.alcampo.es/compra-online#q=' },
  { id: 'dia', label: 'Dia', emoji: '⚪', color: '#888', url: 'https://www.dia.es/search?q=' },
]

const MOTIVO_LABEL: Record<string, { label: string; color: string; bg: string }> = {
  minimos:  { label: '⚠️ Stock mínimo',  color: '#EF9F27', bg: 'rgba(239,159,39,0.1)' },
  caduca:   { label: '⏰ Caduca pronto', color: '#E24B4A', bg: 'rgba(226,75,74,0.1)' },
  sugerido: { label: '✦ Sugerido',       color: '#1D9E75', bg: 'rgba(29,158,117,0.1)' },
  manual:   { label: '✏️ Añadido',        color: '#7F77DD', bg: 'rgba(127,119,221,0.1)' },
}

function uid() { return Math.random().toString(36).slice(2) }

// ── Componente principal ──────────────────────────────────────────────

export function ShoppingPage() {
  const qc = useQueryClient()
  const [activeTab, setActiveTab] = useState<'lista' | 'propuesta' | 'comparativa'>('lista')
  const [newItem, setNewItem] = useState('')
  const [adding, setAdding] = useState(false)
  const [scanMode, setScanMode] = useState(false)
  const [barcodeInput, setBarcodeInput] = useState('')
  const [comparison, setComparison] = useState<ComparisonResponse | null>(null)
  const [loadingComparison, setLoadingComparison] = useState(false)
  const [prices, setPrices] = useState<Record<string, string>>({})
  const [proposal, setProposal] = useState<ProposalItem[]>([])
  const [proposalMsg, setProposalMsg] = useState('')
  const [loadingProposal, setLoadingProposal] = useState(false)
  const [superPrices, setSuperPrices] = useState<SuperPrices>({})
  const [proposalInput, setProposalInput] = useState('')
  const [selectedSuper, setSelectedSuper] = useState<string>('mercadona')
  const [exportMode, setExportMode] = useState<'online' | 'papel'>('online')
  const [copied, setCopied] = useState(false)
  const [sortAlpha, setSortAlpha] = useState(false)
  const [deduplicating, setDeduplicating] = useState(false)
  const barcodeRef = useRef<HTMLInputElement>(null)

  const { data } = useQuery<any>({
    queryKey: ['shopping'],
    queryFn: () => api.get('/shopping'),
    refetchInterval: 30_000,
  })
  const { data: itemsData } = useQuery<any>({
    queryKey: ['items', 'all'],
    queryFn: () => api.get('/items?limit=200&sort=expiryDate&order=asc'),
  })
  const { data: profileData } = useQuery<any>({
    queryKey: ['profile'],
    queryFn: () => api.get('/profile'),
  })

  const add = useMutation({
    mutationFn: (payload: { name: string; quantity?: number }) =>
      api.post('/shopping', { name: payload.name, quantity: payload.quantity ?? 1 }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['shopping'] }); setNewItem(''); setAdding(false) },
  })
  const check = useMutation({
    mutationFn: (id: string) => api.patch(`/shopping/${id}/check`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['shopping'] }),
  })
  const remove = useMutation({
    mutationFn: (id: string) => api.delete(`/shopping/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['shopping'] }),
  })
  const clearChecked = useMutation({
    mutationFn: () => api.delete('/shopping/clear'),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['shopping'] }),
  })
  const deduplicate = async () => {
    setDeduplicating(true)
    try {
      await api.delete('/shopping/deduplicate')
      qc.invalidateQueries({ queryKey: ['shopping'] })
    } finally {
      setDeduplicating(false)
    }
  }

  const allItemsRaw: ShoppingItem[] = Array.isArray(data) ? data : Array.isArray(data?.items) ? data.items : (data?.data ?? [])
  const allItems: ShoppingItem[] = sortAlpha
    ? [...allItemsRaw].sort((a, b) => a.name.localeCompare(b.name, 'es', { sensitivity: 'base' }))
    : allItemsRaw
  const pantryItems: any[] = Array.isArray(itemsData) ? itemsData : (itemsData?.data ?? [])
  const pendingItems = allItems.filter(i => !i.checked)
  const checkedCount = allItems.filter(i => i.checked).length

  const totalGastado = allItems.reduce((sum, item) => {
    const p = parseFloat(prices[item.id] ?? '0')
    return sum + (isNaN(p) ? 0 : p)
  }, 0)

  // ── Scan EAN ─────────────────────────────────────────────────────────
  const handleBarcodeSubmit = async () => {
    const code = barcodeInput.replace(/\D/g, '')
    if (!/^\d{8,14}$/.test(code)) return
    try {
      const data = await api.get<any>(`/openfoodfacts/${code}`)
      await add.mutateAsync({ name: data.name ?? `Producto ${code}` })
    } catch {
      await add.mutateAsync({ name: `Producto ${code}` })
    }
    setBarcodeInput('')
  }

  // ── Generar propuesta Stoqly ─────────────────────────────────────────
  const generateProposal = async () => {
    setLoadingProposal(true)
    setProposal([])
    setProposalMsg('')
    setSuperPrices({})
    try {
      // Perfil del hogar
      const profileUser = profileData?.data?.user
      const profileHousehold = profileData?.data?.household
      const numPersonas: number = profileHousehold?.members?.length ?? 1
      const personasDesc = numPersonas === 1
        ? 'UNA SOLA PERSONA (vive solo/a)'
        : `${numPersonas} personas`

      // Alergias del perfil (crítico: deben ser restricciones hard)
      const alergias: string[] = [
        ...(profileUser?.allergens ?? []),
        ...(profileUser?.alergiasPersonalizadas ?? []),
      ]

      // Mapear códigos internos a términos legibles
      const ALERGIA_LABEL: Record<string, string> = {
        GLUTEN: 'gluten (trigo, cebada, centeno, avena — celíaco)',
        LACTOSA: 'lactosa / lácteos',
        FRUTOS_SECOS: 'frutos secos',
        HUEVO: 'huevo',
        MARISCO: 'marisco / crustáceos',
        SOY: 'soja',
        APIO: 'apio',
        MOSTAZA: 'mostaza',
        SESAMO: 'sésamo',
        SULFITOS: 'sulfitos',
      }
      const alergiasLegibles = alergias
        .map(a => ALERGIA_LABEL[a] ?? a)
        .join(', ')

      // Bloque de restricción — se añade al prompt si hay alergias
      const restriccionesBloque = alergias.length > 0
        ? `\n⚠️ RESTRICCIONES ABSOLUTAS — NUNCA IGNORAR:\nEl usuario tiene alergia/intolerancia a: ${alergiasLegibles}.\nJAMÁS incluyas en la propuesta productos que contengan estos alérgenos.\nSi hay un sustituto sin el alérgeno (ej: pan sin gluten, leche sin lactosa), propón explícitamente ese sustituto.\n`
        : ''

      // Items en mínimos (cantidad <= 2)
      const bajoStock = pantryItems
        .filter(i => i.quantity <= 2)
        .map(i => `- ${i.name} (${i.quantity} ${i.unit} restantes)`)
        .join('\n')

      // Items que caducan en los próximos 5 días
      const proxCaducidad = pantryItems
        .filter(i => i.daysUntilExpiry !== undefined && i.daysUntilExpiry <= 5 && i.daysUntilExpiry >= 0)
        .map(i => `- ${i.name} (caduca en ${i.daysUntilExpiry} días)`)
        .join('\n')

      // Lista actual de la compra (para no duplicar)
      const yaEnLista = allItems.map(i => i.name).join(', ')

      const prompt = `Eres Stoqly, asistente de despensa. El usuario hace su compra online los JUEVES. Hoy es ${new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}.

HOGAR: ${personasDesc}.
${restriccionesBloque}
⚠️ REGLA DE CANTIDADES — MUY IMPORTANTE:
El hogar tiene ${numPersonas} ${numPersonas === 1 ? 'persona' : 'personas'}. Ajusta TODAS las cantidades a este tamaño real.
${numPersonas === 1 ? `Para una persona sola:
- Fruta fresca: máximo 3-4 piezas en total (no 1kg de cada tipo — se estropea antes de comerla).
- Verdura fresca: 1 bolsa pequeña o 2-3 unidades, no más.
- Lácteos: 1-2 yogures, 1 brik de leche. No packs de 6 si no los consume.
- Pan de molde: 1 paquete pequeño o de molde sin gluten si es celiaco.
- Carne/pescado: raciones individuales (150-200g), no packs familiares.
- En general: piensa siempre "¿puede una persona comer esto en 5-7 días antes de que se estropee?"` : `Para ${numPersonas} personas: ajusta las cantidades a lo que consumen en una semana.`}

Analiza la despensa y genera una propuesta de cesta para la compra del próximo jueves:

PRODUCTOS EN MÍNIMOS DE STOCK:
${bajoStock || '(ninguno en mínimos ahora mismo)'}

PRODUCTOS QUE CADUCAN PRONTO (antes del jueves):
${proxCaducidad || '(nada que caduque antes del jueves)'}

YA EN LA LISTA DE LA COMPRA (no duplicar): ${yaEnLista || 'ninguno'}

Propón entre 5 y 15 productos. Incluye tanto mínimos/caducidades como sugerencias útiles.
${alergias.length > 0 ? `RECUERDA: NINGÚN producto puede contener ${alergiasLegibles}. Comprueba cada item antes de incluirlo.` : ''}

También incluye estimación del coste total en cada supermercado (precios realistas España 2025).

Responde ÚNICAMENTE con JSON válido:
{
  "mensajeGeneral": "frase de Stoqly sobre la compra del jueves, cálida y cercana",
  "preciosEstimados": {
    "Mercadona": 0.00,
    "Carrefour": 0.00,
    "Lidl": 0.00,
    "Alcampo": 0.00,
    "Dia": 0.00
  },
  "propuesta": [
    {
      "nombre": "Leche entera",
      "cantidad": 1,
      "unidad": "u",
      "motivo": "minimos",
      "nota": "Solo te quedaba medio brik"
    }
  ]
}

motivo: "minimos" | "caduca" | "sugerido"`

      const res = await api.post<any>('/stoqly/chat', { message: prompt, history: [], maxTokens: 2500 })
      const text = res.reply ?? ''
      const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/) ?? text.match(/(\{[\s\S]*\})/)
      const jsonStr = jsonMatch ? (jsonMatch[1] ?? jsonMatch[0]) : text.trim()
      const parsed = JSON.parse(jsonStr)

      if (parsed.mensajeGeneral) setProposalMsg(parsed.mensajeGeneral)
      if (parsed.preciosEstimados) setSuperPrices(parsed.preciosEstimados)
      if (Array.isArray(parsed.propuesta)) {
        setProposal(parsed.propuesta.map((p: any) => ({
          tempId: uid(),
          name: p.nombre,
          quantity: p.cantidad ?? 1,
          unit: p.unidad ?? 'u',
          motivo: p.motivo ?? 'sugerido',
          nota: p.nota,
          discarded: false,
        })))
      }
    } catch (e) {
      console.error('Error propuesta:', e)
    } finally {
      setLoadingProposal(false)
    }
  }

  // ── Añadir propuesta seleccionada a la lista ─────────────────────────
  const addProposalToList = async () => {
    const toAdd = proposal.filter(p => !p.discarded)
    for (const item of toAdd) {
      await add.mutateAsync({ name: item.name, quantity: item.quantity })
      await new Promise(r => setTimeout(r, 80))
    }
    qc.invalidateQueries({ queryKey: ['shopping'] })
    setProposal([])
    setProposalMsg('')
    setSuperPrices({})
    setActiveTab('lista')
  }

  // ── Generar comparativa ───────────────────────────────────────────────
  const generateComparison = async () => {
    if (pendingItems.length === 0) return
    setLoadingComparison(true)
    setComparison(null)
    try {
      const lista = pendingItems.map(i => `${i.name} (${i.quantity} ${i.unit})`).join(', ')
      const prompt = `Tengo esta lista de la compra: ${lista}.

Haz una comparativa de precios estimados en Mercadona, Carrefour, Lidl, Alcampo y Dia.
Para cada supermercado: precio estimado de cada producto, total, y nota sobre reparto a domicilio.

Responde ÚNICAMENTE con JSON:
{
  "stoqlyMsg": "1 frase con humor presentando la comparativa",
  "recomendacion": "cuál es más económico y por qué (1-2 frases)",
  "comparativa": [
    {
      "supermarket": "Mercadona", "emoji": "🔵", "total": 0.00,
      "items": [{"name": "...", "precio": 0.00, "nota": "opcional"}],
      "disponibilidadZona": "Reparto disponible en la mayoría de ciudades"
    }
  ]
}`
      const res = await api.post<any>('/stoqly/chat', { message: prompt, history: [], maxTokens: 2000 })
      const text = res.reply ?? ''
      const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/) ?? text.match(/(\{[\s\S]*\})/)
      const jsonStr = jsonMatch ? (jsonMatch[1] ?? jsonMatch[0]) : text.trim()
      setComparison(JSON.parse(jsonStr))
    } catch (e) { console.error('Error comparativa:', e) }
    finally { setLoadingComparison(false) }
  }

  // ── Export helpers ────────────────────────────────────────────────────
  const activeSuper = SUPERS.find(s => s.id === selectedSuper) ?? SUPERS[0]
  const exportItems = proposal.filter(p => !p.discarded)

  const copyList = () => {
    const lines = exportItems.map((p, i) => `${i + 1}. ${p.name}  ×${p.quantity} ${p.unit}`)
    navigator.clipboard.writeText(lines.join('\n')).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  const copyListFromShopping = () => {
    const lines = pendingItems.map((p, i) => `${i + 1}. ${p.name}  ×${p.quantity} ${p.unit}`)
    navigator.clipboard.writeText(lines.join('\n')).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  const superColor = (name: string) => SUPERS.find(s => s.label.toLowerCase() === name.toLowerCase())?.color ?? '#888'

  // ── Render ────────────────────────────────────────────────────────────

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>Lista de la compra</h1>
          <p style={{ margin: '4px 0 0', color: 'var(--muted)', fontSize: 14 }}>
            {allItems.length} productos · {checkedCount} en el carro
            {totalGastado > 0 && (
              <span style={{ marginLeft: 10, color: '#1D9E75', fontWeight: 700 }}>
                · {totalGastado.toFixed(2)} € acumulados
              </span>
            )}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {checkedCount > 0 && (
            <button onClick={() => clearChecked.mutate()} style={btnSec}>
              <Trash2 size={14} /> Limpiar
            </button>
          )}
          <button onClick={() => setScanMode(v => !v)} style={{
            ...btnSec, borderColor: scanMode ? 'var(--teal)' : undefined, color: scanMode ? 'var(--teal)' : undefined,
          }}>
            <ScanLine size={14} /> Escanear
          </button>
          <button onClick={() => setAdding(true)} style={btnPrimary}>
            <Plus size={16} /> Añadir
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 20, background: 'var(--surface)', padding: 4, borderRadius: 10, width: 'fit-content' }}>
        <TabBtn active={activeTab === 'lista'} onClick={() => setActiveTab('lista')} icon={<ShoppingCart size={14} />} label="Mi lista" />
        <TabBtn active={activeTab === 'propuesta'} onClick={() => {
          setActiveTab('propuesta')
          if (proposal.length === 0 && !loadingProposal) generateProposal()
        }} icon={<Sparkles size={14} />} label="Propuesta Stoqly" highlight />
        <TabBtn active={activeTab === 'comparativa'} onClick={() => {
          setActiveTab('comparativa')
          if (!comparison && pendingItems.length > 0) generateComparison()
        }} icon={<BarChart2 size={14} />} label="Comparativa" />
      </div>

      {/* Scan EAN */}
      {scanMode && (
        <div style={{
          display: 'flex', gap: 10, marginBottom: 16, padding: '14px 16px',
          background: 'rgba(78,205,196,0.06)', border: '1px solid rgba(78,205,196,0.2)', borderRadius: 12,
        }}>
          <ScanLine size={16} color="var(--teal)" style={{ flexShrink: 0, marginTop: 2 }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 6 }}>
              Escanea o escribe un EAN para añadirlo a la lista
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                ref={barcodeRef}
                value={barcodeInput}
                onChange={e => setBarcodeInput(e.target.value.replace(/\D/g, ''))}
                onKeyDown={e => e.key === 'Enter' && handleBarcodeSubmit()}
                placeholder="8-14 dígitos EAN..."
                inputMode="numeric"
                autoFocus
                style={{ flex: 1, padding: '8px 12px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)', fontSize: 14, outline: 'none' }}
              />
              <button onClick={handleBarcodeSubmit} style={{ ...btnPrimary, padding: '8px 14px' }}>Añadir</button>
            </div>
          </div>
        </div>
      )}

      {/* Añadir manual */}
      {adding && (
        <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
          <input
            autoFocus value={newItem} onChange={e => setNewItem(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && newItem) add.mutate({ name: newItem })
              if (e.key === 'Escape') setAdding(false)
            }}
            placeholder="Nombre del producto..."
            style={{ flex: 1, padding: '10px 14px', background: 'var(--surface)', border: '1px solid var(--teal)', borderRadius: 10, color: 'var(--text)', fontSize: 14, outline: 'none' }}
          />
          <button onClick={() => newItem && add.mutate({ name: newItem })} style={btnPrimary}>Añadir</button>
          <button onClick={() => setAdding(false)} style={btnSec}>✕</button>
        </div>
      )}

      {/* ══ TAB: MI LISTA ══════════════════════════════════════════════ */}
      {activeTab === 'lista' && (
        <>
          {/* Controles de lista */}
          {allItems.length > 0 && (
            <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
              <button
                onClick={() => setSortAlpha(v => !v)}
                style={{
                  ...btnSec,
                  borderColor: sortAlpha ? 'var(--teal)' : undefined,
                  color: sortAlpha ? 'var(--teal)' : undefined,
                  fontSize: 13,
                }}
              >
                {sortAlpha ? '↓ A–Z activo' : '↕ Ordenar A–Z'}
              </button>
              <button
                onClick={deduplicate}
                disabled={deduplicating}
                style={{ ...btnSec, fontSize: 13, opacity: deduplicating ? 0.6 : 1 }}
              >
                {deduplicating ? 'Quitando...' : '⊘ Quitar duplicados'}
              </button>
            </div>
          )}

          {allItems.length === 0 ? (
            <EmptyList onAdd={() => setAdding(true)} onProposal={() => {
              setActiveTab('propuesta')
              if (proposal.length === 0 && !loadingProposal) generateProposal()
            }} />
          ) : (
            <div>
              {Object.entries(
                allItems.reduce((acc, item) => {
                  const key = item.supermarket ?? 'Sin asignar'
                  if (!acc[key]) acc[key] = []
                  acc[key].push(item)
                  return acc
                }, {} as Record<string, ShoppingItem[]>)
              ).map(([supermarket, items]) => (
                <div key={supermarket} style={{ marginBottom: 24 }}>
                  <h2 style={{ fontSize: 13, fontWeight: 600, color: 'var(--muted)', margin: '0 0 10px', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                    🛒 {supermarket}
                  </h2>
                  <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
                    {items.map(item => (
                      <div key={item.id} style={{
                        display: 'flex', alignItems: 'center', gap: 12,
                        padding: '11px 14px', borderBottom: '1px solid var(--border)',
                        opacity: item.checked ? 0.4 : 1,
                      }}>
                        <button onClick={() => check.mutate(item.id)} style={{
                          width: 22, height: 22, borderRadius: 6, flexShrink: 0, cursor: 'pointer',
                          border: item.checked ? 'none' : '2px solid var(--border)',
                          background: item.checked ? 'var(--teal)' : 'transparent',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                          {item.checked && <Check size={13} color="#0F0F1A" strokeWidth={3} />}
                        </button>
                        <span style={{
                          flex: 1, fontSize: 14, fontWeight: 500, color: 'var(--text)',
                          textDecoration: item.checked ? 'line-through' : 'none',
                        }}>
                          {item.name}
                          {item.addedBy === 'stoqly' && (
                            <span style={{ marginLeft: 6, fontSize: 10, color: 'var(--teal)', background: 'rgba(78,205,196,0.1)', borderRadius: 8, padding: '1px 6px' }}>Stoqly</span>
                          )}
                        </span>
                        <span style={{ fontSize: 12, color: 'var(--muted)' }}>{item.quantity} {item.unit}</span>
                        <div style={{ position: 'relative', width: 72 }}>
                          <Euro size={11} style={{ position: 'absolute', left: 7, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)' }} />
                          <input
                            type="number" min="0" step="0.01" placeholder="0.00"
                            value={prices[item.id] ?? ''}
                            onChange={e => setPrices(p => ({ ...p, [item.id]: e.target.value }))}
                            style={{
                              width: '100%', padding: '5px 6px 5px 20px',
                              background: 'var(--bg)', border: '1px solid var(--border)',
                              borderRadius: 6, color: 'var(--text)', fontSize: 12, outline: 'none', boxSizing: 'border-box',
                            }}
                          />
                        </div>
                        <button onClick={() => remove.mutate(item.id)} style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', padding: 4 }}>
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              ))}

              {totalGastado > 0 && (
                <div style={{
                  display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 10,
                  padding: '14px 16px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12,
                }}>
                  <span style={{ fontSize: 14, color: 'var(--muted)' }}>Total acumulado:</span>
                  <span style={{ fontSize: 20, fontWeight: 800, color: '#1D9E75' }}>{totalGastado.toFixed(2)} €</span>
                </div>
              )}

              {/* Exportar lista actual */}
              {pendingItems.length > 0 && (
                <div style={{ marginTop: 16 }}>
                  <ExportPanel
                    items={pendingItems.map(i => ({ name: i.name, quantity: i.quantity, unit: i.unit }))}
                    selectedSuper={selectedSuper}
                    setSelectedSuper={setSelectedSuper}
                    exportMode={exportMode}
                    setExportMode={setExportMode}
                    copied={copied}
                    onCopy={copyListFromShopping}
                    superPrices={{}}
                  />
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* ══ TAB: PROPUESTA STOQLY ══════════════════════════════════════ */}
      {activeTab === 'propuesta' && (
        <div>
          {/* Botón regenerar */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div style={{ fontSize: 13, color: 'var(--muted)' }}>
              Compra del jueves · basada en mínimos y caducidades
            </div>
            <button onClick={generateProposal} disabled={loadingProposal} style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px',
              background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8,
              color: 'var(--muted)', fontSize: 13, cursor: 'pointer',
            }}>
              <RefreshCw size={13} style={{ animation: loadingProposal ? 'spin 1s linear infinite' : 'none' }} />
              {loadingProposal ? 'Analizando despensa...' : 'Regenerar propuesta'}
            </button>
          </div>

          {loadingProposal && proposal.length === 0 && (
            <div style={{ textAlign: 'center', padding: '70px 0', color: 'var(--muted)' }}>
              <Sparkles size={36} style={{ opacity: 0.4, marginBottom: 16 }} />
              <p style={{ margin: 0, fontSize: 15 }}>Stoqly está analizando tu despensa...</p>
              <p style={{ margin: '6px 0 0', fontSize: 13 }}>Comprobando mínimos y caducidades</p>
            </div>
          )}

          {proposalMsg && (
            <div style={{
              display: 'flex', gap: 10, alignItems: 'flex-start', marginBottom: 16,
              padding: '12px 14px', background: 'rgba(29,158,117,0.07)',
              border: '1px solid rgba(29,158,117,0.2)', borderRadius: 10,
            }}>
              <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#1D9E75', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, color: '#fff', flexShrink: 0 }}>✦</div>
              <div style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.6 }}>{proposalMsg}</div>
            </div>
          )}

          {/* Input para añadir manualmente a la propuesta */}
          {!loadingProposal && (
            <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
              <input
                value={proposalInput}
                onChange={e => setProposalInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && proposalInput.trim()) {
                    setProposal(p => [...p, {
                      tempId: uid(), name: proposalInput.trim(),
                      quantity: 1, unit: 'u', motivo: 'sugerido', discarded: false,
                    }])
                    setProposalInput('')
                  }
                }}
                placeholder="Añadir producto a la propuesta..."
                style={{
                  flex: 1, padding: '9px 14px', background: 'var(--surface)',
                  border: '1px solid var(--border)', borderRadius: 10,
                  color: 'var(--text)', fontSize: 14, outline: 'none',
                }}
              />
              <button
                onClick={() => {
                  if (!proposalInput.trim()) return
                  setProposal(p => [...p, {
                    tempId: uid(), name: proposalInput.trim(),
                    quantity: 1, unit: 'u', motivo: 'sugerido', discarded: false,
                  }])
                  setProposalInput('')
                }}
                style={btnPrimary}
              >
                <Plus size={16} /> Añadir
              </button>
            </div>
          )}

          {proposal.length > 0 && (
            <>
              {/* Items de la propuesta */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 16 }}>
                {proposal.map(item => {
                  const mot = MOTIVO_LABEL[item.motivo]
                  return (
                    <div key={item.tempId} style={{
                      display: 'flex', alignItems: 'center', gap: 12,
                      padding: '11px 14px', background: 'var(--surface)',
                      border: `1px solid ${item.discarded ? 'var(--border)' : mot.color + '40'}`,
                      borderRadius: 10, opacity: item.discarded ? 0.35 : 1,
                      transition: 'opacity 0.2s, border-color 0.2s',
                    }}>
                      {/* Checkbox */}
                      <button
                        onClick={() => setProposal(p => p.map(i => i.tempId === item.tempId ? { ...i, discarded: !i.discarded } : i))}
                        style={{
                          width: 22, height: 22, borderRadius: 6, flexShrink: 0, cursor: 'pointer',
                          border: item.discarded ? '2px solid var(--border)' : 'none',
                          background: item.discarded ? 'transparent' : '#1D9E75',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}
                      >
                        {!item.discarded && <Check size={13} color="#0F0F1A" strokeWidth={3} />}
                      </button>

                      {/* Nombre + nota */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {item.name}
                        </div>
                        {item.nota && (
                          <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 1 }}>{item.nota}</div>
                        )}
                      </div>

                      {/* Cantidad */}
                      <span style={{ fontSize: 12, color: 'var(--muted)', flexShrink: 0 }}>×{item.quantity} {item.unit}</span>

                      {/* Motivo */}
                      <span style={{
                        fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 10, flexShrink: 0,
                        color: mot.color, background: mot.bg,
                      }}>
                        {mot.label}
                      </span>

                      {/* X para descartar */}
                      <button
                        onClick={() => setProposal(p => p.map(i => i.tempId === item.tempId ? { ...i, discarded: !i.discarded } : i))}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: 'var(--muted)', flexShrink: 0 }}
                        title={item.discarded ? 'Recuperar' : 'Descartar'}
                      >
                        {item.discarded ? <Plus size={14} /> : <X size={14} />}
                      </button>
                    </div>
                  )
                })}
              </div>

              {/* Resumen selección */}
              <div style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '12px 14px', background: 'var(--surface)', border: '1px solid var(--border)',
                borderRadius: 10, marginBottom: 20,
              }}>
                <span style={{ fontSize: 13, color: 'var(--muted)' }}>
                  {proposal.filter(p => !p.discarded).length} de {proposal.length} productos seleccionados
                </span>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    onClick={() => setProposal(p => p.map(i => ({ ...i, discarded: true })))}
                    style={{ ...btnSec, padding: '7px 12px', fontSize: 12 }}
                  >
                    Desmarcar todos
                  </button>
                  <button
                    onClick={() => setProposal(p => p.map(i => ({ ...i, discarded: false })))}
                    style={{ ...btnSec, padding: '7px 12px', fontSize: 12 }}
                  >
                    Seleccionar todos
                  </button>
                </div>
              </div>

              {/* Panel de exportación / envío */}
              <ExportPanel
                items={exportItems.map(i => ({ name: i.name, quantity: i.quantity, unit: i.unit }))}
                selectedSuper={selectedSuper}
                setSelectedSuper={setSelectedSuper}
                exportMode={exportMode}
                setExportMode={setExportMode}
                copied={copied}
                onCopy={copyList}
                superPrices={superPrices}
                addToListBtn={
                  <button
                    onClick={addProposalToList}
                    disabled={exportItems.length === 0}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 8,
                      width: '100%', padding: '13px', borderRadius: 12, border: 'none',
                      background: exportItems.length === 0 ? 'var(--border)' : '#1D9E75',
                      color: '#fff', fontSize: 14, fontWeight: 700,
                      cursor: exportItems.length === 0 ? 'not-allowed' : 'pointer',
                      justifyContent: 'center', marginBottom: 12,
                    }}
                  >
                    <ShoppingCart size={16} /> Añadir {exportItems.length} productos a mi lista
                  </button>
                }
              />
            </>
          )}
        </div>
      )}

      {/* ══ TAB: COMPARATIVA ══════════════════════════════════════════ */}
      {activeTab === 'comparativa' && (
        <div>
          {pendingItems.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--muted)' }}>
              <BarChart2 size={48} style={{ opacity: 0.3, marginBottom: 12 }} />
              <p>Añade productos a tu lista para comparar precios</p>
            </div>
          ) : (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <div style={{ fontSize: 13, color: 'var(--muted)' }}>
                  Comparando {pendingItems.length} productos en 5 supermercados
                </div>
                <button onClick={generateComparison} disabled={loadingComparison} style={{
                  display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px',
                  background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8,
                  color: 'var(--muted)', fontSize: 13, cursor: 'pointer',
                }}>
                  <RefreshCw size={13} style={{ animation: loadingComparison ? 'spin 1s linear infinite' : 'none' }} />
                  {loadingComparison ? 'Consultando precios...' : 'Actualizar comparativa'}
                </button>
              </div>

              {loadingComparison && !comparison && (
                <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--muted)' }}>
                  <RefreshCw size={32} style={{ animation: 'spin 1s linear infinite', marginBottom: 16, opacity: 0.5 }} />
                  <p style={{ margin: 0 }}>Stoqly está comparando precios...</p>
                </div>
              )}

              {comparison && (
                <div>
                  {comparison.stoqlyMsg && (
                    <div style={{
                      display: 'flex', gap: 10, alignItems: 'flex-start', marginBottom: 20,
                      padding: '12px 14px', background: 'rgba(29,158,117,0.07)',
                      border: '1px solid rgba(29,158,117,0.2)', borderRadius: 10,
                    }}>
                      <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#1D9E75', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, color: '#fff', flexShrink: 0 }}>✦</div>
                      <div style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.6 }}>{comparison.stoqlyMsg}</div>
                    </div>
                  )}

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
                    {[...comparison.comparativa].sort((a, b) => a.total - b.total).map((c, idx) => {
                      const color = superColor(c.supermarket)
                      const isCheapest = idx === 0
                      return (
                        <div key={c.supermarket} style={{
                          background: 'var(--surface)',
                          border: isCheapest ? `2px solid ${color}` : '1px solid var(--border)',
                          borderRadius: 12, padding: '14px 16px', position: 'relative',
                        }}>
                          {isCheapest && (
                            <div style={{ position: 'absolute', top: -10, left: 14, background: color, color: '#fff', fontSize: 10, fontWeight: 700, padding: '2px 10px', borderRadius: 10 }}>
                              🏆 MÁS ECONÓMICO
                            </div>
                          )}
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>{c.emoji} {c.supermarket}</div>
                            <div style={{ fontSize: 22, fontWeight: 800, color }}>{c.total.toFixed(2)} €</div>
                          </div>
                          {c.disponibilidadZona && (
                            <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 8 }}>🚚 {c.disponibilidadZona}</div>
                          )}
                          {c.items?.slice(0, 4).map((item, j) => (
                            <div key={j} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--muted)', marginBottom: 2 }}>
                              <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.name}</span>
                              <span style={{ marginLeft: 8, color: 'var(--text)', fontWeight: 600, flexShrink: 0 }}>{item.precio.toFixed(2)} €</span>
                            </div>
                          ))}
                          {(c.items?.length ?? 0) > 4 && (
                            <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>+ {c.items.length - 4} más...</div>
                          )}
                        </div>
                      )
                    })}
                  </div>

                  {comparison.recomendacion && (
                    <div style={{ padding: '14px 16px', background: 'rgba(29,158,117,0.05)', border: '1px solid rgba(29,158,117,0.15)', borderRadius: 10, fontSize: 13, color: 'var(--text)', lineHeight: 1.6 }}>
                      💡 {comparison.recomendacion}
                    </div>
                  )}
                  <p style={{ fontSize: 11, color: 'var(--muted)', marginTop: 12, fontStyle: 'italic' }}>
                    * Precios estimados por IA basados en medias de 2025. Los precios reales pueden variar.
                  </p>
                </div>
              )}
            </>
          )}
        </div>
      )}

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}

// ── Panel de exportación / envío al super ────────────────────────────

function ExportPanel({
  items, selectedSuper, setSelectedSuper, exportMode, setExportMode, copied, onCopy, superPrices, addToListBtn
}: {
  items: Array<{ name: string; quantity: number; unit: string }>
  selectedSuper: string; setSelectedSuper: (s: string) => void
  exportMode: 'online' | 'papel'; setExportMode: (m: 'online' | 'papel') => void
  copied: boolean; onCopy: () => void
  superPrices: SuperPrices
  addToListBtn?: React.ReactNode
}) {
  const activeSuper = SUPERS.find(s => s.id === selectedSuper) ?? SUPERS[0]
  const hasPrices = Object.keys(superPrices).length > 0

  // Ordenar supermercados por precio si disponibles
  const supersOrdenados = hasPrices
    ? [...SUPERS].sort((a, b) => {
        const pa = (superPrices as any)[a.label] ?? 999
        const pb = (superPrices as any)[b.label] ?? 999
        return pa - pb
      })
    : SUPERS

  const precioMin = hasPrices ? Math.min(...Object.values(superPrices).filter(Boolean) as number[]) : null

  if (items.length === 0) return null

  return (
    <div style={{
      padding: '16px', background: 'var(--surface)', border: '1px solid var(--border)',
      borderRadius: 14,
    }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
        <Send size={14} color="#1D9E75" /> ¿Dónde vas a comprar?
      </div>

      {/* Selector modo */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 14, background: 'var(--bg)', padding: 4, borderRadius: 8, width: 'fit-content' }}>
        <button onClick={() => setExportMode('online')} style={{
          padding: '6px 14px', borderRadius: 6, border: 'none', fontSize: 12, fontWeight: 600, cursor: 'pointer',
          background: exportMode === 'online' ? 'var(--surface)' : 'transparent',
          color: exportMode === 'online' ? 'var(--teal)' : 'var(--muted)',
          boxShadow: exportMode === 'online' ? '0 1px 3px rgba(0,0,0,0.2)' : 'none',
        }}>🖥️ Compra online</button>
        <button onClick={() => setExportMode('papel')} style={{
          padding: '6px 14px', borderRadius: 6, border: 'none', fontSize: 12, fontWeight: 600, cursor: 'pointer',
          background: exportMode === 'papel' ? 'var(--surface)' : 'transparent',
          color: exportMode === 'papel' ? 'var(--teal)' : 'var(--muted)',
          boxShadow: exportMode === 'papel' ? '0 1px 3px rgba(0,0,0,0.2)' : 'none',
        }}>📋 Ir al super</button>
      </div>

      {exportMode === 'online' && (
        <>
          {/* Selector de super con precios */}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
            {supersOrdenados.map((s, idx) => {
              const precio = (superPrices as any)[s.label]
              const esMasBarato = hasPrices && precio === precioMin
              return (
                <button key={s.id} onClick={() => setSelectedSuper(s.id)} style={{
                  padding: '7px 12px', borderRadius: 9, fontSize: 13, cursor: 'pointer',
                  border: selectedSuper === s.id ? `2px solid ${s.color}` : esMasBarato ? `1px solid ${s.color}60` : '1px solid var(--border)',
                  background: selectedSuper === s.id ? `${s.color}18` : esMasBarato ? `${s.color}0A` : 'var(--bg)',
                  color: selectedSuper === s.id ? s.color : esMasBarato ? s.color : 'var(--muted)',
                  fontWeight: selectedSuper === s.id ? 700 : 500,
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1, minWidth: 80,
                }}>
                  <span>{s.emoji} {s.label}{esMasBarato ? ' 🏆' : ''}</span>
                  {precio !== undefined && (
                    <span style={{ fontSize: 11, fontWeight: 800, color: esMasBarato ? s.color : 'var(--text)' }}>
                      ~{precio.toFixed(2)} €
                    </span>
                  )}
                </button>
              )
            })}
          </div>

          {/* Lista con links */}
          <div style={{
            background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 10,
            padding: '12px 14px', marginBottom: 12, maxHeight: 200, overflowY: 'auto',
          }}>
            {items.map((item, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0', borderBottom: i < items.length - 1 ? '1px solid var(--border)' : 'none' }}>
                <span style={{ fontSize: 13, color: 'var(--text)' }}>
                  {i + 1}. {item.name}
                  <span style={{ color: 'var(--muted)', marginLeft: 6 }}>×{item.quantity} {item.unit}</span>
                </span>
                <a
                  href={`${activeSuper.url}${encodeURIComponent(item.name)}`}
                  target="_blank" rel="noopener noreferrer"
                  style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 11, color: activeSuper.color, textDecoration: 'none', flexShrink: 0, marginLeft: 8 }}
                >
                  <ExternalLink size={11} /> Buscar
                </a>
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            {addToListBtn}
            <a
              href={`${activeSuper.url}${encodeURIComponent(items[0]?.name ?? '')}`}
              target="_blank" rel="noopener noreferrer"
              style={{
                display: 'flex', alignItems: 'center', gap: 6, padding: '10px 16px',
                background: activeSuper.color, color: '#fff', borderRadius: 10,
                fontSize: 13, fontWeight: 700, textDecoration: 'none', flexShrink: 0,
              }}
            >
              <ExternalLink size={14} /> Abrir {activeSuper.label}
            </a>
            <button onClick={onCopy} style={{ ...btnSecExport, flex: 1 }}>
              {copied ? <><CheckCheck size={14} /> ¡Copiado!</> : <><Copy size={14} /> Copiar lista</>}
            </button>
          </div>
        </>
      )}

      {exportMode === 'papel' && (
        <>
          <div style={{
            background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 10,
            padding: '14px 16px', marginBottom: 12, fontFamily: 'monospace', fontSize: 13,
            lineHeight: 2, maxHeight: 240, overflowY: 'auto',
          }}>
            {items.map((item, i) => (
              <div key={i} style={{ display: 'flex', gap: 10 }}>
                <span style={{ color: 'var(--muted)', minWidth: 20 }}>{i + 1}.</span>
                <span style={{ flex: 1, color: 'var(--text)' }}>{item.name}</span>
                <span style={{ color: 'var(--muted)' }}>×{item.quantity} {item.unit}</span>
                <span style={{ width: 24, color: 'var(--border)', userSelect: 'none' }}>☐</span>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {addToListBtn}
            <button onClick={onCopy} style={{ ...btnSecExport, flex: 1 }}>
              {copied ? <><CheckCheck size={14} /> ¡Copiado!</> : <><Copy size={14} /> Copiar lista</>}
            </button>
          </div>
        </>
      )}
    </div>
  )
}

// ── Subcomponentes ────────────────────────────────────────────────────

function TabBtn({ active, onClick, icon, label, highlight }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string; highlight?: boolean }) {
  return (
    <button onClick={onClick} style={{
      display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px',
      borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600,
      background: active ? 'var(--bg)' : 'transparent',
      color: active ? (highlight ? '#3B6D11' : 'var(--teal)') : highlight ? '#3B6D11' : 'var(--muted)',
      boxShadow: active ? '0 1px 4px rgba(0,0,0,0.2)' : 'none',
    }}>
      {icon} {label}
    </button>
  )
}

function EmptyList({ onAdd, onProposal }: { onAdd: () => void; onProposal: () => void }) {
  return (
    <div style={{ textAlign: 'center', padding: '80px 0', color: 'var(--muted)' }}>
      <div style={{ fontSize: 56, marginBottom: 12 }}>🛒</div>
      <p style={{ fontSize: 16, fontWeight: 600, color: 'var(--text)', margin: '0 0 8px' }}>Lista vacía</p>
      <p style={{ fontSize: 14, margin: '0 0 20px' }}>Añade productos manualmente o deja que Stoqly proponga la cesta del jueves</p>
      <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
        <button onClick={onAdd} style={btnPrimary}><Plus size={16} /> Añadir producto</button>
        <button onClick={onProposal} style={{ ...btnPrimary, background: 'rgba(29,158,117,0.12)', color: '#1D9E75', border: '1px solid rgba(29,158,117,0.3)' }}>
          <Sparkles size={16} /> Que Stoqly proponga
        </button>
      </div>
    </div>
  )
}

const btnPrimary: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 6, padding: '9px 16px',
  background: 'var(--teal)', color: '#0F0F1A', border: 'none',
  borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer',
}
const btnSec: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 6, padding: '9px 16px',
  background: 'var(--surface)', color: 'var(--muted)', border: '1px solid var(--border)',
  borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: 'pointer',
}
const btnSecExport: React.CSSProperties = {
  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '10px 16px',
  background: 'var(--surface)', color: 'var(--muted)', border: '1px solid var(--border)',
  borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: 'pointer',
}
