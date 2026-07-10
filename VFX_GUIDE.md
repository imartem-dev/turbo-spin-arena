# WoFX Preset JSON Runtime Guide

This guide is the source of truth for interpreting WoFX preset JSON outside this project.
Do not change preset json files in src/VFX.
Do not infer missing behavior from the JSON alone. To reproduce a preset visually 1:1 in another Three.js project, port the runtime rules below: geometry, materials, shaders, update loop, blend modes, defaults, and per-part logic.

## 1. Runtime Contract

WoFX preset JSON describes the visual state of a multi-layer VFX instance.

It does not describe gameplay logic, spawn rules, damage, targeting, or lifetime. Those belong to the host game.

Minimal usage:

```ts
const vfx = new TornadoVfx();
const activePart = vfx.applyPreset(presetJson);
scene.add(vfx.group);

function frame(deltaTime: number, elapsedTime: number) {
  vfx.update(deltaTime, elapsedTime);
}
```

For an attached aura/effect:

```ts
player.group.add(vfx.group);
vfx.group.position.set(0, 0, 0);
```

For a spawned effect:

```ts
scene.add(vfx.group);
vfx.group.position.copy(hitPoint);
```

Important:

- The effect is invisible unless `vfx.group` is added to a scene or parent object.
- The effect is static unless `update(deltaTime, elapsedTime)` is called every frame.
- Visual parity requires the same Three.js material/shader logic, not just the same JSON.

## Runtime One-Shot Pools

| Effect | Module / class | Assets | Lifecycle and trigger | Exact frame update | Placement requirements |
| --- | --- | --- | --- | --- | --- |
| Hit | `hitVfx.ts` / `HitVfxPool` | `assets/vfx/Hit/` | Pooled directional one-shot; `spawn(position, direction, options?)` | `update(deltaTime, camera)` | Scene root; direction is interpreted on XZ |

### HitVfxPool

Pooled directional impact built from random center/ring masks, two long segments
toward the target, one short segment toward the attacker, and radial sparks.
Runtime atlases, color-gradient and dissolve masks are loaded through `ready`.
Pass elemental edges, ring/spark color, reduced motion, and optional seed through
`HitVfxSpawnOptions`; keep gameplay conditions outside this module. Texture URLs
must be built from the app `BASE_URL` so hosted builds under a subpath resolve
`assets/vfx/Hit/` correctly.

Acceptance notes:

1. Copy both `src/VFX/hitVfx.ts` and `public/assets/vfx/Hit/`.
2. Add `HitVfxPool.group` to the scene root exactly once.
3. Wait for `HitVfxPool.ready` before enabling hit spawning.
4. Call `update(deltaTime, camera)` once per rendered frame.
5. Spawn positions are world-space; directions are normalized on XZ internally.

## 2. Preset Shape

Current preset version:

```ts
type TornadoVfxPreset = {
  version: 1;
  activePart: TornadoVfxPart;
  enabled: Record<TornadoVfxPart, boolean>;
  layers: Record<TornadoVfxPart, TornadoVfxLayerConfig>;
};
```

Supported parts:

```ts
type TornadoVfxPart =
  | "tornado"
  | "shockwave"
  | "gust"
  | "dust"
  | "debris"
  | "arcs"
  | "sand";
```

There are no other supported parts in the current runtime. If a preset contains extra parts, ignore them unless the runtime has been extended.

## 3. Meaning of Top-Level Fields

### `version`

Currently must be `1`.

Use it for future migrations. For version 1, missing layer fields are filled from defaults.

### `activePart`

Editor/UI-only metadata.

It indicates which part was selected in the tuning panel when the preset was saved. It does not change rendering by itself. The runtime returns this value from `applyPreset()` so the UI can select the same row again.

If `activePart` is missing or unsupported, use `"tornado"`.

### `enabled`

Controls visibility per part.

Example:

```json
{
  "tornado": true,
  "shockwave": false,
  "gust": true,
  "dust": true,
  "debris": true,
  "arcs": false,
  "sand": false
}
```

Runtime visibility rules:

