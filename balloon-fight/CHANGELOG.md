# Balloon Fight changelog

Every change to `balloon-fight/`, newest first, generated from the git history by `tools/changelog.mjs`.

## 2026-10-18

- **Keep the changelog's date headings bold in every game** `ae5a3e0`
- **Keep each game's own text styles out of the changelog panel** `87751a2`
- **Add a per-game changelog viewable from each game's devkit menu** `1aea49a`
- **Swap Poly Pizza models into Balloon Fight and Block Party** `1335182`
  The fliers are Quaternius's rigged platformer character, repainted per side and animated (airborne pose, run, idle) with the balloon strings tied to the forearms; a swimming clownfish; Quaternius palms, rocks, bushes, clouds and mineral clusters recut as glowing crystals; a modelled lighthouse that keeps its sweeping beam.

## 2026-10-17

- **Make Balloon Fight fill the whole screen** `74d050b`
  The 3D scene was still boxed inside the old arcade-cabinet frame at a fixed 16:9 size. The canvas now covers the viewport, with the HUD bar and touch buttons floating translucent on top, and the camera dollies in or out so the 400x225 playfield fits any aspect ratio (leaving room for the HUD, and for thumb buttons in phone landscape).
- **Remake Balloon Fight's renderer as a 2.5D three.js scene** `4a71faf`
  The 2D canvas drawing is replaced by a WebGL scene; the game logic, audio, HUD, touch controls and leaderboard are unchanged, and game coordinates map 1:1 onto the z=0 plane so play feels the same.
- **Log each fullscreen change once in the devkit** `f3b3d12`
- **Add fullscreen, FPS counter and debug log to 15 games** `d391bed`

## 2026-10-09

- **Add a shared online leaderboard and wire 24 games to it** `85aa3ce`

## 2026-09-18

- **Recover Balloon Fight source from published artifact** `ee0237b`
  The original was written to a since-cleared scratchpad; restore it from the live claude.ai artifact with the publish wrapper stripped, and drop the README note about the folder being empty.
