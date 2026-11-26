# VESPERTINE — *Elegy of the Unremembered*

**Game Design & Technical Specification — v0.2 (Story Mode)**
Genre: Vertical bullet-hell shoot 'em up (danmaku), 2.5D
Platforms: Desktop web browsers + mobile web (installable PWA)
Status: Draft for review

---

## 0. One-Paragraph Pitch

The sun has hung at the edge of the world for a hundred years, frozen at dusk. Nothing ends — and so, quietly, everything is being *forgotten*. Streets, songs and people fade from memory; once no one remembers them, they rise like paper ghosts and drift toward the **Cenotaph Moon**, which swells a little with each one. No one grieves, because no one can grieve what they don't remember. Four people who still remember climb into the twilight sky to confront the one responsible, a saint who swallowed the world's grief out of love. *Vespertine* is a dense, beautiful danmaku shooter about memory, impermanence, and whether a life without pain is worth having if it's also a life without meaning.

---

## 1. Design Pillars

| # | Pillar | What it means in practice |
|---|--------|---------------------------|
| 1 | **Beautiful danger** | Bullet patterns are pretty first and deadly second. Every boss attack reads as a moving painting that you have to slip through. |
| 2 | **Four ways to survive** | Each character plays very differently: different shot, movement, special skill and risk profile. Swapping characters should feel like learning a new instrument. |
| 3 | **Gloom with a lantern in it** | The tone is melancholic and philosophical, never nihilistic. There's always one small warm light (literally amber in the palette) standing against the pale. |
| 4 | **Gameplay is the theme** | You collect fragments of forgotten people, grazing feeds memory meters, and the final choice is a real choice. Mechanics carry the story. |
| 5 | **Plays anywhere** | Works the same on a desktop keyboard and on a phone held one-handed. Mobile is a first-class target, not a port. |

### Inspirations (genre, not content)
- The Touhou Project series: vertical danmaku, named boss attack cards, character-specific shot types, pre-boss dialogue, bad and good endings, music-driven stage identity.
- Tone references: *Mushishi* (quiet melancholy), *Hollow Knight* (dignified sadness), *NieR* (philosophy delivered through play), *Mono no aware* as an aesthetic.
- Philosophy references: Camus (absurdism), the Ship of Theseus and Locke on identity, Stoic and Confucian ritual duty, Buddhist non-attachment, Schopenhauer on suffering.

All characters, setting, names and terminology are original. We do **not** reuse Touhou characters, places, music or terms (for example, our boss attacks are called **Elegies**, not "spell cards").

---

## 2. World & Story

### 2.1 Prologue (shown on first launch of Story Mode)

> In the hundredth year of the Long Dusk, the sun still has not set.
> It rests on the rim of the world like a coin on a dead man's eye — too heavy to rise, too stubborn to fall.
>
> Nothing grows old here. Nothing is born. And in every evening that never ends, something is quietly unmade:
> a street. A song. A sister's name.
>
> The forgotten do not die. They rise, pale as paper, and walk the sky road toward the Cenotaph Moon,
> which grows a little fuller with every one of them.
>
> No one weeps for them. No one can. You cannot grieve what you do not remember.
>
> Some call this a curse. Some call it mercy.
>
> Four who still remember are going to climb into the sky and ask which it is.

### 2.2 The Setting: The Vesperlands

A scattered archipelago of floating islands, paddy fields, canal towns and shrines, all lit by a permanent red-violet dusk. Its look draws loosely on East and Southeast Asian folk architecture, mixed with European gothic relics left over from a forgotten age.

**Key concepts**

| Term | Meaning |
|------|---------|
| **The Long Dusk** | 100 years ago the sun stopped at the horizon. Time still passes, but nothing *ends*: no one dies, no one ages, no day closes. |
| **The Pale** | The fading. Things that are no longer remembered lose their colour, then their outline, then their existence. Forgotten objects leave white silhouettes behind. |
| **Paperwraiths** | Forgotten people. Blank-faced, drifting, harmless and sad. They rise along the **Procession Road** toward the moon. (Hostile variants serve as enemies.) |
| **The Cenotaph Moon** | A huge pale moon built from everything forgotten. A cenotaph is a tomb for someone whose body lies elsewhere: the moon is a monument to the unremembered. |
| **Recollections** | Shards of forgotten memory that can still be caught before they fade. These are the game's collectible lore. |
| **Elegies** | Named boss attacks: the bosses' own songs of mourning, made into bullets. |
| **Litanies** | Player bombs: prayers spoken aloud against the dark. |

### 2.3 The Central Truth (revealed over the story)

A century ago, during a plague, a young shrine maiden named **Amari** watched her whole village die. At the altar of a small, kind god called **the Ember Who Listens**, she prayed:

> *"Let no one ever grieve as I grieve."*

The god granted it, and the wish consumed both of them. Amari became **Amaranth, the Saint Who Swallowed Grief**. To make sure no one would ever grieve again, she did two things:

1. **She stopped the sun at dusk.** If nothing ends, nothing can be lost.
2. **She takes away whatever has already been lost**, so that no one is left to mourn it.

But everything is lost eventually. Every person, place and love is *grief waiting to happen*. So her mercy slowly spreads to everything. She isn't a villain: she's exhausted, holding a hundred years of the world's sorrow inside her, and convinced that she's being kind.

The god, the Ember Who Listens, has been almost completely forgotten. Its last remaining prayer is a single lantern at a ruined shrine, kept lit by a girl named **Sayo**.

**Central philosophical question:** *Is grief the price of love, and is that price worth paying?*

The game never claims it's certain. Amaranth gets good arguments. The player decides.

### 2.4 Tone Guide

- **Melancholy, not misery.** Sadness comes from tenderness, never from gore or cruelty. No graphic violence.
- **Levity exists.** Bosses can be eccentric, cheerful or petty (a genre tradition). Humour makes the sad parts land harder.
- **Short, poetic, concrete writing.** Concrete images ("a bride's hands", "a field nobody remembers planting") beat abstract statements ("loss is sad").
- **Every boss is right about something.** Antagonists hold real philosophical positions.

