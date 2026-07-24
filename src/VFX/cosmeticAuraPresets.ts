import earthAuraPreset from "./earth_aura-preset.json";
import fireAuraPreset from "./Fire_aura_preset.json";
import frostAuraPreset from "./Frost_aura-preset.json";
import lightningAuraPreset from "./Lightning_aura-preset.json";
import type { TornadoVfxPreset } from "../tornadoVfx";
import type { SpinnerElement } from "../simulation/elementalSkills";

export const previewAuraPresetByElement: Record<SpinnerElement, TornadoVfxPreset> = {
  fire: fireAuraPreset as TornadoVfxPreset,
  ice: frostAuraPreset as TornadoVfxPreset,
  lightning: lightningAuraPreset as TornadoVfxPreset,
  earth: earthAuraPreset as TornadoVfxPreset,
};
