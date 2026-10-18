# Howard the Duck '86 changelog

Every change to `howard-the-duck/`, newest first, generated from the git history by `tools/changelog.mjs`.

## 2026-10-18

- **Swap Poly Pizza models into the rest of the games** `79cdae7`
  Parked cars, cabs and cruisers, trees, street lamps

## 2026-10-17

- **Cut render cost across the games so laptops stop throttling** `abdc745`
- **Log each fullscreen change once in the devkit** `f3b3d12`
- **Stop Howard the Duck's minimap covering Quack Fu in phone landscape** `01e923a`
  The compact HUD (smaller minimap, no parts list) only kicked in below 640px wide, so landscape phones got the full 190x204 map, whose panel ran to y=249 while the Quack Fu button starts at y=214 (844x390). The compact HUD now also applies below 500px of height: the map panel ends at y=174 and the left panel at 144, clear of the touch controls at 667x375, 844x390 and 932x430. The parts count stays in the panel header; portrait and desktop are unchanged.
- **Add fullscreen, FPS counter and debug log to 15 games** `d391bed`

## 2026-10-10

- **Link the leaderboard from every game's title screen** `cab5640`

## 2026-10-09

- **Add a shared online leaderboard and wire 24 games to it** `85aa3ce`

## 2026-09-26

- **Make every game playable on a phone** `67fc80a`

## 2026-09-18

- **Add Howard the Duck '86 open-world game** `585bb18`
  WebGL game based on the 1986 film: explore 1986 Cleveland, collect six spectroscope parts, avoid punks, shades and Dr. Jenning, and open a portal home to Duckworld. Adds README entry and screenshots.