---

## 3. Playable Characters

Story Mode has four protagonists. Each has her own **philosophical stance**, **story route**, **shot type**, **special skill**, **bomb (Litany)** and **endings**.

### Character overview

| | Sayo Kagari | Ilse Marrow | Tessel | Sister Wren |
|---|---|---|---|---|
| **Title** | Keeper of the Last Lantern | Cartographer of the Vanishing | The Patchwork Doll | Ferrywoman of the Empty River |
| **Stance** | Duty / ritual (Stoic, Confucian) | Absurdist revolt (Camus) | Identity (Ship of Theseus, Locke) | Letting go vs. forgetting (Buddhist non-attachment) |
| **Playstyle** | Steady, forgiving, wide coverage | Aggressive, high damage, narrow | Technical, tactical, positional | Risky, close range, high reward |
| **Difficulty** | ★☆☆ | ★★★ | ★★☆ | ★★★ |
| **Speed (unfocused / focused, px per frame)** | 4.0 / 2.0 | 5.0 / 2.2 | 4.5 / 1.8 | 4.2 / 2.0 |
| **Hitbox radius** | 2.5 | 2.0 | 2.5 | 2.0 |
| **Graze radius** | 16 | 16 | 16 | 24 |
| **Starting bombs** | 3 | 2 | 3 | 2 |
| **Deathbomb window** | 8 frames | 6 frames | 8 frames | 12 frames |
| **Accent colour** | Lantern amber | Ink blue-black + gold | Porcelain + rust | Bone white + teal |

---

### 3.1 Sayo Kagari — *Keeper of the Last Lantern*

> *"The god's gone. The dark isn't. So I keep the light."*

**Who she is.** About 17 for as long as anyone remembers (no one ages in the Long Dusk). She's the last keeper of a crumbling hilltop shrine to the Ember Who Listens, a god no one but her remembers. Every evening (which is always), she relights its lantern. She's dry, tired and quietly funny, and stubborn the way old trees are stubborn.

**Her question.** *If no one is listening, is a prayer still a prayer?*

**Her arc.** She starts out keeping the lantern out of habit and spite. She learns that her god granted the wish that caused the Long Dusk, and that her lantern is the last thread holding the god in the world. She comes to understand that the lantern was never really *for* the god. It was for whoever might be lost in the dark.

**Gameplay feel: "the steady hand."** Comfortable, forgiving and wide. The best character for learning the game.

| Element | Design |
|---|---|
| **Unfocused shot: *Will-o'-Wisps*** | 4 to 6 amber wisps (depending on power) that home in softly on the nearest enemy. Low damage per hit, very high coverage. |
| **Focused shot: *Wick Lance*** | A narrow, steady flame beam straight ahead. Good sustained damage on bosses. |
| **Skill: *Vigil*** (Skill button, Ember meter) | Plants her lantern at her current position for 5 seconds. Enemy bullets inside the 56 px radius move at **50% speed**. Meter recharges over time (about 20 s). |
| **Litany: *Litany of the Unextinguished*** | A ring of lantern light slowly expands from Sayo and cancels every bullet it passes over. Long invincibility (about 4.5 s). Moderate damage. |
| **Passive: *Patient Flame*** | While focused and not moving, Wick Lance damage slowly rises (up to +20%). Rewards calm positioning. |

---

### 3.2 Ilse Marrow — *Cartographer of the Vanishing*

> *"Every map I've ever drawn has gone blank. So I draw faster."*

**Who she is.** A brash, sardonic sky-witch who rides a drafting compass the size of a broom. She races the Pale, inking places into her atlas moments before they fade, even though her maps fade with them. She's loud, quick and funny, and she is secretly terrified.

**Her question.** *If everything I make will be erased, why make anything?*

**Her secret.** There is one map she can't draw: her own hometown. She has already forgotten it, and she doesn't know its name.

**Her arc.** She starts with defiance as a way of not looking at the problem. She ends with *joyful revolt*: accepting that the map will go blank and drawing it anyway, because the drawing was the point. (Camus: *"One must imagine Sisyphus happy."* Ilse: *"One must imagine the cartographer smug."*)

**Gameplay feel: "the glass cannon."** Fast, aggressive, the highest damage, and punishing if misplayed.

| Element | Design |
|---|---|
| **Unfocused shot: *Ink Meridians*** | Three straight lines of ink that pierce through enemies. Narrow but powerful. |
| **Focused shot: *Survey Ray*** | A thin laser. Enemies it hits become **Charted** for 3 s. |
| **Passive: *Charted*** | Charted enemies take **+25% damage** from all sources. |
| **Skill: *Survey Pins*** (Skill button) | Places a pin at her position (up to 3). Pins connect into lines of ink that **damage enemies** that cross them. A 4th pin replaces the oldest. Pin cooldown about 1.5 s. Lets you build kill zones. |
| **Litany: *Litany of Blank Margins*** | The screen whitens like an erased page. All bullets are deleted, with heavy damage. Short invincibility (about 2.5 s), so it's riskier. |

---

### 3.3 Tessel — *The Patchwork Doll*

> *"My left hand remembers a wedding. My right hand remembers a war. I remember neither. Is that strange?"*

**Who she is.** An automaton put together by an unknown dollmaker from objects the forgotten left behind: a dead girl's glass eye, a soldier's music-box heart, a bride's hands. Each part carries leftover memories that aren't hers. She's polite, curious and literal in a way that's gently unsettling. She refers to her body parts by their original owners.

**Her question.** *If I am made of their memories, am I someone, or am I a grave?*

**Her arc.** Amaranth offers to "give the parts back to the quiet" and free Tessel of the dead. Tessel comes to understand that she's a memorial that walks, and that identity isn't what you're made of but what you do with what you inherit.

**Gameplay feel: "the tactician."** Positional, technical, with a defensive toolkit for clever play.