- `tornado`: `tornadoMesh.visible = enabled.tornado`
- `shockwave`: `shockwaveMesh.visible = enabled.shockwave`
- `gust`: `gustMesh.visible = enabled.gust`
- `dust`: `dustMesh.visible = enabled.dust`
- `debris`: visible only when `enabled.debris === true` and generated debris count is above 0
- `arcs`: core visible when `enabled.arcs === true`; glow visible only when `enabled.arcs === true` and `glowStrength > 0`
- `sand`: puffs and particles visible only when `enabled.sand === true` and their counts are above 0

### `layers`

Contains one config object per supported part.

For best portability, save all 7 layer objects even if some parts are disabled. The current runtime merges each layer with defaults:

```ts
config = { ...defaultLayerConfigs[part], ...(preset.layers?.[part] ?? {}) };
```

That means fields are optional in input JSON, but after loading the runtime treats every field as present.

## 4. Layer Config Type

Current full layer config:

```ts
type VfxBlendMode = "additive" | "normal" | "multiply";

type TornadoVfxLayerConfig = {
  blendMode: VfxBlendMode;

  color: string;
  accentColor: string;
  rimColor: string;

  height: number;
  baseWidth: number;
  topWidth: number;
  twist: number;
  speed: number;
  opacity: number;
  noise: number;
  intensity: number;
  rimStrength: number;
  rimPower: number;
  streakDensity: number;
  streakSharpness: number;
  waveStrength: number;
  displaceStrength: number;
  edgeSoftness: number;

  debrisCount: number;
  debrisSize: number;
  orbitRandomness: number;

  pulseStrength: number;
  ringThickness: number;

  ringFrequency: number;
  ringWidth: number;
  edgeFade: number;

  arcCount: number;
  arcLength: number;
  jaggedness: number;
  branchCount: number;
  flickerRate: number;
  orbitDrift: number;
  thickness: number;
  glowStrength: number;
  arcSmoothness: number;
  arcFlashIn: number;
  arcHold: number;
  arcFlashOut: number;
  arcRest: number;

  sandPuffCount: number;
  sandParticleCount: number;
  sandRadius: number;
  sandHeight: number;
  sandSpread: number;
  sandLifetime: number;
  sandTurbulence: number;
  sandVoronoiScale: number;
  sandVoronoiStrength: number;
  sandSoftness: number;
  sandParticleSize: number;
};
```

Colors must be CSS hex strings in `#RRGGBB` format.

## 5. Default Values

Base default for all layers:

```json
{
  "blendMode": "additive",
  "color": "#ffd94a",
  "accentColor": "#fff4a8",
  "rimColor": "#ffffff",
  "height": 2.65,
  "baseWidth": 0.24,
  "topWidth": 1.16,
  "twist": 8.4,
  "speed": 1.4,
  "opacity": 0.58,
  "noise": 1.15,
  "intensity": 1.15,
  "rimStrength": 1.4,
  "rimPower": 2.4,
  "streakDensity": 18,
  "streakSharpness": 4.4,
  "waveStrength": 0.1,
  "displaceStrength": 0.055,
  "edgeSoftness": 0.38,
  "debrisCount": 42,
  "debrisSize": 1,
  "orbitRandomness": 0.32,
  "pulseStrength": 0.08,
  "ringThickness": 0.055,
  "ringFrequency": 8,
  "ringWidth": 0.36,
  "edgeFade": 0.22,
  "arcCount": 16,
  "arcLength": 0.32,
  "jaggedness": 0.46,
  "branchCount": 2,
  "flickerRate": 12,
  "orbitDrift": 0.35,
  "thickness": 0.035,
  "glowStrength": 1.25,
  "arcSmoothness": 0.35,
  "arcFlashIn": 0.08,
  "arcHold": 0.18,
  "arcFlashOut": 0.22,
  "arcRest": 1.8,
  "sandPuffCount": 34,
  "sandParticleCount": 180,
  "sandRadius": 1.5,
  "sandHeight": 0.9,
  "sandSpread": 1.15,
  "sandLifetime": 2.4,
  "sandTurbulence": 0.75,
  "sandVoronoiScale": 6.5,
  "sandVoronoiStrength": 0.55,
  "sandSoftness": 0.42,
  "sandParticleSize": 0.035
}
```

Layer-specific defaults override the base defaults:

