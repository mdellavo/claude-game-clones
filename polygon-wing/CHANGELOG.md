# Polygon Wing changelog

Every change to `polygon-wing/`, newest first, generated from the git history by `tools/changelog.mjs`.

## 2026-10-18

- **Keep the changelog's date headings bold in every game** `ae5a3e0`
- **Keep each game's own text styles out of the changelog panel** `87751a2`
- **Add a per-game changelog viewable from each game's devkit menu** `1aea49a`
- **Swap Poly Pizza models into the rest of the games** `79cdae7`
  Quaternius spaceships for the Lancer, wingmen and darts (r128 GLTFLoader, swapped in once loaded)

## 2026-10-17

- **Log each fullscreen change once in the devkit** `f3b3d12`
- **Keep Polygon Wing's Launch button on screen in phone landscape** `95d0533`
  On short screens the title card ran past the bottom edge, leaving Launch off-screen (at 844x390 it sat at y=502). Below 560px of height the title and end cards now tighten (smaller headings, gaps and buttons), the keyboard list is hidden on touch devices, and the screen scrolls as a fallback. Launch now sits around y=200-250 at 844x390 and 667x375; portrait and desktop are unchanged.
- **Add fullscreen, FPS counter and debug log to 15 games** `d391bed`

## 2026-10-10

- **Link the leaderboard from every game's title screen** `cab5640`

## 2026-10-09

- **Add a shared online leaderboard and wire 24 games to it** `85aa3ce`

## 2026-09-26

- **Make every game playable on a phone** `67fc80a`

## 2026-09-18

- **Initial commit: WebGL game clones with README and screenshots** `a95434d`
