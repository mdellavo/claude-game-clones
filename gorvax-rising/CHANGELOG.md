# Gorvax Rising changelog

Every change to `gorvax-rising/`, newest first, generated from the git history by `tools/changelog.mjs`.

## 2026-10-18

- **Keep each game's own text styles out of the changelog panel** `87751a2`
- **Add a per-game changelog viewable from each game's devkit menu** `1aea49a`
- **Swap Poly Pizza models into the rest of the games** `79cdae7`
  Tanks (turret still traverses), helicopter, jet, cars, harbour ships, train wagons, pines

## 2026-10-17

- **Cut render cost across the games so laptops stop throttling** `abdc745`
- **Log each fullscreen change once in the devkit** `f3b3d12`
- **Move Gorvax Rising's pause button off the touch buttons in landscape** `89b9f1c`
  On landscape phones the pause button (pinned 212px down on touch) sat on the action-button grid, and at 667x375 the full-size radar ran into it too. Below 500px of height the radar now uses the compact 84px map and pause sits in the bottom row, 20px left of the action buttons. No overlaps remain at 667x375, 844x390 or 932x430; portrait and desktop are unchanged, and tapping pause still pauses.
- **Add fullscreen, FPS counter and debug log to Gorvax Rising** `96b59f9`
  Same inline devkit as the other games. F stays the atomic-breath key, so fullscreen is in the ⋯ menu; the button sits under the radar minimap (left side in phone landscape).

## 2026-10-10

- **Link the leaderboard from every game's title screen** `cab5640`

## 2026-10-09

- **Add a shared online leaderboard and wire 24 games to it** `85aa3ce`

## 2026-09-29

- **Add Gorvax Rising, a kaiju city-destruction game** `c388248`
  A three.js game where you play a giant monster wading out of the bay to level three cities (harbour town by day, mill city at dusk, capital at night) before the military stops you.
