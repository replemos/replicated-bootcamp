# Plate Appearance Engine Display Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When a user takes a plate appearance, replace the scoreboard with an animated at-bat screen showing dice flickering, landing on real values from the game engine, and revealing the outcome — with an optional popup of the full outcome table.

**Architecture:** Extend `resolveAtBat` to return dice values alongside the outcome. The at-bat API route forwards these as `lastRoll` in its response. The game page conditionally renders a new `AtBatScreen` component (instead of `AsciiBoard`) while loading, which runs a client-side animation timed to reveal the real dice values when available.

**Tech Stack:** Next.js App Router, React hooks (`useState`, `useEffect`, `useRef`, `useCallback`), TypeScript, Tailwind CSS, Vitest

---

## File Map

| File | Change |
|------|--------|
| `src/lib/game-engine.ts` | `resolveAtBat` returns `AtBatResult` object instead of bare `Outcome` |
| `src/lib/game-engine.test.ts` | Update assertions to check `.outcome` property |
| `src/app/api/game/types.ts` | Add optional `lastRoll` field to `GameState` |
| `src/app/api/game/at-bat/route.ts` | Destructure `AtBatResult`, include `lastRoll` in all responses |
| `src/components/AtBatScreen.tsx` | New component — full at-bat animation and outcome table popup |
| `src/app/game/page.tsx` | Add `lastRoll` state, render `AtBatScreen` while loading |

---

## Task 1: Update `resolveAtBat` tests to expect an object

**Files:**
- Modify: `src/lib/game-engine.test.ts`

The current tests assert `expect(resolveAtBat(...)).toBe('HR')`. After the implementation change they will need to check `.outcome`. Update the tests first so they fail, then fix the implementation.

- [ ] **Step 1: Update all test assertions in `game-engine.test.ts`**

Replace every assertion that checks the return value directly. The new shape is `{ outcome, die1, die2, adjusted, net }`.

Full updated file:

```ts
import { describe, it, expect, vi, afterEach } from 'vitest'
import { resolveAtBat } from './game-engine'

afterEach(() => vi.restoreAllMocks())

function mockRoll(die1: number, die2: number) {
  vi.spyOn(Math, 'random')
    .mockReturnValueOnce((die1 - 1) / 6)
    .mockReturnValueOnce((die2 - 1) / 6)
}

describe('resolveAtBat', () => {
  it('returns HR on roll 12 with no modifiers (contact=5, power=5, pitching=1)', () => {
    mockRoll(6, 6)
    const result = resolveAtBat({ contact: 5, power: 5 }, { pitching: 1 })
    expect(result.outcome).toBe('HR')
    expect(result.die1).toBe(6)
    expect(result.die2).toBe(6)
    expect(result.adjusted).toBe(12)
    expect(result.net).toBe(0)
  })

  it('returns STRIKEOUT on roll 2 with no modifiers', () => {
    mockRoll(1, 1)
    const result = resolveAtBat({ contact: 5, power: 5 }, { pitching: 1 })
    expect(result.outcome).toBe('STRIKEOUT')
    expect(result.die1).toBe(1)
    expect(result.die2).toBe(1)
    expect(result.adjusted).toBe(2)
  })

  it('returns SINGLE on roll 8 with average batter vs weak pitcher', () => {
    mockRoll(4, 4)
    const result = resolveAtBat({ contact: 5, power: 5 }, { pitching: 1 })
    expect(result.outcome).toBe('SINGLE')
    expect(result.adjusted).toBe(8)
  })

  it('high contact batter shifts roll up toward hits', () => {
    mockRoll(3, 3) // roll 6 → FLYOUT without bonus
    const result = resolveAtBat({ contact: 10, power: 5 }, { pitching: 1 })
    expect(result.outcome).toBe('SINGLE') // 6 + 2 contact bonus = 8 → SINGLE
    expect(result.net).toBe(2)
    expect(result.adjusted).toBe(8)
  })

  it('ace pitcher reduces roll toward outs', () => {
    mockRoll(4, 4) // roll 8 → SINGLE without penalty
    const result = resolveAtBat({ contact: 5, power: 5 }, { pitching: 10 })
    expect(result.outcome).toBe('FLYOUT') // 8 - 2 = 6 → FLYOUT
    expect(result.net).toBe(-2)
    expect(result.adjusted).toBe(6)
  })

  it('returns TRIPLE on roll 9 with no modifiers', () => {
    mockRoll(4, 5)
    const result = resolveAtBat({ contact: 5, power: 5 }, { pitching: 1 })
    expect(result.outcome).toBe('TRIPLE')
    expect(result.adjusted).toBe(9)
  })

  it('clamps adjusted roll to 2 minimum', () => {
    mockRoll(1, 1)
    const result = resolveAtBat({ contact: 1, power: 1 }, { pitching: 10 })
    expect(result.outcome).toBe('STRIKEOUT')
    expect(result.adjusted).toBe(2)
  })

  it('clamps adjusted roll to 12 maximum', () => {
    mockRoll(6, 6)
    const result = resolveAtBat({ contact: 10, power: 10 }, { pitching: 1 })
    expect(result.outcome).toBe('HR')
    expect(result.adjusted).toBe(12)
  })
})
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
npm test -- game-engine
```

