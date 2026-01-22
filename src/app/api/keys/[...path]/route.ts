import { NextRequest } from 'next/server'
import { Handler } from 'tempo.ts/server'
import prisma from '@/lib/db'

// Prisma-based Kv adapter for cross-device passkey storage
const prismaKv = {
  get: async (key: string) => {
    console.log('[Kv] get:', key)
    const record = await prisma.keyStore.findUnique({ where: { key } })
    return record?.value
  },
  set: async (key: string, value: string) => {
    console.log('[Kv] set:', key)
    await prisma.keyStore.upsert({
      where: { key },
      update: { value },
      create: { key, value },
    })
  },
  delete: async (key: string) => {
    console.log('[Kv] delete:', key)
    await prisma.keyStore.delete({ where: { key } }).catch(() => {})
  },
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const handler = Handler.keyManager({
  kv: prismaKv as any,
  path: '/api/keys',
})

export async function GET(request: NextRequest) {
  console.log('[Keys] GET', request.url)
  return handler.fetch(new Request(request.url, { method: 'GET', headers: request.headers }))
}

export async function PUT(request: NextRequest) {
  console.log('[Keys] PUT', request.url)
  const body = await request.text()
  return handler.fetch(new Request(request.url, { method: 'PUT', headers: request.headers, body }))
}

export async function DELETE(request: NextRequest) {
  console.log('[Keys] DELETE', request.url)
  return handler.fetch(new Request(request.url, { method: 'DELETE', headers: request.headers }))
}

export async function POST(request: NextRequest) {
  const body = await request.text()
  console.log('[Keys] POST', request.url)
  console.log('[Keys] POST full body:', body)

  // Parse and check what we received
  try {
    const parsed = JSON.parse(body)
    console.log('[Keys] credential keys:', Object.keys(parsed.credential || {}))
    if (parsed.credential?.response) {
      console.log('[Keys] response keys:', Object.keys(parsed.credential.response))
    } else {
      console.log('[Keys] NO response object in credential!')
    }
  } catch {
    console.log('[Keys] body is not JSON')
  }

  return handler.fetch(new Request(request.url, {
    method: 'POST',
    headers: request.headers,
    body
  }))
}
