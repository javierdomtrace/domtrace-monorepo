import React, { useEffect, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api'
import { X, Camera } from 'lucide-react'

interface Zone { id: string; name: string; icon: string }
interface BarcodeScannerProps { onClose: () => void }
interface ProductInfo { name: string; brand?: string; imageUrl?: string }

const SCANNER_DIV_ID = 'stoqly-barcode-scanner'

async function lookupBarcode(barcode: string): Promise<ProductInfo | null> {
  try {
    // Endpoint unificado: prueba Food Facts → Beauty Facts en cascada
    const data = await api.get<any>(`/product/${barcode}`)
    if (data?.name) return { name: data.name, brand: data.brand, imageUrl: data.imageUrl }
  } catch {}
  return null
}

export function BarcodeScanner({ onClose }: BarcodeScannerProps) {
  const qc = useQueryClient()
  const scannerRef = useRef<any>(null)
  const modalRef = useRef<HTMLDivElement>(null)

  const [status, setStatus] = useState<'scanning' | 'found' | 'done' | 'error'>('scanning')
  const [errorMsg, setErrorMsg] = useState('')
  const [barcode, setBarcode] = useState('')
  const [product, setProduct] = useState<ProductInfo | null>(null)
  const [zoneId, setZoneId] = useState('')
  const [expiryDate, setExpiryDate] = useState('')
  const [quantity, setQuantity] = useState('1')

  const { data: zones } = useQuery<Zone[]>({
    queryKey: ['zones'],
    queryFn: () => api.get('/pantry/zones'),
  })

  const addItem = useMutation({
    mutationFn: () => api.post('/items', {
      name: product?.name || `Producto ${barcode}`,
      barcode,
      quantity: parseFloat(quantity) || 1,
      unit: 'u',
      zoneId: zoneId || undefined,
      expiryDate: expiryDate ? new Date(expiryDate).toISOString() : undefined,
      imageUrl: product?.imageUrl,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['items'] })
      qc.invalidateQueries({ queryKey: ['summary'] })
      setStatus('done')
      setTimeout(onClose, 1500)
    },
  })

  useEffect(() => {
    let stopped = false

    async function startScanner() {
      try {
        const { Html5Qrcode } = await import('html5-qrcode')
        const scanner = new Html5Qrcode(SCANNER_DIV_ID)
        scannerRef.current = scanner

        await scanner.start(
          { facingMode: 'environment' },
          { fps: 10, qrbox: { width: 250, height: 100 } },
          async (decodedText: string) => {
            if (stopped) return
            stopped = true
            setBarcode(decodedText)
            setStatus('found')
            await scanner.stop().catch(() => {})
            const info = await lookupBarcode(decodedText)
            if (!stopped) setProduct(info)
          },
          () => {} // error silencioso por frame
        )
      } catch (e: any) {
        if (!stopped) {
          setErrorMsg(e.message ?? 'No se pudo acceder a la cámara')
          setStatus('error')
        }
      }
    }

    startScanner()

    return () => {
      stopped = true
      scannerRef.current?.stop().catch(() => {})
    }
  }, [])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { scannerRef.current?.stop().catch(() => {}); onClose() }
    }
    document.addEventListener('keydown', handleKeyDown)
    modalRef.current?.focus()
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 2000,
      background: 'rgba(0,0,0,0.85)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }} onClick={e => e.target === e.currentTarget && onClose()}>
      <div ref={modalRef} role="dialog" aria-modal="true" aria-labelledby="barcode-scanner-title" tabIndex={-1} style={{
        background: '#1A1A2E', border: '1px solid #2A2A3E',
        borderRadius: 16, width: 480, maxWidth: '95vw', overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '18px 20px', borderBottom: '1px solid #2A2A3E' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Camera size={20} color="#1D9E75" />
            <span id="barcode-scanner-title" style={{ fontSize: 16, fontWeight: 700, color: '#F0F0F5' }}>Escanear código de barras</span>
          </div>
          <button onClick={() => { scannerRef.current?.stop().catch(() => {}); onClose() }}
            aria-label="Cerrar"
            style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer' }}>
            <X size={20} />
          </button>
        </div>

        {/* Scanner div — html5-qrcode inyecta el video aquí */}
        {status === 'scanning' && (
          <div>
            <div
              id={SCANNER_DIV_ID}
              style={{ width: '100%', background: '#000' }}
            />
            <p style={{ textAlign: 'center', color: '#888', fontSize: 13, padding: '10px 0', margin: 0, background: '#0F0F1A' }}>
              Centra el código de barras en el recuadro
            </p>
          </div>
        )}

        {/* Producto encontrado */}
        {status === 'found' && (
          <div style={{ padding: 20 }}>
            <div style={{ display: 'flex', gap: 14, marginBottom: 20, alignItems: 'flex-start' }}>
              {product?.imageUrl && (
                <img src={product.imageUrl} alt="" style={{ width: 70, height: 70, objectFit: 'contain', borderRadius: 8, background: '#fff', padding: 4, flexShrink: 0 }} />
              )}
              <div style={{ flex: 1 }}>
                {product?.name
                  ? <div style={{ fontSize: 16, fontWeight: 700, color: '#F0F0F5', marginBottom: 4 }}>{product.name}</div>
                  : <div style={{ fontSize: 13, color: '#888', marginBottom: 4 }}>Producto no encontrado — se guardará el código</div>
                }
                {product?.brand && <div style={{ fontSize: 13, color: '#888' }}>{product.brand}</div>}
                <div style={{ fontSize: 11, color: '#444', marginTop: 4, fontFamily: 'monospace' }}>{barcode}</div>
              </div>
            </div>

            <label style={lbl}>Cantidad</label>
            <input type="number" min="0.1" step="0.1" value={quantity}
              onChange={e => setQuantity(e.target.value)} style={inp} />

            <label style={lbl}>Zona</label>
            <select value={zoneId} onChange={e => setZoneId(e.target.value)}
              style={{ ...inp, cursor: 'pointer' }}>
              <option value="">Sin zona</option>
              {zones?.map(z => <option key={z.id} value={z.id}>{z.icon} {z.name}</option>)}
            </select>

            <label style={lbl}>Fecha de caducidad</label>
            <input type="date" value={expiryDate} onChange={e => setExpiryDate(e.target.value)}
              min={new Date().toISOString().split('T')[0]}
              style={{ ...inp, colorScheme: 'dark' }} />

            <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
              <button onClick={onClose} style={btnSec}>Cancelar</button>
              <button onClick={() => addItem.mutate()} disabled={addItem.isPending}
                style={{ ...btnPri, opacity: addItem.isPending ? 0.6 : 1 }}>
                {addItem.isPending ? 'Añadiendo...' : 'Añadir a la despensa'}
              </button>
            </div>
          </div>
        )}

        {status === 'done' && (
          <div style={{ padding: 40, textAlign: 'center' }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>✅</div>
            <div style={{ fontSize: 16, fontWeight: 600, color: '#1D9E75' }}>¡Añadido a la despensa!</div>
          </div>
        )}

        {status === 'error' && (
          <div style={{ padding: 32, textAlign: 'center' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>📷</div>
            <div style={{ fontSize: 14, color: '#FF6B6B', marginBottom: 8 }}>No se pudo acceder a la cámara</div>
            <div style={{ fontSize: 13, color: '#888', marginBottom: 20 }}>{errorMsg}</div>
            <button onClick={onClose} style={{ ...btnSec, width: '100%' }}>Cerrar</button>
          </div>
        )}
      </div>
    </div>
  )
}

const lbl: React.CSSProperties = { display: 'block', fontSize: 12, color: '#888', marginBottom: 6, fontWeight: 500 }
const inp: React.CSSProperties = {
  width: '100%', padding: '10px 12px', background: '#0F0F1A',
  border: '1px solid #2A2A3E', borderRadius: 10, color: '#F0F0F5',
  fontSize: 14, marginBottom: 14, boxSizing: 'border-box', outline: 'none',
}
const btnPri: React.CSSProperties = { flex: 2, padding: '12px', background: '#1D9E75', border: 'none', borderRadius: 10, color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer' }
const btnSec: React.CSSProperties = { flex: 1, padding: '12px', background: 'transparent', border: '1px solid #2A2A3E', borderRadius: 10, color: '#888', fontSize: 14, cursor: 'pointer' }
