import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db'

// GET /api/keys/:key - Retrieve a key
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params
  const key = path.join('/')

  try {
    const record = await prisma.keyStore.findUnique({
      where: { key },
    })

    if (!record) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    return NextResponse.json({ value: record.value })
  } catch (error) {
    console.error('[KeyStore] GET error:', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

// PUT /api/keys/:key - Store a key
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params
  const key = path.join('/')

  try {
    const body = await request.json()
    const { value } = body

    if (typeof value !== 'string') {
      return NextResponse.json({ error: 'Invalid value' }, { status: 400 })
    }

    await prisma.keyStore.upsert({
      where: { key },
      update: { value },
      create: { key, value },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[KeyStore] PUT error:', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

// DELETE /api/keys/:key - Delete a key
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params
  const key = path.join('/')

  try {
    await prisma.keyStore.delete({
      where: { key },
    }).catch(() => {
      // Ignore if not found
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[KeyStore] DELETE error:', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