Expected: 8 failures. All existing assertions like `expect(result).toBe('HR')` fail because `result` is still a string.

---

## Task 2: Update `resolveAtBat` to return `AtBatResult`

**Files:**
- Modify: `src/lib/game-engine.ts`

- [ ] **Step 1: Update `game-engine.ts`**

Full updated file:

```ts
export type Outcome =
  | 'HR' | 'TRIPLE' | 'DOUBLE' | 'SINGLE'
  | 'WALK' | 'STRIKEOUT' | 'GROUNDOUT' | 'FLYOUT'

export type AtBatResult = {
  outcome: Outcome
  die1: number
  die2: number
  adjusted: number
  net: number
}

const OUTCOME_TABLE: Record<number, Outcome> = {
  2:  'STRIKEOUT',
  3:  'STRIKEOUT',
  4:  'GROUNDOUT',
  5:  'GROUNDOUT',
  6:  'FLYOUT',
  7:  'GROUNDOUT',
  8:  'SINGLE',
  9:  'TRIPLE',
  10: 'DOUBLE',
  11: 'WALK',
  12: 'HR',
}

function rollDice(): [number, number] {
  const die1 = Math.floor(Math.random() * 6) + 1
  const die2 = Math.floor(Math.random() * 6) + 1
  return [die1, die2]
}

function contactBonus(contact: number): number {
  return Math.round((contact - 5.5) / 2.25)
}

function powerBonus(power: number): number {
  return Math.round((power - 5.5) / 4.5)
}

function pitcherPenalty(pitching: number): number {
  return Math.round((pitching - 1) / 4.5)
}

export function resolveAtBat(
  batter: { contact: number; power: number },
  pitcher: { pitching: number }
): AtBatResult {
  const [die1, die2] = rollDice()
  const roll = die1 + die2
  const net =
    contactBonus(batter.contact) +
    powerBonus(batter.power) -
    pitcherPenalty(pitcher.pitching)
  const adjusted = Math.max(2, Math.min(12, roll + net))
  return {
    outcome: OUTCOME_TABLE[adjusted],
    die1,
    die2,
    adjusted,
    net,
  }
}
```

- [ ] **Step 2: Run tests — verify they pass**

```bash
npm test -- game-engine
```

Expected: 8 passing.

- [ ] **Step 3: Commit**

```bash
git add src/lib/game-engine.ts src/lib/game-engine.test.ts
git commit -m "feat: resolveAtBat returns AtBatResult with dice values"
```

---

## Task 3: Update `GameState` type and at-bat route

**Files:**
- Modify: `src/app/api/game/types.ts`
- Modify: `src/app/api/game/at-bat/route.ts`

- [ ] **Step 1: Add `lastRoll` to `GameState` in `types.ts`**

