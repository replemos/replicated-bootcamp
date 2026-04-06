import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const team = await prisma.team.findUnique({
      where: { userId: session.user.id },
      include: { mlbTeam: true },
    })
    if (!team) return NextResponse.json({ error: 'No team' }, { status: 404 })

    const players = await prisma.player.findMany({
      where: { teamId: team.id },
      include: {
        mlbPlayer: true,
        playerSeason: true,
      },
      orderBy: [
        { mlbPlayer: { isPitcher: 'asc' } },
        { mlbPlayer: { lineupOrder: 'asc' } },
      ],
    })

    const batters = players
      .filter((p) => !p.mlbPlayer.isPitcher && p.mlbPlayer.lineupOrder !== null)
      .map((p) => ({
        id: p.id,
        name: p.mlbPlayer.name,
        position: p.mlbPlayer.position,
        number: p.mlbPlayer.number,
        season: p.playerSeason,
      }))

    const pitchers = players
      .filter((p) => p.mlbPlayer.isPitcher)
      .map((p) => ({
        id: p.id,
        name: p.mlbPlayer.name,
        position: p.mlbPlayer.position,
        number: p.mlbPlayer.number,
        season: p.playerSeason,
      }))

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { franchiseName: true },
    })
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

    return NextResponse.json({
      team: {
        name: team.mlbTeam.name,
        abbr: team.mlbTeam.abbr,
        franchiseName: user.franchiseName,
      },
      batters,
      pitchers,
    })
  } catch (err) {
    console.error('[roster]', err)
    return NextResponse.json({ error: 'Failed to load roster' }, { status: 500 })
  }
}
