import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getLicenseField } from '@/lib/license'

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ field: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const { field } = await params
  const value = await getLicenseField(field)
  const enabled = value === 'true'
  return NextResponse.json({ enabled })
}