| Element | Design |
|---|---|
| **Familiars: *Spare Dolls*** | Two small dolls orbit Tessel and fire alongside her. |
| **Unfocused shot: *Fan Formation*** | Dolls spread wide and fire angled needles, giving wide coverage. |
| **Focused shot: *Guard Formation*** | Dolls move in front of Tessel and fire straight. Each doll **absorbs up to 6 small bullets**, then cracks for 4 s. |
| **Skill: *Rewind*** (Gear meter) | Returns Tessel to **where she was 1.5 s ago**, leaving a fading afterimage behind, with 20 frames of invincibility on arrival. The Gear meter fills by dealing damage. Bullets don't rewind: only she does. |
| **Litany: *Litany of Spare Parts*** | Dozens of tiny dolls burst outward and self-destruct, cancelling bullets in waves. Medium invincibility (about 3.5 s). |

---

### 3.4 Sister Wren — *Ferrywoman of the Empty River*

> *"I have carried ten thousand souls across the water. Not one of them asked to forget."*

**Who she is.** A psychopomp, a guide of the dead. She ferried souls across the River of Ending until the Long Dusk stopped death, and the forgotten began drifting to the moon instead of to her boat. Her order is gone and her boat is empty. She's calm, gentle and weary, with a gallows humour. She carries a bell and a long oar-scythe.

**Her question.** *Is letting go the same as forgetting?*

**Why she matters.** She's the protagonist most tempted to agree with Amaranth: she has seen more grief than anyone. Her former mentor, **Mother Cinder**, already joined the saint.

**Her arc.** Non-attachment isn't erasure. You can only release something you have truly held. Forgetting is the opposite of letting go: it's never having to.

**Gameplay feel: "the risk dancer."** Close range, graze-driven, explosive when played boldly.

| Element | Design |
|---|---|
| **Unfocused shot: *Oar Sweep*** | Short-range scythe arcs. Damage **falls off with distance** (very strong at close range, weak far away). |
| **Focused shot: *Soul Lantern*** | A slow stream of ghost-lights that drift forward. Medium range, steady damage. |
| **Passive: *Toll*** | Wider graze radius (24). Every graze fills the **Toll meter**. |
| **Skill: *Ring the Bell*** (needs a full Toll meter) | Cancels all bullets within 96 px and turns them into **soul items** (score), then enters **Requiem** for 5 s: +50% shot damage. |
| **Litany: *Litany of the Ferry*** | A ghostly boat sails across the screen, carrying bullets away. Long invincibility (about 4 s). |

---

## 4. Story Mode Structure

### 4.1 Flow

```
Title → Story Mode → Character Select → Difficulty → Prologue (first time)
  → Stage 1 → Vigil interlude → Stage 2 → … → Stage 6 → Final Choice → Ending → Staff Roll
```

- **6 stages** per run, each about 4 to 6 minutes. A full run is about 30 to 35 minutes.
- Each stage has a **midboss** (1 or 2 Elegies) and a **boss** (3 to 5 Elegies, plus non-Elegy attacks between them).
- **Dialogue** before every boss (portrait visual-novel style) and after every boss. It's character-specific.
- **Vigil interludes** between stages: a short monologue (3 to 5 lines) on a black screen with one flickering candle. This is where the character's private thoughts and arc develop.
- **Stage cards** open each stage with a title and a two-line poem.

### 4.2 Difficulty

| Difficulty | Name | Notes |
|---|---|---|
| 1 | **Gentle** | For newcomers. Slower and sparser bullets, more lives. Story is complete; endings are available. |
| 2 | **Dusk** | Standard. |
| 3 | **Midnight** | Hard. |
| 4 | **Requiem** | Expert. Unlocked after any Good End. |

Patterns scale through per-difficulty parameter tables (bullet count, speed, fire rate, density), not by writing separate patterns from scratch. Some Elegies get exclusive variants on Midnight and Requiem.

### 4.3 Stage Overview

| # | Stage | Location | Midboss | Boss | Theme |
|---|---|---|---|---|---|
| 1 | **Fields of Unharvested Names** | Terraced rice paddies where scarecrows wear the faces of forgotten farmers | Crow Matron | **Hoshiko Aze**, the Scarecrow Who Stayed | Work without purpose; the dignity of continuing |
| 2 | **The Drowned Lantern Market** | A canal town sunk under a lake; paper lanterns float up through the water | Hoshiko (rematch, brief) | **Ondine Vesk**, Pawnbroker of Yesterdays | Treating memory as property: who owns the past? |
| 3 | **The Library of Kinder Endings** | A vast library where sad books are rewriting themselves into happy ones and turning blank | Inkmoth swarm | **Seraphine Lull**, the Archivist Who Edits | Comforting lies vs. painful truths |
| 4 | **The Silent Belfry** | A tower of bells that used to toll for the dead and now hang silent | **Kanna Bellwright**, the Bellfounder | **Rival** (another protagonist) | Two ways of living with loss collide |
| 5 | **The Procession Road** | A highway in the sky where thousands of Paperwraiths walk toward the moon | Paperwraith Choir | **Mother Cinder**, Abbess of Ash | Mercy that has become control |
| 6 | **The Cenotaph Moon** | The moon's surface: a landscape built from forgotten things (shoes, swings, letters, toys) | Echo of Amari (the girl she was) | **Amaranth**, the Saint Who Swallowed Grief | Is grief the price of love? |

### 4.4 Stage 4 Rivals

Stage 4's boss is another protagonist, chosen by who you play. It's a philosophical argument fought as a duel. The rival uses their own shot style, turned into boss patterns.

| You play | Rival | The argument |
|---|---|---|
| Sayo | **Wren** | "You keep a candle for a corpse." / "You ferry souls and call it letting go: you just like to be needed." Duty vs. release. |
| Ilse | **Tessel** | Ilse wants to map Tessel ("you're an atlas of dead people!"); Tessel asks whether being mapped is the same as being known. |
| Tessel | **Sayo** | Tessel asks if Sayo's god is a person or a habit. Sayo asks if Tessel is a person or a collection. |
| Wren | **Ilse** | Ilse calls Wren a quitter dressed as a saint; Wren calls Ilse a coward dressed as a rebel. Both are a little right. |

