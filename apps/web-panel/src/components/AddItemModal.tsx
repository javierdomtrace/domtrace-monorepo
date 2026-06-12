import React, { useState, useRef, useEffect } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api'
import { X, Leaf, ScanLine, CheckCircle } from 'lucide-react'

const TIPOS_FRESCOS: Record<string, { id: string; label: string; ejemplos: string[]; vidaUtilDias: number; conservacion: string; alertaConBebe?: string }> = {
  TUBERCULO: { id: 'TUBERCULO', label: 'Tubérculos', ejemplos: ['Patata', 'Boniato', 'Yuca'], vidaUtilDias: 18, conservacion: 'Lugar fresco, oscuro y seco. NUNCA nevera. Alejados de las cebollas.' },
  RAIZ: { id: 'RAIZ', label: 'Raíces', ejemplos: ['Zanahoria', 'Remolacha', 'Nabo'], vidaUtilDias: 12, conservacion: 'Nevera en bolsa perforada. Retirar las hojas si las tienen.' },
  HOJA: { id: 'HOJA', label: 'Verduras de hoja', ejemplos: ['Espinacas', 'Lechuga', 'Acelgas', 'Rúcula'], vidaUtilDias: 4, conservacion: 'Nevera envueltas en papel húmedo. No lavar hasta usar.', alertaConBebe: 'Espinacas y acelgas no adecuadas para bebés menores de 12 meses por nitratos.' },
  TOMATE: { id: 'TOMATE', label: 'Tomates', ejemplos: ['Tomate', 'Cherry', 'Tomate pera'], vidaUtilDias: 5, conservacion: 'NUNCA en la nevera — pierde sabor y textura. Temperatura ambiente.' },
  ALLIUM: { id: 'ALLIUM', label: 'Cebollas, ajos y puerros', ejemplos: ['Cebolla', 'Ajo', 'Puerro', 'Chalota'], vidaUtilDias: 25, conservacion: 'Lugar seco, oscuro y ventilado. NUNCA junto a patatas.' },
  FRUTA_CLIM: { id: 'FRUTA_CLIM', label: 'Frutas climatéricas', ejemplos: ['Plátano', 'Mango', 'Aguacate', 'Pera'], vidaUtilDias: 5, conservacion: 'Fuera nevera hasta maduros, luego nevera o congelar. El plátano aparte.', alertaConBebe: 'Fresas, kiwi y mango pueden ser alergénicos. Introducir con precaución.' },
  FRUTA_NO_CLIM: { id: 'FRUTA_NO_CLIM', label: 'Frutas no climatéricas', ejemplos: ['Fresas', 'Uvas', 'Cerezas', 'Arándanos'], vidaUtilDias: 3, conservacion: 'Nevera desde el principio. Sin lavar hasta el momento de comer.', alertaConBebe: 'Fresas y frambuesas pueden ser alergénicas. Introducir después de los 6 meses.' },
  CITRICO: { id: 'CITRICO', label: 'Cítricos', ejemplos: ['Naranja', 'Limón', 'Mandarina', 'Lima'], vidaUtilDias: 10, conservacion: 'Temperatura ambiente 1 semana, o nevera hasta 3-4 semanas.' },
  HIERBA: { id: 'HIERBA', label: 'Hierbas aromáticas', ejemplos: ['Perejil', 'Cilantro', 'Albahaca', 'Menta'], vidaUtilDias: 4, conservacion: 'Nevera como un ramo en un vaso con agua, o envueltas en papel húmedo.' },
}

interface Zone { id: string; name: string; icon: string }

interface AddItemModalProps { onClose: () => void }

const UNITS = ['u', 'kg', 'g', 'l', 'ml', 'cl', 'pack', 'caja', 'bote', 'lata', 'manojo', 'bolsa']

