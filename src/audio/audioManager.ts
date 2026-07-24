import * as THREE from "three";
import type { SpinnerElement } from "../simulation/elementalSkills";

const config = {
  masterVolume: 0.8,
  sfxVolume: 0.85,
  playerSpinVolume: 0.55,
  enemySpinVolume: 0.14,
  enemySpinReferenceDistance: 4,
  enemySpinMaxDistance: 25,
  fadeSeconds: 0.12,
  hitPoolSize: 10,
};

const paths = {
  spin: "audio/sfx/base_sfx/base_spin_sound.ogg",
  dash: "audio/sfx/base_sfx/dash.ogg",
  basicHits: [1, 2, 3, 4, 5].map((index) => `audio/sfx/base_sfx/basicHit_${index}.ogg`),
  critHits: [1, 2, 3].map((index) => `audio/sfx/base_sfx/critHit_${index}.ogg`),
  aura: {
    earth: "audio/sfx/earth/rock_aura.ogg",
    fire: "audio/sfx/fire/fire_aura.ogg",
    ice: "audio/sfx/frost/frost_aura.ogg",
    lightning: "audio/sfx/light/electro_aura.ogg",
  },
  start: {
    earth: "audio/sfx/earth/rock_ultStrike.ogg",
    fire: "audio/sfx/fire/start_Fire.ogg",
    ice: null,
    lightning: "audio/sfx/light/start_electro.ogg",
  },
  strike: {
    earth: "audio/sfx/earth/rock_ultStrike.ogg",
    fire: "audio/sfx/fire/fire_strike.ogg",
    ice: "audio/sfx/frost/frost_strike.ogg",
    lightning: "audio/sfx/light/electro_strike.ogg",
  },
  earthEnd: "audio/sfx/earth/rockEnd_aura.ogg",
  freeze: "audio/sfx/frost/enemy_freez.ogg",
  heal: "audio/sfx/heal_buff.ogg",
  pickups: ["audio/sfx/pickup_buff_1.ogg", "audio/sfx/pickup_buff_2.ogg"],
  uiClick: "assets/audio/ui_menu_click.ogg",
  uiHover: "audio/sfx/base_sfx/ui_menu_hover.ogg",
} as const;

type LoopName = "playerSpin" | "aura";

export class AudioManager {
  private readonly listener = new THREE.AudioListener();
  private readonly loader = new THREE.AudioLoader();
  private readonly buffers = new Map<string, AudioBuffer>();
  private readonly loops = new Map<LoopName, THREE.Audio>();
  private readonly hitPool: THREE.Audio[];
  private readonly enemySpin = new Map<THREE.Object3D, THREE.PositionalAudio>();
  private pickupIndex = 0;
  private activeAura: SpinnerElement | null = null;
  private userMuted = false;
  private temporarilyPaused = false;

  constructor(camera: THREE.Camera) {
    camera.add(this.listener);
    this.listener.setMasterVolume(config.masterVolume);
    this.hitPool = Array.from({ length: config.hitPoolSize }, () => new THREE.Audio(this.listener));
  }

  preload(): void {
    const startFiles = Object.values(paths.start).filter((path): path is Exclude<typeof path, null> => path !== null);
    const files = [paths.spin, paths.dash, ...paths.basicHits, ...paths.critHits, ...Object.values(paths.aura), ...startFiles, ...Object.values(paths.strike), paths.earthEnd, paths.freeze, paths.heal, ...paths.pickups, paths.uiClick, paths.uiHover];
    for (const path of files) this.load(path);
  }

  setMuted(muted: boolean): void { this.userMuted = muted; this.applyMasterVolume(); }
  setPaused(paused: boolean): void { this.temporarilyPaused = paused; this.applyMasterVolume(); }
  setMasterVolume(volume: number): void { config.masterVolume = THREE.MathUtils.clamp(volume, 0, 1); this.applyMasterVolume(); }
  setSfxVolume(volume: number): void { config.sfxVolume = THREE.MathUtils.clamp(volume, 0, 1); }

  resume(): void { void this.listener.context.resume().catch(() => {}); }

