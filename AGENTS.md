# Project Refactoring Rule

This project is still a gameplay prototype, so do not start a broad architecture rewrite just to make the file tree look cleaner.

When you are already changing a gameplay system and that system still lives inside the large shared game file, extract only that touched system into a focused module as part of the same change.

Examples:

- If changing enemy AI and enemy AI is still inside `src/main.ts`, move that AI code into a focused file such as `src/simulation/enemyAi.ts`.
- If changing RPM combat, collision damage, zones, or critical hits and that logic is still inside `src/main.ts`, move that combat code into a focused file such as `src/simulation/combat.ts`.
- If changing spinner movement and the shared movement logic is still inside `src/main.ts`, move it into a focused file such as `src/simulation/movement.ts`.
- If changing arenas, keep arena-related code together, for example under `src/arenas/`, because the game may have multiple arenas later.
- If changing visual effects such as trails, target lines, sparks, or other runtime VFX, it is fine to keep related VFX code together under `src/VFX/` or one focused VFX module. Do not split visuals into tiny files like `playerTrail.ts`, `enemyTrail1.ts`, `enemyTrail2.ts`.

Keep refactors surgical:

- Do not move unrelated systems.
- Do not create speculative abstractions.
- Do not split code by object instance when the behavior is shared.
- Preserve the current gameplay behavior unless the user explicitly asks to change it.
- Run `npm run build` after code changes.

# Runtime Performance Rules

- Do not create Three.js `Geometry`, `BufferGeometry`, `Material`, `Texture`, `CanvasTexture`, `Sprite`, `Mesh`, `Line`, or `Canvas` during active gameplay unless explicitly approved.
- Runtime battle VFX must reuse prebuilt objects through pools or `InstancedMesh`.
- Use `InstancedMesh` for many identical moving visuals such as sparks, particles, debris, pickups, and spinner models when possible.
- Keep gameplay state separate from render instances. Damage, bonuses, AI, health, RPM, cooldowns, and ownership remain per entity; `InstancedMesh` should only handle rendering.
- Damage numbers must use a fixed sprite/canvas pool instead of creating new canvas textures during hits.
- Bonus pickups, heal visuals, sparks, and repeated short-lived VFX must be prewarmed or pooled before combat.
- Per-frame animation should update transforms, visibility, opacity, shader uniforms, existing buffer attributes, or instance matrices. It should not allocate new render resources.
- Do not update human-readable DOM text every frame. Values meant for a person to read, such as health, cooldowns, timers, scores, stats, labels, and table rows, must be event-driven or throttled to a human-readable rate outside the render loop.
- All visible UI text must go through `src/i18n.ts` keys instead of hardcoded DOM strings.
