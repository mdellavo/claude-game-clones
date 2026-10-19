# Porchlight changelog

Every change to `porchlight/`, newest first, generated from the git history by `tools/changelog.mjs`.

## 2026-10-19

- **Use the Poly Pizza grey alien in Porchlight** `58a2ff7`
  The aliens are now Poly by Google's "Alien" (CC-BY, credited in the README), its 2048px texture shrunk to 512 so the model ships at 87 KB. The model is one static mesh, so its arms are cut away at the shoulders and hung in the existing arm groups: they still swing while walking and the right arm still raises to aim. The aiming tip and beam now start at the model's hand. The glowing eye shells sit over the painted eyes, so they still turn green when hunting and red when aiming. If the model fails to load, the hand-built alien is used as before.

## 2026-10-18

- **Keep the changelog's date headings bold in every game** `ae5a3e0`
- **Keep each game's own text styles out of the changelog panel** `87751a2`
- **Add a per-game changelog viewable from each game's devkit menu** `1aea49a`
- **Swap Poly Pizza models into the rest of the games** `79cdae7`
  Rocks, logs, the dead pickup, a dog on the porch

## 2026-10-17

- **Cut render cost across the games so laptops stop throttling** `abdc745`
- **Log each fullscreen change once in the devkit** `f3b3d12`
- **Add fullscreen, FPS counter and debug log to the remaining 11 games** `a8bb4b7`

## 2026-10-09

- **Add a shared online leaderboard and wire 24 games to it** `85aa3ce`

## 2026-09-30

- **Add Porchlight, a night run through foggy woods to your cabin** `4f0ed0d`
  A first-person three.js game. The truck dies on a logging road and the player has to find their cabin in the fog over three nights, guided by a dog barking in stereo, a compass that jitters near anything strange, and the porch light once close.
