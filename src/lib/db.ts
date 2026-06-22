import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

// Ensure the cached client has the latest schema
// In development with hot reload, the cached PrismaClient might be stale
if (globalForPrisma.prisma) {
  try {
    // Quick check: if botConnection is undefined, the client is stale
    if (globalForPrisma.prisma.botConnection === undefined) {
      globalForPrisma.prisma.$disconnect().catch(() => {})
      globalForPrisma.prisma = undefined
    }
  } catch {
    globalForPrisma.prisma = undefined
  }
}

// Use getter to always return the current client (handles hot reload)
function getDb(): PrismaClient {
  if (!globalForPrisma.prisma) {
    globalForPrisma.prisma = new PrismaClient({ log: ['query'] })
  }
  return globalForPrisma.prisma
}

// Export via Proxy so hot-reloaded modules always get the current client
export const db = new Proxy({} as PrismaClient, {
  get(_target, prop) {
    return (getDb() as unknown as Record<string | symbol, unknown>)[prop]
  },
})

if (process.env.NODE_ENV !== 'production' && !globalForPrisma.prisma) {
  globalForPrisma.prisma = new PrismaClient({ log: ['query'] })
}