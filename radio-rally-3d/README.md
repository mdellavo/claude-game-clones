# R.C. Pro-Am 3D

A WebGL (three.js) take on the NES classic *R.C. Pro-Am*: race radio-controlled trucks, grab upgrades
and ammo, blast rivals with missiles and bombs, and finish in the top 3 to advance.

## Run

ES modules need to be served over HTTP:

```sh
npm install        # installs three.js locally (no CDN needed)
npm start          # python3 -m http.server 8080
```

Then open http://localhost:8080.

## Controls

| Action | Keyboard | Gamepad |
| --- | --- | --- |
| Accelerate | ↑ / W / X | A / RT |
| Brake / reverse | ↓ / S / Z | X / LT |
| Steer | ← → / A D | Left stick / D-pad |
| Fire missile | Space / C | B |
| Drop bomb | Shift / B | Y / RB |
| Camera (dynamic → classic NES view → chase) | V | LB |
| Mute / Pause | M / P | — / Select |

## Gameplay

- 6 tracks (meadow, desert, marsh, refinery, snow, night), then a faster "Round 2" loop.
- Place 4th and you lose a life; 3 lives total.
- Pickups: missiles, bombs, **Super Engine** (top speed), **Hi-Traction Tires** (grip/steering), **Turbo Battery** (acceleration).
- Collect the letters **N-I-N-T-E-N-D-O** across races to earn a Super Truck.
- Track hazards: zipper boost arrows, puddles (slow), oil slicks (spin), ramps and bumps (air).

## Code

- `src/trackgen.js` – spline track sampling, nearest-point queries, height/ramps (no three.js; runs in Node)
- `src/tracks.js` – track layouts and themes
- `src/trackmesh.js` – road, curbs, walls, scenery, ramps
- `src/car.js` – arcade truck physics and model
- `src/ai.js` – rival drivers
- `src/items.js` – pickups, hazards, missiles, bombs
- `src/fx.js`, `src/audio.js`, `src/input.js`, `src/main.js` – particles, synth audio, input, game loop/HUD

Dev checks:

```sh
npm run validate          # track layouts: overlap clearance, corner radii
node tools/sim-race.mjs   # headless 4-car AI race on every track
```
