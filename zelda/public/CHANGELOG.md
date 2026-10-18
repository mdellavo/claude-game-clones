# Zelda Isometric changelog

Every change to `zelda/`, newest first, generated from the git history by `tools/changelog.mjs`.

## 2026-10-18

- **Add a per-game changelog viewable from each game's devkit menu** `1aea49a`

## 2026-10-17

- **Float Zelda's status bar over a full-height scene** `19348b5`
  The 3D view started below a solid black 120px status bar. The bar is now translucent and overlays the canvas, which fills the window; the camera still frames the current room in the space below the bar, so nothing in play hides under it.
- **Cut render cost across the games so laptops stop throttling** `abdc745`
- **Log each fullscreen change once in the devkit** `f3b3d12`
- **Add fullscreen, FPS counter and debug log to the remaining 11 games** `a8bb4b7`

## 2026-09-18

- **Initial commit: WebGL game clones with README and screenshots** `a95434d`
