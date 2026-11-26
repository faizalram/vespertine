# Vespertine — *Elegy of the Unremembered*

A melancholic 2.5D bullet-hell shooter for desktop and mobile browsers. Design: [`SPEC.md`](SPEC.md).

**Current milestone: M3, Act One.** Stages 1–3 play back to back with all four heroines, each with her own mechanics, dialogue and Vigil interludes:

| Stage | Midboss | Boss |
|---|---|---|
| 1 · Fields of Unharvested Names | Crow Matron | Hoshiko Aze (5 phases) |
| 2 · The Drowned Lantern Market | Hoshiko (rematch) | Ondine Vesk, Pawnbroker of Yesterdays (5 phases) |
| 3 · The Library of Kinder Endings | The Inkmoth Swarm | Seraphine Lull, the Archivist Who Edits (5 phases, redaction lasers) |

Also: 30 collectible Recollections, a Codex (Recollections, People, Elegy History), and a motion pass with interpolated 120 Hz-smooth rendering, squash and stretch, and a dynamic 2.5D camera.

The heroines:

| Heroine | Shot | Skill (C) | Litany (X) |
|---|---|---|---|
| Sayo Kagari | homing wisps / Wick Lance | Vigil: a ward that slows bullets | expanding ring of light |
| Ilse Marrow | piercing ink / Survey Ray (marks targets for +25% damage) | Survey Pins: up to 3 pins whose ink lines cut enemies | Blank Margins: erases the page |
| Tessel | doll needles; focused, the dolls stand guard and eat bullets | Rewind: back to where she was 1.5 s ago (fills by dealing damage) | Spare Parts: a burst of exploding dolls |
| Sister Wren | short-range oar (stronger up close) / soul lanterns | Ring the Bell: bullets nearby become souls, then +50% damage (fills by grazing) | the Ferry: a ghost boat sails up the screen |

Systems: items and power, Elegy captures, extra lives, continues, character and difficulty select, stage results and Vigil interludes between stages.

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
| Skill | C | X / Y | Skill button |
| Advance dialogue | Z / Enter | A | Tap |
| Pause | Esc / P | Start | ❚❚ |

`Ctrl` (or tapping repeatedly) fast-forwards dialogue. `` ` `` toggles stats, `M` mutes.

URL flags (for testing):
- `?stage=1..3`: start at that stage
- `?midboss` / `?boss`: start at that point of the stage
- `?char=sayo|ilse|tessel|wren`: skip character select
- `?diff=0..3`: skip the difficulty screen
- `?god`: invincible
- `?debug`: stats overlay
- `?practice`: the M0 Training Effigy
- `?stress`: the 2,000-bullet stress test

During a boss fight, `1`–`5` jump to a phase.

## Art preview

With `npm run dev` running, open `/dev/sheet.html` to see every portrait expression with blink and talk frames, or `/dev/sheet.html?puppets` for the in-game puppets in each expression.

## Layout

```
src/core      loop helpers: seeded RNG, coroutine scheduler, input
src/game      deterministic simulation (no rendering imports)
src/content   stage scripts, enemy behaviours, boss patterns and dialogue (generator coroutines)
src/render    Three.js: procedural vector atlas, instanced sprites, 3D backgrounds, spring-driven puppets
src/audio     WebAudio-synthesised SFX and procedural music (placeholder)
src/ui        responsive layout, DOM HUD, dialogue, live vector portraits (ui/art: drawing kit)
```