After the duel the rival offers a grudging blessing, and one line from them comes back in that character's ending.

---

## 5. Bosses & Elegies

Every boss has a short personality brief, their philosophical position, and their Elegies (Dusk difficulty names shown). The Elegy format is: **Category Elegy "Poetic Name"**.

### Stage 1: Hoshiko Aze, *the Scarecrow Who Stayed*
A cheerful, straw-stuffed girl who guards a rice field no one remembers planting, for a village no one remembers living in. She works every day anyway. *"Somebody planted it. That's enough for me."* An early mirror for Sayo's devotion and Ilse's futility.
- Harvest Elegy **"Grain That Was Never Sown"**: golden rice-grain bullets in spiralling sheaves.
- Field Elegy **"Crows Who Forgot the Way Home"**: crow familiars circle, losing their formation as the attack continues.
- Scarecrow Elegy **"Standing Guard Over Nothing"**: Hoshiko stands still while rings close in on an empty centre. Survival-focused.

### Stage 2: Ondine Vesk, *Pawnbroker of Yesterdays*
A jolly, gold-toothed merchant who buys people's memories *just before* they fade, "to keep them safe, for a modest fee." Comedic and greedy on the surface; in reality, her vaults are the most complete record of the forgotten world. *"Grief is just love with poor liquidity."*
- Ledger Elegy **"Interest Compounded in Regret"**: bullet counts grow geometrically with each wave.
- Lantern Elegy **"Prices Written on Water"**: lanterns rise from below and burst into ripples.
- Pawn Elegy **"Your First Memory, Resold"**: replays a slowed version of the *player's own* earlier movement as a bullet trail.

### Stage 3: Seraphine Lull, *the Archivist Who Edits*
A soft-spoken, kind librarian who rewrites sad stories into happy ones, without realising the books go blank afterward. *"Why let a story hurt you when I can make it gentle?"* The comforting-lie argument, in its purest form.
- Index Elegy **"Footnotes to a Forgotten War"**: dense columns of tiny text-shaped bullets.
- Redaction Elegy **"Black Bars Across the Sky"**: horizontal lasers black out lanes of the screen.
- Revision Elegy **"The Happy Ending You Were Promised"**: forms a lovely, calm flower pattern, which then slowly turns lethal.

### Stage 4 midboss: Kanna Bellwright, *the Bellfounder*
Casts bells that used to ring for every death. With no deaths, they're silent. She has kept casting bells for a century. Brief but heartfelt.
- Bell Elegy **"A Toll for No One"**: expanding sound-ring bullets that pulse in rhythm with the music.

### Stage 5: Mother Cinder, *Abbess of Ash*
Wren's former mentor. A towering, serene nun who believes Amaranth's mercy is the most compassionate act in history, and who has quietly stopped asking whether the forgotten *want* it. *"I have ferried enough weeping. Let the world sleep."*
- Procession Elegy **"Ten Thousand Shoes, No Feet"**: lines of marching bullets stream down the screen like a crowd.
- Ash Elegy **"Cremation of Unspoken Names"**: bullets burn into ash particles that drift and re-ignite.
- Mercy Elegy **"Sleep, Child, It Was Never Yours"**: the screen dims; bullets are faint and slow, and hard to see. A lullaby you have to fight through.

### Stage 6: Amaranth, *the Saint Who Swallowed Grief*
Sad, gentle and immensely powerful. She speaks softly and never raises her voice. She's crying the whole fight, and her bullets are her tears, her memories and her lost village. She has 8 Elegies, getting more personal as the fight goes on.
1. Saint's Elegy **"Plague Summer"**: the season she lost everyone.
2. Moon Elegy **"Cenotaph"**: falling pale monuments.
3. Dusk Elegy **"The Sun That Would Not Set"**: a huge red sun bullet hangs above, shedding rays.
4. Village Elegy **"Forty-Two Names"**: 42 waves, one for each villager she lost. Each wave is small and different.
5. Memory Elegy **"Everything You Love Is Already Leaving"**: bullets drift *away* from the player and loop back.
6. Mercy Elegy **"Gentle Endings"**: personal to each character (see §6).
7. ⟶ **THE FINAL CHOICE** (see §6.2)
8. Last Elegy **"Elegy of the Unremembered"**: only if the player refuses. A 60-second survival phase. The screen fills with Recollection fragments the player has collected, turned into bullets. *The more you remembered, the more beautiful and dense it gets.*

---

## 6. Narrative Systems

### 6.1 Sample Dialogue

**Stage 1 — Sayo meets Hoshiko**

> **HOSHIKO:** Oh! A visitor! Nobody visits. Are you here to buy rice? There's lots. Nobody eats it.
> **SAYO:** Who planted all this?
> **HOSHIKO:** No idea! Somebody with very strong arms, I think.
> **SAYO:** And you just… guard it. For no one.
> **HOSHIKO:** You say that like it's sad. Somebody planted it. That's enough for me.
> **SAYO:** …I know someone like that. She's very annoying.
> **HOSHIKO:** Is she pretty?
> **SAYO:** Get out of my way, scarecrow.

**Stage 6 — Amaranth's question, by character**

| Character | Amaranth asks | Choice A (Accept) | Choice B (Refuse) |
|---|---|---|---|
| Sayo | *"Your god is a candle no one prays to. Let it go out. Let it rest. Would you deny it rest?"* | Lower the lantern | Keep it lit |
| Ilse | *"You draw maps of what is already gone. Give me the pen. Aren't you tired, little cartographer?"* | Close the atlas | Turn the page |
| Tessel | *"You are made of the dead. Let me give them back to the quiet. Wouldn't you like to be only yourself?"* | Return the parts | "This is myself." |
| Wren | *"You know what grief weighs better than anyone. I carry it so no one else has to. Help me carry it."* | Take her hand | Take up the oar |

