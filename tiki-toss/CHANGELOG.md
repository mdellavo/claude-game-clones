# Tiki Toss changelog

Every change to `tiki-toss/`, newest first, generated from the git history by `tools/changelog.mjs`.

## 2026-10-31

- **Add per-game model credits viewable from each game's devkit menu** `7cd573c`

## 2026-10-18

- **Keep the changelog's date headings bold in every game** `ae5a3e0`
- **Keep each game's own text styles out of the changelog panel** `87751a2`
- **Add a per-game changelog viewable from each game's devkit menu** `1aea49a`
- **Swap Poly Pizza models into the rest of the games** `79cdae7`
  Palms, rocks, a tiki head beside every tee

## 2026-10-17

- **Cut render cost across the games so laptops stop throttling** `abdc745`
- **Log each fullscreen change once in the devkit** `f3b3d12`
- **Add fullscreen, FPS counter and debug log to the remaining 11 games** `a8bb4b7`

## 2026-10-10

- **Link the leaderboard from every game's title screen** `cab5640`

## 2026-10-09

- **Add a shared online leaderboard and wire 24 games to it** `85aa3ce`

## 2026-10-02

- **Smooth out Tiki Toss frame pacing, aiming and the throw** `403f36a`
  Frames were hitching to 50 ms or more: every foliage batch spanned the whole island, so nothing was culled in the main or shadow pass, and the minimap and flight guide re-ran the terrain noise thousands of times a frame. Foliage is now split into culled 140 m tiles with only palms and trees casting shadows, heights come from a cached 2 m grid, the minimap is painted once per hole, the guide recomputes only when inputs change, shadows snap to texels, and resolution adapts to frame time.
- **Add Tiki Toss, arcade disc golf on a tropical island** `c8766f2`
  Nine holes around a lush jungle island with swaying palms, hibiscus, lagoons and a sparkling ocean. Aim, choose a straight or curving shot, hold to charge a power meter scaled in metres and let go; a dotted guide shows the flight. Palms in the fairways knock the disc down, water costs a stroke, and putts ring the chains to a steel-drum soundtrack. Ends with a scorecard against par and a saved best round.
