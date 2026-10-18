# Zenithian Chronicles changelog

Every change to `zenithian-chronicles/`, newest first, generated from the git history by `tools/changelog.mjs`.

## 2026-10-18

- **Keep each game's own text styles out of the changelog panel** `87751a2`
- **Add a per-game changelog viewable from each game's devkit menu** `1aea49a`
- **Swap Poly Pizza models into the rest of the games** `79cdae7`
  Fantasy cottages and inns in the towns

## 2026-10-17

- **Remake Zenithian Chronicles as a full-screen 2.5D three.js game** `5fc715c`
  The map was a fixed 480x320 box in a narrow column. The game now fills the window, with the top bar, party cards and touch pad floating over it, and is drawn by a three.js module that reads the existing game state each frame; the rules, menus and saves are unchanged, and the 2D canvas stays as a fallback if WebGL or the CDN is unavailable.
- **Log each fullscreen change once in the devkit** `f3b3d12`
- **Fix Zenithian Chronicles battles running rounds in parallel** `4dcfd90`
  The target list stayed clickable while a round played out on timers, so extra taps queued whole extra rounds that ran at the same time. That could wipe the party in an instant, and the stray timers kept firing after the battle ended, throwing "Cannot read properties of null".
- **Add fullscreen, FPS counter and debug log to the remaining 11 games** `a8bb4b7`

## 2026-09-26

- **Make every game playable on a phone** `67fc80a`

## 2026-09-18

- **Initial commit: WebGL game clones with README and screenshots** `a95434d`