export function AddItemModal({ onClose }: AddItemModalProps) {
  const qc = useQueryClient()
  const [esFresco, setEsFresco] = useState(false)
  const [form, setForm] = useState({
    name: '', quantity: '1', unit: 'u', zoneId: '', expiryDate: '',
    fechaCompra: new Date().toISOString().split('T')[0],
    tipoFresco: '',
  })
  const [barcode, setBarcode] = useState('')
  const [offLookup, setOffLookup] = useState<{ status: 'idle' | 'loading' | 'found' | 'notfound' }>({ status: 'idle' })
  const [error, setError] = useState('')
  const barcodeRef = useRef<HTMLInputElement>(null)

  const { data: zones } = useQuery<Zone[]>({
    queryKey: ['zones'],
    queryFn: () => api.get('/pantry/zones'),
  })

  const tipoInfo = esFresco && form.tipoFresco ? TIPOS_FRESCOS[form.tipoFresco] : null

  // Buscar producto en Open Food Facts cuando se introduce un código de barras completo
  const lookupBarcode = async (code: string) => {
    if (!/^\d{8,14}$/.test(code)) return
    setOffLookup({ status: 'loading' })
    try {
      const data = await api.get<any>(`/openfoodfacts/${code}`)
      if (data.name) set('name', data.name)
      setOffLookup({ status: 'found' })
    } catch {
      setOffLookup({ status: 'notfound' })
    }
  }

  const add = useMutation({
    mutationFn: () => api.post('/items', {
      name: form.name,
      quantity: parseFloat(form.quantity) || 1,
      unit: form.unit,
      zoneId: form.zoneId || undefined,
      barcode: barcode || undefined,
      // Modo fresco: sin fecha de caducidad, con fecha de compra y tipo
      ...(esFresco ? {
        fechaCompra: new Date(form.fechaCompra).toISOString(),
        tipoFresco: form.tipoFresco || undefined,
        vidaUtilDias: tipoInfo?.vidaUtilDias,
        conservacion: tipoInfo?.conservacion,
      } : {
        expiryDate: form.expiryDate ? new Date(form.expiryDate).toISOString() : undefined,
      }),
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['items'] })
      qc.invalidateQueries({ queryKey: ['summary'] })
      qc.invalidateQueries({ queryKey: ['zones'] })
      onClose()
    },
    onError: (err: any) => setError(err.message),
  })

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 2000, background: 'rgba(0,0,0,0.6)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }} onClick={e => e.target === e.currentTarget && onClose()}>
      <div role="dialog" aria-modal="true" aria-labelledby="add-item-title" style={{
        background: '#1A1A2E', border: '1px solid #2A2A3E',
        borderRadius: 16, padding: 28, width: 460, maxWidth: '95vw',
        maxHeight: '90vh', overflowY: 'auto',
      }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h2 id="add-item-title" style={{ margin: 0, fontSize: 17, fontWeight: 700, color: '#F0F0F5' }}>Añadir producto</h2>
          <button onClick={onClose} aria-label="Cerrar" style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', padding: 4 }}>
            <X size={20} />
          </button>
        </div>

        {/* Toggle fresco / con caducidad */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 20, background: '#0F0F1A', borderRadius: 10, padding: 4 }}>
          <button onClick={() => setEsFresco(false)} style={{
            flex: 1, padding: '8px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600,
            background: !esFresco ? '#1D9E75' : 'transparent',
            color: !esFresco ? '#fff' : '#888',
          }}>
            📦 Con fecha de caducidad
          </button>
          <button onClick={() => setEsFresco(true)} style={{
            flex: 1, padding: '8px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600,
            background: esFresco ? '#3B6D11' : 'transparent',
            color: esFresco ? '#fff' : '#888',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          }}>
            <Leaf size={14} /> Producto fresco
          </button>
        </div>

        {/* Código de barras (opcional) */}
        <label style={lbl}>
          <ScanLine size={12} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} />
          Código de barras <span style={{ fontWeight: 400, opacity: 0.6 }}>(opcional — auto-rellena el nombre)</span>
        </label>
        <div style={{ position: 'relative', marginBottom: 16 }}>
          <input
            ref={barcodeRef}
            value={barcode}
            onChange={e => {
              const v = e.target.value.replace(/\D/g, '')
              setBarcode(v)
              setOffLookup({ status: 'idle' })
              if (v.length >= 8) lookupBarcode(v)
            }}
            placeholder="8-14 dígitos EAN — escribe o escanea"
            inputMode="numeric"
            style={{ ...inp, marginBottom: 0, paddingRight: 40 }}
          />
          <span style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 11 }}>
            {offLookup.status === 'loading' && <span style={{ color: 'var(--muted)' }}>🔍</span>}
            {offLookup.status === 'found' && <CheckCircle size={14} color="#1D9E75" />}
            {offLookup.status === 'notfound' && <span style={{ color: 'var(--muted)' }}>?</span>}
          </span>
        </div>
        {offLookup.status === 'found' && (
          <div style={{ fontSize: 11, color: '#1D9E75', marginTop: -12, marginBottom: 10 }}>
            ✅ Producto encontrado en Open Food Facts — nombre auto-rellenado
          </div>
        )}
        {offLookup.status === 'notfound' && (
          <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: -12, marginBottom: 10 }}>
            Código no encontrado — introduce el nombre manualmente
          </div>
        )}

        {/* Nombre */}
        <label style={lbl}>Nombre del producto *</label>
        <input autoFocus value={form.name} onChange={e => set('name', e.target.value)}
          onKeyDown={e => e.key === 'Enter' && form.name && add.mutate()}
          placeholder={esFresco ? 'Ej: Patatas, Espinacas, Tomates...' : 'Ej: Leche entera, Aceite de oliva...'}
          style={inp} />

        {/* Cantidad + Unidad */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
          <div style={{ flex: 1 }}>
            <label style={lbl}>Cantidad</label>
            <input type="number" min="0.1" step="0.1" value={form.quantity}
              onChange={e => set('quantity', e.target.value)} style={inp} />
          </div>
          <div style={{ flex: 1 }}>
            <label style={lbl}>Unidad</label>
            <select value={form.unit} onChange={e => set('unit', e.target.value)}
              style={{ ...inp, cursor: 'pointer' }}>
              {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
            </select>
          </div>
        </div>

        {/* Zona */}
        <label style={lbl}>Zona de la despensa</label>
        <select value={form.zoneId} onChange={e => set('zoneId', e.target.value)}
          style={{ ...inp, cursor: 'pointer' }}>
          <option value="">Sin zona</option>
          {zones?.map(z => <option key={z.id} value={z.id}>{z.icon} {z.name}</option>)}
        </select>

        {/* MODO CADUCIDAD */}
        {!esFresco && (
          <>
            <label style={lbl}>Fecha de caducidad</label>
            <input type="date" value={form.expiryDate} onChange={e => set('expiryDate', e.target.value)}
              min={new Date().toISOString().split('T')[0]}
              style={{ ...inp, colorScheme: 'dark' }} />
          </>
        )}

        {/* MODO FRESCO */}
        {esFresco && (
          <>
            <label style={lbl}>Tipo de fresco</label>
            <select value={form.tipoFresco} onChange={e => set('tipoFresco', e.target.value)}
              style={{ ...inp, cursor: 'pointer' }}>
              <option value="">Selecciona el tipo...</option>
              {Object.values(TIPOS_FRESCOS).map(t => (
                <option key={t.id} value={t.id}>
                  {t.label} — {t.ejemplos.slice(0, 3).join(', ')}
                </option>
              ))}
            </select>

            <label style={lbl}>Fecha de compra</label>
            <input type="date" value={form.fechaCompra} onChange={e => set('fechaCompra', e.target.value)}
              max={new Date().toISOString().split('T')[0]}
              style={{ ...inp, colorScheme: 'dark' }} />

            {/* Info del tipo seleccionado */}
            {tipoInfo && (
              <div style={{
                padding: '12px 14px', background: 'rgba(59,109,17,0.1)',
                border: '1px solid rgba(59,109,17,0.3)', borderRadius: 10, marginBottom: 16,
              }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#3B6D11', marginBottom: 6 }}>
                  🌱 Vida útil estimada: ~{tipoInfo.vidaUtilDias} días desde la compra
                </div>
                <div style={{ fontSize: 12, color: '#888', marginBottom: 4 }}>
                  <strong style={{ color: '#aaa' }}>Conservación:</strong> {tipoInfo.conservacion}
                </div>
                <div style={{ fontSize: 12, color: '#666', fontStyle: 'italic', marginTop: 6 }}>
                  Stoqly te avisará cuando sea momento de usarlo y te sugerirá recetas.
                </div>
                {tipoInfo.alertaConBebe && (
                  <div style={{ fontSize: 11, color: '#EF9F27', marginTop: 8, padding: '6px 8px', background: 'rgba(239,159,39,0.1)', borderRadius: 6 }}>
                    👶 {tipoInfo.alertaConBebe}
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {error && <p style={{ color: '#FF6B6B', fontSize: 13, margin: '4px 0 8px' }}>{error}</p>}

        {/* Botones */}
        <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
          <button onClick={onClose} style={btnSec}>Cancelar</button>
          <button onClick={() => add.mutate()} disabled={!form.name || add.isPending}
            style={{ ...btnPri, opacity: !form.name || add.isPending ? 0.5 : 1, background: esFresco ? '#3B6D11' : '#1D9E75' }}>
            {add.isPending ? 'Añadiendo...' : esFresco ? '🌱 Añadir fresco' : 'Añadir a la despensa'}
          </button>
        </div>
      </div>
    </div>
  )
}

const lbl: React.CSSProperties = { display: 'block', fontSize: 12, color: '#888', marginBottom: 6, fontWeight: 500 }
const inp: React.CSSProperties = {
  width: '100%', padding: '10px 12px', background: '#0F0F1A',
  border: '1px solid #2A2A3E', borderRadius: 10, color: '#F0F0F5',
  fontSize: 14, marginBottom: 16, boxSizing: 'border-box', outline: 'none',
}
const btnPri: React.CSSProperties = { flex: 2, padding: '12px', background: '#1D9E75', border: 'none', borderRadius: 10, color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer' }
const btnSec: React.CSSProperties = { flex: 1, padding: '12px', background: 'transparent', border: '1px solid #2A2A3E', borderRadius: 10, color: '#888', fontSize: 14, cursor: 'pointer' }
