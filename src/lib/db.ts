import { PrismaClient } from '@/generated/prisma/client'
import { PrismaNeon } from '@prisma/adapter-neon'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

// Use Neon serverless driver for Postgres
const connectionString = process.env.DATABASE_URL

function createPrismaClient() {
  if (!connectionString) {
    throw new Error('DATABASE_URL environment variable is not set')
  }

  // PrismaNeon takes PoolConfig, not an instantiated Pool
  const adapter = new PrismaNeon({ connectionString })
  return new PrismaClient({ adapter })
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma

export default prisma