```ts
export interface GameState {
  id: string
  inning: number
  halfInning: 'top' | 'bot'
  outs: number
  homeScore: number
  awayScore: number
  runnersOnBase: { first: string | null; second: string | null; third: string | null }
  currentBatter: {
    id: string
    name: string
    position: string
    number: number
    contact: number
    power: number
    speed: number
    gameStats: { ab: number; h: number; hr: number; rbi: number }
    seasonStats: { avg: string; hr: number; rbi: number }
  }
  gameLog: string[]
  status: 'in_progress' | 'completed'
  result?: 'user_win' | 'cpu_win' | 'tie'
  userTeam: { name: string; abbr: string; franchiseName: string }
  cpuTeam: { name: string; abbr: string }
  lastCpuLog?: string[]
  lastRoll?: {
    die1: number
    die2: number
    adjusted: number
    net: number
    pitching: number
  }
}
```

- [ ] **Step 2: Update `at-bat/route.ts` to use `AtBatResult` and include `lastRoll`**

At the top of the file, the import already pulls in `resolveAtBat`. Add `AtBatResult` to the import and update the call site. Find the `resolveAtBat` call (line 49) and all `NextResponse.json` return statements.

Replace the resolveAtBat call and downstream usage (lines 48–52):

```ts
// was: const outcome = resolveAtBat(...)
const atBatResult = resolveAtBat(
  { contact: mlp.contact, power: mlp.power },
  cpuPitcher
)
const outcome = atBatResult.outcome
const lastRoll = {
  die1: atBatResult.die1,
  die2: atBatResult.die2,
  adjusted: atBatResult.adjusted,
  net: atBatResult.net,
  pitching: cpuPitcher.pitching,
}
```

Then update all three `NextResponse.json` return statements to include `lastRoll`:

Line ~116 (game over path):
```ts
return NextResponse.json({ ...state, lastCpuLog: [], lastRoll })
```

Line ~162 (home wins after top path):
```ts
return NextResponse.json({ ...state, lastCpuLog, lastRoll })
```

Line ~197 (normal path):
```ts
return NextResponse.json({ ...state, lastCpuLog, lastRoll })
```

- [ ] **Step 3: Run the full test suite**

```bash
npm test
```

Expected: all tests pass (the at-bat route has no unit tests, but game-engine and other tests should still pass).

- [ ] **Step 4: Commit**

```bash
git add src/app/api/game/types.ts src/app/api/game/at-bat/route.ts
git commit -m "feat: include lastRoll with dice values in at-bat API response"
```

---

## Task 4: Create `AtBatScreen` component

**Files:**
- Create: `src/components/AtBatScreen.tsx`

This component renders the full-screen at-bat experience. It mounts immediately when the user clicks the button (before the API responds), animates random dice, then lands on the real values from `lastRoll` once available.

- [ ] **Step 1: Create `src/components/AtBatScreen.tsx`**

