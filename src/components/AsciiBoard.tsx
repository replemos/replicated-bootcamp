'use client'

import type { GameState } from '@/app/api/game/types'

interface Props {
  state: GameState
  lastCpuLog?: string[]
  onAtBat: () => void
  onSimulate: () => void
  loading: boolean
  simulating: boolean
}

function outPips(outs: number) {
  return [0, 1, 2].map((i) => (i < outs ? 'X' : 'o')).join('  ')
}

function runnerSymbol(occupied: boolean) {
  return occupied ? 'X' : 'o'
}

export function AsciiBoard({ state, lastCpuLog, onAtBat, onSimulate, loading, simulating }: Props) {
  const { inning, halfInning, outs, homeScore, awayScore, runnersOnBase,
          currentBatter, gameLog, userTeam, cpuTeam, status, result } = state

  const inningStr = `INNING ${inning} ${halfInning === 'bot' ? 'BOT' : 'TOP'}`
  const awayAbbr = cpuTeam.abbr.padEnd(3)
  const homeLabel = userTeam.franchiseName.toUpperCase().slice(0, 12).padEnd(12)

  const b = currentBatter
  const shortName = b.name.split(' ').map((s, i) => i === 0 ? s[0] + '.' : s).join(' ')
  const avgStr = b.seasonStats.avg.padStart(4)

  const gameOverMsg = status === 'completed'
    ? result === 'user_win' ? '  ** YOU WIN! **'
    : result === 'cpu_win' ? '  COMPUTER WINS'
    : '  FINAL - TIE'
    : ''

  const W = 54
  const row = (content: string) => `║${content.padEnd(W)}║`
  const top    = `╔${'═'.repeat(W)}╗`
  const mid    = `╠${'═'.repeat(W)}╣`
  const bottom = `╚${'═'.repeat(W)}╝`

  const board = [
    top,
    row(`  ${userTeam.franchiseName.toUpperCase().padEnd(20)}${inningStr.padStart(30)}  `),
    mid,
    row(`  SCORE:  ${awayAbbr} ${String(awayScore).padStart(2)}  |  ${homeLabel} ${String(homeScore).padStart(2)}`),
    row(`  OUTS:   [ ${outPips(outs)} ]`),
    mid,
    row(`                         2B`),
    row(`                         ${runnerSymbol(!!runnersOnBase.second)}`),
    row(`            3B                          1B`),
    row(`             ${runnerSymbol(!!runnersOnBase.third)}                        ${runnerSymbol(!!runnersOnBase.first)}`),
    row(`                         ${runnerSymbol(false)}`),
    row(`                        HOME`),
    mid,
    row(`  AT BAT:  ${shortName.padEnd(18)}(#${String(b.number).padStart(2)} - ${b.position.padEnd(2)})`),
    row(`  ${avgStr} AVG  -  ${String(b.seasonStats.hr).padStart(2)} HR  -  ${String(b.seasonStats.rbi).padStart(3)} RBI  (season)`),
    mid,
    row(`  ${(gameLog[0] ?? '-').slice(0, 52)}`),
    bottom,
  ].join('\n')

  return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center p-4">
      <pre style={{ fontFamily: "'Courier New', Courier, monospace" }} className="text-green-400 text-sm leading-tight whitespace-pre">
        {board}
      </pre>

      {lastCpuLog && lastCpuLog.length > 0 && (
        <pre style={{ fontFamily: "'Courier New', Courier, monospace" }} className="text-yellow-400 text-xs mt-2 whitespace-pre">
          {`  ${cpuTeam.abbr} half-inning:\n`}
          {lastCpuLog.map((l) => `    ${l}`).join('\n')}
        </pre>
      )}

      {status === 'in_progress' ? (
        <div className="flex flex-col items-center gap-3 mt-6">
          <button
            onClick={onAtBat}
            disabled={loading || simulating}
            className="font-mono text-black bg-green-400 hover:bg-green-300 disabled:opacity-50 px-8 py-3 text-sm tracking-widest"
          >
            {loading ? '  PITCHING...  ' : '  TAKE PLATE APPEARANCE  '}
          </button>
          <button
            onClick={onSimulate}
            disabled={loading || simulating}
            className="font-mono text-green-600 hover:text-green-400 disabled:opacity-50 text-xs"
          >
            {simulating ? 'SIMULATING...' : 'SIMULATE REST OF GAME ->'}
          </button>
        </div>
      ) : (
        <pre style={{ fontFamily: "'Courier New', Courier, monospace" }} className="text-yellow-300 text-lg mt-4">{gameOverMsg}</pre>
      )}
    </div>
  )
}
