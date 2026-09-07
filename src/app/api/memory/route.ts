export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { logError } from '@/lib/logger'
import {
  storeMemory,
  getMemory,
  getUserMemories,
  deleteMemory,
  clearUserMemories,
  getMemoryStats,
  getMemoryContext,
} from '@/lib/memory'

/**
 * GET /api/memory
 * Get user memories
 */
export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const url = new URL(req.url)
    const key = url.searchParams.get('key')
    const category = url.searchParams.get('category')
    const format = url.searchParams.get('format')

    // Get specific memory
    if (key) {
      const memory = await getMemory(session.user.id, key)
      return NextResponse.json({ memory })
    }

    // Get AI context format
    if (format === 'context') {
      const context = await getMemoryContext(session.user.id)
      return NextResponse.json({ context })
    }

    // Get stats
    if (format === 'stats') {
      const stats = await getMemoryStats(session.user.id)
      return NextResponse.json({ stats })
    }

    // Get all memories (optionally filtered by category)
    const categories = category ? ([category] as any) : undefined
    const memories = await getUserMemories(session.user.id, categories)

    return NextResponse.json({ memories })
  } catch (error) {
    logError('Error fetching memories', error, { userId: session.user.id })
    return NextResponse.json({ error: 'Failed to fetch memories' }, { status: 500 })
  }
}

/**
 * POST /api/memory
 * Store a new memory
 */
export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await req.json()
    const { category, key, value, source, confidence, importance } = body

    if (!category || !key || !value) {
      return NextResponse.json(
        { error: 'Missing required fields: category, key, value' },
        { status: 400 }
      )
    }

    await storeMemory({
      userId: session.user.id,
      category,
      key,
      value,
      source,
      confidence,
      importance,
    })

    return NextResponse.json({
      success: true,
      message: 'Memory stored successfully',
    })
  } catch (error) {
    logError('Error storing memory', error, { userId: session.user.id })
    return NextResponse.json({ error: 'Failed to store memory' }, { status: 500 })
  }
}

/**
 * DELETE /api/memory
 * Delete a memory or clear all
 */
export async function DELETE(req: NextRequest) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const url = new URL(req.url)
    const key = url.searchParams.get('key')
    const category = url.searchParams.get('category')

    if (key) {
      await deleteMemory(session.user.id, key)
      return NextResponse.json({
        success: true,
        message: 'Memory deleted',
      })
    }

    if (category) {
      const count = await clearUserMemories(session.user.id, category as any)
      return NextResponse.json({
        success: true,
        message: `Deleted ${count} memories`,
      })
    }

    // Clear all memories
    const count = await clearUserMemories(session.user.id)
    return NextResponse.json({
      success: true,
      message: `Deleted all ${count} memories`,
    })
  } catch (error) {
    logError('Error deleting memory', error, { userId: session.user.id })
    return NextResponse.json({ error: 'Failed to delete memory' }, { status: 500 })
  }
}