```tsx
'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import type { GameState } from '@/app/api/game/types'

const OUTCOME_TABLE: Record<number, string> = {
  2: 'STRIKEOUT', 3: 'STRIKEOUT', 4: 'GROUNDOUT', 5: 'GROUNDOUT',
  6: 'FLYOUT', 7: 'GROUNDOUT', 8: 'SINGLE', 9: 'TRIPLE',
  10: 'DOUBLE', 11: 'WALK', 12: 'HOME RUN',
}

interface Props {
  batter: GameState['currentBatter']
  lastRoll: GameState['lastRoll']
  onDone: () => void
}

function contactBonus(c: number) { return Math.round((c - 5.5) / 2.25) }
function powerBonus(p: number) { return Math.round((p - 5.5) / 4.5) }
function pitcherPenalty(p: number) { return Math.round((p - 1) / 4.5) }
function statBar(v: number) { return '█'.repeat(v) + '░'.repeat(10 - v) }
function sgn(n: number) { return (n >= 0 ? '+' : '') + n }
function rd() { return Math.ceil(Math.random() * 6) }

const W = 54
const row = (s: string) => '║' + s.padEnd(W) + '║'
const TOP = '╔' + '═'.repeat(W) + '╗'
const MID = '╠' + '═'.repeat(W) + '╣'
const BOT = '╚' + '═'.repeat(W) + '╝'

export function AtBatScreen({ batter, lastRoll, onDone }: Props) {
  const [die1, setDie1] = useState<number | null>(null)
  const [die2, setDie2] = useState<number | null>(null)
  const [phase, setPhase] = useState<'rolling' | 'landed' | 'done'>('rolling')
  const [showPopup, setShowPopup] = useState(false)

  const lastRollRef = useRef(lastRoll)
  const flickerEndRef = useRef(Date.now() + 1300)

  useEffect(() => {
    lastRollRef.current = lastRoll
  }, [lastRoll])

  useEffect(() => {
    const interval = setInterval(() => {
      setDie1(rd())
      setDie2(rd())
      if (lastRollRef.current && Date.now() >= flickerEndRef.current) {
        clearInterval(interval)
        setDie1(lastRollRef.current.die1)
        setDie2(lastRollRef.current.die2)
        setPhase('landed')
      }
    }, 80)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    if (phase === 'landed') {
      const t = setTimeout(() => setPhase('done'), 700)
      return () => clearTimeout(t)
    }
    if (phase === 'done') {
      const t = setTimeout(onDone, 2000)
      return () => clearTimeout(t)
    }
  }, [phase, onDone])

  const cb = contactBonus(batter.contact)
  const pb = powerBonus(batter.power)
  const pp = lastRoll ? pitcherPenalty(lastRoll.pitching) : 0
  const pitchingVal = lastRoll?.pitching ?? '?'

  const shortName = batter.name.split(' ').map((s, i) => i === 0 ? s[0] + '.' : s).join(' ')

  const diceRow = `   │ ${die1 ?? '?'} │  +  │ ${die2 ?? '?'} │`

  let rollLine = row('  ROLLING 2d6...')
  let mathLine = row('')
  let resultLine = row('')

  if (phase !== 'rolling' && lastRoll) {
    const raw = lastRoll.die1 + lastRoll.die2
    rollLine = row(`  rolled ${raw}  net ${sgn(lastRoll.net)}  →  adjusted: ${lastRoll.adjusted}`)
    mathLine = row(`  Contact${sgn(cb)} · Power${sgn(pb)} · Pitcher${sgn(-pp)}`)
  }

  if (phase === 'done' && lastRoll) {
    resultLine = row(`         ▸▸  ${OUTCOME_TABLE[lastRoll.adjusted]}  ◂◂`)
  }

  const board = [
    TOP,
    row('      ⚾  PLATE APPEARANCE  ⚾'),
    MID,
    row(`  ${shortName} (#${batter.number} - ${batter.position})   vs   CPU Pitcher`),
    MID,
    row(`  CONTACT  ${batter.contact}  ${statBar(batter.contact)}  [${sgn(cb)}]`),
    row(`  POWER    ${batter.power}  ${statBar(batter.power)}  [${sgn(pb)}]`),
    row(`  PITCHING ${pitchingVal}  ${typeof pitchingVal === 'number' ? statBar(pitchingVal) : '░'.repeat(10)}  [${sgn(-pp)}]`),
    MID,
    rollLine,
    mathLine,
    row('   ┌───┐     ┌───┐'),
    row(diceRow),
    row('   └───┘     └───┘'),
    row(''),
    resultLine,
    MID,
    row('  [ ? ] outcome table'),
    BOT,
  ].join('\n')

  const outcomePopup = (() => {
    const adj = lastRoll?.adjusted
    const lines = [
      '╔══ 2d6 OUTCOME TABLE ══════════╗',
      '║   roll   outcome               ║',
      '╠═══════════════════════════════╣',
      ...Object.entries(OUTCOME_TABLE).map(([k, v]) => {
        const r = parseInt(k)
        const arrow = r === adj ? '→' : ' '
        const marker = r === adj ? ' ◂' : ''
        return { text: `║  ${arrow} ${String(r).padStart(2)}    ${v.padEnd(13)}║${marker}`, hi: r === adj }
      }),
      '╚═══════════════════════════════╝',
    ]
    return lines
  })()

  return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center p-4">
      <pre
        style={{ fontFamily: "'Courier New', Courier, monospace" }}
        className="text-sm leading-tight whitespace-pre"
      >
        {board.split('\n').map((line, i) => {
          const isRolling = line === rollLine || line === mathLine ||
            line.includes('┌───┐') || line.includes('│') || line.includes('└───┘')
          const isResult = line === resultLine && phase === 'done'
          const isLink = line.includes('[ ? ] outcome table')
          const color = isResult ? '#86efac' : isRolling && phase !== 'done' ? '#facc15' : '#4ade80'
          if (isLink) {
            return (
              <span key={i} style={{ color: '#4ade80' }}>
                {line.replace('[ ? ] outcome table', '')}
                <span
                  style={{ color: '#60a5fa', textDecoration: 'underline', cursor: 'pointer' }}
                  onClick={() => setShowPopup(true)}
                >
                  [ ? ] outcome table
                </span>
                {'\n'}
              </span>
            )
          }
          return <span key={i} style={{ color }}>{line}{'\n'}</span>
        })}
      </pre>

      {showPopup && (
        <div
          className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center cursor-pointer"
          onClick={() => setShowPopup(false)}
        >
          <pre
            style={{ fontFamily: "'Courier New', Courier, monospace" }}
            className="text-sm leading-tight whitespace-pre"
          >
            {outcomePopup.map((entry, i) => {
              if (typeof entry === 'string') {
                return <span key={i} style={{ color: '#4ade80' }}>{entry}{'\n'}</span>
              }
              return (
                <span key={i} style={{ color: entry.hi ? '#facc15' : '#4ade80', fontWeight: entry.hi ? 'bold' : 'normal' }}>
                  {entry.text}{'\n'}
                </span>
              )
            })}
            <span style={{ color: '#4ade80' }}>{'\n'}  click anywhere to close</span>
          </pre>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Run the test suite to make sure nothing is broken**

```bash
npm test
```

Expected: all tests pass (no tests for this component — it's animation/visual only).

- [ ] **Step 3: Commit**

```bash
git add src/components/AtBatScreen.tsx
git commit -m "feat: add AtBatScreen component with dice animation and outcome table popup"
```

---

## Task 5: Wire `AtBatScreen` into the game page

**Files:**
- Modify: `src/app/game/page.tsx`

- [ ] **Step 1: Update `game/page.tsx`**

Full updated file:

```tsx
'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSession, signOut } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { AsciiBoard } from '@/components/AsciiBoard'
import { AtBatScreen } from '@/components/AtBatScreen'
import type { GameState } from '@/app/api/game/types'

export default function GamePage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [gameState, setGameState] = useState<GameState | null>(null)
  const [lastCpuLog, setLastCpuLog] = useState<string[]>([])
  const [lastRoll, setLastRoll] = useState<GameState['lastRoll']>(null)
  const [loading, setLoading] = useState(false)
  const [starting, setStarting] = useState(false)
  const [simulating, setSimulating] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/')
  }, [status, router])

  const loadCurrentGame = useCallback(async () => {
    const res = await fetch('/api/game/current')
    const data = await res.json()
    if (data?.id) setGameState(data)
  }, [])

  useEffect(() => {
    if (status === 'authenticated') loadCurrentGame()
  }, [status, loadCurrentGame])

  async function startGame() {
    setStarting(true)
    setError('')
    const res = await fetch('/api/game/start', { method: 'POST' })
    const data = await res.json()
    setStarting(false)
    if (!res.ok) {
      setError(data.error ?? 'Failed to start game')
      return
    }
    setLastCpuLog(data.lastCpuLog ?? [])
    setGameState(data)
  }

  async function handleSimulate() {
    setSimulating(true)
    setError('')
    const res = await fetch('/api/game/simulate', { method: 'POST' })
    const data = await res.json()
    setSimulating(false)
    if (!res.ok) {
      setError(data.error ?? 'Error simulating game')
      return
    }
    setLastCpuLog([])
    setGameState(data)
  }

  async function handleAtBat() {
    if (!gameState) return
    setLoading(true)
    setLastRoll(null)
    setError('')
    const res = await fetch('/api/game/at-bat', { method: 'POST' })
    const data = await res.json()
    if (!res.ok) {
      setError(data.error ?? 'Error processing at-bat')
      setLoading(false)
      return
    }
    setLastCpuLog(data.lastCpuLog ?? [])
    setGameState(data)
    setLastRoll(data.lastRoll ?? null)
    // Do NOT call setLoading(false) here — AtBatScreen calls onAtBatDone when animation completes
  }

  const onAtBatDone = useCallback(() => {
    setLoading(false)
    setLastRoll(null)
  }, [])

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <pre className="font-mono text-green-400">LOADING...</pre>
      </div>
    )
  }

  if (!gameState) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center gap-4">
        <pre className="font-mono text-green-400 text-xl">{`⚾  PLAYBALL.EXE  ⚾`}</pre>
        {error && <pre className="font-mono text-red-400 text-sm">{error}</pre>}
        <button
          onClick={startGame}
          disabled={starting}
          className="border border-green-400 text-green-400 font-mono px-8 py-3 text-sm hover:bg-green-400 hover:text-black disabled:opacity-50"
        >
          {starting ? '  STARTING GAME...  ' : '  NEW GAME  '}
        </button>
        <button
          onClick={() => router.push('/stats')}
          className="font-mono text-xs text-green-600 hover:text-green-400"
        >
          VIEW ROSTER + STATS -&gt;
        </button>
        <button
          onClick={() => signOut({ callbackUrl: '/' })}
          className="font-mono text-xs text-green-600 hover:text-green-400"
        >
          LOGOUT
        </button>
      </div>
    )
  }

  return (
    <div>
      <div className="flex justify-between p-4">
        <button
          onClick={() => router.push('/stats')}
          className="font-mono text-xs text-green-600 hover:text-green-400"
        >
          ROSTER / STATS -&gt;
        </button>
        <div className="flex gap-4">
          {gameState.status === 'completed' && (
            <button
              onClick={() => { setGameState(null); setLastCpuLog([]) }}
              className="font-mono text-xs text-green-600 hover:text-green-400"
            >
              NEW GAME
            </button>
          )}
          <button
            onClick={() => signOut({ callbackUrl: '/' })}
            className="font-mono text-xs text-green-600 hover:text-green-400"
          >
            LOGOUT
          </button>
        </div>
      </div>

      {loading ? (
        <AtBatScreen
          batter={gameState.currentBatter}
          lastRoll={lastRoll}
          onDone={onAtBatDone}
        />
      ) : (
        <AsciiBoard
          state={gameState}
          lastCpuLog={lastCpuLog}
          onAtBat={handleAtBat}
          onSimulate={handleSimulate}
          loading={loading}
          simulating={simulating}
        />
      )}

      {error && !loading && (
        <pre className="font-mono text-red-400 text-xs text-center">{error}</pre>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Run the full test suite**

```bash
npm test
```

Expected: all tests pass.

- [ ] **Step 3: Build to verify no TypeScript errors**

```bash
docker build -f deploy/Dockerfile . 2>&1 | tail -20
```

Expected: build succeeds with no TypeScript errors.

- [ ] **Step 4: Commit**

```bash
git add src/app/game/page.tsx
git commit -m "feat: render AtBatScreen with dice animation during plate appearance"
```

---

## Self-Review

**Spec coverage:**
- ✅ Full-screen takeover (Option B) — `AtBatScreen` mounts in place of `AsciiBoard` while loading
- ✅ Drama — dice flicker random values for 1.3s before landing
- ✅ Transparency — real `die1`, `die2`, `adjusted`, `net` values from API
- ✅ Stat bars for CONTACT, POWER, PITCHING with modifier labels
- ✅ Outcome reveal after dice land
- ✅ Transition back to board after 2s
- ✅ Outcome table popup with adjusted roll highlighted in yellow
- ✅ Pitching stat gap resolved — included in `lastRoll` from `cpuPitcher.pitching`
- ✅ API responds before 1.3s → animation still runs full duration (checked in interval loop)

**Type consistency:** `AtBatResult` defined in Task 2 and imported via `resolveAtBat` return type. `GameState['lastRoll']` used as prop type in `AtBatScreen` — consistent with Task 3 definition. `onDone` / `onAtBatDone` named consistently between Tasks 4 and 5.
