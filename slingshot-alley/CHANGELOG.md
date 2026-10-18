# Slingshot Alley changelog

Every change to `slingshot-alley/`, newest first, generated from the git history by `tools/changelog.mjs`.

## 2026-10-18

- **Add a per-game changelog viewable from each game's devkit menu** `1aea49a`
- **Swap Poly Pizza models into the rest of the games** `79cdae7`
  Teddy-bear prize shelves and rubber ducks

## 2026-10-17

- **Cut render cost across the games so laptops stop throttling** `abdc745`
  Cap render scale at 1.25 (1.5 on touch) with adaptive resolution that drops further, then turns bloom off, when frames run long; three point lights instead of six; standard materials instead of clearcoat/sheen physical ones; 2x MSAA in the bloom target and none on the screen buffer it never shows; no redraws while paused and half-rate title and end screens.
- **Add Slingshot Alley, a first-person carnival balloon gallery** `bc319d8`
  Stand at the counter of a striped booth strung with bulbs and pop balloons with a slingshot: hold to draw, release to fire a pellet that arcs under gravity, with a faint guide while drawing. Three 40-second rounds bring fixed balloons on a pegboard, rows riding conveyor rails left and right, and balloons rising from the floor or bobbing up and down on poles. Gold balloons pay five times, clock balloons add time, bomb balloons cost points; combos, multi-pops and accuracy bonuses drive the score.
