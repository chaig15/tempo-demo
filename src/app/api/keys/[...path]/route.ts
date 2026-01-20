import { NextRequest } from 'next/server'
import { Handler } from 'tempo.ts/server'
import prisma from '@/lib/db'

// Prisma-based Kv adapter for cross-device passkey storage
const prismaKv = {
  get: async (key: string) => {
    const record = await prisma.keyStore.findUnique({ where: { key } })
    return record?.value
  },
  set: async (key: string, value: string) => {
    await prisma.keyStore.upsert({
      where: { key },
      update: { value },
      create: { key, value },
    })
  },
  delete: async (key: string) => {
    await prisma.keyStore.delete({ where: { key } }).catch(() => {})
  },
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const handler = Handler.keyManager({
  kv: prismaKv as any,
  path: '/api/keys',
})

export async function GET(request: NextRequest) {
  return handler.fetch(new Request(request.url, { method: 'GET', headers: request.headers }))
}

export async function PUT(request: NextRequest) {
  return handler.fetch(new Request(request.url, { method: 'PUT', headers: request.headers, body: request.body, duplex: 'half' } as RequestInit))
}

export async function DELETE(request: NextRequest) {
  return handler.fetch(new Request(request.url, { method: 'DELETE', headers: request.headers }))
}
