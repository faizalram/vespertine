# Vespertine — *Elegy of the Unremembered*

A melancholic 2.5D bullet-hell shooter for desktop and mobile browsers. Design: [`SPEC.md`](SPEC.md).

**Current milestone: M0 technical prototype.** Sayo Kagari against a Training Effigy that cycles through four practice patterns and a 2,000-bullet stress test, over a 3D rice-terrace background.

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
| Pause | Esc / P | Start | ❚❚ |

Debug keys: `1`–`5` jump to a boss phase, `` ` `` toggles stats, `M` mutes.

URL flags: `?stress` (start at the stress test), `?phase=N`, `?god` (invincible), `?debug` (stats overlay).

## Layout

```
src/core      loop helpers: seeded RNG, coroutine scheduler, input
src/game      deterministic simulation (no rendering imports)
src/content   boss patterns written as generator coroutines
src/render    Three.js: procedural vector atlas, instanced sprites, 3D background
src/audio     WebAudio-synthesised SFX and procedural music (placeholder)
src/ui        responsive layout (desktop panel / portrait thumb zone), DOM HUD
```
