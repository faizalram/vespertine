# Vespertine — *Elegy of the Unremembered*

A melancholic 2.5D bullet-hell shooter for desktop and mobile browsers. Design: [`SPEC.md`](SPEC.md).

**Current milestone: M1, the Stage 1 vertical slice.** Sayo Kagari plays *Fields of Unharvested Names* from start to finish:
- enemy waves and the Crow Matron midboss
- Hoshiko Aze with 5 phases (3 Elegies), plus pre- and post-fight dialogue
- items and power, Elegy captures, extra lives, continues
- difficulty select, the stage clear screen and Sayo's first Vigil interlude

## Run

```bash
npm install
npm run dev        # http://localhost:5173 (also reachable from a phone on the same network)
npm test           # simulation unit tests
npm run build      # static build in dist/
```

## Controls

| Action | Keyboard | Gamepad | Touch |
|---|---|---|---|
| Move | Arrows / WASD | Stick / D-pad | Drag anywhere (relative) |
| Shoot | Z (hold) | A / RT | Automatic |
| Focus | Shift (hold) | LB / RB / LT | Focus button (toggle) or a second finger |
| Litany (bomb) | X | B | Litany button |
| Vigil (skill) | C | X / Y | Vigil button |
| Advance dialogue | Z / Enter | A | Tap |
| Pause | Esc / P | Start | ❚❚ |

`Ctrl` (or tapping repeatedly) fast-forwards dialogue. `` ` `` toggles stats, `M` mutes.

URL flags (for testing):
- `?midboss` / `?boss`: start at that point of Stage 1
- `?diff=0..3`: skip the difficulty screen
- `?god`: invincible
- `?debug`: stats overlay
- `?practice`: the M0 Training Effigy
- `?stress`: the 2,000-bullet stress test

During a boss fight, `1`–`5` jump to a phase.

## Layout

```
src/core      loop helpers: seeded RNG, coroutine scheduler, input
src/game      deterministic simulation (no rendering imports)
src/content   stage scripts, enemy behaviours, boss patterns and dialogue (generator coroutines)
src/render    Three.js: procedural vector atlas, instanced sprites, 3D background
src/audio     WebAudio-synthesised SFX and procedural music (placeholder)
src/ui        responsive layout, DOM HUD, dialogue, vector portraits
```
