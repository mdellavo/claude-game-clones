# X-COM: Crash Site Recovery

A WebGL (three.js) take on the tactical battlescape of *UFO: Enemy Unknown* (1994), focused on UFO crash site missions. There's no Geoscape, base building or economy.

```
npm install
npm run dev      # http://localhost:5173
npm run build    # static build in dist/
npm run sim 20   # headless battle simulations (logic smoke test)
```

Open `/#quick` to jump straight into a battle.

## What's in it
- **Mission setup:** 4 UFO types (Small/Medium/Large Scout, Abductor), 4 alien races (Sectoid, Floater, Snakeman, Muton) with terror units (Cyberdisc, Reaper, Chryssalid + zombies, Silacoid), 4 terrains, day/night, 5 difficulties, and 3 equipment tiers.
- **Squad:** a persistent roster (localStorage) with classic stats, ranks, promotions and deaths. You can equip each soldier with a drag-and-drop inventory (hands, belt, backpack and so on).
- **Battlescape:**
  - Multi-level voxel map with destructible terrain, stairs and gravity lifts.
  - Fog of war, field of view, and night vision limits (electro-flares help).
  - Time units, energy, kneeling, and reserve-TU modes.
  - Snap, aimed and auto fire, with realistic projectile tracing, cover and armour facing.
  - Reaction fire, grenades (prime and throw), HE, incendiary, smoke and stun, fire spread, and exploding UFO power sources.
  - Stun rods, medi-kits, fatal wounds, morale and panic, unconscious captures, and item pickup.
- **Alien AI:** guards and patrols, shared intel, finding firing positions, taking cover, grenade use, and melee charges. Hidden movement is shown while aliens act out of sight.
- **Debriefing:** classic-style score, recovered UFO components and artifacts, and soldier fates.

## Layout
- `src/battle/`: simulation (map, mapgen, pathfinding, line of sight, combat, AI). It has no rendering dependencies.
- `src/render/`: three.js view (chunked terrain meshes with a fog-of-war shader, unit models, effects).
- `src/ui/`: screens, HUD and controller, inventory.
- `src/data/`: items, units, terrain parts, UFO blueprints.
