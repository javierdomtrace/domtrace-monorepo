import React, { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '../lib/api'
import { ChevronDown, ChevronUp, ExternalLink } from 'lucide-react'

interface OFFData {
  barcode: string
  name: string | null
  brand: string | null
  quantity: string | null
  ingredients: string | null
  allergens: string[]
  nutriscore: { label: string; color: string } | null
  ecoscore: string | null
  novaGroup: number | null
  imageUrl: string | null
  nutriments: {
    energia: number | null
    grasas: number | null
    grasasSaturadas: number | null
    carbohidratos: number | null
    azucares: number | null
    fibra: number | null
    proteinas: number | null
    sal: number | null
  }
}

const NOVA_DESC: Record<number, { label: string; color: string }> = {
  1: { label: 'Sin procesar', color: '#038141' },
  2: { label: 'Ingrediente culinario', color: '#85BB2F' },
  3: { label: 'Procesado', color: '#EE8100' },
  4: { label: 'Ultraprocesado', color: '#E63312' },
}

export function ProductInfoPanel({ barcode }: { barcode: string }) {
  const [open, setOpen] = useState(false)

  const { data, isLoading, isError } = useQuery<OFFData>({
    queryKey: ['off', barcode],
    queryFn: () => api.get(`/openfoodfacts/${barcode}`),
    enabled: open,
    staleTime: 1000 * 60 * 60 * 24, // 24h — los datos de OFF no cambian frecuentemente
    retry: false,
  })

  return (
    <div style={{ marginTop: 4 }}>
      <button
        onClick={() => setOpen(v => !v)}
        aria-expanded={open}
        style={{
          display: 'flex', alignItems: 'center', gap: 4,
          background: 'none', border: 'none', cursor: 'pointer',
          fontSize: 11, color: 'var(--teal)', padding: 0, fontWeight: 600,
        }}
      >
        {open ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
        {open ? 'Ocultar composición' : 'Ver composición'}
      </button>

      {open && (
        <div style={{
          marginTop: 8, padding: '12px 14px',
          background: 'rgba(78,205,196,0.04)',
          border: '1px solid rgba(78,205,196,0.15)',
          borderRadius: 8, fontSize: 12,
        }}>
          {isLoading && (
            <p style={{ margin: 0, color: 'var(--muted)' }}>Consultando Open Food Facts...</p>
          )}

          {isError && (
            <p style={{ margin: 0, color: 'var(--muted)', fontStyle: 'italic' }}>
              Producto no encontrado en Open Food Facts.{' '}
              <a
                href={`https://world.openfoodfacts.org/product/${barcode}`}
                target="_blank" rel="noopener noreferrer"
                style={{ color: 'var(--teal)', textDecoration: 'none' }}
              >
                Contribuir <ExternalLink size={10} style={{ display: 'inline', verticalAlign: 'middle' }} />
              </a>
            </p>
          )}

          {data && (
            <div>
              {/* Badges */}
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
                {data.nutriscore && (
                  <span style={{
                    background: data.nutriscore.color, color: '#fff',
                    fontWeight: 800, fontSize: 11, padding: '2px 8px', borderRadius: 4,
                  }}>
                    Nutri-Score {data.nutriscore.label}
                  </span>
                )}
                {data.novaGroup && NOVA_DESC[data.novaGroup] && (
                  <span style={{
                    background: NOVA_DESC[data.novaGroup].color + '20',
                    color: NOVA_DESC[data.novaGroup].color,
                    border: `1px solid ${NOVA_DESC[data.novaGroup].color}40`,
                    fontWeight: 600, fontSize: 11, padding: '2px 8px', borderRadius: 4,
                  }}>
                    NOVA {data.novaGroup} — {NOVA_DESC[data.novaGroup].label}
                  </span>
                )}
                {data.ecoscore && (
                  <span style={{
                    background: 'rgba(131,214,131,0.15)', color: '#2D7A2D',
                    border: '1px solid rgba(131,214,131,0.3)',
                    fontWeight: 600, fontSize: 11, padding: '2px 8px', borderRadius: 4,
                  }}>
                    Eco {data.ecoscore}
                  </span>
                )}
              </div>

              {/* Ingredientes */}
              {data.ingredients && (
                <div style={{ marginBottom: 8 }}>
                  <div style={{ fontWeight: 600, color: 'var(--text)', marginBottom: 3 }}>Ingredientes</div>
                  <div style={{ color: 'var(--muted)', lineHeight: 1.5 }}>{data.ingredients}</div>
                </div>
              )}

              {/* Alérgenos */}
              {data.allergens?.length > 0 && (
                <div style={{ marginBottom: 8 }}>
                  <div style={{ fontWeight: 600, color: '#EF9F27', marginBottom: 4 }}>⚠️ Contiene alérgenos</div>
                  <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                    {data.allergens.map(a => (
                      <span key={a} style={{
                        background: 'rgba(239,159,39,0.12)', color: '#EF9F27',
                        border: '1px solid rgba(239,159,39,0.3)',
                        borderRadius: 10, padding: '2px 8px', fontSize: 11, fontWeight: 600,
                      }}>{a}</span>
                    ))}
                  </div>
                </div>
              )}

              {/* Tabla nutricional */}
              <div>
                <div style={{ fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>Valores por 100g</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '3px 12px' }}>
                  {[
                    ['Energía', data.nutriments.energia, 'kcal'],
                    ['Grasas', data.nutriments.grasas, 'g'],
                    ['  Saturadas', data.nutriments.grasasSaturadas, 'g'],
                    ['Carbohidratos', data.nutriments.carbohidratos, 'g'],
                    ['  Azúcares', data.nutriments.azucares, 'g'],
                    ['Fibra', data.nutriments.fibra, 'g'],
                    ['Proteínas', data.nutriments.proteinas, 'g'],
                    ['Sal', data.nutriments.sal, 'g'],
                  ].map(([label, val, unit]) => val !== null && (
                    <div key={String(label)} style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--muted)', fontSize: 11 }}>
                      <span>{label}</span>
                      <span style={{ fontWeight: 600, color: 'var(--text)' }}>{Number(val).toFixed(1)}{unit}</span>
                    </div>
                  ))}
                </div>
              </div>

              <a
                href={`https://world.openfoodfacts.org/product/${barcode}`}
                target="_blank" rel="noopener noreferrer"
                style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 8, color: 'var(--teal)', textDecoration: 'none', fontSize: 11 }}
              >
                Ver ficha completa en Open Food Facts <ExternalLink size={10} />
              </a>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
