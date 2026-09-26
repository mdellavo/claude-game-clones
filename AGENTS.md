# AGENTS.md

Notes for agents working in this repo. Humans are welcome to read it too.

## What this is

A collection of browser games, one per subdirectory, each a remake of or homage to an older
game. Every game is also published as an artifact on claude.ai, and `README.md` links to it.
Each game was written from a single prompt, quoted word for word in the README's Prompt column.

## Layout

```
<game>/index.html     the game (most are one self-contained file)
screenshots/          <game>-1.jpg, -2.jpg, -3.jpg — used by the README table
README.md             one table row per game: name, description, prompt, play link, screenshots
```

Five games are not single files:

| Game | Shape |
| --- | --- |
| `xcom/`, `zelda/` | Vite projects: `src/`, `npm install && npm run dev`, `npm run build` writes `dist/` |
| `radio-rally-3d/` | ES modules under `src/`, no bundler; `tools/` has a build script and headless sims |
| `tide-breaker/` | ES modules under `src/` plus `style.css`, served straight from the folder |
| `polygon-wing/` | `index.html` plus plain `core.js` and `game.js`, no modules |

`node_modules/` and `dist/` are gitignored, so a checkout of `xcom/` or `zelda/` needs
`npm install` before it runs.

## Writing a new game

Single self-contained `index.html` is the default. It keeps the repo copy and the published
artifact identical, which matters because the artifact is what people actually play.

Start every new game file with:

```html
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>Game Name</title>
```

and put `[hidden]{display:none!important}` in the CSS. claude.ai's publish wrapper supplies a
charset, a viewport meta and that `[hidden]` rule, so a file missing them still works when
published but breaks when opened locally — text lays out 980px wide on a phone, and `el.hidden`
stops hiding overlays. Both bugs have happened here.

Other constraints that come from artifact publishing:

- **Scripts** load only from `cdnjs.cloudflare.com`, `cdn.jsdelivr.net/npm/`, `unpkg.com`,
  `cdn.tailwindcss.com` and `code.jquery.com`. **Stylesheets** only from `fonts.googleapis.com`.
  Everything else is blocked silently, so inline all other CSS and JS and embed assets as data URIs.
- Most 3D games here use three.js via an import map:
  `{"imports":{"three":"https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js"}}`.
  Polygon Wing predates that and uses the r128 UMD build from cdnjs.
- `localStorage` works but can throw; wrap reads and writes in try/catch, as the high-score code does.

## Touch controls are not optional

Every game must be playable on a phone. Two patterns are in use:

- **Own controls in the page** — a thumbstick plus action buttons, shown when
  `matchMedia('(pointer: coarse)').matches`. Most 3D games do this.
- **Synthesised key events** — on-screen buttons that dispatch the `keydown`/`keyup` the game
  already listens for. Tidebreaker, X-COM and Zelda do this; it suits a game whose input layer
  you do not want to touch.

Check a change on a phone-sized viewport before calling it done, including that the controls
are visible and that nothing scrolls sideways.

## Running and testing

```sh
cd <game> && python3 -m http.server 8080      # then open http://localhost:8080
```

There is no test suite. Games are checked by driving them in headless Chrome with
`playwright-core` (installed in a scratch directory, pointed at the installed Google Chrome),
tapping through to gameplay and taking screenshots. Emulate a phone with
`{ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }`.
`radio-rally-3d/tools/` and `xcom/tools/` also have headless simulation scripts.

Watch for: JavaScript errors on load, a start button that leads to gameplay, the HUD updating,
and the player surviving a crash or wipeout without getting stuck.

## Artifacts

Each game is published at its own claude.ai URL, linked from the README's Play column.

- Republish to the **same** URL after changing a game, or the README link goes stale.
- A game with extra files (Polygon Wing) publishes them alongside the page.
- Artifacts published from an earlier session must be read before they can be republished.
  A published page is wrapped in claude.ai's own `<html><head>…<body>`; strip that wrapper
  before republishing a patched copy, or the page ends up nested inside itself.
- Sharing and the version pin live in the artifact's Share menu and can only be changed by the
  owner. A pinned older version means viewers do not see new publishes.

## Adding a game to the README

Add one row, in alphabetical order by display name, with all five columns filled in:
name and folder, description, the prompt quoted word for word in `<i>"…"</i>` (typos included,
follow-ups after `<br><br>Follow-ups:`), the claude.ai link, and three screenshots at
`width="200"`. Save screenshots as `screenshots/<game>-1.jpg` through `-3.jpg`, around
1280×720, JPEG quality 85.

## Commits

Subject line in the imperative, a body explaining what changed and why, and this trailer:

```
Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
```

Commit and push only when asked.