```ts
const defaultLayerConfigs = {
  tornado: { ...defaultConfig },

  shockwave: {
    height: 0.5,
    baseWidth: 0.12,
    topWidth: 1.35,
    twist: 8.0,
    ringFrequency: 12.0,
    ringWidth: 0.22,
    edgeFade: 0.28,
    speed: 1.35,
    opacity: 0.72,
    noise: 1.25,
    intensity: 1.55,
    rimStrength: 1.5,
    rimPower: 2.2,
    streakDensity: 22,
    streakSharpness: 6.0,
    waveStrength: 0.16,
    displaceStrength: 0.22
  },

  gust: {
    color: "#fff7c4",
    accentColor: "#ffffff",
    rimColor: "#ffffff",
    height: 2.35,
    baseWidth: 0.34,
    topWidth: 1.28,
    twist: 5.2,
    speed: 1.15,
    opacity: 0.38,
    noise: 1.35,
    streakDensity: 24,
    streakSharpness: 5.2,
    waveStrength: 0.08,
    displaceStrength: 0.035
  },

  dust: {
    color: "#f4c76a",
    accentColor: "#fff2a8",
    rimColor: "#ffffff",
    height: 0.08,
    baseWidth: 0.055,
    topWidth: 0.82,
    twist: 0,
    speed: 0.85,
    opacity: 0.32,
    noise: 0,
    pulseStrength: 0.08,
    ringThickness: 0.055
  },

  debris: {
    color: "#fff1b8",
    accentColor: "#ffffff",
    rimColor: "#ffffff",
    height: 2.4,
    baseWidth: 0.42,
    topWidth: 1.42,
    twist: 0,
    speed: 1.25,
    opacity: 0.82,
    noise: 0,
    debrisCount: 42,
    debrisSize: 1,
    orbitRandomness: 0.32
  },

  arcs: {
    color: "#b9fbff",
    accentColor: "#4ae8ff",
    rimColor: "#06151c",
    height: 0.9,
    topWidth: 1.1,
    speed: 1.0,
    opacity: 0.9,
    arcCount: 18,
    arcLength: 0.34,
    jaggedness: 0.58,
    branchCount: 2,
    flickerRate: 14,
    orbitDrift: 0.28,
    thickness: 0.026,
    glowStrength: 1.45,
    arcSmoothness: 0.45,
    arcFlashIn: 0.06,
    arcHold: 0.14,
    arcFlashOut: 0.24,
    arcRest: 1.4
  },

  sand: {
    blendMode: "normal",
    color: "#b97936",
    accentColor: "#f3d19a",
    rimColor: "#2f2118",
    height: 0.7,
    baseWidth: 0.25,
    topWidth: 1.65,
    speed: 0.75,
    opacity: 0.62,
    noise: 1.35,
    intensity: 1.0,
    sandPuffCount: 42,
    sandParticleCount: 220,
    sandRadius: 1.65,
    sandHeight: 0.85,
    sandSpread: 1.25,
    sandLifetime: 2.7,
    sandTurbulence: 0.9,
    sandVoronoiScale: 7.5,
    sandVoronoiStrength: 0.62,
    sandSoftness: 0.45,
    sandParticleSize: 0.038
  }
};
```

## 6. Required vs Optional Fields

For saved presets, write all fields for all parts.

For loading external presets:

- `version` is required.
- `enabled` is optional per part; missing values should default to the runtime defaults.
- `layers` is optional per part; missing layers should use `defaultLayerConfigs[part]`.
- fields inside a layer are optional; missing fields should be merged from defaults.

Do not treat missing numeric fields as `0`. Missing means "use default".

## 7. Zero Values

Zero is valid and intentional.

Examples:

- `opacity: 0` means invisible material.
- `speed: 0` means no time-based movement for that layer.
- `height: 0` flattens height-driven geometry.
- `topWidth: 0` or `baseWidth: 0` collapses radius-related geometry.
- `debrisCount: 0` creates no debris instances.
- `sandPuffCount: 0` creates no sand billboards.
- `sandParticleCount: 0` creates no sand point particles.
- `arcCount: 0` creates no arc paths.
- `branchCount: 0` disables arc branches.
- `glowStrength: 0` disables arc glow mesh visibility.

Clamp values only where the runtime clamps them. Do not replace zero with default.

## 8. Blend Modes

`blendMode` is interpreted as:

```ts
function applyBlendMode(material: THREE.Material, blendMode: VfxBlendMode) {
  material.transparent = true;
  if (blendMode === "normal") {
    material.blending = THREE.NormalBlending;
  } else if (blendMode === "multiply") {
    material.blending = THREE.MultiplyBlending;
  } else {
    material.blending = THREE.AdditiveBlending;
  }
  material.needsUpdate = true;
}
```

Default is `"additive"`, except `sand`, whose default is `"normal"`.

Visual parity depends heavily on blend mode. Do not ignore it.

## 9. Field Groups

### Color and material fields

- `blendMode`: Three.js blending mode.
- `color`: primary layer color.
- `accentColor`: secondary/ramp/glow color.
- `rimColor`: Fresnel/rim/edge color where supported.
- `opacity`: material alpha multiplier.
- `intensity`: brightness/detail multiplier in shaders.
- `rimStrength`: strength of rim/fresnel contribution.
- `rimPower`: exponent controlling rim falloff.
- `edgeSoftness`: alpha edge softness or streak threshold softness.

### Geometry fields

- `height`: vertical extent or y offset depending on part.
- `baseWidth`: inner/lower radius or minimum orbit radius.
- `topWidth`: outer/top radius or maximum orbit radius.
- `ringThickness`: dust torus tube thickness scale.
- `thickness`: arc ribbon thickness.
- `debrisSize`: debris instance scale multiplier.
- `sandRadius`, `sandHeight`, `sandSpread`, `sandParticleSize`: sand geometry/point layout.

### Shader texture/detail fields

- `noise`: noise strength.
- `streakDensity`: number/density of streaks/cells.
- `streakSharpness`: how hard/thin the streak mask is.
- `waveStrength`: wave/pulse/ripple displacement strength.
- `displaceStrength`: vertex or radial irregularity strength.
- `ringFrequency`, `ringWidth`, `edgeFade`: shockwave ring structure.
- `sandVoronoiScale`, `sandVoronoiStrength`, `sandSoftness`: sand puff breakup.

### Animation/timing fields

- `speed`: main time multiplier.
- `pulseStrength`: dust pulse amount.
- `orbitRandomness`: debris orbital radius randomization.
- `orbitDrift`: arcs group rotation speed.
- `flickerRate`, `arcFlashIn`, `arcHold`, `arcFlashOut`, `arcRest`: arcs flicker cycle.
- `sandLifetime`, `sandTurbulence`: sand grain animation cycle and drift.

## 10. Part Implementations

### `tornado`

Purpose: big BMS element.

Geometry:

- `THREE.CylinderGeometry(1, 1, 1, 64, 48, true)`
- translated up by `0.5` so local y runs from 0 to 1
- open-ended cylinder

Material:

- `THREE.ShaderMaterial`
- double-sided
- transparent
- depthWrite false
- blend mode from `blendMode`

Vertex shader:

- uses `uv.y` as vertical coordinate.
- radius is mixed from `baseWidth` to `topWidth`.
- twist rotates xz around y using `twist`, `speed`, and `time`.
- `waveStrength` adds pulsing.
- `displaceStrength` and `noise` add radial roughness.
- `height` scales y.

Fragment shader:

- uses UV noise plus spiral/streak mask.
- `color` and `accentColor` act like a ColorRamp.
- Fresnel/rim uses `rimColor`, `rimStrength`, `rimPower`.
- `opacity`, `edgeSoftness`, `streakDensity`, `streakSharpness`, and `intensity` shape alpha and brightness.

### `gust`

Purpose: medium BMS element; vertical air bands pulled upward.

Geometry:

- duplicate of the same cylinder geometry as `tornado`.
- slightly wider radius interpretation in shader.

Material:

- `THREE.ShaderMaterial`
- transparent, double-sided, depthWrite false
- blend mode from `blendMode`

Vertex shader:

- `height`, `baseWidth`, `topWidth` shape the wider flow.
- `twist` and `speed` rotate/scroll the flow.
- `waveStrength` and `displaceStrength` add flutter.

Fragment shader:

- UV `y` scrolls upward over time.
- `streakDensity`, `streakSharpness`, `noise`, `edgeSoftness` control vertical streak breakup.
- `color` and `accentColor` color the streaks.

### `shockwave`

Purpose: expanding/irregular ground ring.

Geometry:

- `THREE.CircleGeometry(1.45, 64)`
- rotated to lie on XZ plane.
- scaled by `topWidth`.

