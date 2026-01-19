import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userAddress = searchParams.get('userAddress')
    const limit = parseInt(searchParams.get('limit') || '20', 10)
    const offset = parseInt(searchParams.get('offset') || '0', 10)

    if (!userAddress) {
      return NextResponse.json({ error: 'User address required' }, { status: 400 })
    }

    const [transactions, total] = await Promise.all([
      prisma.transaction.findMany({
        where: { userAddress: userAddress.toLowerCase() },
        orderBy: { createdAt: 'desc' },
        take: Math.min(limit, 100),
        skip: offset,
      }),
      prisma.transaction.count({
        where: { userAddress: userAddress.toLowerCase() },
      }),
    ])

    return NextResponse.json({
      transactions,
      total,
      limit,
      offset,
    })
  } catch (error) {
    console.error('Get transactions error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
