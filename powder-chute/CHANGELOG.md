# Powder Chute changelog

Every change to `powder-chute/`, newest first, generated from the git history by `tools/changelog.mjs`.

## 2026-10-31

- **Add per-game model credits viewable from each game's devkit menu** `7cd573c`

## 2026-10-18

- **Use the Poly Pizza dog model in Powder Chute** `80c93d3`
  The model swap set G.dog from the loaded model, but the hand-built dog was defined a few lines later and replaced it, so the dog never showed the model and its 940 KB file loaded for nothing. The swap now runs after the hand-built dog.
- **Keep the changelog's date headings bold in every game** `ae5a3e0`
- **Keep each game's own text styles out of the changelog panel** `87751a2`
- **Add a per-game changelog viewable from each game's devkit menu** `1aea49a`
- **Swap Poly Pizza models into the rest of the games** `79cdae7`
  Snowy pines, rocks, cocoa mugs, a running dog

## 2026-10-17

- **Cut render cost across the games so laptops stop throttling** `abdc745`
- **Log each fullscreen change once in the devkit** `f3b3d12`
- **Add fullscreen, FPS counter and debug log to 15 games** `d391bed`

## 2026-10-10

- **Link the leaderboard from every game's title screen** `cab5640`

## 2026-10-09

- **Add a shared online leaderboard and wire 24 games to it** `85aa3ce`

## 2026-09-26

- **Make every game playable on a phone** `67fc80a`
- **Add Powder Chute, an isometric SkiFree-style snowboarding run** `0cbc5b7`
  Endless isometric mountain with carving, ollies, spins, flips, grabs, rail grinds, slalom gates and the Abominable at 2000 m, wrapped in an early-90s desktop HUD. Rider stands across the board facing downhill, and a crash sets you back on your feet past the obstacle with a moment of invulnerability.
