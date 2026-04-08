import { NextResponse } from 'next/server'

export async function POST() {
  const sdkUrl = process.env.REPLICATED_SDK_URL
  if (!sdkUrl) {
    return NextResponse.json({ error: 'SDK not configured' }, { status: 503 })
  }

  try {
    const res = await fetch(`${sdkUrl}/api/v1/app/supportbundle`, { method: 'POST' })
    if (!res.ok) {
      console.error('[support-bundle] SDK returned', res.status)
      return NextResponse.json(
        { error: 'Failed to generate support bundle' },
        { status: res.status }
      )
    }
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[support-bundle] failed to generate bundle', err)
    return NextResponse.json(
      { error: 'Failed to generate support bundle' },
      { status: 500 }
    )
  }
}