### 6.2 The Final Choice

Before the last Elegy, the game pauses on a still image of Amaranth holding out her hand. Two options appear, **with no timer**. This is a real choice, and neither option is labelled "wrong."

- **Accept:** The fight ends. The character is gently relieved of what she carries. → **Quiet End**
- **Refuse:** Final Elegy "Elegy of the Unremembered" begins. → **Good End** (no continues used) or **Bad End** (continues used)

### 6.3 Endings

Each character has 3 endings. There's also one **True End** shared by everyone. That makes **13 endings**.

| Ending | Condition | Character-specific example (Sayo) |
|---|---|---|
| **Quiet End** | Accept Amaranth's offer | The lantern goes out. Sayo sleeps in the shrine, peaceful, and wakes not knowing why there's a lantern there. She thinks it's pretty. She doesn't light it. Bittersweet, haunting and not "bad." |
| **Bad End** | Refuse, but used a continue | Amaranth is driven back but not reached. Sayo returns home with the lantern still lit, but she can't remember the name of the god it's for. She keeps lighting it anyway. |
| **Good End** | Refuse, no continues | Amaranth hears the god's name in Sayo's prayer and remembers she was once a girl who prayed. The fading stops. The sun doesn't set yet, but it trembles. |
| **True End: "The First Sunset"** | Unlocked after all four Good Ends | A final epilogue stage (Stage 6, alternate). All four protagonists ascend together. With four people remembering the Ember Who Listens, the god can finally undo the wish. Amaranth sets down a century of grief, and the people of the Vesperlands mourn it together, for the first time. **The sun sets.** Night falls. In the morning, things begin to end again, and so they begin to matter again. |

Endings are a short sequence of illustrated panels with text, followed by the staff roll. Each character's Good End includes one line from her Stage 4 rival.

**Rule of design:** a continue doesn't punish you with a worse story. It gives you a *different poem*. Still, the Good End must be earned, following genre tradition.

**Gentle exception (decided):** on Gentle difficulty, a run that uses **at most 1 continue** still reaches the Good End. Two or more continues lead to the Bad End. On Dusk and above, any continue leads to the Bad End.

### 6.4 Vigil Interludes (sample)

After Stage 3, **Ilse**:
> *There was a bakery on Thistle Street. I drew it on Tuesday.*
> *It's gone now. So is the page.*
> *I don't remember what the bread smelled like.*
> *But I remember that I drew it. That has to count. It has to.*

After Stage 5, **Wren**:
> *Mother Cinder taught me to row.*
> *She said: "Hold the oar loosely. Hold the soul gently. Hold nothing forever."*
> *She forgot the second part.*

### 6.5 Recollections (collectible codex)

- Every stage hides **10 Recollections** (60 in total). They drop from named **Remnant** enemies (pale, slow and easy to miss) and sometimes appear during boss fights.
- Each one is a single sentence: the last trace of someone forgotten.
  - *"A woman named Teru taught her son to whistle. Neither of them remembers now."*
  - *"There was a dog who waited at the pier every evening. The pier is gone. The dog is still waiting."*
  - *"Someone carved two initials into this bench. One of them was loved very much."*
- Collected Recollections stay in a **Codex** menu across runs.
- **Gameplay tie-in:** collected Recollections become the bullets of the final Elegy, and they add a small score multiplier.
- Collecting all 60 unlocks a final codex entry: Amari's original prayer, in her own handwriting.

---

## 7. Core Gameplay Systems

### 7.1 Controls

| Action | Keyboard | Gamepad | Mobile (touch) |
|---|---|---|---|
| Move | Arrows / WASD | Left stick / D-pad | **Relative drag** anywhere (the ship moves by your finger's movement, not to your finger's position) |
| Shoot | Z (hold) / auto-fire toggle | A / RT | **Always auto-fire** |
| Focus (slow + show hitbox) | Shift (hold) | RB / LT | Focus button, **or** hold a second finger anywhere |
| Litany (bomb) | X | B | Bomb button |
| Skill | C | X / Y | Skill button |
| Pause | Esc | Start | Pause icon (top corner) / automatic on app background |
| Advance dialogue | Z / Enter | A | Tap |

Mobile touch details:
- **Relative drag with adjustable sensitivity** (0.8× to 2.0×), so your finger never covers the ship.
- Buttons are placed in the **space below the playfield** on portrait phones (see §8.2), so thumbs never cover bullets.
- Button layout can be mirrored for left-handed play.
- Haptic feedback on hit, graze milestones and bombs (`navigator.vibrate`, where supported).

### 7.2 Player Resources

| Resource | Name | Notes |
|---|---|---|
| Lives | **Candles** | Start with 3 (Gentle: 5). Extra candles from score thresholds and Candle Fragments (5 fragments = 1 candle). |
| Bombs | **Litanies** | Restored to the character's default on death. Fragments come from Elegy captures. |
| Power | **Ember** | 1.00 to 4.00. Shot strength increases in steps at 2, 3 and 4. Lose 0.50 on death; power items scatter. |
| Graze | **Graze** | Bullets passing within the graze radius. Adds to score and raises point item value. Feeds Wren's Toll meter. |
| Skill meter | (per character) | Ember / pins / Gear / Toll, as described in §3. |

### 7.3 Items

