import { prisma } from '@domtrace/db'

// Límites de hogares por tier
export const HOUSEHOLD_LIMITS: Record<string, number> = {
  FREE: 1,
  HOGAR: 1,      // legado
  EXPERTO: 3,
  PREMIUM: 5,
  ENTERPRISE: 999,
}

/**
 * Devuelve el householdId activo del usuario.
 * Prioriza user.activeHouseholdId; si no está seteado, usa el primer hogar (más antiguo).
 */
export async function getActiveHousehold(userId: string): Promise<string> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { activeHouseholdId: true },
  })

  if (user?.activeHouseholdId) {
    // Verificar que sigue siendo miembro de ese hogar
    const member = await prisma.householdMember.findUnique({
      where: { householdId_userId: { householdId: user.activeHouseholdId, userId } },
    })
    if (member) return user.activeHouseholdId
  }

  // Fallback: primer hogar por fecha de unión
  const member = await prisma.householdMember.findFirst({
    where: { userId },
    orderBy: { joinedAt: 'asc' },
  })
  if (!member) throw new Error('NO_HOUSEHOLD')
  return member.householdId
}
