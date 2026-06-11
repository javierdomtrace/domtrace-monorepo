/**
 * Seed de desarrollo — Stoqly
 * Crea: usuario javier, hogar "Casa Javier", productos de prueba
 * Uso: cd packages/db && npx tsx prisma/seed.ts
 *   o: pnpm db:seed (desde la raíz)
 */
import { PrismaClient, Tier, HouseholdType, Role, ItemStatus } from '@prisma/client'
import * as bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Iniciando seed...')

  // ── Usuario ───────────────────────────────────────────────────────────
  const passwordHash = await bcrypt.hash('password123', 10)

  const user = await prisma.user.upsert({
    where: { email: 'jtorres@cogelo.es' },
    update: {},
    create: {
      email: 'jtorres@cogelo.es',
      passwordHash,
      name: 'Javier Torres',
      subscriptionTier: Tier.PREMIUM,
      categoriasActivas: ['ALIMENTACION', 'COSMETICOS', 'MEDICAMENTOS', 'BEBES'],
      allergens: [],
      codigoPostal: '28001',
      deporte: 'Running',
      deporteNivel: 'INTERMEDIO',
      deporteDiasSemana: 4,
    },
  })
  console.log('✅ Usuario:', user.email)

  // ── Hogar ─────────────────────────────────────────────────────────────
  const household = await prisma.household.upsert({
    where: { id: 'seed-household-001' },
    update: {},
    create: {
      id: 'seed-household-001',
      name: 'Casa Javier',
      ownerId: user.id,
      type: HouseholdType.HOME,
      supermarket: 'Mercadona',
      direccionCiudad: 'Madrid',
      direccionCodigoPostal: '28001',
    },
  })
  console.log('✅ Hogar:', household.name)

  // ── Miembro del hogar ─────────────────────────────────────────────────
  await prisma.householdMember.upsert({
    where: { householdId_userId: { householdId: household.id, userId: user.id } },
    update: {},
    create: {
      householdId: household.id,
      userId: user.id,
      role: Role.OWNER,
    },
  })

  // ── Actualizar hogar activo del usuario ───────────────────────────────
  await prisma.user.update({
    where: { id: user.id },
    data: { activeHouseholdId: household.id },
  })

  // ── Zona de despensa ──────────────────────────────────────────────────
  const zona = await prisma.pantryZone.upsert({
    where: { id: 'seed-zone-001' },
    update: {},
    create: {
      id: 'seed-zone-001',
      name: 'Despensa principal',
      icon: '🏠',
      temperatureType: 'AMBIENT',
      position: 1,
      householdId: household.id,
    },
  })

  // ── Productos de prueba ───────────────────────────────────────────────
  const hoy = new Date()
  const en = (dias: number) => new Date(hoy.getTime() + dias * 86_400_000)

  const productos = [
    // Frescos
    { name: 'Leche entera Hacendado', expiryDate: en(3),  quantity: 2, unit: 'L',   barcode: '8480000123456', status: ItemStatus.EXPIRING_SOON },
    { name: 'Yogur natural Danone',   expiryDate: en(5),  quantity: 4, unit: 'uds', barcode: '3033490009225', status: ItemStatus.OK },
    { name: 'Pechuga de pollo',       expiryDate: en(2),  quantity: 1, unit: 'kg',  barcode: null,            status: ItemStatus.EXPIRING_SOON },
    { name: 'Queso manchego',         expiryDate: en(-1), quantity: 1, unit: 'uds', barcode: null,            status: ItemStatus.EXPIRED },
    // Despensa
    { name: 'Aceite de oliva virgen extra', expiryDate: en(180), quantity: 1, unit: 'L',    barcode: '8410036011001', status: ItemStatus.OK },
    { name: 'Arroz largo SOS',             expiryDate: en(365), quantity: 2, unit: 'kg',   barcode: '8410774310018', status: ItemStatus.OK },
    { name: 'Tomate frito Orlando',        expiryDate: en(400), quantity: 3, unit: 'brik', barcode: '8410076010021', status: ItemStatus.OK },
    { name: 'Pasta espaguetis Barilla',    expiryDate: en(300), quantity: 2, unit: 'paq',  barcode: '8076800195057', status: ItemStatus.OK },
    // Cosméticos
    { name: 'Crema hidratante Nivea', expiryDate: en(500), quantity: 1, unit: 'uds', barcode: '4005808155200', status: ItemStatus.OK },
    { name: 'Gel de ducha Sanex',     expiryDate: en(400), quantity: 2, unit: 'uds', barcode: '8718951318397', status: ItemStatus.OK },
    // Medicamentos
    { name: 'Ibuprofeno 600mg', expiryDate: en(90),  quantity: 1, unit: 'caja', barcode: '8470001234567', status: ItemStatus.OK },
    { name: 'Paracetamol 1g',   expiryDate: en(120), quantity: 2, unit: 'caja', barcode: '8470007654321', status: ItemStatus.OK },
    // Otros
    { name: 'Zumo de naranja',  expiryDate: en(200), quantity: 1, unit: 'L',    barcode: null,            status: ItemStatus.OK },
  ]

  let creados = 0
  for (const p of productos) {
    const existing = await prisma.item.findFirst({
      where: { householdId: household.id, name: p.name },
    })
    if (!existing) {
      await prisma.item.create({
        data: {
          name: p.name,
          addedBy: user.id,
          expiryDate: p.expiryDate,
          quantity: p.quantity,
          unit: p.unit,
          barcode: p.barcode,
          status: p.status,
          householdId: household.id,
          zoneId: zona.id,
        },
      })
      creados++
    }
  }
  console.log(`✅ Productos: ${creados} creados (${productos.length - creados} ya existían)`)

  // ── Shopping items ────────────────────────────────────────────────────
  const shoppingItems = [
    { name: 'Leche semidesnatada', quantity: 3, unit: 'L',      supermarket: 'Mercadona' },
    { name: 'Pan de molde',        quantity: 1, unit: 'uds',    supermarket: 'Mercadona' },
    { name: 'Huevos L',            quantity: 1, unit: 'docena', supermarket: 'Mercadona' },
  ]

  for (const s of shoppingItems) {
    const existing = await prisma.shoppingItem.findFirst({
      where: { householdId: household.id, name: s.name },
    })
    if (!existing) {
      await prisma.shoppingItem.create({
        data: { ...s, householdId: household.id, addedBy: user.id },
      })
    }
  }
  console.log('✅ Lista de la compra: lista inicial creada')

  console.log('\n🎉 Seed completado.')
  console.log('   Email:    jtorres@cogelo.es')
  console.log('   Password: password123')
  console.log('   URL:      http://localhost:5173')
}

main()
  .catch(e => { console.error('❌ Error en seed:', e); process.exit(1) })
  .finally(() => prisma.$disconnect())