| Item | Look | Effect |
|---|---|---|
| Power | Small red-amber flame | +0.01 power (large version +0.10) |
| Point | Small blue paper slip | Score; worth more when collected higher up the screen |
| Recollection | White shard with a faint glow | Codex entry and multiplier |
| Candle Fragment | Pink-violet flame | 5 = extra life |
| Litany Fragment | Green prayer strip | 3 = extra bomb |
| Soul | Teal wisp | Score (from Wren's bell, and from bullet cancels) |

**Auto-collect line:** moving above 25% of the screen height pulls in every item on screen. Defeating a boss or capturing an Elegy also auto-collects.

### 7.4 Elegy Capture

An Elegy is **captured** if it's cleared without dying or bombing. Captures give a score bonus and a Litany Fragment, and are recorded in the Elegy History (attempts and captures, per difficulty and character).

### 7.5 Scoring (brief)

`score = enemy kills + point items × point value + graze × 10 + Elegy capture bonuses + stage clear bonus`
- Point value starts at 10,000 and rises with graze and Recollections.
- High scores are saved per character × difficulty.
- Scoring depth matters less than in classic shmups for this first milestone; it mainly needs to be readable and satisfying.

### 7.6 Collision & Fairness Rules

- The player's hitbox is a **tiny circle** (2 to 2.5 px), much smaller than the sprite. It's shown as a glowing dot while focused.
- Bullet hitboxes are **smaller than their sprites** (about 60 to 70% of the visible radius).
- Bullets get a **spawn grace** period: harmless and semi-transparent for the first 6 frames.
- **No off-screen bullets** fire straight at the player without a visible warning.
- Lasers show a thin warning line for 30+ frames before they become dangerous.
- After a death: 3 seconds of invincibility, with the player sprite flashing.

---

## 8. Presentation

### 8.1 The 2.5D Approach

Gameplay is strictly **2D on a single plane**: everything that can hit the player is a flat sprite in a 2D playfield. The **world around it is 3D**:

- **3D backgrounds** with perspective, scrolling toward or under the camera (for example, flying over rice terraces, gliding along canal water, rising through the belfry shaft).
- **Camera moments**: the background camera tilts, rolls or pulls back at boss entrances, Elegy declarations and stage transitions. Gameplay stays flat and readable throughout.
- **Billboarded depth layers**: lanterns, paper wraiths and falling petals at different depths add parallax.
- **Elegy backgrounds**: each Elegy swaps in a distinct shader-based backdrop behind the playfield (for example, a red sun, falling ash, rippling ink).
- **Light**: bullets are additive, glowing sprites. An optional bloom pass (turned off on low-end devices).

This is the standard approach for modern danmaku: depth for atmosphere, flatness for fairness.

### 8.2 Screen Layout

The logical playfield is **384 × 448** (aspect 6:7), rendered at integer or high-DPI scale.

**Desktop / landscape:**
```
┌──────────────────────────────────────────────┐
│          ┌──────────────┐  VESPERTINE        │
│          │              │  Hi-Score 12,450,000│
│          │  PLAYFIELD   │  Score     3,201,880│
│          │  384 × 448   │  Candles   ● ● ●    │
│          │              │  Litanies  ✦ ✦      │
│          │              │  Ember     3.25     │
│          │              │  Graze     1,204    │
│          │              │  Toll  ▓▓▓▓▓░░░     │
│          └──────────────┘  Recollections 4/10│
└──────────────────────────────────────────────┘
```

**Mobile / portrait (primary mobile layout):**
```
┌──────────────────────┐
│ 3,201,880  ●●●  ✦✦ ⏸ │  ← compact HUD strip
├──────────────────────┤
│                      │
│      PLAYFIELD       │  ← full width
│      (6:7)           │
│                      │
├──────────────────────┤
│ ▓▓▓▓░░ Toll   3.25   │  ← meter strip
│                      │
│  [FOCUS]   [SKILL]   │  ← thumb zone: buttons +
│        [BOMB]        │     relative-drag area
└──────────────────────┘
```
On a 9:16 or taller phone, the 6:7 playfield at full width leaves about 30% of the screen below it. That space becomes the control and drag area, so **thumbs never cover the playfield**. This is a key mobile advantage of using a vertical shooter.

Mobile landscape is supported using the desktop layout, with controls overlaid on the side panels.

### 8.3 Art Direction

- **Palette:** desaturated twilight (indigo, violet, ash grey, dusty rose), with **amber as the single warm "hope" colour** (lanterns, Sayo, Ember items). The Pale is shown as colour draining toward paper white.
- **Bullet readability above everything else:** bullets are saturated and glowing with dark outlines. Backgrounds are kept at lower contrast and saturation and are slightly blurred during dense phases.
- **Art style (decided): stylised vector.** Everything is drawn from code or SVG: flat shapes, clean silhouettes, limited palettes, soft glows. No hand-painted raster art is required.
  - **Characters:** iconic vector silhouettes with one strong accent colour and a signature prop (Sayo's lantern, Ilse's compass, Tessel's mismatched eyes, Wren's bell and oar). Dialogue portraits are flat vector busts (paper-cut style) with 4 to 6 expression variants made by swapping eye and mouth shapes.
  - **Bullets & effects:** procedurally generated textures (rice grains, orbs, petals, paper slips, ink drops) drawn to a canvas atlas at boot, so no image files are needed.
  - **Backgrounds:** low-poly 3D geometry with flat shading, fog and gradient skies (Three.js).
- **UI:** thin serif typography, candle and paper motifs, ink-stain transitions.

### 8.4 Audio

- **Music:** a melodic, emotional style with a strong lead melody (piano, erhu or violin, flute) over driving rhythm and synth. Every stage and every boss has its own named theme (for example, Stage 1: *"Rice Grows for Nobody"*; Amaranth: *"Requiem for a Saint Who Wanted Everyone to Be Happy"*).
- A **Music Room** unlock with composer's notes for each track (genre tradition).
- **SFX:** soft, satisfying shot sounds (avoid loud, harsh fire loops: they're tiring on phones), a distinct graze "tick", a bell for Elegy declarations, and paper-tearing sounds for enemy deaths.
- **Decided: placeholder sound for the first release.** All SFX are synthesised at runtime with WebAudio (no audio files). Music is a simple procedural loop per stage (pad, bass and an arpeggiated lead in a minor key). The audio module keeps an interface that can later play real tracks with intro and loop points, so a real soundtrack can drop in without code changes.

---

## 9. Screens & UX Flow

1. **Boot / Title**: animated dusk sky with a slowly drifting moon. Menu: Story Mode, Codex, Settings (later: Extra, Practice, Music Room, Replays).
2. **Character Select**: four characters with a portrait, a quote, the stance in one line, a difficulty rating, and a looping gameplay preview of her shot.
3. **Difficulty Select**
4. **Prologue** (first time only; can be skipped)
5. **Stage Card**: stage title and poem
6. **Gameplay** (HUD as in §8.2)
7. **Dialogue**: portraits slide in, text box with a typewriter effect. Tap or press to advance, hold to fast-forward, with an auto mode.
8. **Pause**: Resume / Restart stage / Settings / Quit to title
9. **Continue Screen**: *"The candle gutters. Will you remember?"* Continue (credits left) / Give up. Shows a note: "Continuing leads to a different ending."
10. **Vigil Interlude**
11. **Final Choice**
12. **Ending → Staff Roll → Results** (score, captures, Recollections found)
13. **Codex**: Recollections, character bios (unlocked through play), Elegy History, endings seen
14. **Settings**: volume (music/SFX), touch sensitivity, button layout and size, mirror controls, haptics, show hitbox always, reduce flashing, screen shake on/off, background detail (Low/Med/High/Auto), bloom on/off, text speed

### Accessibility
- **Reduce flashing** mode (limits full-screen flashes; required for Litanies and Elegy declarations).
- **Always-visible hitbox** option.
- **Background dimming** slider.
- **Bullet outline thickness** option and a colourblind-friendly bullet palette.
- **Gentle** difficulty sees the complete story.
- **Game speed** option (75% / 90% / 100%). Runs on a reduced speed are marked and don't count for high scores.

---

## 10. Technical Specification

### 10.1 Stack

| Concern | Choice | Reason |
|---|---|---|
| Language | **TypeScript** (strict) | Safety in a large codebase of patterns and scripts |
| Build | **Vite** | Fast development, simple static output |
| Rendering | **Three.js** (WebGL2) | 3D backgrounds, cameras, shaders, plus instanced 2D sprites in one pipeline |
| UI | DOM/CSS overlay for menus and dialogue; canvas HUD during play | Crisp text, easy layout, accessibility |
| Audio | Native **Web Audio API** | Low latency, seamless music loops with intros |
| PWA | `vite-plugin-pwa` (Workbox) | Install to home screen, offline play, asset caching |
| Storage | `localStorage` (settings), **IndexedDB** (saves, codex, scores) | Persistent, offline |
| Tests | **Vitest** (logic, determinism), **Playwright** (smoke tests and screenshots) | |
| Hosting | Any static host (GitHub Pages, Cloudflare Pages, Netlify) | No backend needed for Story Mode |

### 10.2 Architecture

```
src/
  main.ts                 boot, PWA registration
  core/
    loop.ts               fixed 60 Hz simulation + interpolated rendering
    rng.ts                seeded PRNG (deterministic: makes replays possible later)
    input/                keyboard, gamepad, touch → unified InputState per frame
    scheduler.ts          coroutine runner (generator-based scripting)
  game/
    world.ts              entity storage, update order
    player/               base player + sayo.ts, ilse.ts, tessel.ts, wren.ts
    bullets/              pooled bullet system (struct-of-arrays), shapes, movers
    enemies/              enemy types, movement paths
    bosses/               boss controller, phase/Elegy manager, HP bars, timers
    items.ts
    collision.ts
    scoring.ts
  content/
    stages/stage1.ts …    stage scripts (generator functions)
    elegies/              attack patterns per boss
    dialogue/*.ts         dialogue per character × stage (English text)
    recollections.json
    endings/
    difficulty.ts         parameter tables
  render/
    renderer.ts           layered composition
    background/           per-stage 3D scenes + Elegy shader backdrops
    sprites.ts            instanced sprite batches (bullets, items, enemies)
    effects.ts            particles, screen flashes, bloom
  ui/                     title, select, HUD, dialogue, pause, codex, settings
  audio/                  music player (intro + loop points), SFX bank
  save/                   IndexedDB wrapper, schema migrations
```

### 10.3 The Simulation Loop

- **Fixed timestep at 60 Hz**: the game logic always steps in 1/60 s ticks, matching the genre's frame-based design. Rendering interpolates between ticks on 90/120 Hz displays.
- If a device falls behind, run at most 2 catch-up ticks per rendered frame, then **slow down** rather than skip ahead (the genre convention, and it's fairer than teleporting bullets).
- All randomness goes through a **seeded RNG**, and input is sampled once per tick. That makes runs deterministic, so replays are possible later without redesign.

### 10.4 Scripting Model (generator coroutines)

Stages and attacks are written as TypeScript generator functions. That makes timing readable, like a script:

```ts
// content/stages/stage1.ts
export function* stage1(s: StageCtx) {
  yield* s.wait(60);
  for (let i = 0; i < 8; i++) {
    s.spawn(Wisp, { x: 48 + i * 40, y: -16, path: paths.sineDown, drop: Item.Power });
    yield* s.wait(12);
  }
  yield* s.midboss(CrowMatron);
  // ...
  yield* s.dialogue('stage1.pre_boss');
  yield* s.boss(HoshikoAze);
}

// content/elegies/hoshiko.ts
export const grainNeverSown: Elegy = {
  id: 'hoshiko.grain', name: 'elegy.hoshiko.grain', hp: 1800, time: 40,
  *run(b, d) {                         // d = difficulty parameters
    let a = 0;
    while (true) {
      b.ring({ count: d.pick(12, 18, 24, 32), speed: 2.0, sprite: 'rice',
               color: 'gold', angle: a });
      a += 0.13;
      yield* b.wait(d.pick(18, 14, 10, 8));
    }
  },
};
```

### 10.5 Bullet System & Rendering Performance

- **Struct-of-arrays pools** (typed arrays for x, y, vx, vy, angle, radius, sprite, colour, flags). No allocation during gameplay, so no garbage-collection stutter.
- **Capacity:** 4,096 enemy bullets and 512 player shots. Design target: ≤ 1,500 on screen on Dusk difficulty and ≤ 2,500 at peak on Requiem.
- **Rendering:** one `InstancedMesh` per sprite atlas, with per-instance attributes for position, rotation, UV and colour. That means **one draw call for all bullets**.
- **Collision:** player-hitbox vs. bullets is an O(n) circle test per tick (cheap). Player shots vs. enemies is O(n × m) with few enemies, which is fine. Lasers use segment-to-circle tests.
- **Movers:** a small set of standard movement behaviours (linear, accelerate, curve, homing-once, orbit, wave), plus optional per-bullet script callbacks for special cases.

### 10.6 Performance Budgets

| Metric | Target |
|---|---|
| Frame rate | Steady 60 fps on mid-range phones (about 2022 Android mid-tier, iPhone 11 or newer) |
| Simulation time | < 4 ms per tick on mid-range mobile |
| Draw calls | < 40 per frame |
| Initial download | < 5 MB to reach the title screen and Stage 1 |
| Total assets | < 60 MB, lazy-loaded per stage, cached by the service worker |
| Memory | < 300 MB |

**Adaptive quality:** measure frame time during the first seconds of play. If it's over budget, automatically lower background resolution, disable bloom and reduce particle counts. Bullet logic and visibility never get reduced.

### 10.7 Mobile & PWA Requirements

- `manifest.webmanifest` with icons, `display: fullscreen`, portrait-primary orientation, theme colour.
- Service worker: precache the core; cache stage assets the first time they're played; **full offline play** once cached.
- Request the Fullscreen API and Screen Orientation lock where supported (Android). On iOS Safari, show an "Add to Home Screen" hint to get a standalone experience.
- Disable unwanted browser behaviour on the game surface: pull-to-refresh, double-tap zoom, long-press menus, text selection (`touch-action: none`, `overscroll-behavior: none`, `user-select: none`).
- **Unlock audio** on the first user tap (a browser requirement).
- **Auto-pause** on `visibilitychange` or when the app is backgrounded.
- Respect safe areas (notches, home indicator) via `env(safe-area-inset-*)`.
- Wake Lock API to stop the screen from dimming during play.

### 10.8 Save Data

```ts
interface SaveData {
  version: number;
  settings: Settings;
  progress: {
    endingsSeen: EndingId[];          // e.g. 'sayo.good', 'true'
    unlockedDifficulties: Difficulty[];
    charactersCleared: Record<CharId, Difficulty[]>;
  };
  codex: { recollections: string[]; biosUnlocked: string[] };
  elegyHistory: Record<string, { attempts: number; captures: number }>; // key: elegy|char|diff
  highScores: Record<string, ScoreEntry[]>;                             // key: char|diff
}
```
The save is versioned with migrations, and there's an export/import feature (as a JSON file) so players can back up their progress.

---

## 11. Development Roadmap

| Milestone | Scope | Exit criteria |
|---|---|---|
| **M0: Technical prototype** | Loop, input (keyboard + touch + gamepad), one player, bullet pool and renderer, one 3D scrolling background, a test pattern | 2,000 bullets at 60 fps on a mid-range phone; touch movement feels right |
| **M1: Vertical slice** | Stage 1 complete with **Sayo**: enemies, midboss, Hoshiko with 3 Elegies, dialogue, HUD, items, lives and bombs, stage card, pause, continue screen | Stage 1 is fun and readable start to finish on desktop and phone |
| **M2: The four** | Ilse, Tessel and Wren with full mechanics; character select; Stage 1 dialogue for all four | Each character feels clearly distinct in blind playtests |
| **M3: Act One** | Stages 2 and 3 with bosses, Vigil interludes, Recollections and Codex | A run from Stage 1 to 3 works for all characters |
| **M4: Act Two** | Stages 4 to 6, rivals, Mother Cinder, Amaranth, the Final Choice, 12 endings, staff roll | Story Mode can be completed with every ending reachable |
| **M5: Polish & ship** | PWA and offline, settings and accessibility, adaptive quality, audio pass, difficulty balancing, save import/export | Lighthouse PWA checks pass; full runs on iOS and Android browsers |
| **M6: True End** | "The First Sunset" epilogue | All 13 endings available |

**Future (outside this spec):** Extra Stage (post-True End story), Practice Mode, Elegy Practice, Replays (designed for already through determinism), online leaderboards, localisation, more characters.

---

## 12. Content Inventory (Story Mode)

| Item | Count |
|---|---|
| Playable characters | 4 |
| Stages | 6 (+1 alternate for the True End) |
| Bosses / midbosses | 6 bosses + 4 rival variants + 6 midbosses |
| Elegies | About 40 unique (more with difficulty variants) |
| Dialogue scenes | About 4 characters × 12 scenes ≈ 48 |
| Vigil interludes | 4 × 5 = 20 |
| Endings | 13 |
| Recollections | 60 |
| Music tracks | About 16 procedural placeholder loops (title, 6 stages, 7 bosses, ending, staff roll) |
| Portraits | 4 protagonists + 7 antagonists as vector busts, each with 4 to 6 expressions |

---

## 13. Decisions & Open Questions

### Decided (2026-11-26)
| # | Topic | Decision |
|---|---|---|
| 1 | Art | **Stylised vector**, everything generated from code/SVG (§8.3) |
| 2 | Music & SFX | **Placeholder sound**: WebAudio-synthesised SFX and procedural music loops (§8.4) |
| 3 | Continues | **Gentle allows 1 continue** and still reaches the Good End (§6.3) |
| 4 | Languages | **English only.** Text lives in plain content files; no i18n framework |

### Still open
1. **Final Choice:** keep the choice unannounced (it's more powerful) or hint at it in the Codex?
2. **Monetisation:** none (free web game) assumed. Confirm.
3. **Game title:** *Vespertine: Elegy of the Unremembered* is a working title.

---

*End of spec v0.1.*
