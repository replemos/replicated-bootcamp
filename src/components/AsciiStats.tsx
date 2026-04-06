interface BatterRow {
  number: number
  name: string
  position: string
  season: {
    games: number; atBats: number; hits: number
    homeRuns: number; rbi: number; walks: number; strikeouts: number
  } | null
}

interface PitcherRow {
  number: number
  name: string
  position: string
  season: {
    gamesStarted: number; inningsPitched: number; hitsAllowed: number
    walksAllowed: number; strikeoutsThrown: number; earnedRuns: number
  } | null
}

interface Props {
  teamName: string
  franchiseName: string
  batters: BatterRow[]
  pitchers: PitcherRow[]
}

function avg(hits: number, ab: number): string {
  if (ab === 0) return '.000'
  return (hits / ab).toFixed(3).replace('0.', '.')
}

function era(er: number, ip: number): string {
  if (ip === 0) return '0.00'
  return ((er * 9) / ip).toFixed(2)
}

export function AsciiStats({ franchiseName, batters, pitchers }: Props) {
  const W = 67
  const row = (content: string) => `║${content.padEnd(W)}║`
  const top    = `╔${'═'.repeat(W)}╗`
  const mid    = `╠${'═'.repeat(W)}╣`
  const bottom = `╚${'═'.repeat(W)}╝`

  // Column widths: # POS G are right-aligned nums; NAME/POS label left-aligned
  const batCol = (num: string, name: string, pos: string, g: string, ab: string, h: string, hr: string, rbi: string, avg: string) =>
    `  ${num.padStart(3)}  ${name.padEnd(18)}  ${pos.padEnd(3)}  ${g.padStart(3)}  ${ab.padStart(4)}  ${h.padStart(4)}  ${hr.padStart(4)}  ${rbi.padStart(4)}  ${avg.padStart(4)}`

  const pitCol = (num: string, name: string, pos: string, g: string, ip: string, h: string, bb: string, k: string, era: string) =>
    `  ${num.padStart(3)}  ${name.padEnd(18)}  ${pos.padEnd(3)}  ${g.padStart(3)}  ${ip.padStart(4)}  ${h.padStart(4)}  ${bb.padStart(4)}  ${k.padStart(4)}  ${era.padStart(5)}`

  const sep = `  ${'─'.repeat(64)}`

  const header = [
    top,
    row(`  ${franchiseName.toUpperCase()}`),
    mid,
    row(`  BATTING`),
    row(batCol('#', 'NAME', 'POS', 'G', 'AB', 'H', 'HR', 'RBI', 'AVG')),
    row(sep),
  ].join('\n')

  const batterRows = batters.map((b) => {
    const s = b.season
    return row(batCol(
      String(b.number),
      b.name.slice(0, 18),
      (b.position || '').slice(0, 3),
      String(s?.games ?? 0),
      String(s?.atBats ?? 0),
      String(s?.hits ?? 0),
      String(s?.homeRuns ?? 0),
      String(s?.rbi ?? 0),
      avg(s?.hits ?? 0, s?.atBats ?? 0),
    ))
  })

  const pitcherHeader = [
    mid,
    row(`  PITCHING`),
    row(pitCol('#', 'NAME', 'POS', 'G', 'IP', 'H', 'BB', 'K', 'ERA')),
    row(sep),
  ].join('\n')

  const pitcherRows = pitchers.map((p) => {
    const s = p.season
    return row(pitCol(
      String(p.number),
      p.name.slice(0, 18),
      (p.position || '').slice(0, 3),
      String(s?.gamesStarted ?? 0),
      String(s?.inningsPitched ?? 0),
      String(s?.hitsAllowed ?? 0),
      String(s?.walksAllowed ?? 0),
      String(s?.strikeoutsThrown ?? 0),
      era(s?.earnedRuns ?? 0, s?.inningsPitched ?? 0),
    ))
  })

  const footer = bottom

  const board = [header, ...batterRows, pitcherHeader, ...pitcherRows, footer].join('\n')

  return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-start p-4 pt-8">
      <pre style={{ fontFamily: "'Courier New', Courier, monospace" }} className="text-green-400 text-sm leading-tight whitespace-pre overflow-x-auto">
        {board}
      </pre>
    </div>
  )
}
