/**
 * POST /api/admin/branding/upload
 * Upload a brand asset (logo / favicon). Uses Cloudinary when configured,
 * otherwise stores under public/uploads/<tenantId>/ (dev fallback).
 */

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

import { randomUUID } from 'crypto'
import { mkdir, writeFile } from 'fs/promises'
import path from 'path'
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { logError } from '@/lib/logger'
import { getTenantContext } from '@/lib/tenant'

const MAX_BYTES = 2 * 1024 * 1024
const ALLOWED: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/svg+xml': 'svg',
  'image/x-icon': 'ico',
  'image/vnd.microsoft.icon': 'ico',
}

async function checkTenantAdmin(): Promise<
  { ok: true; tenantId: string } | { ok: false; res: NextResponse }
> {
  const session = await auth()
  if (!session?.user?.tenantId) {
    return { ok: false, res: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  }
  if (session.user.role !== 'admin' && session.user.role !== 'superadmin') {
    return {
      ok: false,
      res: NextResponse.json({ error: 'Admin access required' }, { status: 403 }),
    }
  }
  const ctx = await getTenantContext()
  if (session.user.tenantId !== ctx.tenantId) {
    return { ok: false, res: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  }
  return { ok: true, tenantId: ctx.tenantId }
}

export async function POST(req: NextRequest) {
  try {
    const guard = await checkTenantAdmin()
    if (!guard.ok) return guard.res

    const form = await req.formData()
    const file = form.get('file')
    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'file (multipart) is required' }, { status: 400 })
    }
    const ext = ALLOWED[file.type]
    if (!ext) {
      return NextResponse.json(
        { error: `Unsupported type ${file.type}. Use PNG, JPG, WEBP, SVG or ICO.` },
        { status: 400 }
      )
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: 'File too large (max 2 MB)' }, { status: 400 })
    }

    const bytes = Buffer.from(await file.arrayBuffer())
    const folder = `starpath-branding/${guard.tenantId}`
    const filename = `${randomUUID()}.${ext}`

    const cloudName = process.env.CLOUDINARY_CLOUD_NAME
    const apiKey = process.env.CLOUDINARY_API_KEY
    const apiSecret = process.env.CLOUDINARY_API_SECRET

    if (cloudName && apiKey && apiSecret) {
      try {
        const basic = Buffer.from(`${apiKey}:${apiSecret}`).toString('base64')
        const fd = new FormData()
        fd.append('file', new Blob([new Uint8Array(bytes)], { type: file.type }), filename)
        fd.append('folder', folder)
        const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
          method: 'POST',
          headers: { Authorization: `Basic ${basic}` },
          body: fd,
        })
        const data = (await res.json()) as { secure_url?: string; error?: { message?: string } }
        if (res.ok && data.secure_url) {
          return NextResponse.json({ url: data.secure_url, storage: 'cloudinary' })
        }
        logError(
          'Cloudinary upload rejected, falling back to local storage',
          new Error(data.error?.message ?? `HTTP ${res.status}`)
        )
      } catch (error) {
        logError('Cloudinary upload error, falling back to local storage', error)
      }
    }

    // Local fallback: serve from public/uploads (dev/staging convenience)
    const relDir = path.join('public', 'uploads', guard.tenantId)
    await mkdir(relDir, { recursive: true })
    await writeFile(path.join(relDir, filename), bytes)
    return NextResponse.json({ url: `/uploads/${guard.tenantId}/${filename}`, storage: 'local' })
  } catch (error) {
    logError('Brand asset upload error', error)
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 })
  }
}
