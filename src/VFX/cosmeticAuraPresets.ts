import bonusGreenAuraPreset from "./bonusGreen_aura-preset.json";
import bonusPinkAuraPreset from "./bonusPink_aura-preset.json";
import bonusRedAuraPreset from "./bonusRed_aura-preset.json";
import bonusYellowAuraPreset from "./bonusYellow_aura-preset.json";
import critSpeedReadyAuraPreset from "./critSpeedReady_aura-preset.json";
import earthAuraPreset from "./earth_aura-preset.json";
import fireAuraPreset from "./Fire_aura_preset.json";
import frostAuraPreset from "./Frost_aura-preset.json";
import lightningAuraPreset from "./Lightning_aura-preset.json";
import type { TornadoVfxPreset } from "../tornadoVfx";
import type { SpinnerElement } from "../simulation/elementalSkills";

export const cosmeticAuraPresetById: Record<string, TornadoVfxPreset> = {
  aura_crit: critSpeedReadyAuraPreset as TornadoVfxPreset,
  aura_green: bonusGreenAuraPreset as TornadoVfxPreset,
  aura_pink: bonusPinkAuraPreset as TornadoVfxPreset,
  aura_red: bonusRedAuraPreset as TornadoVfxPreset,
  aura_yellow: bonusYellowAuraPreset as TornadoVfxPreset,
};

export const previewAuraPresetByElement: Record<SpinnerElement, TornadoVfxPreset> = {
  fire: fireAuraPreset as TornadoVfxPreset,
  ice: frostAuraPreset as TornadoVfxPreset,
  lightning: lightningAuraPreset as TornadoVfxPreset,
  earth: earthAuraPreset as TornadoVfxPreset,
};