Material:

- `THREE.ShaderMaterial`
- transparent, double-sided, depthWrite false
- blend mode from `blendMode`

Shader:

- uses radial distance from UV center.
- `ringFrequency` controls angular/ring breakup frequency.
- `ringWidth` controls width of visible bands.
- `edgeFade` controls edge falloff.
- `speed` animates expansion/pulse.
- `noise`, `streakDensity`, `streakSharpness`, `waveStrength`, `displaceStrength` distort ring and spokes.
- `color`, `accentColor`, `rimColor`, `intensity`, `rimStrength`, `rimPower` control appearance.

### `dust`

Purpose: medium BMS ring at base.

Geometry:

- torus/ring-like mesh in current runtime as `dustMesh`.
- local y/position uses `height`.
- radius uses `topWidth`.
- thickness uses `ringThickness`.

Material:

- shader or additive material depending on runtime revision.
- blend mode from `blendMode`.

Animation:

- rotates by `speed`.
- pulses by `pulseStrength`.
- opacity from `opacity`.

### `debris`

Purpose: small BMS particles/oblong chunks orbiting tornado.

Geometry:

- `THREE.InstancedMesh`
- base geometry: small box/chunk
- max instance capacity in current runtime: 240

Generation:

```ts
const count = clamp(round(debrisCount), 0, 240);
for each debris:
  radius = lerp(baseWidth, topWidth, random()) + (random() - 0.5) * orbitRandomness;
  speed = lerp(0.55, 1.55, random()) * alternatingDirection;
  height = lerp(0.08, config.height, normalizedIndex);
  phase = random() * TAU;
  size = lerp(0.55, 1.45, random());
```

Per-frame:

```ts
angle = phase + elapsedTime * debris.speed * config.speed;
y = debris.height + sin(elapsedTime * debris.speed + phase) * 0.16;
scale = debris.size * debrisSize;
```

Material:

- `THREE.MeshBasicMaterial`
- color from `color`
- opacity from `opacity`
- blend mode from `blendMode`

### `arcs`

Purpose: jagged electric arcs/cracks around or near the tornado.

Geometry:

- generated ribbon paths, not particles.
- two meshes:
  - core mesh
  - glow mesh

Path generation:

- `arcCount`: number of main paths.
- radius is random between `baseWidth` and `topWidth`.
- `arcLength`: angular length of each path.
- `height`: vertical spread for non-ground arcs.
- `jaggedness`: random angular/radial/y jitter.
- `branchCount`: number of smaller branch paths per main arc.
- `arcSmoothness`: smoothing passes over generated paths.
- `thickness`: core ribbon width.
- `glowStrength`: glow ribbon width/opacity multiplier.

Animation:

- core and glow meshes rotate by `elapsedTime * orbitDrift`.
- flicker alpha uses:

```ts
cycleDuration = arcFlashIn + arcHold + arcFlashOut + arcRest;
cycleTime = (cycleTime + deltaTime * flickerRate) % cycleDuration;
```

Alpha:

- fades in during `arcFlashIn`.
- stays full during `arcHold`.
- fades out during `arcFlashOut`.
- remains hidden during `arcRest`.

Material:

- core color from `color`.
- glow color from `accentColor`.
- core opacity from `opacity * arcAlpha`.
- glow opacity from `opacity * glowStrength * 0.34 * arcAlpha`.
- blend mode from `blendMode`.

### `sand`

Purpose: dust/sand cloud plus fine grains.

Runtime has two sublayers:

1. `sandPuffMesh`
   - `THREE.InstancedMesh`
   - base geometry: subdivided plane billboard
   - max puff capacity: 120
   - material: `ShaderMaterial`

2. `sandParticleMesh`
   - `THREE.Points`
   - regenerated geometry when `sandParticleCount` changes
   - max recommended count from UI/runtime: 800

Puff generation:

```ts
count = clamp(round(sandPuffCount), 0, 120);
distance = sandRadius * lerp(0.12, sandSpread, random());
y = lerp(0.04, sandHeight, random());
angle = seedAngle + elapsedTime * speed * orbitFactor;
drift = sin(elapsedTime * speed * 0.7 + seed * 9.0) * sandTurbulence * 0.12;
```

Puff shader:

