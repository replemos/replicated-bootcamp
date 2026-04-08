import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { POST } from './route'

beforeEach(() => {
  vi.stubEnv('REPLICATED_SDK_URL', 'http://replicated:3000')
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllEnvs()
})

describe('POST /api/support-bundle', () => {
  it('returns 503 when REPLICATED_SDK_URL is not set', async () => {
    vi.unstubAllEnvs()
    const res = await POST()
    expect(res.status).toBe(503)
    const body = await res.json()
    expect(body).toEqual({ error: 'SDK not configured' })
  })

  it('returns 200 when SDK returns ok', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 200 }))
    const res = await POST()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toEqual({ ok: true })
    expect(global.fetch).toHaveBeenCalledWith(
      'http://replicated:3000/api/v1/app/supportbundle',
      { method: 'POST' }
    )
  })

  it('returns the SDK status when SDK returns non-2xx', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 503 }))
    const res = await POST()
    expect(res.status).toBe(503)
    const body = await res.json()
    expect(body).toEqual({ error: 'Failed to generate support bundle' })
  })

  it('returns 500 when fetch throws', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network error')))
    const res = await POST()
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body).toEqual({ error: 'Failed to generate support bundle' })
  })
})
