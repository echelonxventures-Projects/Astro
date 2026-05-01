export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import {
  exportUserData,
  deleteUserData,
  recordConsent,
  getConsent,
  generateDataExportJSON,
} from '@/lib/gdpr'
import { logError } from '@/lib/logger'

/**
 * GET /api/gdpr/data
 * Export user's personal data (GDPR Right to Access)
 */
export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const data = await exportUserData(session.user.id)
    const exportJSON = generateDataExportJSON(data)

    return new NextResponse(exportJSON, {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="starpath-data-export-${new Date().toISOString().split('T')[0]}.json"`,
      },
    })
  } catch (error) {
    logError('Error exporting user data', error, { userId: session.user.id })
    return NextResponse.json(
      { error: 'Failed to export data' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/gdpr/data
 * Record consent or request data deletion
 */
export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await req.json()
    const { action, consents } = body

    if (action === 'recordConsent' && consents) {
      await recordConsent(session.user.id, consents)
      return NextResponse.json({ success: true, message: 'Consent recorded' })
    }

    if (action === 'deleteAccount') {
      // Require explicit confirmation
      if (!body.confirmDelete || body.confirmDelete !== 'DELETE_MY_ACCOUNT') {
        return NextResponse.json({
          error: 'Please confirm deletion by sending confirmDelete: "DELETE_MY_ACCOUNT"',
        }, { status: 400 })
      }

      await deleteUserData(session.user.id)
      return NextResponse.json({
        success: true,
        message: 'All personal data has been permanently deleted',
      })
    }

    if (action === 'getConsent') {
      const consent = await getConsent(session.user.id)
      return NextResponse.json({ consent })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (error) {
    logError('Error processing GDPR request', error, { userId: session.user.id })
    return NextResponse.json(
      { error: 'Failed to process request' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/gdpr/data
 * Delete user account and all data (GDPR Right to Erasure)
 */
export async function DELETE(req: NextRequest) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    // Check for confirmation header
    const confirmDelete = req.headers.get('X-Confirm-Delete')
    if (confirmDelete !== 'CONFIRM_ERASE') {
      return NextResponse.json({
        error: 'Deletion requires X-Confirm-Delete: CONFIRM_ERASE header',
        warning: 'This action is irreversible and will permanently delete all your data',
      }, { status: 400 })
    }

    await deleteUserData(session.user.id)

    return NextResponse.json({
      success: true,
      message: 'Account and all personal data have been permanently deleted',
    })
  } catch (error) {
    logError('Error deleting user data', error, { userId: session.user.id })
    return NextResponse.json(
      { error: 'Failed to delete data' },
      { status: 500 }
    )
  }
}