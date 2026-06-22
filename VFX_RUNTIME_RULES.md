# VFX Runtime Rules

Do not edit `src/VFX/*.json` when fixing runtime rendering. These files are authored presets and define intended style values.

## Arcs

- Arc shapes are generated in `src/tornadoVfx.ts` with the original WoFX arc functions: `createArcPath`, `createArcBranch`, `smoothArcPath`, and `appendRibbonPath`.
- Do not reintroduce hand-authored `aura` / `lightning` / `earth` arc banks. The preset parameters already produce those silhouettes through the WoFX formula.
- Preset JSON controls color, size, opacity, thickness, glow, blend mode, `arcCount`, `branchCount`, `arcLength`, `jaggedness`, `height`, `baseWidth`, `topWidth`, `flickerRate`, and `orbitDrift`.
- Runtime code must not generate or replace arc geometry every render frame.
- During `rebuildArcs()`, prebuild a small set of arc geometry frames from the original WoFX formula. During animation, switch between those existing frames.
- `flickerRate` advances geometry frames. For example, `flickerRate: 20` should visibly switch the line pattern about 20 times per second when `arcFlash*` timings are zero.
- `orbitDrift` rotates the existing arc meshes; it is not a replacement for geometry-frame switching.

## Performance

- Create Three.js geometries and `BufferAttribute`s during rebuild/setup, not during every frame.
- During animation, switch existing arc geometry frames instead of constructing new geometry.
- Per-frame work should be limited to cheap transforms, material opacity, visibility, and shader uniforms.
- After VFX runtime changes, run `npm run build`.