- uses UV radial soft edge.
- uses noise and Worley/Voronoi-style cells.
- `sandVoronoiScale`: cell scale.
- `sandVoronoiStrength`: breakup strength.
- `sandSoftness`: puff edge softness.
- `color` and `accentColor` mix dust colors.

Particle shader:

- attributes contain seeds.
- `sandLifetime` controls age loop.
- `sandRadius`, `sandHeight`, `sandSpread` control position.
- `sandTurbulence` controls wind drift.
- `sandParticleSize` controls `gl_PointSize`.
- `accentColor` colors points.
- `opacity` controls alpha.

## 11. Interpreting Presets 1:1

To reproduce visual output in another Three.js project:

1. Use the same supported `parts` list.
2. Merge missing fields with the exact defaults above.
3. Create the same geometry per part.
4. Use the same shaders and material settings.
5. Apply `blendMode`.
6. Apply `enabled` visibility.
7. Call `update(deltaTime, elapsedTime)` every frame.
8. Use the same units: local origin at effect base, y up, radii in local XZ.
9. Attach `vfx.group` to the same object if the effect should follow it.

If you only parse JSON and create approximate meshes, the result will not match. The JSON is a parameter set for the WoFX runtime, not a complete visual implementation by itself.

## 12. Minimal Loader Pseudocode

```ts
const supportedParts = ["tornado", "shockwave", "gust", "dust", "debris", "arcs", "sand"] as const;

function normalizePreset(input: Partial<TornadoVfxPreset>): TornadoVfxPreset {
  const enabled = { ...defaultEnabled };
  const layers = cloneLayerConfigs(defaultLayerConfigs);

  for (const part of supportedParts) {
    if (typeof input.enabled?.[part] === "boolean") {
      enabled[part] = input.enabled[part]!;
    }

    layers[part] = {
      ...defaultLayerConfigs[part],
      ...(input.layers?.[part] ?? {})
    };
  }

  return {
    version: 1,
    activePart: supportedParts.includes(input.activePart as any)
      ? input.activePart as TornadoVfxPart
      : "tornado",
    enabled,
    layers
  };
}

function applyPreset(input: Partial<TornadoVfxPreset>) {
  const preset = normalizePreset(input);

  for (const part of supportedParts) {
    runtime.enabled[part] = preset.enabled[part];
    runtime.configs[part] = preset.layers[part];
    runtime.applyConfig(part);
  }

  runtime.rebuildDebris();
  runtime.rebuildSand();
  runtime.rebuildArcs();
  runtime.applyVisibility();

  return preset.activePart;
}
```

## 13. Common Mistakes

- Mistake: Treating `activePart` as the only part to render.
  - Correct: render all parts where `enabled[part] === true`.

- Mistake: Ignoring disabled layers.
  - Correct: use `enabled` for visibility.

- Mistake: Treating missing numeric fields as `0`.
  - Correct: missing means default; explicit `0` means zero.

- Mistake: Ignoring `blendMode`.
  - Correct: additive/normal/multiply changes the visual strongly.

- Mistake: Loading colors but not shader uniforms.
  - Correct: update `color`, `accentColor`, and `rimColor` uniforms/material colors.

- Mistake: Reading `layers.tornado` only.
  - Correct: read every layer: `tornado`, `shockwave`, `gust`, `dust`, `debris`, `arcs`, `sand`.

- Mistake: Recreating debris/sand/arcs as random particles each frame.
  - Correct: generate deterministic states/paths from seeded random rules, then update transforms over time.

- Mistake: Expecting 1:1 output without porting shaders.
  - Correct: port shader code and update logic from `src/tornadoVfx.ts`.

## 14. Best Instruction for Another AI

Use this prompt when handing a preset to another implementation agent:

```txt
Implement the WoFX runtime, not just a JSON parser.

Use the supported parts:
tornado, shockwave, gust, dust, debris, arcs, sand.

Normalize the preset by merging each layer with WoFX defaults.
Render every enabled part.
Use activePart only as editor UI state.
Respect explicit zero values.
Apply blendMode.
Use #RRGGBB colors as Three.Color.
Port the geometry, shaders, seeded debris/arcs/sand generation, and update(deltaTime, elapsedTime) behavior from the WoFX guide.
The goal is visual parity with the original Three.js runtime.
```