  updateSpinners(player: THREE.Object3D, selectedEnemies: readonly THREE.Object3D[], playerSpinning: boolean): void {
    if (playerSpinning) this.startLoop("playerSpin", paths.spin, config.playerSpinVolume);
    else this.stopLoop("playerSpin");
    for (const enemy of selectedEnemies) {
      const source = this.enemySpin.get(enemy) ?? this.createEnemySpin(enemy);
      if (playerSpinning) this.startAudio(source, paths.spin, config.enemySpinVolume, true);
      else this.stopAudio(source);
    }
    for (const [enemy, source] of this.enemySpin) {
      let selected = false;
      for (let index = 0; index < selectedEnemies.length; index += 1) {
        if (selectedEnemies[index] === enemy) {
          selected = true;
          break;
        }
      }
      if (!selected) this.stopAudio(source);
    }
  }

  stopEnemySpin(enemy: THREE.Object3D): void { const source = this.enemySpin.get(enemy); if (source) this.stopAudio(source); }

  playHit(critical: boolean, fromBot = false): void { this.playOneShot(this.random(critical ? paths.critHits : paths.basicHits), (critical ? 0.72 : 0.56) * (fromBot ? 0.8 : 1), 0.94 + Math.random() * 0.12); }
  playDash(): void { this.playOneShot(paths.dash, 0.64); }
  playUltimateStart(element: SpinnerElement): void { const path = paths.start[element]; if (path) this.playOneShot(path, 0.7); }
  startAura(element: SpinnerElement): void { if (this.activeAura === element) return; this.stopAura(); this.activeAura = element; this.startLoop("aura", paths.aura[element], 0.36); }
  stopAura(): void { const wasEarth = this.activeAura === "earth"; this.activeAura = null; this.stopLoop("aura"); if (wasEarth) this.playOneShot(paths.earthEnd, 0.55); }
  playElementStrike(element: SpinnerElement): void { this.playOneShot(paths.strike[element], 0.62); }
  playFreeze(): void { this.playOneShot(paths.freeze, 0.55); }
  playPickup(heal: boolean): void { this.playOneShot(heal ? paths.heal : paths.pickups[this.pickupIndex++ % paths.pickups.length], 0.58); }
  playUiClick(): void { this.playOneShot(paths.uiClick, 0.42); }
  playUiHover(): void { this.playOneShot(paths.uiHover, 0.24); }
  stopAll(): void { this.stopLoop("playerSpin"); this.stopAura(); for (const source of this.enemySpin.values()) this.stopAudio(source); }

  private load(path: string): void { if (this.buffers.has(path)) return; this.loader.load(`${import.meta.env.BASE_URL}${path}`, (buffer) => this.buffers.set(path, buffer), undefined, () => {}); }
  private applyMasterVolume(): void { this.listener.setMasterVolume(this.userMuted || this.temporarilyPaused ? 0 : config.masterVolume); }
  private startLoop(name: LoopName, path: string, volume: number): void { let source = this.loops.get(name); if (!source) { source = new THREE.Audio(this.listener); this.loops.set(name, source); } this.startAudio(source, path, volume, true); }
  private stopLoop(name: LoopName): void { const source = this.loops.get(name); if (source) this.stopAudio(source); }
  private createEnemySpin(enemy: THREE.Object3D): THREE.PositionalAudio { const source = new THREE.PositionalAudio(this.listener); source.setRefDistance(config.enemySpinReferenceDistance); source.setMaxDistance(config.enemySpinMaxDistance); enemy.add(source); this.enemySpin.set(enemy, source); return source; }
  private startAudio(source: THREE.Audio | THREE.PositionalAudio, path: string, volume: number, loop: boolean): void { const buffer = this.buffers.get(path); if (!buffer || source.isPlaying) return; source.setBuffer(buffer); source.setLoop(loop); source.setVolume(volume * config.sfxVolume); source.play(); }
  private stopAudio(source: THREE.Audio | THREE.PositionalAudio): void { if (source.isPlaying) source.stop(); }
  private playOneShot(path: string, volume: number, rate = 1): void { const source = this.hitPool.find((item) => !item.isPlaying); if (!source) return; const buffer = this.buffers.get(path); if (!buffer) return; source.setBuffer(buffer); source.setLoop(false); source.setVolume(volume * config.sfxVolume); source.setPlaybackRate(rate); source.play(); }
  private random<T>(items: readonly T[]): T { return items[Math.floor(Math.random() * items.length)]!; }
}
