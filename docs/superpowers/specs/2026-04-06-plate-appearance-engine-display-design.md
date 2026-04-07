# Plate Appearance Engine Display

**Date:** 2026-04-06  
**Status:** Approved

## Summary

When the user clicks "TAKE PLATE APPEARANCE", the board is temporarily replaced by a full-screen at-bat screen that animates the 2d6 dice roll, reveals the real dice values and modifiers from the game engine, and displays the outcome. An optional popup shows the full outcome table with the current roll highlighted.

## Goals

- **Drama:** animated dice flickering builds suspense before the result
- **Transparency:** real dice values and stat modifiers are shown, not fabricated

## API Changes

### `src/lib/game-engine.ts`

`resolveAtBat` returns an object instead of a bare `Outcome`:

```ts
export type AtBatResult = {
  outcome: Outcome
  die1: number
  die2: number
  adjusted: number
  net: number  // total modifier applied (contactBonus + powerBonus - pitcherPenalty)
}
```

### `src/app/api/game/types.ts`

`GameState` gets an optional field:

```ts
lastRoll?: {
  die1: number
  die2: number
  adjusted: number
  net: number
}
```

### `src/app/api/game/at-bat/route.ts`

The at-bat route includes `lastRoll` in its response payload, sourced from `resolveAtBat`.

## New Component: `AtBatScreen`

**File:** `src/components/AtBatScreen.tsx`

### Props

```ts
interface Props {
  batter: GameState['currentBatter']
  pitching: number          // CPU pitcher's pitching stat
  lastRoll: GameState['lastRoll']  // populated once API responds
  cpuAbbr: string
  onDone: () => void        // called after reveal animation completes
}
```

### Animation Sequence

1. **Immediately on click** — `AtBatScreen` mounts. Batter/pitcher stat bars render. Dice show `?`. "ROLLING 2d6..." label appears.
2. **Flickering (~1.3s)** — `setInterval` at 80ms swaps random 1–6 values on each die face.
3. **Land** — interval clears; real `die1`/`die2` values from `lastRoll` replace the random values. Raw roll + net modifier + adjusted total render.
4. **Outcome reveal (~700ms later)** — outcome string appears (`▸▸  SINGLE  ◂◂`).
5. **Transition (~2s later)** — `onDone()` is called; parent unmounts `AtBatScreen` and mounts `AsciiBoard` with updated game state.

If the API responds before the 1.3s flicker window ends, the real values are held until the animation completes naturally.

### Stat Bars

Each stat is rendered as a 10-character bar (`█░`) alongside its computed modifier:

```
CONTACT  8  ████████░░  [+2]
POWER    5  █████░░░░░  [+0]
PITCHING 7  ███████░░░  [-1]
```

Modifier labels use the same formulas as `game-engine.ts` (`contactBonus`, `powerBonus`, `pitcherPenalty`).

### Outcome Table Popup

A `[ ? ] outcome table` link sits at the bottom of the at-bat screen. Clicking it overlays a small ASCII table showing all 2d6 → outcome mappings. The row matching `lastRoll.adjusted` is highlighted in yellow with a `◂` marker. Clicking anywhere dismisses the overlay. Implemented with a React state boolean — no modal library.

```
╔══ 2d6 OUTCOME TABLE ══════╗
║   roll   outcome           ║
╠═══════════════════════════╣
║    2     STRIKEOUT         ║
║    ...                     ║
║  → 8     SINGLE       ◂   ║  ← highlighted
║    ...                     ║
╚═══════════════════════════╝
```

## Game Page Changes

**File:** `src/app/game/page.tsx`

- Add `lastRoll` state: `const [lastRoll, setLastRoll] = useState<GameState['lastRoll']>(null)`
- `handleAtBat` sets `lastRoll` from the API response
- Render `AtBatScreen` instead of `AsciiBoard` when `loading` is true, passing `onDone` callback that clears `loading` and `lastRoll`

## Pitching Stat Availability

The CPU pitcher's `pitching` stat is not currently in `GameState`. It needs to be added — either as a field on `cpuTeam` in `GameState`, or included directly in `lastRoll`. The simplest path: add `pitching` to `lastRoll` so `AtBatScreen` doesn't need a separate prop.

## Out of Scope

- Sound effects
- Animation for baserunner movement
- User ability to skip/speed up the animation
