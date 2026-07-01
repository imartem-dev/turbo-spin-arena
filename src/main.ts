import * as THREE from "three";
import { OBJLoader } from "three/examples/jsm/loaders/OBJLoader.js";
import backgroundImageUrl from "./img/background.webp";
import iconBlueUrl from "./img/iconBlue.webp";
import iconGreenUrl from "./img/iconGreen.webp";
import iconRedUrl from "./img/iconRed.webp";
import iconYellowUrl from "./img/iconYellow.webp";
import { createMobileControls, type MobileControls } from "./input/mobileControls";
import bonusPinkAuraPreset from "./VFX/bonusPink_aura-preset.json";
import bonusRedAuraPreset from "./VFX/bonusRed_aura-preset.json";
import bonusYellowAuraPreset from "./VFX/bonusYellow_aura-preset.json";
import bonusGreenAuraPreset from "./VFX/bonusGreen_aura-preset.json";
import critSpeedReadyAuraPreset from "./VFX/critSpeedReady_aura-preset.json";
import earthAuraPreset from "./VFX/earth_aura-preset.json";
import fireAuraPreset from "./VFX/Fire_aura_preset.json";
import frostAuraPreset from "./VFX/Frost_aura-preset.json";
import lightningAuraPreset from "./VFX/Lightning_aura-preset.json";
import { BonusVfxPool, type ArenaBonusVfxType } from "./VFX/arenaBonusVfx";
import { DamageNumberPool } from "./VFX/damageNumberPool";
import { ElementalSkillVfx } from "./VFX/elementalSkillVfx";
import { LightningChainVfx, type LightningChainSettings } from "./VFX/lightningChainVfx";
import { SparkVfxPool } from "./VFX/sparkVfxPool";
import {
  activeArena,
  getActiveArenaHeight,
  getArenaEdgePoint,
  projectToArenaSurface,
} from "./arenas/bowlArena";
import { createTranslator, detectLanguage } from "./i18n";
import { createDashState, getDashSpeedMultiplier, tryStartDash, updateDashState, type DashState } from "./simulation/dash";
import {
  applyArenaBonusEffect,
  collectArenaBonuses,
  createArenaBonusState,
  getActiveArenaBonuses,
  updateArenaBonusEffects,
  updateArenaBonuses,
  type ArenaBonusType,
  type ArenaBonusEffect,
  type TimedArenaBonusType,
} from "./simulation/arenaBonuses";
import { createBotAiDirector, type BotAiCommand, type BotAiSettings } from "./simulation/botAi";
import {
  type CombatDamageNumberCommand,
  type CombatDamageEvent,
  type CombatFlashCommand,
  type CombatFlashStep,
  type CombatKnockbackCommand,
  applyDirectDamage,
  handleSpinnerCollisions,
  resetCombatState,
} from "./simulation/combat";
import {
  activateElementalSkill,
  clearElementalTarget,
  createElementalSkillState,
  defaultElementalSkillSettings,
  resetElementalSkillState,
  syncElementalCollisionModifiers,
  updateElementalSkills,
  type ElementalSkillResult,
  type SpinnerElement,
} from "./simulation/elementalSkills";
import {
  getCurrentMoveSpeed,
  isCritSpeedReady,
  minMoveSpeedRatio,
  recoverRPMFromMovement,
  resetSpeedLimitRatio,
  speedLimitMinRatio,
  updateSpeedLimitRatio,
} from "./simulation/movement";
import {
  addUltimateCharge,
  createUltimateChargeState,
  getUltimateChargeRatio,
  isUltimateActive,
  isUltimateReady,
  tryActivateUltimate,
  updateUltimateActive,
  updateUltimatePassiveCharge,
  type UltimateChargeState,
} from "./simulation/ultimate";
import {
  applyRimResistance,
  applySlopeGravity,
  type RimResistanceSettings,
  type SlopeGravitySettings,
} from "./simulation/slopeGravity";
import {
  applyDeathmatchDeaths,
  defaultDeathmatchSettings,
  getDeathmatchLeaderboardRows,
  isDeathmatchAlive,
  isDeathmatchDamageable,
  recordPlayerCriticalHits,
  type DeathmatchStatus,
} from "./simulation/deathmatch";
import { TornadoVfx, type TornadoVfxPreset } from "./tornadoVfx";
import { EnemySpinnerInstancedModel } from "./rendering/enemySpinnerInstancedModel";

type SpinnerColors = {
  body: string;
  cone: string;
  cap: string;
  blur: string;
  panels: string[];
};

type SpinnerOptions = {
  name: string;
  colors: SpinnerColors;
  position: THREE.Vector3;
  radius: number;
  spinSpeed: number;
  baseMoveSpeed?: number;
};

type KnockbackState = {
  active: boolean;
  fromPosition: THREE.Vector3;
  toPosition: THREE.Vector3;
  elapsed: number;
  duration: number;
};

type RespawnDashState = {
  active: boolean;
  fromPosition: THREE.Vector3;
  toPosition: THREE.Vector3;
  elapsed: number;
  duration: number;
};

type FlashMaterialRecord = {
  mesh: THREE.Mesh;
  material: THREE.Material | THREE.Material[];
};

type FlashState = {
  sequence: CombatFlashStep[];
  stepIndex: number;
  stepElapsed: number;
  overrideMaterial: THREE.MeshBasicMaterial | null;
  originalMaterials: FlashMaterialRecord[];
};

type DeathmatchVisualState = {
  active: boolean;
  material: THREE.MeshBasicMaterial | null;
  originalMaterials: FlashMaterialRecord[];
};

type RpmHudElements = {
  root: HTMLElement;
  fill: HTMLElement;
  cap: HTMLElement;
  value: HTMLElement;
  bonusIcons?: HTMLElement;
};

type DashHudElements = {
  root: HTMLElement;
  fill: HTMLElement;
  value: HTMLElement;
};

type UltimateHudElements = {
  root: HTMLElement;
  fill: HTMLElement;
  value: HTMLElement;
};

type TargetLine = {
  line: THREE.Line;
  geometry: THREE.BufferGeometry;
  positions: Float32Array;
};

type SolidTrailMesh = THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial> & {
  userData: {
    positions: Float32Array;
  };
};

type BotDifficulty = "easy" | "normal" | "hard";

type SpinnerState = {
  participantId: string;
  name: string;
  group: THREE.Group;
  spinGroup: THREE.Group;
  critReadyVfx: TornadoVfx;
  ultimateVfx: TornadoVfx;
  bonusAuraVfxByType: Record<TimedArenaBonusType, TornadoVfx>;
  bonusAuraIntroByType: Record<TimedArenaBonusType, number>;
  trailMesh: SolidTrailMesh;
  trailMaterial: THREE.MeshBasicMaterial;
  trailPoints: THREE.Vector3[];
  trailSampleTimer: number;
  trailVisibleStrength: number;
  targetPosition: THREE.Vector3;
  desiredTargetPosition: THREE.Vector3;
  followTargetPosition: THREE.Vector3;
  visualTargetPosition: THREE.Vector3;
  targetLine: TargetLine | null;
  botVirtualCursorPosition: THREE.Vector3;
  botDesiredCursorPosition: THREE.Vector3;
  velocity: THREE.Vector3;
  dash: DashState;
  ultimate: UltimateChargeState;
  knockback: KnockbackState;
  respawnDash: RespawnDashState;
  flash: FlashState;
  deathmatchVisual: DeathmatchVisualState;
  forwardDirection: THREE.Vector3;
  baseRadius: number;
  radius: number;
  spinSpeed: number;
  pulseTimer: number;
  currentRPM: number;
  maxRPM: number;
  absoluteMaxRPM: number;
  baseMoveSpeed: number;
  grounded: boolean;
  verticalVelocity: number;
  heightOffset: number;
  distanceMovedThisTick: number;
  speedLimitRatio: number;
  bonusEffects: ArenaBonusEffect[];
  bonusSpeedMultiplier: number;
  critSpeedEase: number;
  critDamageMultiplier: number;
  damageMultiplier: number;
  incomingDamageMultiplier: number;
  collisionDamageMultiplier: number;
  collisionKnockbackMultiplier: number;
  elementalMoveSpeedMultiplier: number;
  elementalMovementLocked: boolean;
  verticalLaunchActive: boolean;
  deathmatchStatus: DeathmatchStatus;
  respawnTimer: number;
  invulnerabilityTimer: number;
  kills: number;
  deaths: number;
  playerCriticalHits: number;
  modelColor: string;
  modelTint: string | null;
  colorAccent: string;
  lastPosition: THREE.Vector3;
  previousTrailPosition: THREE.Vector3;
};

type HealingZone = {
  group: THREE.Group;
  position: THREE.Vector3;
  radius: number;
  age: number;
  delay: number;
  afterTriggerDelay: number;
  postTriggerLife: number;
  triggered: boolean;
  healed: boolean;
  staticRing: THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>;
  staticRingMaterial: THREE.MeshBasicMaterial;
  shrinkRing: THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>;
  shrinkRingMaterial: THREE.MeshBasicMaterial;
  burstDisk: THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>;
  burstDiskMaterial: THREE.MeshBasicMaterial;
  echoDisk: THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>;
  echoDiskMaterial: THREE.MeshBasicMaterial;
};

type HealAuraBurst = {
  vfx: TornadoVfx;
  parent: THREE.Object3D;
  age: number;
  duration: number;
};

const pointerNdc = new THREE.Vector2();
const raycaster = new THREE.Raycaster();
const pointerFallbackPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -activeArena.getHeightAt(activeArena.radius, 0));
const pointerFallbackPoint = new THREE.Vector3();
const scratchVector = new THREE.Vector3();
const mobileCameraForward = new THREE.Vector3();
const mobileCameraRight = new THREE.Vector3();
const mobileMoveDirection = new THREE.Vector3();
const mobileMoveTarget = new THREE.Vector3();
const clock = new THREE.Clock();
const healingZones: HealingZone[] = [];
const idleHealingZones: HealingZone[] = [];
const healAuraBursts: HealAuraBurst[] = [];
const idleHealAuraVfx: TornadoVfx[] = [];
const reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
let damageNumberFontReady = false;

const fixedPhysicsDelta = 1 / 60;
const maxPhysicsStepsPerFrame = 5;
const hudUpdateIntervalMs = 100;
const leaderboardUpdateIntervalMs = 1000;
const absoluteMaxRPM = 6000;
const playerBaseMoveSpeed = 17;
const enemyBaseMoveSpeed = 14;
const springStrength = 16;
const springDamping = 1.5;
const dashSettings = {
  duration: 0.12,
  cooldown: 8,
  speedMultiplier: 2.4,
};
const ultimateChargeSettings = {
  maxCharge: 100,
  chargePerDamageDealt: 0.02,
  chargePerDamageTaken: 0.008,
  passiveChargePerSecond: 1,
  activeDuration: 5,
  speedMultiplier: 1.1,
};
const lightningChainSettings: LightningChainSettings = {
  chainRadius: defaultElementalSkillSettings.lightningChainRadius,
  maxChainTargets: defaultElementalSkillSettings.lightningMaxTargets,
  chainDelay: 0.12,
  beamHoldDuration: 0.2,
  baseDamage: defaultElementalSkillSettings.lightningBaseDamage,
  damageStep: defaultElementalSkillSettings.lightningDamageStep,
};
const elementOrder: SpinnerElement[] = ["fire", "ice", "earth", "lightning"];
const ultimateAuraPresetByElement: Record<SpinnerElement, TornadoVfxPreset> = {
  fire: fireAuraPreset as TornadoVfxPreset,
  ice: frostAuraPreset as TornadoVfxPreset,
  earth: earthAuraPreset as TornadoVfxPreset,
  lightning: lightningAuraPreset as TornadoVfxPreset,
};
const arenaBonusColorByType: Record<ArenaBonusVfxType, string> = {
  speed: "#45a6ff",
  critSpeed: "#ffd83d",
  critDamage: "#f26bdc",
  damage: "#ff4d4d",
  heal: "#35e878",
};
const arenaBonusTypes: TimedArenaBonusType[] = ["speed", "critSpeed", "critDamage", "damage"];
const arenaBonusAuraPresetByType: Record<TimedArenaBonusType, TornadoVfxPreset> = {
  speed: critSpeedReadyAuraPreset as TornadoVfxPreset,
  critSpeed: bonusYellowAuraPreset as TornadoVfxPreset,
  critDamage: bonusPinkAuraPreset as TornadoVfxPreset,
  damage: bonusRedAuraPreset as TornadoVfxPreset,
};
const arenaBonusHudLabelByType: Record<ArenaBonusType, string> = {
  speed: "Speed bonus",
  critSpeed: "Critical speed bonus",
  critDamage: "Critical damage bonus",
  damage: "Damage bonus",
  heal: "Heal bonus",
};
const healingZoneSettings = {
  radius: 2.4,
  delay: 2,
  afterTriggerDelay: 0.2,
  postTriggerLife: 0.6,
  maxRpmHealAmount: 1200,
};
const deathmatchSettings = defaultDeathmatchSettings;
const playerContinueDelay = 3;
const botRespawnDelay = 5;
const deathmatchBlinkOpacity = 0.8;
const deathmatchPulseMinOpacity = 0.35;
const deathmatchPulseFrequency = 2.4;
const respawnDashDuration = 0.45;
const deathCameraReturnSpeed = 3.5;
const bonusAuraIntroDuration = 2;
const elementIconByElement: Record<SpinnerElement, string> = {
  fire: iconRedUrl,
  ice: iconBlueUrl,
  earth: iconGreenUrl,
  lightning: iconYellowUrl,
};
let selectedElement: SpinnerElement = "lightning";
const botCursorMinRadius = 6;
const botAiSettings: BotAiSettings = {
  globalAttackLimit: 0,
  maxAttackersPerTarget: 2,
  windupDistance: 5,
  separationStrength: 1.2,
  predictionTurnFactor: 0,
  attackCooldown: 2,
  crowdPenalty: 4,
};
const slopeGravitySettings: SlopeGravitySettings = {
  slopeGravity: 59.5,
  maxSlopeBoost: 1,
  slopeSampleDistance: 0.2,
};
const rimResistanceSettings: RimResistanceSettings = {
  rimResistanceStartRatio: 0.88,
  rimResistanceStrength: 240,
  rimResistanceMaxBoost: 10,
};
const botDifficultyPresets: Record<
  BotDifficulty,
  { minDecisionTime: number; maxDecisionTime: number; cursorAngularSpeed: number; cursorRadialSpeed: number }
> = {
  easy: { minDecisionTime: 0.6, maxDecisionTime: 1, cursorAngularSpeed: Math.PI * 0.65, cursorRadialSpeed: 4.5 },
  normal: { minDecisionTime: 0.35, maxDecisionTime: 0.6, cursorAngularSpeed: Math.PI * 1.05, cursorRadialSpeed: 7 },
  hard: { minDecisionTime: 0.2, maxDecisionTime: 0.35, cursorAngularSpeed: Math.PI * 1.55, cursorRadialSpeed: 10 },
};
const debugSettingStoragePrefix = "turbo-spin-arena.debug.";
let spinnerSizeScale = getStoredDebugNumber("spinnerSize", 0.6, 3, 1);

const maxTrailPoints = 28;
const maxTrailRibbonPoints = (maxTrailPoints + 1) * 2;
const maxTrailVertices = maxTrailRibbonPoints * 2;
const maxTrailIndices = (maxTrailRibbonPoints - 1) * 6;
const spinnerModelUrl = `${import.meta.env.BASE_URL}assets/Spiner.obj`;
const damageNumberFontUrl = `${import.meta.env.BASE_URL}assets/fonts/ZeroCool.woff2`;
const damageNumberFontFamily = "ZeroCoolDamage";
const maxRendererPixelRatio = 1.25;
const auraGroundPlaneOffset = 0.06;
const cameraLookAtTarget = new THREE.Vector3(0, 0, 0);
const airborneGravity = -18;
const cameraSettings = {
  gameX: 0,
  gameY: 16,
  gameZ: 14.1,
  lookAtX: 0,
  lookAtY: -2,
  lookAtZ: 2.1,
  minDistance: 18,
  maxDistance: 21,
  deathOffsetX: 0,
  deathOffsetY: 2.4,
  deathOffsetZ: 5,
  deathLookAtX: 0,
  deathLookAtY: 1.1,
  deathLookAtZ: 0,
};
const lightSettings = {
  disabled: false,
  ambient: 1.55,
  hemisphere: 0.72,
  key: 2.35,
  fill: 0.18,
};

let elapsedTime = 0;
let physicsAccumulator = 0;
let pointerHasWorldTarget = false;
let spinnerModelSource: THREE.Group | null = null;
let mobileMoveActive = false;
let matchStarted = false;
let gameLoopStarted = false;
let deathmatchOverlayOpen = false;
let deathmatchOverlayOpenedByDeath = false;
let deathCameraActive = false;
let deathCameraReturning = false;
const defaultCameraPosition = new THREE.Vector3(cameraSettings.gameX, cameraSettings.gameY, cameraSettings.gameZ);
const defaultCameraLookAt = new THREE.Vector3(cameraSettings.lookAtX, cameraSettings.lookAtY, cameraSettings.lookAtZ);
const savedCameraPosition = defaultCameraPosition.clone();
const savedCameraLookAt = defaultCameraLookAt.clone();
let fpsFrameCount = 0;
let fpsElapsedTime = 0;
let hudUpdateIntervalId: number | null = null;
let leaderboardUpdateIntervalId: number | null = null;

const language = detectLanguage(navigator.language);
const t = createTranslator(language);
document.documentElement.lang = language;
document.documentElement.dir = language === "ar" ? "rtl" : "ltr";

const scene = new THREE.Scene();
scene.background = new THREE.Color("#172820");

const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 100);
camera.position.copy(defaultCameraPosition);
camera.lookAt(cameraLookAtTarget);
scene.add(camera);

const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: "high-performance" });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, maxRendererPixelRatio));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = false;
document.body.appendChild(renderer.domElement);

const ambientLight = new THREE.AmbientLight("#ffffff", lightSettings.ambient);
scene.add(ambientLight);
const hemisphereLight = new THREE.HemisphereLight("#ffffff", "#ffffff", lightSettings.hemisphere);
scene.add(hemisphereLight);

const keyLight = new THREE.DirectionalLight("#ffffff", lightSettings.key);
keyLight.position.set(0, 12, 0);
keyLight.target.position.set(0, 0, 0);
keyLight.castShadow = false;
scene.add(keyLight);
scene.add(keyLight.target);

const fillLight = new THREE.DirectionalLight("#ffffff", lightSettings.fill);
fillLight.position.set(0, 8, 0);
fillLight.target.position.set(0, 0, 0);
fillLight.castShadow = false;
scene.add(fillLight);
scene.add(fillLight.target);

const arena = activeArena.createSceneObjects();
scene.add(arena);
const arenaBonusState = createArenaBonusState(activeArena.interestPoints);
const arenaBonusVfxPool = new BonusVfxPool(scene, arenaBonusColorByType, reducedMotionQuery);
arenaBonusVfxPool.prewarm({ particles: 160, pulses: 36 });
const enemySpinnerInstancedModel = new EnemySpinnerInstancedModel(scene, 9);
const sparkVfxPool = new SparkVfxPool(scene, reducedMotionQuery);
const damageNumberPool = new DamageNumberPool(scene, damageNumberFontFamily, () => damageNumberFontReady);
prewarmHealingZones();
prewarmHealAuraBursts();
scene.add(createArenaBonusPointMarkers());

const player = createSpinner({
  name: "Player",
  colors: {
    body: "#243a75",
    cone: "#d9f6ff",
    cap: "#f5f0d8",
    blur: "#64d6ff",
    panels: ["#f54848", "#f7c948", "#2ddf7a", "#45a6ff", "#f26bdc", "#ffffff"],
  },
  position: activeArena.playerStart,
  radius: 0.72,
  spinSpeed: 11.5,
  baseMoveSpeed: playerBaseMoveSpeed,
});

const enemySpinners: SpinnerState[] = [];
const combatSpinners: SpinnerState[] = [player];
const elementalSkillState = createElementalSkillState<SpinnerState>();
const elementalSkillVfx = new ElementalSkillVfx(scene, getActiveArenaHeight);
const lightningChainVfx = new LightningChainVfx<SpinnerState>(
  scene,
  lightningChainSettings,
  (spinner) => isDeathmatchDamageable(spinner) && !spinner.respawnDash.active,
  getActiveArenaHeight,
);
const botAiDirector = createBotAiDirector();
const latestEnemyAiCommands = new Map<SpinnerState, BotAiCommand>();
let hudElements: RpmHudElements[] = [];
let dashHudElements: DashHudElements | null = null;
let ultimateHudElements: UltimateHudElements | null = null;
let mobileControls: MobileControls | null = null;
const deathmatchLeaderboardElement = document.querySelector<HTMLElement>("[data-deathmatch-leaderboard]");
const deathmatchOverlayElement = document.querySelector<HTMLElement>("[data-deathmatch-overlay]");
const deathmatchScoreboardButton = document.querySelector<HTMLButtonElement>("[data-deathmatch-scoreboard]");
const deathmatchContinueButton = document.querySelector<HTMLButtonElement>("[data-deathmatch-continue]");
const fpsCounterElement = document.querySelector<HTMLElement>("[data-fps-counter]");
let botDifficulty: BotDifficulty = "normal";
let botAiDecisionCountdown = 0;
let botAiDecisionElapsedTime = 0;

scene.add(player.group);
scene.add(player.trailMesh);
player.targetLine = createTargetLine("#ffffff", 0.95, 4);
scene.add(player.targetLine.line);
loadDamageNumberFont();
loadCustomSpinnerModel();
player.targetPosition.copy(player.group.position);
setEnemyCount(1);
hudElements = createRpmHud(player, enemySpinners);
setupSettingTooltips();
setupEnemyCountControl();
setupSpinnerSizeControl();
setupBotDifficultyControls();
setupLightControls();
setupStartMenu();
setupDeathmatchContinueButton();
setupMobileControls();

renderer.domElement.addEventListener("pointermove", handlePointer);
renderer.domElement.addEventListener("pointerdown", handlePointerDown);
renderer.domElement.addEventListener("contextmenu", preventContextMenu);
window.addEventListener("contextmenu", preventContextMenu);
window.addEventListener("resize", handleResize);

function startGameLoop(): void {
  if (gameLoopStarted) {
    return;
  }
  gameLoopStarted = true;
  clock.getDelta();
  renderer.setAnimationLoop(runGameFrame);
}

function startUiUpdateTimers(): void {
  if (hudUpdateIntervalId === null) {
    hudUpdateIntervalId = window.setInterval(updateHudSystems, hudUpdateIntervalMs);
  }
  if (leaderboardUpdateIntervalId === null) {
    leaderboardUpdateIntervalId = window.setInterval(updateOpenDeathmatchLeaderboard, leaderboardUpdateIntervalMs);
  }
}

function runGameFrame(): void {
  const frameDeltaTime = Math.min(clock.getDelta(), 0.1);
  updateFpsCounter(frameDeltaTime);

  physicsAccumulator += frameDeltaTime;

  let physicsSteps = 0;
  while (physicsAccumulator >= fixedPhysicsDelta && physicsSteps < maxPhysicsStepsPerFrame) {
    simulatePhysicsTick(fixedPhysicsDelta);
    physicsAccumulator -= fixedPhysicsDelta;
    physicsSteps += 1;
  }

  if (physicsSteps === maxPhysicsStepsPerFrame) {
    physicsAccumulator = 0;
  }

  updateCritReadyVfx(frameDeltaTime);
  updateUltimateVfx(frameDeltaTime);
  updateLightningChainVfx(frameDeltaTime);
  elementalSkillVfx.update(frameDeltaTime, elapsedTime, camera);
  updateBonusAuraVfx(frameDeltaTime);
  updateDeathmatchProtectedVisuals(frameDeltaTime);
  updateHealAuraBursts(frameDeltaTime);
  updateArenaBonusVisuals(frameDeltaTime);
  if (isDeathmatchAlive(player)) {
    updateSolidTrail(player);
    updateTargetLine(player);
  } else {
    hideSpinnerTrailAndTarget(player);
  }
  for (const spinner of enemySpinners) {
    if (isDeathmatchAlive(spinner)) {
      updateSolidTrail(spinner);
    } else {
      hideSpinnerTrailAndTarget(spinner);
    }
  }
  damageNumberPool.update(frameDeltaTime);
  updateDeathCamera(frameDeltaTime);
  for (const spinner of enemySpinners) {
    enemySpinnerInstancedModel.setFrozen(spinner, spinner.elementalMovementLocked);
  }
  enemySpinnerInstancedModel.sync(enemySpinners, frameDeltaTime);

  renderer.render(scene, camera);
}

function updateCritReadyVfx(deltaTime: number): void {
  for (const spinner of combatSpinners) {
    if (!isDeathmatchDamageable(spinner)) {
      spinner.critReadyVfx.group.visible = false;
      continue;
    }
    const ready = isCritSpeedReady(spinner);
    spinner.critReadyVfx.group.visible = ready;
    if (ready) {
      spinner.critReadyVfx.update(deltaTime, elapsedTime);
      projectAuraGroundToArena(spinner.critReadyVfx);
    }
  }
}

function updateUltimateVfx(deltaTime: number): void {
  for (const spinner of combatSpinners) {
    if (!isDeathmatchAlive(spinner)) {
      spinner.ultimateVfx.group.visible = false;
      continue;
    }
    const active = isUltimateActive(spinner.ultimate);
    spinner.ultimateVfx.group.visible = active;
    if (active) {
      spinner.ultimateVfx.update(deltaTime, elapsedTime);
      projectAuraGroundToArena(spinner.ultimateVfx);
    }
  }
}

function updateLightningChainVfx(deltaTime: number): void {
  lightningChainVfx.updateVisuals(deltaTime, elapsedTime, camera, reducedMotionQuery.matches);
}

function updateBonusAuraVfx(deltaTime: number): void {
  for (const spinner of combatSpinners) {
    if (!isDeathmatchAlive(spinner)) {
      for (const type of arenaBonusTypes) {
        spinner.bonusAuraVfxByType[type].group.visible = false;
      }
      continue;
    }
    const activeBonusTypes = new Set(spinner.bonusEffects.map((effect) => effect.type));
    for (const type of arenaBonusTypes) {
      const bonusAuraVfx = spinner.bonusAuraVfxByType[type];
      const active = activeBonusTypes.has(type);
      const wasVisible = bonusAuraVfx.group.visible;
      bonusAuraVfx.group.visible = active;
      if (active) {
        if (!wasVisible) {
          spinner.bonusAuraIntroByType[type] = bonusAuraIntroDuration;
        }
        updateBonusAuraIntro(spinner, type, deltaTime);
        bonusAuraVfx.update(deltaTime, elapsedTime);
        projectAuraGroundToArena(bonusAuraVfx);
      } else {
        spinner.bonusAuraIntroByType[type] = 0;
        bonusAuraVfx.group.scale.setScalar(1);
      }
    }
  }
}

function updateBonusAuraIntro(spinner: SpinnerState, type: TimedArenaBonusType, deltaTime: number): void {
  const remaining = spinner.bonusAuraIntroByType[type];
  if (remaining <= 0) {
    spinner.bonusAuraVfxByType[type].group.scale.setScalar(1);
    return;
  }

  const nextRemaining = Math.max(0, remaining - deltaTime);
  spinner.bonusAuraIntroByType[type] = nextRemaining;
  const ratio = 1 - THREE.MathUtils.clamp(nextRemaining / bonusAuraIntroDuration, 0, 1);
  const eased = easeOutCubic(ratio);
  const heightScale = THREE.MathUtils.lerp(3.0, 1, eased);
  const widthScale = THREE.MathUtils.lerp(1.25, 1, eased);
  spinner.bonusAuraVfxByType[type].group.scale.set(widthScale, heightScale, widthScale);
}

function projectAuraGroundToArena(vfx: TornadoVfx): void {
  vfx.projectGroundToSurface(sampleActiveArenaHeight, auraGroundPlaneOffset, elapsedTime);
}

function sampleActiveArenaHeight(x: number, z: number): number {
  return activeArena.getHeightAt(x, z);
}

function updateHudSystems(): void {
  if (!matchStarted) {
    return;
  }

  updateRpmHud(hudElements);
  updateDashHud(dashHudElements);
  updateUltimateHud(ultimateHudElements);
  updateMobileControls();
  updateDeathmatchContinueButton();
}

function updateOpenDeathmatchLeaderboard(): void {
  if (!deathmatchOverlayOpen) {
    return;
  }

  updateDeathmatchLeaderboard();
}

function createSpinner(options: SpinnerOptions): SpinnerState {
  const group = new THREE.Group();
  group.name = options.name;
  group.position.copy(options.position);
  group.scale.setScalar(spinnerSizeScale);

  const spinGroup = new THREE.Group();
  group.add(spinGroup);

  const bodyMaterial = new THREE.MeshStandardMaterial({
    color: options.colors.body,
    roughness: 0.38,
    metalness: 0.2,
  });
  const coneMaterial = new THREE.MeshStandardMaterial({
    color: options.colors.cone,
    roughness: 0.32,
    metalness: 0.18,
  });
  const capMaterial = new THREE.MeshStandardMaterial({
    color: options.colors.cap,
    roughness: 0.34,
    metalness: 0.28,
  });

  const cone = new THREE.Mesh(new THREE.ConeGeometry(0.36, 0.5, 32), coneMaterial);
  cone.position.y = 0.25;
  cone.rotation.x = Math.PI;
  spinGroup.add(cone);

  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.58, 0.48, 0.42, 48), bodyMaterial);
  body.position.y = 0.62;
  spinGroup.add(body);

  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.52, 0.2, 48), capMaterial);
  cap.position.y = 0.93;
  spinGroup.add(cap);

  const knob = new THREE.Mesh(new THREE.SphereGeometry(0.18, 20, 12), capMaterial);
  knob.position.y = 1.1;
  knob.scale.y = 0.46;
  spinGroup.add(knob);

  const panelCount = options.colors.panels.length;
  const panelGeometry = new THREE.BoxGeometry(0.2, 0.28, 0.055);
  for (let i = 0; i < panelCount; i += 1) {
    const angle = (i / panelCount) * Math.PI * 2;
    const material = new THREE.MeshStandardMaterial({
      color: options.colors.panels[i],
      roughness: 0.45,
      metalness: 0.1,
    });
    const panel = new THREE.Mesh(panelGeometry, material);
    panel.position.set(Math.cos(angle) * 0.55, 0.66, Math.sin(angle) * 0.55);
    panel.rotation.y = -angle;
    spinGroup.add(panel);
  }

  const topWedges = createTopWedges(options.colors.panels);
  topWedges.position.y = 1.035;
  spinGroup.add(topWedges);

  const { trailMesh, trailMaterial } = createSolidTrail("#ffffff");
  const critReadyVfx = new TornadoVfx(critSpeedReadyAuraPreset as TornadoVfxPreset);
  critReadyVfx.group.visible = false;
  group.add(critReadyVfx.group);
  const ultimateVfx = new TornadoVfx(ultimateAuraPresetByElement[selectedElement]);
  ultimateVfx.group.visible = false;
  group.add(ultimateVfx.group);
  const bonusAuraVfxByType = createBonusAuraVfxByType();
  for (const bonusAuraVfx of Object.values(bonusAuraVfxByType)) {
    bonusAuraVfx.group.visible = false;
    group.add(bonusAuraVfx.group);
  }

  const initialForward = new THREE.Vector3(1, 0, 0);

  return {
    participantId: options.name,
    name: options.name,
    group,
    spinGroup,
    critReadyVfx,
    ultimateVfx,
    bonusAuraVfxByType,
    bonusAuraIntroByType: createBonusAuraIntroByType(),
    trailMesh,
    trailMaterial,
    trailPoints: [options.position.clone()],
    trailSampleTimer: 0,
    trailVisibleStrength: 0,
    targetPosition: options.position.clone(),
    desiredTargetPosition: options.position.clone(),
    followTargetPosition: options.position.clone(),
    visualTargetPosition: options.position.clone(),
    targetLine: null,
    botVirtualCursorPosition: options.position.clone(),
    botDesiredCursorPosition: options.position.clone(),
    velocity: new THREE.Vector3(),
    dash: createDashState(dashSettings),
    ultimate: createUltimateChargeState(ultimateChargeSettings),
    knockback: {
      active: false,
      fromPosition: options.position.clone(),
      toPosition: options.position.clone(),
      elapsed: 0,
      duration: 0,
    },
    respawnDash: {
      active: false,
      fromPosition: options.position.clone(),
      toPosition: options.position.clone(),
      elapsed: 0,
      duration: 0,
    },
    flash: {
      sequence: [],
      stepIndex: 0,
      stepElapsed: 0,
      overrideMaterial: null,
      originalMaterials: [],
    },
    deathmatchVisual: {
      active: false,
      material: null,
      originalMaterials: [],
    },
    forwardDirection: initialForward,
    baseRadius: options.radius,
    radius: options.radius * spinnerSizeScale,
    spinSpeed: options.spinSpeed,
    pulseTimer: 0,
    currentRPM: absoluteMaxRPM,
    maxRPM: absoluteMaxRPM,
    absoluteMaxRPM,
    baseMoveSpeed: options.baseMoveSpeed ?? playerBaseMoveSpeed,
    grounded: true,
    verticalVelocity: 0,
    heightOffset: 0,
    distanceMovedThisTick: 0,
    speedLimitRatio: speedLimitMinRatio,
    bonusEffects: [],
    bonusSpeedMultiplier: 1,
    critSpeedEase: 0,
    critDamageMultiplier: 1,
    damageMultiplier: 1,
    incomingDamageMultiplier: 1,
    collisionDamageMultiplier: 1,
    collisionKnockbackMultiplier: 1,
    elementalMoveSpeedMultiplier: 1,
    elementalMovementLocked: false,
    verticalLaunchActive: false,
    deathmatchStatus: "alive",
    respawnTimer: 0,
    invulnerabilityTimer: 0,
    kills: 0,
    deaths: 0,
    playerCriticalHits: 0,
    modelColor: options.colors.body,
    modelTint: null,
    colorAccent: options.colors.blur,
    lastPosition: options.position.clone(),
    previousTrailPosition: options.position.clone(),
  };
}

function createBonusAuraVfxByType(): Record<TimedArenaBonusType, TornadoVfx> {
  return {
    speed: new TornadoVfx(arenaBonusAuraPresetByType.speed),
    critSpeed: new TornadoVfx(arenaBonusAuraPresetByType.critSpeed),
    critDamage: new TornadoVfx(arenaBonusAuraPresetByType.critDamage),
    damage: new TornadoVfx(arenaBonusAuraPresetByType.damage),
  };
}

function createBonusAuraIntroByType(): Record<TimedArenaBonusType, number> {
  return {
    speed: 0,
    critSpeed: 0,
    critDamage: 0,
    damage: 0,
  };
}

function createEnemySpinner(index: number): SpinnerState {
  const spawn = activeArena.enemySpawns[index % activeArena.enemySpawns.length];
  const enemySpinner = createSpinner({
    name: `Enemy ${index + 1}`,
    colors: {
      body: "#5c1f26",
      cone: "#ffeecc",
      cap: "#f08a34",
      blur: "#ff3f8e",
      panels: ["#161616", "#ff6b35", "#ffd23f", "#8a1c7c", "#2f2f2f", "#f9f7ef"],
    },
    position: spawn,
    radius: 0.72,
    spinSpeed: index % 2 === 0 ? -10.2 : 10.2,
    baseMoveSpeed: enemyBaseMoveSpeed,
  });
  enemySpinner.targetPosition.copy(enemySpinner.group.position);
  enemySpinner.desiredTargetPosition.copy(enemySpinner.group.position);
  enemySpinner.followTargetPosition.copy(enemySpinner.group.position);
  enemySpinner.visualTargetPosition.copy(enemySpinner.group.position);
  enemySpinner.botVirtualCursorPosition.copy(projectPointOutsideBotCursorRadius(enemySpinner, enemySpinner.group.position));
  enemySpinner.botDesiredCursorPosition.copy(enemySpinner.botVirtualCursorPosition);
  enemySpinner.followTargetPosition.copy(enemySpinner.botVirtualCursorPosition);
  return enemySpinner;
}

function setEnemyCount(count: number): void {
  const targetCount = THREE.MathUtils.clamp(Math.round(count), 0, 9);

  while (enemySpinners.length < targetCount) {
    const enemySpinner = createEnemySpinner(enemySpinners.length);
    enemySpinners.push(enemySpinner);
    combatSpinners.push(enemySpinner);
    scene.add(enemySpinner.group, enemySpinner.trailMesh);
    if (spinnerModelSource) {
      installInstancedEnemySpinnerModel(enemySpinner);
    }
  }

  while (enemySpinners.length > targetCount) {
    const enemySpinner = enemySpinners.pop();
    if (!enemySpinner) {
      continue;
    }
    const combatIndex = combatSpinners.indexOf(enemySpinner);
    if (combatIndex >= 0) {
      combatSpinners.splice(combatIndex, 1);
    }
    lightningChainVfx.cancelForSpinner(enemySpinner);
    clearElementalTarget(elementalSkillState, enemySpinner);
    enemySpinnerInstancedModel.setFrozen(enemySpinner, false);
    botAiDirector.forget(enemySpinner);
    latestEnemyAiCommands.delete(enemySpinner);
    disposeSpinner(enemySpinner);
  }

  clearPairImpactTimes();
  updateBotAttackLimits();
  hudElements = createRpmHud(player, enemySpinners);
  updateHudSystems();
}

function disposeSpinner(spinner: SpinnerState): void {
  finishSpinnerFlash(spinner);
  finishDeathmatchProtectedVisual(spinner);
  scene.remove(spinner.group, spinner.trailMesh);
  if (spinner.targetLine) {
    scene.remove(spinner.targetLine.line);
    spinner.targetLine.geometry.dispose();
    const materials = Array.isArray(spinner.targetLine.line.material)
      ? spinner.targetLine.line.material
      : [spinner.targetLine.line.material];
    for (const material of materials) {
      material.dispose();
    }
  }
  disposeObjectChildren(spinner.spinGroup);
  spinner.critReadyVfx.dispose();
  spinner.ultimateVfx.dispose();
  for (const bonusAuraVfx of Object.values(spinner.bonusAuraVfxByType)) {
    bonusAuraVfx.dispose();
  }
  spinner.trailMesh.geometry.dispose();
  spinner.trailMaterial.dispose();
}

function updateBotAttackLimits(): void {
  botAiSettings.globalAttackLimit = Math.floor(enemySpinners.length / 2);
}

function clearPairImpactTimes(): void {
  resetCombatState();
}

function loadCustomSpinnerModel(): void {
  new OBJLoader().load(
    spinnerModelUrl,
    (source) => {
      spinnerModelSource = source;
      installCustomSpinnerModel(player, source.clone(true));
      enemySpinnerInstancedModel.setModelSource(source, enemySpinners[0]?.baseRadius ?? player.baseRadius);
      for (const spinner of enemySpinners) {
        installInstancedEnemySpinnerModel(spinner);
      }
    },
    undefined,
    (error) => {
      console.error(`Failed to load ${spinnerModelUrl}`, error);
    },
  );
}

function installInstancedEnemySpinnerModel(spinner: SpinnerState): void {
  finishSpinnerFlash(spinner);
  finishDeathmatchProtectedVisual(spinner);
  disposeObjectChildren(spinner.spinGroup);
  spinner.modelTint = null;
}

function loadDamageNumberFont(): void {
  const font = new FontFace(damageNumberFontFamily, `url(${damageNumberFontUrl})`);
  font
    .load()
    .then((loadedFont) => {
      document.fonts.add(loadedFont);
      damageNumberFontReady = true;
    })
    .catch((error) => {
      console.warn(`Failed to load ${damageNumberFontUrl}`, error);
    });
}

function installCustomSpinnerModel(spinner: SpinnerState, model: THREE.Group): void {
  finishSpinnerFlash(spinner);
  disposeObjectChildren(spinner.spinGroup);

  const box = new THREE.Box3().setFromObject(model);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const diameter = Math.max(size.x, size.y);
  const height = size.z;
  const scale = diameter > 0 ? (spinner.baseRadius * 1.65) / diameter : 1;

  model.name = `${spinner.name} Custom Model`;
  model.position.sub(center);
  model.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      child.material = new THREE.MeshStandardMaterial({
        color: spinner.modelColor,
        roughness: 0.38,
        metalness: 0.22,
      });
      child.geometry.computeVertexNormals();
    }
  });

  const modelRoot = new THREE.Group();
  modelRoot.name = `${spinner.name} Model Root`;
  modelRoot.rotation.x = -Math.PI / 2;
  modelRoot.position.y = (height * scale) / 2;
  modelRoot.scale.setScalar(scale);
  modelRoot.add(model);
  spinner.spinGroup.add(modelRoot);
}

function disposeObjectChildren(group: THREE.Group): void {
  for (const child of [...group.children]) {
    group.remove(child);
    child.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        object.geometry.dispose();
        disposeMaterial(object.material);
      }
    });
  }
}

function disposeMaterial(material: THREE.Material | THREE.Material[]): void {
  const materials = Array.isArray(material) ? material : [material];
  for (const item of materials) {
    item.dispose();
  }
}

function createTopWedges(colors: string[]): THREE.Group {
  const group = new THREE.Group();
  const radius = 0.43;
  const inset = 0.05;
  const segmentAngle = (Math.PI * 2) / colors.length;

  for (let i = 0; i < colors.length; i += 1) {
    const start = i * segmentAngle + inset;
    const end = (i + 1) * segmentAngle - inset;
    const shape = new THREE.Shape();
    shape.moveTo(0, 0);
    shape.lineTo(Math.cos(start) * radius, Math.sin(start) * radius);

    const steps = 4;
    for (let step = 1; step <= steps; step += 1) {
      const angle = THREE.MathUtils.lerp(start, end, step / steps);
      shape.lineTo(Math.cos(angle) * radius, Math.sin(angle) * radius);
    }

    shape.lineTo(0, 0);

    const wedge = new THREE.Mesh(
      new THREE.ShapeGeometry(shape),
      new THREE.MeshStandardMaterial({
        color: colors[i],
        roughness: 0.42,
        metalness: 0.08,
        side: THREE.DoubleSide,
      }),
    );
    wedge.rotation.x = -Math.PI / 2;
    group.add(wedge);
  }

  return group;
}

function createSolidTrail(color: string): { trailMesh: SolidTrailMesh; trailMaterial: THREE.MeshBasicMaterial } {
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(maxTrailVertices * 3);
  const indices = new Uint16Array(maxTrailIndices);
  for (let i = 0; i < maxTrailRibbonPoints - 1; i += 1) {
    const vertex = i * 2;
    const index = i * 6;
    indices[index] = vertex;
    indices[index + 1] = vertex + 2;
    indices[index + 2] = vertex + 1;
    indices[index + 3] = vertex + 1;
    indices[index + 4] = vertex + 2;
    indices[index + 5] = vertex + 3;
  }

  const positionAttribute = new THREE.BufferAttribute(positions, 3);
  positionAttribute.setUsage(THREE.DynamicDrawUsage);
  geometry.setAttribute("position", positionAttribute);
  geometry.setIndex(new THREE.BufferAttribute(indices, 1));
  geometry.setDrawRange(0, 0);

  const trailMaterial = new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    depthTest: true,
    side: THREE.DoubleSide,
  });
  const trailMesh = new THREE.Mesh(geometry, trailMaterial) as SolidTrailMesh;
  trailMesh.renderOrder = 1;
  trailMesh.frustumCulled = false;
  trailMesh.userData.positions = positions;

  return { trailMesh, trailMaterial };
}

function createTargetLine(color: string, opacity: number, renderOrder: number): TargetLine {
  const positions = new Float32Array(6);
  const geometry = new THREE.BufferGeometry();
  const positionAttribute = new THREE.BufferAttribute(positions, 3);
  positionAttribute.setUsage(THREE.DynamicDrawUsage);
  geometry.setAttribute("position", positionAttribute);

  const line = new THREE.Line(
    geometry,
    new THREE.LineBasicMaterial({
      color,
      transparent: true,
      opacity,
      depthWrite: false,
      depthTest: false,
    }),
  );
  line.renderOrder = renderOrder;
  line.frustumCulled = false;

  return { line, geometry, positions };
}

function createRpmHud(playerSpinner: SpinnerState, enemySpinnerList: SpinnerState[]): RpmHudElements[] {
  const elements: RpmHudElements[] = [];
  const playerRoot = document.querySelector<HTMLElement>("[data-player-rpm]");
  const enemyRoot = document.querySelector<HTMLElement>("[data-enemy-rpms]");

  if (playerRoot) {
    playerRoot.replaceChildren();
    elements.push(createRpmCard(playerRoot, playerSpinner, "player"));
    dashHudElements = createDashHud(playerRoot);
    ultimateHudElements = createUltimateHud(playerRoot);
  } else {
    dashHudElements = null;
    ultimateHudElements = null;
  }

  if (enemyRoot) {
    enemyRoot.replaceChildren();
    for (const enemySpinner of enemySpinnerList.slice(0, 9)) {
      elements.push(createRpmCard(enemyRoot, enemySpinner, "enemy"));
    }
  }

  return elements;
}

function createRpmCard(root: HTMLElement, spinner: SpinnerState, variant: "player" | "enemy"): RpmHudElements {
  const card = document.createElement("div");
  card.className = `rpm-card ${variant}`;

  const label = document.createElement("div");
  label.className = "rpm-label";

  const name = document.createElement("span");
  name.textContent = spinner.name;

  const value = document.createElement("span");
  value.textContent = `${Math.ceil(spinner.currentRPM)} / ${Math.ceil(spinner.maxRPM)} RPM`;

  const track = document.createElement("div");
  track.className = "rpm-track";

  const cap = document.createElement("div");
  cap.className = "rpm-cap";

  const fill = document.createElement("div");
  fill.className = "rpm-fill";

  label.append(name, value);
  track.append(cap, fill);
  let bonusIcons: HTMLElement | undefined;
  if (variant === "player") {
    bonusIcons = document.createElement("div");
    bonusIcons.className = "bonus-icons";
    bonusIcons.hidden = true;
    card.append(bonusIcons);
  }
  card.append(label, track);
  root.append(card);

  return { root: card, fill, cap, value, bonusIcons };
}

function createDashHud(root: HTMLElement): DashHudElements {
  const card = document.createElement("div");
  card.className = "dash-card";

  const label = document.createElement("div");
  label.className = "dash-label";

  const name = document.createElement("span");
  name.textContent = t("hud.dash");

  const value = document.createElement("span");
  value.textContent = t("hud.ready").toUpperCase();

  const track = document.createElement("div");
  track.className = "dash-track";

  const fill = document.createElement("div");
  fill.className = "dash-fill";

  label.append(name, value);
  track.append(fill);
  card.append(label, track);
  root.append(card);

  return { root: card, fill, value };
}

function createUltimateHud(root: HTMLElement): UltimateHudElements {
  const card = document.createElement("div");
  card.className = "ultimate-card";

  const label = document.createElement("div");
  label.className = "ultimate-label";

  const name = document.createElement("span");
  name.textContent = t("hud.ultimate");

  const value = document.createElement("span");
  value.textContent = "0%";

  const track = document.createElement("div");
  track.className = "ultimate-track";

  const fill = document.createElement("div");
  fill.className = "ultimate-fill";

  label.append(name, value);
  track.append(fill);
  card.append(label, track);
  root.append(card);

  return { root: card, fill, value };
}

function setupSettingTooltips(): void {
  const enemyCountRow = document.querySelector<HTMLElement>("[data-enemy-count]")?.closest<HTMLElement>(".setting-row");
  if (enemyCountRow) {
    enemyCountRow.dataset.tooltip =
      "РљРѕР»РёС‡РµСЃС‚РІРѕ Р±РѕС‚РѕРІ РЅР° Р°СЂРµРЅРµ. Р”РІРёР¶РµРЅРёРµ, RPM Рё СѓСЂРѕРЅ Сѓ РЅРёС… СЃС‡РёС‚Р°СЋС‚СЃСЏ РїРѕ С‚РµРј Р¶Рµ РїСЂР°РІРёР»Р°Рј, С‡С‚Рѕ Сѓ РёРіСЂРѕРєР°.";
  }

  const tooltips: Record<string, string> = {
    baseMoveSpeed:
      "РњР°РєСЃРёРјР°Р»СЊРЅР°СЏ СЃРєРѕСЂРѕСЃС‚СЊ РґРІРёР¶РµРЅРёСЏ РїСЂРё РїРѕР»РЅРѕРј RPM. Р§РµРј РІС‹С€Рµ Р·РЅР°С‡РµРЅРёРµ, С‚РµРј Р±С‹СЃС‚СЂРµРµ СЃРїРёРЅРЅРµСЂ РґРѕРіРѕРЅСЏРµС‚ РєСѓСЂСЃРѕСЂ РёР»Рё AI-С†РµР»СЊ.",
    springStrength:
      "РЎРёР»Р° РїСЂРёС‚СЏР¶РµРЅРёСЏ Рє С†РµР»Рё. Р‘РѕР»СЊС€РµРµ Р·РЅР°С‡РµРЅРёРµ Р°РіСЂРµСЃСЃРёРІРЅРµРµ СѓСЃРєРѕСЂСЏРµС‚ СЃРїРёРЅРЅРµСЂ Рє РєСѓСЂСЃРѕСЂСѓ РёР»Рё AI-С†РµР»Рё, РЅРѕ СЃРєРѕСЂРѕСЃС‚СЊ РІСЃС‘ СЂР°РІРЅРѕ РѕРіСЂР°РЅРёС‡РµРЅР° Max speed.",
    springDamping:
      "Р”РµРјРїС„РёСЂРѕРІР°РЅРёРµ РґРІРёР¶РµРЅРёСЏ. Р‘РѕР»СЊС€РµРµ Р·РЅР°С‡РµРЅРёРµ СЃРёР»СЊРЅРµРµ РіР°СЃРёС‚ РёРЅРµСЂС†РёСЋ Рё РїРµСЂРµР»С‘С‚, РјРµРЅСЊС€РµРµ РґРµР»Р°РµС‚ РґРІРёР¶РµРЅРёРµ Р±РѕР»РµРµ СЂРµР·РєРёРј.",
    minMoveSpeedRatio:
      "РњРёРЅРёРјР°Р»СЊРЅР°СЏ РґРѕР»СЏ СЃРєРѕСЂРѕСЃС‚Рё РїСЂРё РЅРёР·РєРѕРј RPM. РќР°РїСЂРёРјРµСЂ, 30% Р·РЅР°С‡РёС‚, С‡С‚Рѕ РїРѕС‡С‚Рё РІС‹Р±РёС‚С‹Р№ СЃРїРёРЅРЅРµСЂ РІСЃС‘ РµС‰С‘ РґРІРёР¶РµС‚СЃСЏ, РЅРѕ Р·Р°РјРµС‚РЅРѕ РјРµРґР»РµРЅРЅРµРµ.",
    globalAttackLimit:
      "РњР°РєСЃРёРјР°Р»СЊРЅРѕРµ РєРѕР»РёС‡РµСЃС‚РІРѕ Р±РѕС‚РѕРІ, РєРѕС‚РѕСЂС‹Рµ РјРѕРіСѓС‚ РѕРґРЅРѕРІСЂРµРјРµРЅРЅРѕ РЅР°С…РѕРґРёС‚СЊСЃСЏ РІ Р°РєС‚РёРІРЅРѕР№ С„Р°Р·Рµ С‚Р°СЂР°РЅР°.",
    maxAttackersPerTarget: "РњР°РєСЃРёРјР°Р»СЊРЅРѕРµ РєРѕР»РёС‡РµСЃС‚РІРѕ Р°РєС‚РёРІРЅС‹С… С‚Р°СЂР°РЅРѕРІ РїРѕ РѕРґРЅРѕР№ Рё С‚РѕР№ Р¶Рµ С†РµР»Рё.",
    windupDistance: "Р”РёСЃС‚Р°РЅС†РёСЏ СЂР°Р·РіРѕРЅР°: Р±РѕС‚ СЃС‚Р°СЂР°РµС‚СЃСЏ Р·Р°РЅСЏС‚СЊ СЌС‚Сѓ РїРѕР·РёС†РёСЋ РїРµСЂРµРґ С„РёРєСЃР°С†РёРµР№ С‚Р°СЂР°РЅР°.",
    separationStrength: "РЎРёР»Р° Р»РѕРєР°Р»СЊРЅРѕРіРѕ СѓРєР»РѕРЅРµРЅРёСЏ, С‡С‚РѕР±С‹ Р±РѕС‚С‹ РЅРµ СЃР»РёРїР°Р»РёСЃСЊ РІ С‚РѕР»РїСѓ.",
    predictionTurnFactor:
      "РљРѕСЌС„С„РёС†РёРµРЅС‚ РїСЂРµРґСЃРєР°Р·Р°РЅРёСЏ С†РµР»Рё. Р’СЂРµРјСЏ РїСЂРѕРіРЅРѕР·Р° СЃС‡РёС‚Р°РµС‚СЃСЏ РєР°Рє РґРёСЃС‚Р°РЅС†РёСЏ, СѓРјРЅРѕР¶РµРЅРЅР°СЏ РЅР° СЌС‚Рѕ Р·РЅР°С‡РµРЅРёРµ.",
    attackCooldown: "Р’СЂРµРјСЏ РІРѕСЃСЃС‚Р°РЅРѕРІР»РµРЅРёСЏ РїРѕСЃР»Рµ Р·Р°РІРµСЂС€РµРЅРёСЏ РёР»Рё РѕС‚РјРµРЅС‹ Р°С‚Р°РєРё.",
    crowdPenalty: "РЁС‚СЂР°С„ РґР»СЏ С†РµР»РµР№, РІРѕРєСЂСѓРі РєРѕС‚РѕСЂС‹С… СѓР¶Рµ РјРЅРѕРіРѕ СЃРїРёРЅРЅРµСЂРѕРІ.",
    botCursorMinRadius: "РњРёРЅРёРјР°Р»СЊРЅР°СЏ РґРёСЃС‚Р°РЅС†РёСЏ РѕС‚ Р±РѕС‚Р° РґРѕ РµРіРѕ РІРёСЂС‚СѓР°Р»СЊРЅРѕРіРѕ РєСѓСЂСЃРѕСЂР°.",
  };

  for (const input of document.querySelectorAll<HTMLInputElement>("[data-control-setting]")) {
    const key = input.dataset.controlSetting;
    const tooltip = key ? tooltips[key] : undefined;
    const row = input.closest<HTMLElement>(".setting-row");
    if (row && tooltip) {
      row.dataset.tooltip = tooltip;
    }
  }
}

function setupEnemyCountControl(): void {
  const input = document.querySelector<HTMLInputElement>("[data-enemy-count]");
  const output = document.querySelector<HTMLOutputElement>("[data-enemy-count-value]");
  if (!input) {
    return;
  }
  restoreStoredInputValue(input, "enemyCount");

  const syncEnemyCount = (): void => {
    const enemyCount = THREE.MathUtils.clamp(Math.round(Number(input.value)), 0, 9);
    input.value = String(enemyCount);
    storeInputValue("enemyCount", input.value);
    if (output) {
      output.value = String(enemyCount);
    }
    setEnemyCount(enemyCount);
  };

  input.addEventListener("input", syncEnemyCount);
  syncEnemyCount();
}

function setupSpinnerSizeControl(): void {
  const input = document.querySelector<HTMLInputElement>("[data-spinner-size]");
  const output = document.querySelector<HTMLOutputElement>("[data-spinner-size-value]");
  if (!input) {
    return;
  }
  input.value = String(spinnerSizeScale);
  restoreStoredInputValue(input, "spinnerSize");

  const syncSpinnerSize = (): void => {
    const value = clampTextureInputValue(input, Number(input.value));
    if (!Number.isFinite(value)) {
      return;
    }

    input.value = String(value);
    storeInputValue("spinnerSize", input.value);
    if (output) {
      output.value = value.toFixed(2);
    }
    applySpinnerSizeScale(value);
  };

  input.addEventListener("input", syncSpinnerSize);
  syncSpinnerSize();
}

function applySpinnerSizeScale(scale: number): void {
  spinnerSizeScale = scale;
  for (const spinner of combatSpinners) {
    spinner.radius = spinner.baseRadius * spinnerSizeScale;
    spinner.group.scale.setScalar(spinnerSizeScale);
  }
}

function setupStartMenu(): void {
  const menu = document.querySelector<HTMLElement>("[data-start-menu]");
  const startButton = document.querySelector<HTMLButtonElement>("[data-start-match]");
  document.body.classList.toggle("match-started", matchStarted);
  document.body.style.setProperty("--menu-background", `url("${backgroundImageUrl}")`);

  for (const element of elementOrder) {
    const button = document.querySelector<HTMLButtonElement>(`[data-element-choice="${element}"]`);
    const image = button?.querySelector<HTMLImageElement>("img");
    if (!button || !image) {
      continue;
    }
    image.src = elementIconByElement[element];
    const label = t(`element.${element}`);
    button.setAttribute("aria-label", label);
    button.title = label;
    button.addEventListener("click", () => setSelectedElement(element));
  }

  applyMenuTranslations();
  setSelectedElement(selectedElement);

  startButton?.addEventListener("click", () => {
    matchStarted = true;
    physicsAccumulator = 0;
    pointerHasWorldTarget = false;
    mobileControls?.reset();
    menu?.setAttribute("hidden", "");
    document.body.classList.add("match-started");
    updateHudSystems();
    startUiUpdateTimers();
    startGameLoop();
  });
}

function setupMobileControls(): void {
  const stick = document.querySelector<HTMLElement>("[data-mobile-joystick]");
  const thumb = document.querySelector<HTMLElement>("[data-mobile-joystick-thumb]");
  const dashButton = document.querySelector<HTMLButtonElement>("[data-mobile-dash]");
  const ultimateButton = document.querySelector<HTMLButtonElement>("[data-mobile-ultimate]");
  if (!stick || !thumb || !dashButton || !ultimateButton) {
    return;
  }

  mobileControls = createMobileControls({
    stick,
    thumb,
    dashButton,
    ultimateButton,
    onMove: updateMobileMoveDirection,
    onDash: tryStartPlayerMobileDash,
    onUltimate: tryActivatePlayerUltimate,
  });
}

function setupDeathmatchContinueButton(): void {
  deathmatchScoreboardButton?.addEventListener("click", () => {
    if (deathmatchOverlayOpen) {
      closeDeathmatchOverlay();
    } else {
      openDeathmatchOverlay(false);
    }
  });

  deathmatchContinueButton?.addEventListener("click", () => {
    if (player.deathmatchStatus !== "respawning" || player.respawnTimer > 0) {
      return;
    }
    startDeathmatchRespawnDash(player);
    if (deathmatchOverlayOpenedByDeath) {
      closeDeathmatchOverlay();
    }
  });
}

function applyMenuTranslations(): void {
  for (const element of document.querySelectorAll<HTMLElement>("[data-i18n]")) {
    const key = element.dataset.i18n;
    if (key) {
      element.textContent = t(key as Parameters<typeof t>[0]);
    }
  }
  for (const element of document.querySelectorAll<HTMLElement>("[data-i18n-aria]")) {
    const key = element.dataset.i18nAria;
    if (key) {
      const label = t(key as Parameters<typeof t>[0]);
      element.setAttribute("aria-label", label);
      element.title = label;
    }
  }
}

function setSelectedElement(element: SpinnerElement): void {
  selectedElement = element;
  if (selectedElement !== "lightning") {
    lightningChainVfx.cancelForSpinner(player);
  }
  replaceUltimateVfx(player, ultimateAuraPresetByElement[selectedElement]);
  for (const button of document.querySelectorAll<HTMLButtonElement>("[data-element-choice]")) {
    button.classList.toggle("selected", button.dataset.elementChoice === selectedElement);
    button.setAttribute("aria-pressed", String(button.dataset.elementChoice === selectedElement));
  }
}

function replaceUltimateVfx(spinner: SpinnerState, preset: TornadoVfxPreset): void {
  spinner.group.remove(spinner.ultimateVfx.group);
  spinner.ultimateVfx.dispose();
  spinner.ultimateVfx = new TornadoVfx(preset);
  spinner.ultimateVfx.group.visible = false;
  spinner.group.add(spinner.ultimateVfx.group);
}

function setupBotDifficultyControls(): void {
  const buttons = Array.from(document.querySelectorAll<HTMLButtonElement>("[data-bot-difficulty]"));
  const storedDifficulty = localStorage.getItem(`${debugSettingStoragePrefix}botDifficulty`);
  if (isBotDifficulty(storedDifficulty)) {
    botDifficulty = storedDifficulty;
  }

  const applyDifficulty = (difficulty: BotDifficulty): void => {
    botDifficulty = difficulty;
    botAiDecisionCountdown = 0;
    botAiDecisionElapsedTime = 0;
    storeInputValue("botDifficulty", difficulty);
    for (const button of buttons) {
      button.classList.toggle("active", button.dataset.botDifficulty === difficulty);
    }
  };

  for (const button of buttons) {
    const difficulty = button.dataset.botDifficulty;
    if (!isBotDifficulty(difficulty)) {
      continue;
    }
    button.addEventListener("click", () => applyDifficulty(difficulty));
  }

  applyDifficulty(botDifficulty);
}

function setupLightControls(): void {
  const panel = document.querySelector<HTMLElement>("[data-light-settings-panel]");
  const toggle = document.querySelector<HTMLButtonElement>("[data-light-settings-toggle]");
  const storedPanelHidden = localStorage.getItem(`${debugSettingStoragePrefix}light.panelHidden`);
  let panelHidden = storedPanelHidden === "true";

  const syncPanelVisibility = (): void => {
    if (panel) {
      panel.hidden = panelHidden;
    }
    if (toggle) {
      toggle.setAttribute("aria-pressed", String(!panelHidden));
    }
    localStorage.setItem(`${debugSettingStoragePrefix}light.panelHidden`, String(panelHidden));
  };

  toggle?.addEventListener("click", () => {
    panelHidden = !panelHidden;
    syncPanelVisibility();
  });

  for (const input of document.querySelectorAll<HTMLInputElement>("[data-light-setting]")) {
    const setting = input.dataset.lightSetting;
    if (!isLightSetting(setting)) {
      continue;
    }

    const numberInput = document.querySelector<HTMLInputElement>(`[data-light-value="${setting}"]`);
    restoreStoredInputValue(input, `light.${setting}`);
    if (numberInput) {
      numberInput.value = input.value;
    }

    const syncLightSetting = (): void => {
      const value = clampTextureInputValue(input, Number(input.value));
      if (!Number.isFinite(value)) {
        return;
      }

      input.value = String(value);
      if (numberInput) {
        numberInput.value = String(value);
      }
      storeInputValue(`light.${setting}`, input.value);
      lightSettings[setting] = value;
      applyLightSettings();
    };

    input.addEventListener("input", syncLightSetting);
    numberInput?.addEventListener("input", () => {
      input.value = numberInput.value;
      syncLightSetting();
    });
    syncLightSetting();
  }

  const disableLightInput = document.querySelector<HTMLInputElement>("[data-light-disabled]");
  if (disableLightInput) {
    const stored = localStorage.getItem(`${debugSettingStoragePrefix}light.disabled`);
    if (stored !== null) {
      disableLightInput.checked = stored === "true";
    }
    const syncLightDisabled = (): void => {
      lightSettings.disabled = disableLightInput.checked;
      localStorage.setItem(`${debugSettingStoragePrefix}light.disabled`, String(disableLightInput.checked));
      applyLightSettings();
    };
    disableLightInput.addEventListener("change", syncLightDisabled);
    syncLightDisabled();
  }

  syncPanelVisibility();
}

function applyLightSettings(): void {
  const lightMultiplier = lightSettings.disabled ? 0 : 1;
  ambientLight.intensity = lightSettings.ambient * lightMultiplier;
  hemisphereLight.intensity = lightSettings.hemisphere * lightMultiplier;
  keyLight.intensity = lightSettings.key * lightMultiplier;
  fillLight.intensity = lightSettings.fill * lightMultiplier;
}

function isLightSetting(value: string | undefined): value is Exclude<keyof typeof lightSettings, "disabled"> {
  return value === "ambient" || value === "hemisphere" || value === "key" || value === "fill";
}

function clampTextureInputValue(rangeInput: HTMLInputElement, value: number): number {
  const min = rangeInput.min === "" ? -Infinity : Number(rangeInput.min);
  const max = rangeInput.max === "" ? Infinity : Number(rangeInput.max);
  return THREE.MathUtils.clamp(value, min, max);
}

function isBotDifficulty(value: string | null | undefined): value is BotDifficulty {
  return value === "easy" || value === "normal" || value === "hard";
}

function restoreStoredInputValue(input: HTMLInputElement, key: string | undefined): void {
  if (!key) {
    return;
  }

  const storedValue = localStorage.getItem(`${debugSettingStoragePrefix}${key}`);
  if (storedValue === null) {
    return;
  }

  const value = Number(storedValue);
  if (!Number.isFinite(value)) {
    return;
  }

  const min = input.min === "" ? -Infinity : Number(input.min);
  const max = input.max === "" ? Infinity : Number(input.max);
  input.value = String(THREE.MathUtils.clamp(value, min, max));
}

function getStoredDebugNumber(key: string, min: number, max: number, fallback: number): number {
  const storedValue = localStorage.getItem(`${debugSettingStoragePrefix}${key}`);
  if (storedValue === null) {
    return fallback;
  }

  const value = Number(storedValue);
  if (!Number.isFinite(value)) {
    return fallback;
  }

  return THREE.MathUtils.clamp(value, min, max);
}

function storeInputValue(key: string | undefined, value: string): void {
  if (!key) {
    return;
  }

  localStorage.setItem(`${debugSettingStoragePrefix}${key}`, value);
}

function updateRpmHud(elements: RpmHudElements[]): void {
  const hudSpinners = [player, ...enemySpinners];
  for (let i = 0; i < elements.length; i += 1) {
    const spinner = hudSpinners[i];
    const element = elements[i];
    if (!spinner) {
      element.root.hidden = true;
      continue;
    }

    element.root.hidden = false;
    element.root.classList.toggle("respawning", spinner.deathmatchStatus === "respawning");
    element.root.classList.toggle("invulnerable", spinner.deathmatchStatus === "alive" && spinner.invulnerabilityTimer > 0);
    if (spinner.deathmatchStatus === "respawning") {
      element.fill.style.transform = "scaleX(0)";
      element.cap.style.transform = "scaleX(0)";
      element.value.textContent = `${t("hud.respawn").toUpperCase()} ${spinner.respawnTimer.toFixed(1)}s`;
      if (element.bonusIcons) {
        element.bonusIcons.hidden = true;
      }
      continue;
    }

    const currentRatio = spinner.absoluteMaxRPM > 0 ? THREE.MathUtils.clamp(spinner.currentRPM / spinner.absoluteMaxRPM, 0, 1) : 0;
    const capRatio = spinner.absoluteMaxRPM > 0 ? THREE.MathUtils.clamp(spinner.maxRPM / spinner.absoluteMaxRPM, 0, 1) : 0;
    element.fill.style.transform = `scaleX(${currentRatio})`;
    element.cap.style.transform = `scaleX(${capRatio})`;
    const invulnerabilityLabel = spinner.invulnerabilityTimer > 0 ? ` · ${t("hud.invulnerable").toUpperCase()} ${spinner.invulnerabilityTimer.toFixed(1)}s` : "";
    element.value.textContent = `${Math.ceil(spinner.currentRPM)} / ${Math.ceil(spinner.maxRPM)} RPM${invulnerabilityLabel}`;
    if (element.bonusIcons) {
      updatePlayerBonusHud(element.bonusIcons, spinner);
    }
  }
}

function updatePlayerBonusHud(root: HTMLElement, spinner: SpinnerState): void {
  root.replaceChildren();
  root.hidden = spinner.bonusEffects.length === 0;
  if (root.hidden) {
    return;
  }

  for (const type of arenaBonusTypes) {
    const effect = spinner.bonusEffects.find((item) => item.type === type);
    if (!effect) {
      continue;
    }

    const ratio = THREE.MathUtils.clamp(effect.timeRemaining / arenaBonusState.settings.effectDuration, 0, 1);
    const icon = document.createElement("div");
    icon.className = "bonus-icon";
    icon.style.setProperty("--bonus-color", arenaBonusColorByType[type]);
    icon.title = arenaBonusHudLabelByType[type];
    icon.setAttribute("role", "img");
    icon.setAttribute("aria-label", `${arenaBonusHudLabelByType[type]} ${Math.ceil(effect.timeRemaining)} seconds`);

    const fill = document.createElement("div");
    fill.className = "bonus-icon-fill";
    fill.style.transform = `scaleY(${ratio})`;

    const grid = document.createElement("div");
    grid.className = "bonus-icon-grid";

    icon.append(fill, grid);
    root.append(icon);
  }
}

function updateDeathmatchLeaderboard(): void {
  if (!deathmatchLeaderboardElement || !deathmatchOverlayOpen) {
    return;
  }

  const rows = getDeathmatchLeaderboardRows(getDeathmatchParticipants());
  const title = document.createElement("div");
  title.className = "deathmatch-leaderboard-title";
  title.textContent = "Deathmatch";

  const table = document.createElement("table");
  table.className = "deathmatch-leaderboard-table";

  const header = document.createElement("thead");
  const headerRow = document.createElement("tr");
  for (const label of ["#", "Name", "K", "D", "Crit", "Rating"]) {
    const cell = document.createElement("th");
    cell.textContent = label;
    headerRow.append(cell);
  }
  header.append(headerRow);

  const body = document.createElement("tbody");
  for (const row of rows) {
    const tr = document.createElement("tr");
    tr.classList.toggle("player", row.participant === player);
    tr.classList.toggle("respawning", row.participant.deathmatchStatus === "respawning");
    tr.classList.toggle("invulnerable", row.participant.deathmatchStatus === "alive" && row.participant.invulnerabilityTimer > 0);

    const cells = [
      String(row.rank),
      row.participant.name,
      String(row.participant.kills),
      String(row.participant.deaths),
      String(row.participant === player ? row.participant.playerCriticalHits : 0),
      String(row.rating),
    ];

    for (const value of cells) {
      const cell = document.createElement("td");
      cell.textContent = value;
      tr.append(cell);
    }
    body.append(tr);
  }

  table.append(header, body);
  deathmatchLeaderboardElement.replaceChildren(title, table);
}

function openDeathmatchOverlay(openedByDeath: boolean): void {
  deathmatchOverlayOpen = true;
  deathmatchOverlayOpenedByDeath = openedByDeath;
  updateDeathmatchOverlay();
  updateDeathmatchLeaderboard();
}

function closeDeathmatchOverlay(): void {
  deathmatchOverlayOpen = false;
  deathmatchOverlayOpenedByDeath = false;
  updateDeathmatchOverlay();
}

function updateDeathmatchOverlay(): void {
  deathmatchOverlayElement?.toggleAttribute("hidden", !deathmatchOverlayOpen);
  deathmatchScoreboardButton?.classList.toggle("active", deathmatchOverlayOpen);
  if (deathmatchScoreboardButton) {
    deathmatchScoreboardButton.setAttribute("aria-pressed", String(deathmatchOverlayOpen));
  }
}

function updateDeathmatchContinueButton(): void {
  if (!deathmatchContinueButton) {
    return;
  }

  const playerRespawning = player.deathmatchStatus === "respawning";
  deathmatchContinueButton.hidden = !playerRespawning;
  deathmatchContinueButton.classList.toggle("ready", playerRespawning && player.respawnTimer <= 0);
  if (!playerRespawning) {
    deathmatchContinueButton.disabled = true;
    setButtonLabel(deathmatchContinueButton, t("hud.continue"));
    return;
  }

  const ready = player.respawnTimer <= 0;
  deathmatchContinueButton.disabled = !ready;
  setButtonLabel(deathmatchContinueButton, ready ? t("hud.continue") : `${t("hud.continueIn")} ${Math.ceil(player.respawnTimer)}s`);
}

function setButtonLabel(button: HTMLButtonElement, label: string): void {
  let labelElement = button.querySelector("span");
  if (!labelElement) {
    labelElement = document.createElement("span");
    button.replaceChildren(labelElement);
  }
  labelElement.textContent = label;
}

function updateDashHud(elements: DashHudElements | null): void {
  if (!elements) {
    return;
  }

  const dash = player.dash;
  const ready = dash.cooldownRemaining <= 0 && dash.activeTimeRemaining <= 0;
  const active = dash.activeTimeRemaining > 0;
  const cooldownProgress = 1 - THREE.MathUtils.clamp(dash.cooldownRemaining / dash.settings.cooldown, 0, 1);
  const progress = active ? 1 : cooldownProgress;

  elements.root.classList.toggle("ready", ready);
  elements.root.classList.toggle("active", active);
  elements.fill.style.transform = `scaleX(${progress})`;
  elements.value.textContent = active ? t("hud.dash").toUpperCase() : ready ? t("hud.ready").toUpperCase() : `${dash.cooldownRemaining.toFixed(1)}s`;
}

function updateUltimateHud(elements: UltimateHudElements | null): void {
  if (!elements) {
    return;
  }

  const active = isUltimateActive(player.ultimate);
  const ready = isUltimateReady(player.ultimate);
  const ratio = getUltimateChargeRatio(player.ultimate);
  const activeRatio = player.ultimate.settings.activeDuration > 0
    ? THREE.MathUtils.clamp(player.ultimate.activeTimeRemaining / player.ultimate.settings.activeDuration, 0, 1)
    : 0;
  elements.root.classList.toggle("ready", ready);
  elements.root.classList.toggle("active", active);
  elements.fill.style.transform = `scaleX(${active ? activeRatio : ratio})`;
  elements.value.textContent = active
    ? `${t("hud.active").toUpperCase()} ${player.ultimate.activeTimeRemaining.toFixed(1)}s`
    : ready
      ? t("hud.ready").toUpperCase()
      : `${Math.floor(ratio * 100)}%`;
}

function updateMobileControls(): void {
  if (!mobileControls) {
    return;
  }

  const dashReady = player.dash.cooldownRemaining <= 0 && player.dash.activeTimeRemaining <= 0;
  const dashActive = player.dash.activeTimeRemaining > 0;
  mobileControls.setDashReady(dashReady, dashActive);
  mobileControls.setUltimateReady(isUltimateReady(player.ultimate), isUltimateActive(player.ultimate));
}

function updateFpsCounter(deltaTime: number): void {
  if (!fpsCounterElement) {
    return;
  }

  fpsFrameCount += 1;
  fpsElapsedTime += deltaTime;
  if (fpsElapsedTime < 0.5) {
    return;
  }

  const fps = Math.round(fpsFrameCount / fpsElapsedTime);
  fpsCounterElement.textContent = `FPS: ${fps}`;
  fpsFrameCount = 0;
  fpsElapsedTime = 0;
}

function handlePointer(event: PointerEvent): void {
  event.preventDefault();
  if (!matchStarted) {
    return;
  }
  updatePlayerPointerTarget(event.clientX, event.clientY);
}

function handlePointerDown(event: PointerEvent): void {
  event.preventDefault();
  if (!matchStarted) {
    return;
  }
  if (event.pointerType === "mouse" && event.button === 2) {
    tryActivatePlayerUltimate();
    return;
  }

  const target = updatePlayerPointerTarget(event.clientX, event.clientY);
  if (event.pointerType === "mouse" && event.button === 0 && target) {
    tryStartPlayerDash(target);
  }
}

function updatePlayerPointerTarget(clientX: number, clientY: number): THREE.Vector3 | null {
  if (!isDeathmatchAlive(player) || player.respawnDash.active) {
    return null;
  }

  const worldPoint = screenPointerToWorld(clientX, clientY);
  if (!worldPoint) {
    return null;
  }

  setPlayerTarget(worldPoint, worldPoint);
  pointerHasWorldTarget = true;
  return worldPoint;
}

function tryStartPlayerDash(target: THREE.Vector3): void {
  if (!isDeathmatchAlive(player) || player.knockback.active || player.respawnDash.active) {
    return;
  }

  const direction = target.clone().sub(player.group.position);
  direction.y = 0;
  tryStartPlayerDashInDirection(direction);
}

function tryStartPlayerMobileDash(): void {
  if (applyPlayerMobileTarget()) {
    tryStartPlayerDashInDirection(mobileMoveDirection);
    return;
  }

  const direction = scratchVector.subVectors(player.visualTargetPosition, player.group.position);
  direction.y = 0;
  if (direction.lengthSq() <= 0.000001) {
    direction.copy(player.forwardDirection);
    direction.y = 0;
  }
  tryStartPlayerDashInDirection(direction);
}

function tryStartPlayerDashInDirection(direction: THREE.Vector3): void {
  if (!isDeathmatchAlive(player) || player.knockback.active || player.respawnDash.active) {
    return;
  }

  tryStartDash(player.dash, { x: direction.x, z: direction.z });
}

function tryActivatePlayerUltimate(): void {
  if (!isDeathmatchAlive(player) || player.respawnDash.active) {
    return;
  }

  if (tryActivateUltimate(player.ultimate)) {
    player.pulseTimer = 0.28;
    const result = activateElementalSkill(
      elementalSkillState,
      player,
      enemySpinners,
      selectedElement,
      (spinner) => isDeathmatchDamageable(spinner) && !spinner.respawnDash.active,
    );
    const damage = applyElementalSkillResult(result);
    processDamageEvents(damage.damageEvents);
  }
}

function refreshSpinnerSurfaceHeights(): void {
  for (const spinner of combatSpinners) {
    updateSpinnerVerticalState(spinner, 0);
    spinner.targetPosition.copy(projectToArenaSurface(spinner.targetPosition));
    spinner.desiredTargetPosition.copy(projectToArenaSurface(spinner.desiredTargetPosition));
    spinner.followTargetPosition.copy(projectToArenaSurface(spinner.followTargetPosition));
    spinner.visualTargetPosition.copy(projectToArenaSurface(spinner.visualTargetPosition));
    spinner.botVirtualCursorPosition.copy(projectToArenaSurface(spinner.botVirtualCursorPosition));
    spinner.botDesiredCursorPosition.copy(projectToArenaSurface(spinner.botDesiredCursorPosition));
    spinner.knockback.fromPosition.copy(projectToArenaSurface(spinner.knockback.fromPosition));
    spinner.knockback.toPosition.copy(projectToArenaSurface(spinner.knockback.toPosition));
    spinner.respawnDash.fromPosition.copy(projectToArenaSurface(spinner.respawnDash.fromPosition));
    spinner.respawnDash.toPosition.copy(projectToArenaSurface(spinner.respawnDash.toPosition));
    spinner.trailPoints.length = 0;
    spinner.previousTrailPosition.copy(spinner.group.position);
  }
}

function updateDeathCamera(deltaTime: number): void {
  if (!deathCameraActive && !deathCameraReturning) {
    return;
  }

  const response = 1 - Math.exp(-deathCameraReturnSpeed * deltaTime);
  if (deathCameraActive) {
    const lookAt = player.group.position.clone().add(new THREE.Vector3(cameraSettings.deathLookAtX, cameraSettings.deathLookAtY, cameraSettings.deathLookAtZ));
    const targetPosition = player.group.position.clone().add(new THREE.Vector3(cameraSettings.deathOffsetX, cameraSettings.deathOffsetY, cameraSettings.deathOffsetZ));
    camera.position.lerp(targetPosition, response);
    cameraLookAtTarget.lerp(lookAt, response);
    camera.lookAt(cameraLookAtTarget);
    return;
  }

  camera.position.lerp(savedCameraPosition, response);
  cameraLookAtTarget.lerp(savedCameraLookAt, response);
  camera.lookAt(cameraLookAtTarget);
  if (
    camera.position.distanceToSquared(savedCameraPosition) <= 0.0001
    && cameraLookAtTarget.distanceToSquared(savedCameraLookAt) <= 0.0001
  ) {
    camera.position.copy(savedCameraPosition);
    cameraLookAtTarget.copy(savedCameraLookAt);
    camera.lookAt(cameraLookAtTarget);
    deathCameraReturning = false;
  }
}

function preventContextMenu(event: Event): void {
  event.preventDefault();
}

function setPlayerTarget(target: THREE.Vector3, visualTarget: THREE.Vector3): void {
  setSpinnerTarget(player, target, visualTarget);
}

function setSpinnerTarget(spinner: SpinnerState, target: THREE.Vector3, visualTarget = target): void {
  const surfaceTarget = projectToArenaSurface(target);
  const surfaceVisualTarget = projectToArenaSurface(visualTarget);
  spinner.targetPosition.copy(surfaceTarget);
  spinner.desiredTargetPosition.copy(surfaceTarget);
  spinner.followTargetPosition.copy(surfaceTarget);
  spinner.visualTargetPosition.copy(surfaceVisualTarget);
}

function screenPointerToWorld(clientX: number, clientY: number): THREE.Vector3 | null {
  const rect = renderer.domElement.getBoundingClientRect();
  pointerNdc.x = ((clientX - rect.left) / rect.width) * 2 - 1;
  pointerNdc.y = -(((clientY - rect.top) / rect.height) * 2 - 1);

  // Raycaster translates the screen pointer into a world-space point on the arena bowl.
  raycaster.setFromCamera(pointerNdc, camera);
  const hits = raycaster.intersectObject(arena, true);
  const surfaceHit = hits.find((hit) => hit.object.userData.arenaSurface === true);
  if (surfaceHit) {
    return surfaceHit.point.clone();
  }

  const fallbackHit = raycaster.ray.intersectPlane(pointerFallbackPlane, pointerFallbackPoint);
  return fallbackHit ? fallbackHit.clone() : null;
}

function simulatePhysicsTick(deltaTime: number): void {
  elapsedTime += deltaTime;

  updateDeathmatchRespawns(deltaTime);
  updateRespawnDashes(deltaTime);
  updatePlayer(deltaTime);
  updateEnemyAi(deltaTime);
  updateArenaBonusSystems(deltaTime);
  updateHealingZones(deltaTime);

  const auraActive = isUltimateActive(player.ultimate) && isDeathmatchDamageable(player) && !player.respawnDash.active;
  syncElementalCollisionModifiers(player, selectedElement, auraActive);
  const elementalTickResult = updateElementalSkills(
    elementalSkillState,
    player,
    enemySpinners,
    auraActive,
    deltaTime,
    (spinner) => isDeathmatchDamageable(spinner) && !spinner.respawnDash.active,
  );
  const elementalDamage = applyElementalSkillResult(elementalTickResult);
  processDamageEvents(elementalDamage.damageEvents);

  const collisionResult = handleSpinnerCollisions(getDeathmatchDamageableSpinners(), elapsedTime);
  for (const knockback of collisionResult.knockbacks) {
    startSpinnerKnockback(knockback);
  }
  for (const flash of collisionResult.flashes) {
    startSpinnerFlash(flash);
  }
  for (const damageNumber of collisionResult.damageNumbers) {
    spawnDamageNumber(damageNumber);
  }
  for (const impact of collisionResult.impacts) {
    spawnImpactSparks(impact.position, impact.normal, impact.critical);
  }
  const lightningChainResult = updateLightningChainCombat(deltaTime, collisionResult.damageEvents);

  if (selectedElement === "fire" && auraActive) {
    for (const event of collisionResult.damageEvents) {
      if (event.source === player && event.target !== player) {
        elementalSkillVfx.spawnExplosion(event.position);
      }
    }
  }

  for (const spinner of combatSpinners) {
    if (!isDeathmatchAlive(spinner)) {
      continue;
    }
    updateUltimateActive(spinner.ultimate, deltaTime);
    updateUltimatePassiveCharge(spinner.ultimate, deltaTime);
    updateSpinVisuals(spinner, deltaTime);
  }
  processDamageEvents([
    ...collisionResult.damageEvents,
    ...lightningChainResult.damageEvents,
  ]);

  sparkVfxPool.update(deltaTime);
}

function updateLightningChainCombat(
  deltaTime: number,
  damageEvents: CombatDamageEvent<SpinnerState>[],
): { damageEvents: CombatDamageEvent<SpinnerState>[] } {
  const commands = lightningChainVfx.advance(deltaTime, enemySpinners, reducedMotionQuery.matches).damageCommands;
  const triggerEvent = damageEvents.find((event) => canStartLightningChain(event));
  if (triggerEvent) {
    commands.push(...lightningChainVfx.tryStart(
      player,
      triggerEvent.target,
      enemySpinners,
      reducedMotionQuery.matches,
    ).damageCommands);
  }

  const result: CombatDamageEvent<SpinnerState>[] = [];
  for (const command of commands) {
    const applied = applyDirectDamage(command.source, command.target, command.amount, command.direction);
    if (applied.damageEvent) {
      result.push(applied.damageEvent);
    }
    if (applied.damageNumber) {
      spawnDamageNumber(applied.damageNumber);
    }
  }
  return { damageEvents: result };
}

function canStartLightningChain(event: CombatDamageEvent<SpinnerState>): boolean {
  return (
    selectedElement === "lightning" &&
    isUltimateActive(player.ultimate) &&
    isDeathmatchDamageable(player) &&
    !player.respawnDash.active &&
    event.source === player &&
    event.target !== player &&
    enemySpinners.includes(event.target) &&
    isDeathmatchDamageable(event.target) &&
    !event.target.respawnDash.active
  );
}

function applyElementalSkillResult(
  result: ElementalSkillResult<SpinnerState>,
): { damageEvents: CombatDamageEvent<SpinnerState>[] } {
  const damageEvents: CombatDamageEvent<SpinnerState>[] = [];
  for (const command of result.damageCommands) {
    const applied = applyDirectDamage(command.source, command.target, command.amount, command.direction);
    if (applied.damageEvent) {
      damageEvents.push(applied.damageEvent);
    }
    if (applied.damageNumber) {
      spawnDamageNumber(applied.damageNumber);
    }
  }
  for (const command of result.launchCommands) {
    command.target.knockback.active = false;
    command.target.velocity.set(0, 0, 0);
    command.target.grounded = false;
    command.target.verticalLaunchActive = true;
    command.target.verticalVelocity = Math.max(command.target.verticalVelocity, command.verticalVelocity);
  }
  for (const command of result.freezeCommands) {
    enemySpinnerInstancedModel.setFrozen(command.target, command.frozen);
    if (!command.frozen) {
      elementalSkillVfx.spawnThawShards(command.target.group.position, command.target.radius, reducedMotionQuery.matches);
    }
  }
  for (const position of result.rockRipplePositions) {
    elementalSkillVfx.spawnRockRipple(position);
  }
  return { damageEvents };
}

function processDamageEvents(damageEvents: CombatDamageEvent<SpinnerState>[]): void {
  for (const event of damageEvents) {
    elementalSkillVfx.spawnHit(event, reducedMotionQuery.matches);
  }
  applyUltimateChargeFromDamage(damageEvents);
  updateDeathmatchScores(damageEvents);
}

function getDeathmatchParticipants(): SpinnerState[] {
  return [player, ...enemySpinners];
}

function getDeathmatchDamageableSpinners(): SpinnerState[] {
  return getDeathmatchParticipants().filter((spinner) => isDeathmatchDamageable(spinner) && !spinner.respawnDash.active);
}

function updateDeathmatchRespawns(deltaTime: number): void {
  for (const spinner of getDeathmatchParticipants()) {
    if (spinner.deathmatchStatus === "respawning") {
      spinner.respawnTimer = Math.max(0, spinner.respawnTimer - deltaTime);
      if (spinner !== player && spinner.respawnTimer <= 0) {
        startDeathmatchRespawnDash(spinner);
      }
      continue;
    }

    spinner.invulnerabilityTimer = Math.max(0, spinner.invulnerabilityTimer - deltaTime);
  }
}

function updateDeathmatchScores(damageEvents: CombatDamageEvent<SpinnerState>[]): void {
  recordPlayerCriticalHits(damageEvents, player);
  const deaths = applyDeathmatchDeaths(getDeathmatchParticipants(), damageEvents, deathmatchSettings);
  for (const death of deaths) {
    startDeathmatchRespawn(death.victim);
  }
}

function startDeathmatchRespawn(spinner: SpinnerState): void {
  const edgePoint = spinner === player ? getPlayerDeathEdgeSpawnPoint() : getArenaEdgePoint(spinner.group.position);
  spinner.group.position.copy(edgePoint);
  spinner.deathmatchStatus = "respawning";
  spinner.respawnTimer = spinner === player ? playerContinueDelay : botRespawnDelay;
  spinner.invulnerabilityTimer = 0;
  spinner.velocity.set(0, 0, 0);
  spinner.currentRPM = 0;
  spinner.maxRPM = 0;
  spinner.knockback.active = false;
  spinner.dash.activeTimeRemaining = 0;
  spinner.dash.cooldownRemaining = 0;
  spinner.ultimate.charge = 0;
  spinner.ultimate.activeTimeRemaining = 0;
  spinner.bonusEffects.length = 0;
  spinner.bonusSpeedMultiplier = 1;
  spinner.critSpeedEase = 0;
  spinner.critDamageMultiplier = 1;
  spinner.damageMultiplier = 1;
  spinner.incomingDamageMultiplier = 1;
  spinner.collisionDamageMultiplier = 1;
  spinner.collisionKnockbackMultiplier = 1;
  spinner.elementalMoveSpeedMultiplier = 1;
  spinner.elementalMovementLocked = false;
  spinner.verticalLaunchActive = false;
  spinner.grounded = true;
  spinner.verticalVelocity = 0;
  spinner.heightOffset = 0;
  spinner.distanceMovedThisTick = 0;
  spinner.pulseTimer = 0;
  lightningChainVfx.cancelForSpinner(spinner);
  if (spinner === player) {
    for (const frozenTarget of resetElementalSkillState(elementalSkillState, enemySpinners)) {
      enemySpinnerInstancedModel.setFrozen(frozenTarget, false);
    }
    syncElementalCollisionModifiers(player, selectedElement, false);
  } else {
    clearElementalTarget(elementalSkillState, spinner);
    enemySpinnerInstancedModel.setFrozen(spinner, false);
  }
  finishSpinnerFlash(spinner);
  clearSpinnerTrail(spinner);
  hideSpinnerTrailAndTarget(spinner);
  setSpinnerTarget(spinner, spinner.group.position, spinner.group.position);
  spinner.lastPosition.copy(spinner.group.position);
  spinner.previousTrailPosition.copy(spinner.group.position);
  resetSpeedLimitRatio(spinner);
  if (spinner === player) {
    pointerHasWorldTarget = false;
    savedCameraPosition.copy(camera.position);
    savedCameraLookAt.copy(cameraLookAtTarget);
    openDeathmatchOverlay(true);
    deathCameraActive = true;
    deathCameraReturning = false;
  }
}

function startDeathmatchRespawnDash(spinner: SpinnerState): void {
  const spawn = getDeathmatchSpawnPoint(spinner);
  spinner.deathmatchStatus = "alive";
  spinner.respawnTimer = 0;
  spinner.invulnerabilityTimer = deathmatchSettings.invulnerabilityDuration;
  startRespawnDash(spinner, projectToArenaSurface(spawn));
  spinner.lastPosition.copy(spinner.group.position);
  spinner.previousTrailPosition.copy(spinner.group.position);
  spinner.velocity.set(0, 0, 0);
  spinner.currentRPM = spinner.absoluteMaxRPM;
  spinner.maxRPM = spinner.absoluteMaxRPM;
  spinner.knockback.active = false;
  spinner.dash.activeTimeRemaining = 0;
  spinner.dash.cooldownRemaining = 0;
  spinner.grounded = true;
  spinner.verticalVelocity = 0;
  spinner.heightOffset = 0;
  spinner.distanceMovedThisTick = 0;
  clearSpinnerTrail(spinner);
  setSpinnerTarget(spinner, spinner.group.position, spinner.group.position);
  spinner.botVirtualCursorPosition.copy(projectPointOutsideBotCursorRadius(spinner, spinner.group.position));
  spinner.botDesiredCursorPosition.copy(spinner.botVirtualCursorPosition);
  spinner.followTargetPosition.copy(spinner.botVirtualCursorPosition);
  resetSpeedLimitRatio(spinner);
  botAiDirector.forget(spinner);
  latestEnemyAiCommands.delete(spinner);
  clearPairImpactTimes();
  if (spinner === player) {
    pointerHasWorldTarget = false;
    deathCameraActive = false;
    deathCameraReturning = true;
  }
}

function getPlayerDeathEdgeSpawnPoint(): THREE.Vector3 {
  return projectToArenaSurface(new THREE.Vector3(0, 0, activeArena.radius));
}

function startRespawnDash(spinner: SpinnerState, destination: THREE.Vector3): void {
  spinner.respawnDash.active = true;
  spinner.respawnDash.fromPosition.copy(spinner.group.position);
  spinner.respawnDash.toPosition.copy(destination);
  spinner.respawnDash.elapsed = 0;
  spinner.respawnDash.duration = respawnDashDuration;
}

function updateRespawnDashes(deltaTime: number): void {
  for (const spinner of getDeathmatchParticipants()) {
    const respawnDash = spinner.respawnDash;
    if (!respawnDash.active) {
      continue;
    }

    respawnDash.elapsed = Math.min(respawnDash.duration, respawnDash.elapsed + deltaTime);
    const ratio = respawnDash.duration > 0 ? respawnDash.elapsed / respawnDash.duration : 1;
    const eased = 1 - (1 - ratio) ** 3;
    spinner.group.position.lerpVectors(respawnDash.fromPosition, respawnDash.toPosition, eased);
    updateSpinnerVerticalState(spinner, deltaTime);
    spinner.lastPosition.copy(spinner.group.position);
    spinner.previousTrailPosition.copy(spinner.group.position);
    spinner.velocity.set(0, 0, 0);
    setSpinnerTarget(spinner, spinner.group.position, spinner.group.position);

    if (ratio >= 1) {
      respawnDash.active = false;
      spinner.group.position.copy(respawnDash.toPosition);
      setSpinnerTarget(spinner, spinner.group.position, spinner.group.position);
      if (spinner !== player) {
        spinner.botVirtualCursorPosition.copy(projectPointOutsideBotCursorRadius(spinner, spinner.group.position));
        spinner.botDesiredCursorPosition.copy(spinner.botVirtualCursorPosition);
        spinner.followTargetPosition.copy(spinner.botVirtualCursorPosition);
      }
    }
  }
}

function getDeathmatchSpawnPoint(spinner: SpinnerState): THREE.Vector3 {
  if (spinner === player) {
    return activeArena.playerStart;
  }

  const enemyIndex = Math.max(0, enemySpinners.indexOf(spinner));
  return activeArena.enemySpawns[enemyIndex % activeArena.enemySpawns.length];
}

function clearSpinnerTrail(spinner: SpinnerState): void {
  spinner.trailPoints.length = 0;
  spinner.trailVisibleStrength = 0;
  spinner.previousTrailPosition.copy(spinner.group.position);
  spinner.trailMaterial.opacity = 0;
  spinner.trailMesh.geometry.setDrawRange(0, 0);
}

function hideSpinnerTrailAndTarget(spinner: SpinnerState): void {
  spinner.trailMaterial.opacity = 0;
  spinner.trailMesh.geometry.setDrawRange(0, 0);
  if (spinner.targetLine) {
    spinner.targetLine.line.visible = false;
  }
}

function applyUltimateChargeFromDamage(damageEvents: CombatDamageEvent<SpinnerState>[]): void {
  for (const event of damageEvents) {
    addUltimateCharge(event.source.ultimate, event.amount * event.source.ultimate.settings.chargePerDamageDealt);
    addUltimateCharge(event.target.ultimate, event.amount * event.target.ultimate.settings.chargePerDamageTaken);
  }
}

function updateArenaBonusSystems(deltaTime: number): void {
  updateArenaBonuses(arenaBonusState, deltaTime);
  for (const spinner of combatSpinners) {
    if (!isDeathmatchAlive(spinner)) {
      continue;
    }
    updateArenaBonusEffects(spinner, deltaTime);
  }

  const pickups = collectArenaBonuses(
    arenaBonusState,
    getDeathmatchDamageableSpinners().map((spinner) => ({
      target: spinner,
      position: spinner.group.position,
      radius: spinner.radius,
    })),
  );

  for (const pickup of pickups) {
    if (pickup.bonus.type === "heal") {
      createHealingZone(pickup.bonus.position);
      startHealAuraBurst(pickup.target.group);
    } else {
      applyArenaBonusEffect(pickup.target, pickup.bonus.type, arenaBonusState.settings.effectDuration);
    }
    arenaBonusVfxPool.startCollectEffect(pickup.bonus);
  }
}

function createHealingZone(position: THREE.Vector3): void {
  const zonePosition = projectToArenaSurface(position, 0.08);
  const zone = acquireHealingZone();
  resetHealingZone(zone, zonePosition);
  healingZones.push(zone);
}

function prewarmHealingZones(): void {
  for (let i = idleHealingZones.length; i < 3; i += 1) {
    idleHealingZones.push(createHealingZoneVisual());
  }
}

function createHealingZoneVisual(): HealingZone {
  const radius = healingZoneSettings.radius;
  const group = new THREE.Group();
  group.name = "Healing Zone";
  group.visible = false;
  group.position.set(0, -40, 0);

  const staticRingMaterial = createVfxMaterial(arenaBonusColorByType.heal, 0.4);
  const staticRing = new THREE.Mesh(new THREE.RingGeometry(radius - 0.045, radius + 0.045, 96), staticRingMaterial);
  staticRing.rotation.x = -Math.PI / 2;
  group.add(staticRing);

  const shrinkRingMaterial = createVfxMaterial(arenaBonusColorByType.heal, 0.2);
  const shrinkRing = new THREE.Mesh(new THREE.RingGeometry(radius - 0.04, radius + 0.04, 96), shrinkRingMaterial);
  shrinkRing.rotation.x = -Math.PI / 2;
  group.add(shrinkRing);

  const burstDiskMaterial = createHealingDiskMaterial(arenaBonusColorByType.heal, 0.8, 0.1);
  const burstDisk = new THREE.Mesh(new THREE.CircleGeometry(radius, 96), burstDiskMaterial);
  burstDisk.rotation.x = -Math.PI / 2;
  burstDisk.visible = false;
  group.add(burstDisk);

  const echoDiskMaterial = createVfxMaterial(arenaBonusColorByType.heal, 0.1);
  const echoDisk = new THREE.Mesh(new THREE.CircleGeometry(radius, 96), echoDiskMaterial);
  echoDisk.rotation.x = -Math.PI / 2;
  echoDisk.scale.setScalar(0.001);
  echoDisk.visible = false;
  group.add(echoDisk);

  scene.add(group);
  return {
    group,
    position: new THREE.Vector3(),
    radius,
    age: 0,
    delay: healingZoneSettings.delay,
    afterTriggerDelay: healingZoneSettings.afterTriggerDelay,
    postTriggerLife: healingZoneSettings.postTriggerLife,
    triggered: false,
    healed: false,
    staticRing,
    staticRingMaterial,
    shrinkRing,
    shrinkRingMaterial,
    burstDisk,
    burstDiskMaterial,
    echoDisk,
    echoDiskMaterial,
  };
}

function acquireHealingZone(): HealingZone {
  const idle = idleHealingZones.pop();
  if (idle) {
    return idle;
  }

  const oldest = healingZones.reduce((candidate, zone) => (zone.age > candidate.age ? zone : candidate), healingZones[0]);
  const index = healingZones.indexOf(oldest);
  if (index >= 0) {
    healingZones.splice(index, 1);
  }
  return oldest;
}

function resetHealingZone(zone: HealingZone, position: THREE.Vector3): void {
  zone.group.visible = true;
  zone.group.position.copy(position);
  zone.position.copy(position);
  zone.radius = healingZoneSettings.radius;
  zone.age = 0;
  zone.delay = healingZoneSettings.delay;
  zone.afterTriggerDelay = healingZoneSettings.afterTriggerDelay;
  zone.postTriggerLife = healingZoneSettings.postTriggerLife;
  zone.triggered = false;
  zone.healed = false;
  zone.staticRing.visible = true;
  zone.staticRingMaterial.opacity = 0.4;
  zone.staticRing.scale.setScalar(1);
  zone.shrinkRing.visible = true;
  zone.shrinkRingMaterial.opacity = 0.2;
  zone.shrinkRing.scale.setScalar(1);
  zone.burstDisk.visible = false;
  zone.burstDisk.scale.setScalar(1);
  zone.burstDiskMaterial.opacity = 0.85;
  zone.echoDisk.visible = false;
  zone.echoDisk.scale.setScalar(0.001);
  zone.echoDiskMaterial.opacity = 0.1;
}

function releaseHealingZone(zone: HealingZone): void {
  zone.group.visible = false;
  zone.group.position.set(0, -40, 0);
  zone.staticRing.visible = false;
  zone.shrinkRing.visible = false;
  zone.burstDisk.visible = false;
  zone.echoDisk.visible = false;
  idleHealingZones.push(zone);
}

function updateHealingZones(deltaTime: number): void {
  for (let i = healingZones.length - 1; i >= 0; i -= 1) {
    const zone = healingZones[i];
    zone.age += deltaTime;

    if (!zone.triggered) {
      const pendingRatio = THREE.MathUtils.clamp(zone.age / zone.delay, 0, 1);
      zone.staticRing.visible = zone.age < zone.delay;
      zone.shrinkRing.visible = zone.age < zone.delay;
      zone.staticRingMaterial.opacity = 0.4;
      zone.shrinkRingMaterial.opacity = 0.2;
      zone.shrinkRing.scale.setScalar(Math.max(0.001, 1 - pendingRatio));

      if (zone.age >= zone.delay + zone.afterTriggerDelay) {
        triggerHealingZone(zone);
      } else if (zone.age >= zone.delay) {
        zone.staticRing.visible = false;
        zone.shrinkRing.visible = false;
      }
      continue;
    }

    const triggerAge = zone.age - zone.delay - zone.afterTriggerDelay;
    updateTriggeredHealingZone(zone, triggerAge);
    if (triggerAge >= zone.postTriggerLife) {
      disposeHealingZone(zone);
      healingZones.splice(i, 1);
    }
  }
}

function triggerHealingZone(zone: HealingZone): void {
  zone.triggered = true;
  zone.staticRing.visible = true;
  zone.staticRingMaterial.opacity = 0.4;
  zone.shrinkRing.visible = false;
  zone.burstDisk.visible = true;
  zone.echoDisk.visible = true;
  zone.burstDisk.scale.setScalar(1);
  zone.echoDisk.scale.setScalar(0.001);
  arenaBonusVfxPool.startHealZonePulse(zone.position);

  if (!zone.healed) {
    applyHealingZone(zone);
    zone.healed = true;
  }
}

function updateTriggeredHealingZone(zone: HealingZone, triggerAge: number): void {
  const burstRatio = THREE.MathUtils.clamp(triggerAge / 0.4, 0, 1);
  const echoRatio = THREE.MathUtils.clamp(triggerAge / 0.6, 0, 1);
  const burstScale = Math.max(0.001, 1 - easeInOut(burstRatio));
  zone.burstDisk.scale.setScalar(burstScale);
  zone.burstDiskMaterial.opacity = 0.85 * (1 - burstRatio);
  zone.echoDisk.scale.setScalar(easeOutCubic(echoRatio));
  zone.echoDiskMaterial.opacity = 0.1 * (1 - echoRatio);
}

function applyHealingZone(zone: HealingZone): void {
  const radiusSq = zone.radius * zone.radius;
  for (const spinner of getDeathmatchDamageableSpinners()) {
    const dx = spinner.group.position.x - zone.position.x;
    const dz = spinner.group.position.z - zone.position.z;
    if (dx * dx + dz * dz > radiusSq) {
      continue;
    }

    spinner.maxRPM = Math.min(spinner.absoluteMaxRPM, spinner.maxRPM + healingZoneSettings.maxRpmHealAmount);
    spinner.currentRPM = Math.min(spinner.currentRPM, spinner.maxRPM);
    startHealAuraBurst(spinner.group);
  }
}

function disposeHealingZone(zone: HealingZone): void {
  releaseHealingZone(zone);
}

function prewarmHealAuraBursts(): void {
  for (let i = idleHealAuraVfx.length; i < 4; i += 1) {
    const vfx = new TornadoVfx(bonusGreenAuraPreset as TornadoVfxPreset);
    vfx.group.visible = false;
    idleHealAuraVfx.push(vfx);
  }
}

function acquireHealAuraVfx(): TornadoVfx {
  const idle = idleHealAuraVfx.pop();
  if (idle) {
    return idle;
  }

  const oldest = healAuraBursts.shift();
  if (oldest) {
    oldest.parent.remove(oldest.vfx.group);
    return oldest.vfx;
  }

  throw new Error("Heal aura VFX pool was not prewarmed.");
}

function releaseHealAuraVfx(vfx: TornadoVfx): void {
  vfx.group.visible = false;
  vfx.group.scale.setScalar(1);
  idleHealAuraVfx.push(vfx);
}

function startHealAuraBurst(parent: THREE.Object3D): void {
  const vfx = acquireHealAuraVfx();
  vfx.group.visible = true;
  vfx.group.scale.setScalar(1);
  parent.add(vfx.group);
  healAuraBursts.push({
    vfx,
    parent,
    age: 0,
    duration: 2,
  });
}

function updateHealAuraBursts(deltaTime: number): void {
  for (let i = healAuraBursts.length - 1; i >= 0; i -= 1) {
    const burst = healAuraBursts[i];
    burst.age += deltaTime;
    const ratio = THREE.MathUtils.clamp(burst.age / burst.duration, 0, 1);
    const heightScale = THREE.MathUtils.lerp(3.0, 0.2, easeOutCubic(ratio));
    const widthScale = THREE.MathUtils.lerp(1.25, 0.55, easeOutCubic(ratio));
    burst.vfx.group.scale.set(widthScale, heightScale, widthScale);
    burst.vfx.update(deltaTime, elapsedTime);
    projectAuraGroundToArena(burst.vfx);

    if (ratio >= 1) {
      burst.parent.remove(burst.vfx.group);
      releaseHealAuraVfx(burst.vfx);
      healAuraBursts.splice(i, 1);
    }
  }
}

function createHealingDiskMaterial(color: string, centerOpacity: number, edgeOpacity: number): THREE.MeshBasicMaterial {
  const size = 128;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext("2d");
  if (!context) {
    return createVfxMaterial(color, centerOpacity);
  }

  const gradient = context.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  const center = new THREE.Color(color);
  gradient.addColorStop(0, `rgba(${Math.round(center.r * 255)}, ${Math.round(center.g * 255)}, ${Math.round(center.b * 255)}, 0.90)`);
  gradient.addColorStop(0.55, `rgba(${Math.round(center.r * 255)}, ${Math.round(center.g * 255)}, ${Math.round(center.b * 255)}, 0.70)`);
  gradient.addColorStop(0.82, `rgba(${Math.round(center.r * 255)}, ${Math.round(center.g * 255)}, ${Math.round(center.b * 255)}, ${edgeOpacity})`);
  gradient.addColorStop(1, `rgba(${Math.round(center.r * 255)}, ${Math.round(center.g * 255)}, ${Math.round(center.b * 255)}, 0)`);
  context.fillStyle = gradient;
  context.fillRect(0, 0, size, size);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const material = createVfxMaterial("#ffffff", 1);
  material.map = texture;
  material.needsUpdate = true;
  return material;
}

function easeOutCubic(value: number): number {
  const t = THREE.MathUtils.clamp(value, 0, 1);
  return 1 - (1 - t) ** 3;
}

function easeInOut(value: number): number {
  const t = THREE.MathUtils.clamp(value, 0, 1);
  return t < 0.5 ? 2 * t * t : 1 - ((-2 * t + 2) ** 2) / 2;
}

function startSpinnerKnockback(command: CombatKnockbackCommand<SpinnerState>): void {
  if (command.spinner.elementalMovementLocked || command.spinner.verticalLaunchActive) {
    return;
  }

  const direction = command.direction.clone();
  direction.y = 0;
  if (direction.lengthSq() <= 0.000001 || command.distance <= 0 || command.duration <= 0) {
    return;
  }

  direction.normalize();
  const fromPosition = command.spinner.group.position.clone();
  const toPosition = projectToArenaSurface(fromPosition.clone().addScaledVector(direction, command.distance));
  if (toPosition.distanceToSquared(fromPosition) <= 0.000001) {
    return;
  }

  command.spinner.knockback.active = true;
  command.spinner.knockback.fromPosition.copy(fromPosition);
  command.spinner.knockback.toPosition.copy(toPosition);
  command.spinner.knockback.elapsed = 0;
  command.spinner.knockback.duration = command.duration;
  command.spinner.velocity.set(0, 0, 0);
  resetSpeedLimitRatio(command.spinner);
}

function startSpinnerFlash(command: CombatFlashCommand<SpinnerState>): void {
  finishSpinnerFlash(command.spinner);
  if (command.sequence.length === 0) {
    return;
  }

  if (usesInstancedEnemyModel(command.spinner)) {
    command.spinner.modelTint = command.sequence[0].color;
    command.spinner.flash.sequence = command.sequence.map((step) => ({ ...step }));
    command.spinner.flash.stepIndex = 0;
    command.spinner.flash.stepElapsed = 0;
    return;
  }

  const overrideMaterial = new THREE.MeshBasicMaterial({
    color: command.sequence[0].color,
    depthTest: true,
  });
  const originalMaterials: FlashMaterialRecord[] = [];

  command.spinner.spinGroup.traverse((object) => {
    if (object instanceof THREE.Mesh) {
      originalMaterials.push({ mesh: object, material: object.material });
      object.material = overrideMaterial;
    }
  });

  if (originalMaterials.length === 0) {
    overrideMaterial.dispose();
    return;
  }

  command.spinner.flash.sequence = command.sequence.map((step) => ({ ...step }));
  command.spinner.flash.stepIndex = 0;
  command.spinner.flash.stepElapsed = 0;
  command.spinner.flash.overrideMaterial = overrideMaterial;
  command.spinner.flash.originalMaterials = originalMaterials;
}

function updateSpinnerFlash(spinner: SpinnerState, deltaTime: number): void {
  const flash = spinner.flash;
  if (flash.sequence.length === 0) {
    return;
  }

  flash.stepElapsed += deltaTime;
  while (flash.stepIndex < flash.sequence.length && flash.stepElapsed >= flash.sequence[flash.stepIndex].duration) {
    flash.stepElapsed -= flash.sequence[flash.stepIndex].duration;
    flash.stepIndex += 1;
    if (flash.stepIndex < flash.sequence.length) {
      const color = flash.sequence[flash.stepIndex].color;
      flash.overrideMaterial?.color.set(color);
      if (usesInstancedEnemyModel(spinner)) {
        spinner.modelTint = color;
      }
    }
  }

  if (flash.stepIndex >= flash.sequence.length) {
    finishSpinnerFlash(spinner);
  }
}

function finishSpinnerFlash(spinner: SpinnerState): void {
  const flash = spinner.flash;
  for (const record of flash.originalMaterials) {
    record.mesh.material = record.material;
  }
  flash.overrideMaterial?.dispose();
  flash.sequence = [];
  flash.stepIndex = 0;
  flash.stepElapsed = 0;
  flash.overrideMaterial = null;
  flash.originalMaterials = [];
  if (usesInstancedEnemyModel(spinner)) {
    spinner.modelTint = null;
  }
}

function updateDeathmatchProtectedVisuals(deltaTime: number): void {
  for (const spinner of getDeathmatchParticipants()) {
    const protectedByDeathmatch = spinner.deathmatchStatus === "respawning" || spinner.invulnerabilityTimer > 0 || spinner.respawnDash.active;
    if (!protectedByDeathmatch) {
      finishDeathmatchProtectedVisual(spinner);
      spinner.spinGroup.visible = true;
      continue;
    }

    startDeathmatchProtectedVisual(spinner);
    spinner.spinGroup.visible = true;
    if (spinner.deathmatchVisual.material) {
      const pulse = (Math.sin((elapsedTime + deltaTime) * Math.PI * 2 * deathmatchPulseFrequency) + 1) * 0.5;
      spinner.deathmatchVisual.material.opacity = THREE.MathUtils.lerp(
        deathmatchPulseMinOpacity,
        deathmatchBlinkOpacity,
        pulse,
      );
    }
  }
}

function startDeathmatchProtectedVisual(spinner: SpinnerState): void {
  const visual = spinner.deathmatchVisual;
  if (visual.active) {
    return;
  }

  finishSpinnerFlash(spinner);
  if (usesInstancedEnemyModel(spinner)) {
    spinner.modelTint = "#ffffff";
    visual.active = true;
    return;
  }

  const material = new THREE.MeshBasicMaterial({
    color: "#ffffff",
    transparent: true,
    opacity: deathmatchBlinkOpacity,
    depthTest: true,
  });
  const originalMaterials: FlashMaterialRecord[] = [];

  spinner.spinGroup.traverse((object) => {
    if (object instanceof THREE.Mesh) {
      originalMaterials.push({ mesh: object, material: object.material });
      object.material = material;
    }
  });

  if (originalMaterials.length === 0) {
    material.dispose();
    return;
  }

  visual.active = true;
  visual.material = material;
  visual.originalMaterials = originalMaterials;
}

function finishDeathmatchProtectedVisual(spinner: SpinnerState): void {
  const visual = spinner.deathmatchVisual;
  if (!visual.active) {
    return;
  }

  for (const record of visual.originalMaterials) {
    record.mesh.material = record.material;
  }
  visual.material?.dispose();
  visual.active = false;
  visual.material = null;
  visual.originalMaterials = [];
  spinner.spinGroup.visible = true;
  if (usesInstancedEnemyModel(spinner)) {
    spinner.modelTint = null;
  }
}

function usesInstancedEnemyModel(spinner: SpinnerState): boolean {
  return enemySpinners.includes(spinner) && spinner.spinGroup.children.length === 0;
}

function spawnDamageNumber(command: CombatDamageNumberCommand<SpinnerState>): void {
  if (command.source !== player && command.target !== player) {
    return;
  }

  const playerTookDamage = command.target === player;
  const amount = Math.max(1, Math.round(command.amount));
  const text = playerTookDamage ? `-${amount}` : String(amount);
  const color = playerTookDamage ? "#ff2a2a" : command.critical ? "#ffd83d" : "#ffffff";
  const criticalScale = command.critical ? 1.45 : 1;
  const direction = command.direction.clone();
  direction.y = 0;
  if (direction.lengthSq() <= 0.000001) {
    direction.copy(command.target.forwardDirection);
    direction.y = 0;
  }
  if (direction.lengthSq() <= 0.000001) {
    direction.set(1, 0, 0);
  }
  direction.normalize();

  damageNumberPool.spawn({
    text,
    color,
    criticalScale,
    position: command.target.group.position,
    direction,
  });
}

function updatePlayer(deltaTime: number): void {
  if (!isDeathmatchAlive(player) || player.respawnDash.active) {
    player.velocity.set(0, 0, 0);
    player.distanceMovedThisTick = 0;
    return;
  }

  const hasMobileTarget = applyPlayerMobileTarget();
  if (!hasMobileTarget && !pointerHasWorldTarget) {
    player.targetPosition.copy(player.group.position);
    player.desiredTargetPosition.copy(player.group.position);
    player.followTargetPosition.copy(player.group.position);
    player.visualTargetPosition.copy(player.group.position);
  }

  moveSpinnerTowardFollowTarget(player, deltaTime);
}

function updateMobileMoveDirection(moveVector: { x: number; y: number }): void {
  if (Math.hypot(moveVector.x, moveVector.y) <= 0.001) {
    mobileMoveActive = false;
    mobileMoveDirection.set(0, 0, 0);
    return;
  }

  camera.getWorldDirection(mobileCameraForward);
  mobileCameraForward.y = 0;
  if (mobileCameraForward.lengthSq() <= 0.000001) {
    mobileCameraForward.set(0, 0, -1);
  }
  mobileCameraForward.normalize();

  mobileCameraRight.setFromMatrixColumn(camera.matrixWorld, 0);
  mobileCameraRight.y = 0;
  if (mobileCameraRight.lengthSq() <= 0.000001) {
    mobileCameraRight.set(1, 0, 0);
  }
  mobileCameraRight.normalize();

  mobileMoveDirection.copy(mobileCameraRight).multiplyScalar(moveVector.x);
  mobileMoveDirection.addScaledVector(mobileCameraForward, -moveVector.y);
  if (mobileMoveDirection.lengthSq() <= 0.000001) {
    mobileMoveActive = false;
    mobileMoveDirection.set(0, 0, 0);
    return;
  }

  mobileMoveDirection.normalize();
  mobileMoveActive = true;
}

function applyPlayerMobileTarget(): boolean {
  if (!mobileMoveActive) {
    return false;
  }

  mobileMoveTarget.copy(player.group.position).addScaledVector(mobileMoveDirection, activeArena.radius);
  setPlayerTarget(mobileMoveTarget, mobileMoveTarget);
  return true;
}

function updateEnemyAi(deltaTime: number): void {
  botAiDecisionElapsedTime += deltaTime;
  botAiDecisionCountdown -= deltaTime;
  const aliveEnemies = enemySpinners.filter((spinner) => isDeathmatchAlive(spinner) && !spinner.respawnDash.active);
  if (botAiDecisionCountdown <= 0) {
    const commands = botAiDirector.update({
      bots: aliveEnemies,
      targets: getDeathmatchDamageableSpinners(),
      deltaTime: botAiDecisionElapsedTime,
      arenaRadius: activeArena.radius,
      settings: botAiSettings,
    });
    latestEnemyAiCommands.clear();
    for (const spinner of enemySpinners) {
      const command = commands.get(spinner);
      if (command) {
        latestEnemyAiCommands.set(spinner, command);
      }
    }
    botAiDecisionElapsedTime = 0;
    botAiDecisionCountdown = getNextBotAiDecisionDelay();
  }

  for (const spinner of aliveEnemies) {
    const command = latestEnemyAiCommands.get(spinner);
    if (command) {
      const target = projectToArenaSurface(command.target);
      spinner.targetPosition.copy(target);
      spinner.desiredTargetPosition.copy(target);
      spinner.visualTargetPosition.copy(projectToArenaSurface(command.visualTarget));
      spinner.botDesiredCursorPosition.copy(projectPointOutsideBotCursorRadius(spinner, target));
    }
    updateBotVirtualCursor(spinner, deltaTime);
    moveSpinnerTowardFollowTarget(spinner, deltaTime);
  }

  for (const spinner of enemySpinners) {
    if (isDeathmatchAlive(spinner)) {
      continue;
    }
    spinner.velocity.set(0, 0, 0);
    spinner.distanceMovedThisTick = 0;
    latestEnemyAiCommands.delete(spinner);
  }
}

function getNextBotAiDecisionDelay(): number {
  const preset = botDifficultyPresets[botDifficulty];
  return THREE.MathUtils.randFloat(preset.minDecisionTime, preset.maxDecisionTime);
}

function updateBotVirtualCursor(spinner: SpinnerState, deltaTime: number): void {
  const desiredCursorPosition = projectPointOutsideBotCursorRadius(spinner, spinner.botDesiredCursorPosition);
  const currentOffset = spinner.botVirtualCursorPosition.clone().sub(spinner.group.position);
  const desiredOffset = desiredCursorPosition.clone().sub(spinner.group.position);
  currentOffset.y = 0;
  desiredOffset.y = 0;

  const currentDirection = getSafeCursorDirection(currentOffset, spinner.forwardDirection);
  const desiredDirection = getSafeCursorDirection(desiredOffset, currentDirection);
  const preset = botDifficultyPresets[botDifficulty];
  const nextDirection = rotateDirectionToward(
    currentDirection,
    desiredDirection,
    preset.cursorAngularSpeed * deltaTime,
  );

  const currentDistance = Math.max(currentOffset.length(), botCursorMinRadius);
  const desiredDistance = Math.max(desiredOffset.length(), botCursorMinRadius);
  const nextDistance = moveNumberToward(currentDistance, desiredDistance, preset.cursorRadialSpeed * deltaTime);
  spinner.botVirtualCursorPosition.copy(spinner.group.position).addScaledVector(nextDirection, nextDistance);

  spinner.botVirtualCursorPosition.copy(projectPointOutsideBotCursorRadius(spinner, spinner.botVirtualCursorPosition));
  spinner.followTargetPosition.copy(spinner.botVirtualCursorPosition);
}

function getSafeCursorDirection(offset: THREE.Vector3, fallback: THREE.Vector3): THREE.Vector3 {
  const direction = offset.clone();
  direction.y = 0;
  if (direction.lengthSq() > 0.000001) {
    return direction.normalize();
  }

  direction.copy(fallback);
  direction.y = 0;
  if (direction.lengthSq() > 0.000001) {
    return direction.normalize();
  }

  return new THREE.Vector3(1, 0, 0);
}

function rotateDirectionToward(current: THREE.Vector3, desired: THREE.Vector3, maxAngle: number): THREE.Vector3 {
  const currentAngle = Math.atan2(current.z, current.x);
  const desiredAngle = Math.atan2(desired.z, desired.x);
  let deltaAngle = desiredAngle - currentAngle;
  while (deltaAngle > Math.PI) {
    deltaAngle -= Math.PI * 2;
  }
  while (deltaAngle < -Math.PI) {
    deltaAngle += Math.PI * 2;
  }

  const clampedDelta = THREE.MathUtils.clamp(deltaAngle, -maxAngle, maxAngle);
  const nextAngle = currentAngle + clampedDelta;
  return new THREE.Vector3(Math.cos(nextAngle), 0, Math.sin(nextAngle));
}

function moveNumberToward(current: number, desired: number, maxDelta: number): number {
  if (Math.abs(desired - current) <= maxDelta) {
    return desired;
  }
  return current + Math.sign(desired - current) * maxDelta;
}

function projectPointOutsideBotCursorRadius(spinner: SpinnerState, point: THREE.Vector3): THREE.Vector3 {
  const projected = point.clone();
  projected.y = 0;
  const fromBot = projected.sub(spinner.group.position);
  fromBot.y = 0;

  if (fromBot.length() >= botCursorMinRadius) {
    return projectToArenaSurface(point);
  }

  if (fromBot.lengthSq() <= 0.000001) {
    fromBot.copy(spinner.forwardDirection);
    fromBot.y = 0;
  }
  if (fromBot.lengthSq() <= 0.000001) {
    fromBot.set(1, 0, 0);
  }

  return projectToArenaSurface(spinner.group.position.clone().addScaledVector(fromBot.normalize(), botCursorMinRadius));
}

function moveSpinnerTowardFollowTarget(spinner: SpinnerState, deltaTime: number): void {
  spinner.lastPosition.copy(spinner.group.position);
  if (spinner.elementalMovementLocked || spinner.verticalLaunchActive) {
    spinner.knockback.active = false;
    spinner.velocity.set(0, 0, 0);
    updateSpinnerVerticalState(spinner, deltaTime);
    if (spinner.verticalLaunchActive && spinner.grounded) {
      spinner.verticalLaunchActive = false;
    }
    spinner.distanceMovedThisTick = 0;
    updateDashState(spinner.dash, deltaTime, 0);
    sampleSpinnerTrail(spinner, deltaTime);
    return;
  }
  if (updateSpinnerKnockback(spinner, deltaTime)) {
    spinner.distanceMovedThisTick = 0;
    updateDashState(spinner.dash, deltaTime, spinner.distanceMovedThisTick);
    sampleSpinnerTrail(spinner, deltaTime);
    return;
  }

  const beforeMove = spinner.group.position.clone();
  const availableSpeed = getAvailableMoveSpeed(spinner);
  const dashSpeedMultiplier = getDashSpeedMultiplier(spinner.dash);
  const toTarget = scratchVector.subVectors(spinner.followTargetPosition, spinner.group.position);
  toTarget.y = 0;
  const distanceToTarget = toTarget.length();

  if (distanceToTarget <= spinner.radius * 0.5 && spinner.velocity.lengthSq() <= 0.25) {
    resetSpeedLimitRatio(spinner);
  } else {
    updateSpeedLimitRatio(spinner, deltaTime);
  }

  const acceleration = toTarget.multiplyScalar(springStrength).addScaledVector(spinner.velocity, -springDamping);
  spinner.velocity.addScaledVector(acceleration, deltaTime);

  if (dashSpeedMultiplier > 1) {
    const dashDirection = new THREE.Vector3(spinner.dash.direction.x, 0, spinner.dash.direction.z);
    const dashSpeed = availableSpeed * dashSpeedMultiplier;
    const currentDashSpeed = spinner.velocity.dot(dashDirection);
    if (currentDashSpeed < dashSpeed) {
      spinner.velocity.addScaledVector(dashDirection, dashSpeed - currentDashSpeed);
    }
  }

  const effectiveSpeedLimit = availableSpeed * (dashSpeedMultiplier > 1 ? dashSpeedMultiplier : spinner.speedLimitRatio);
  if (spinner.velocity.length() > effectiveSpeedLimit) {
    spinner.velocity.setLength(effectiveSpeedLimit);
  }
  if (spinner.grounded) {
    applySlopeGravity(spinner.velocity, spinner.group.position, activeArena.getHeightAt, slopeGravitySettings, deltaTime);
    applyRimResistance(spinner.velocity, spinner.group.position, activeArena.radius, rimResistanceSettings, deltaTime);
    const terrainSpeedLimit = effectiveSpeedLimit
      + slopeGravitySettings.maxSlopeBoost
      + rimResistanceSettings.rimResistanceMaxBoost;
    if (spinner.velocity.length() > terrainSpeedLimit) {
      spinner.velocity.setLength(terrainSpeedLimit);
    }
  }

  spinner.group.position.addScaledVector(spinner.velocity, deltaTime);
  updateSpinnerVerticalState(spinner, deltaTime);

  spinner.distanceMovedThisTick = beforeMove.distanceTo(spinner.group.position);
  updateDashState(spinner.dash, deltaTime, spinner.distanceMovedThisTick);
  updateForwardDirection(spinner);
  recoverRPMFromMovement(spinner);
  sampleSpinnerTrail(spinner, deltaTime);
}

function getAvailableMoveSpeed(spinner: SpinnerState): number {
  const elementalMultiplier = spinner.elementalMoveSpeedMultiplier;
  if (isUltimateActive(spinner.ultimate)) {
    return spinner.baseMoveSpeed * spinner.bonusSpeedMultiplier * spinner.ultimate.settings.speedMultiplier * elementalMultiplier;
  }

  return getCurrentMoveSpeed(spinner) * elementalMultiplier;
}

function updateSpinnerKnockback(spinner: SpinnerState, deltaTime: number): boolean {
  if (!spinner.knockback.active) {
    return false;
  }

  spinner.knockback.elapsed = Math.min(spinner.knockback.duration, spinner.knockback.elapsed + deltaTime);
  const t = spinner.knockback.duration > 0 ? spinner.knockback.elapsed / spinner.knockback.duration : 1;
  const eased = 1 - (1 - t) ** 2;
  spinner.group.position.lerpVectors(spinner.knockback.fromPosition, spinner.knockback.toPosition, eased);
  updateSpinnerVerticalState(spinner, deltaTime);
  spinner.velocity.set(0, 0, 0);

  if (t >= 1) {
    spinner.knockback.active = false;
    spinner.group.position.copy(spinner.knockback.toPosition);
    updateSpinnerVerticalState(spinner, deltaTime);
  }

  return true;
}

function updateSpinnerVerticalState(spinner: SpinnerState, deltaTime: number): void {
  const groundHeight = getActiveArenaHeight(spinner.group.position) + spinner.heightOffset;
  if (spinner.grounded) {
    spinner.group.position.y = groundHeight;
    spinner.verticalVelocity = 0;
    return;
  }

  spinner.verticalVelocity += airborneGravity * deltaTime;
  spinner.group.position.y += spinner.verticalVelocity * deltaTime;
  if (spinner.group.position.y <= groundHeight) {
    spinner.group.position.y = groundHeight;
    spinner.verticalVelocity = 0;
    spinner.grounded = true;
  }
}

function updateForwardDirection(spinner: SpinnerState): void {
  const movement = scratchVector.subVectors(spinner.group.position, spinner.lastPosition);
  movement.y = 0;
  if (movement.lengthSq() > 0.0001) {
    spinner.forwardDirection.copy(movement.normalize());
    return;
  }

  const targetDirection = scratchVector.subVectors(spinner.desiredTargetPosition, spinner.group.position);
  targetDirection.y = 0;
  if (targetDirection.lengthSq() > 0.0001) {
    spinner.forwardDirection.copy(targetDirection.normalize());
  }
}

function updateSpinVisuals(spinner: SpinnerState, deltaTime: number): void {
  const rpmVisualScale = spinner.absoluteMaxRPM > 0 ? spinner.currentRPM / spinner.absoluteMaxRPM : 0;
  spinner.spinGroup.rotation.y += spinner.spinSpeed * rpmVisualScale * deltaTime;

  const motionScale = reducedMotionQuery.matches ? 0.45 : 1;
  const wobble = Math.sin(elapsedTime * 8 + spinner.radius * 3) * 0.08 * motionScale * rpmVisualScale;
  spinner.spinGroup.rotation.x = wobble;
  spinner.spinGroup.rotation.z = Math.cos(elapsedTime * 7.3) * 0.055 * motionScale * rpmVisualScale;

  if (spinner.pulseTimer > 0) {
    spinner.pulseTimer = Math.max(0, spinner.pulseTimer - deltaTime);
    const pulse = 1 + Math.sin((spinner.pulseTimer / 0.18) * Math.PI) * 0.16;
    spinner.spinGroup.scale.setScalar(pulse);
  } else {
    spinner.spinGroup.scale.setScalar(1);
  }
  updateSpinnerFlash(spinner, deltaTime);
}

function createVfxMaterial(color: string, opacity: number): THREE.MeshBasicMaterial {
  return new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity,
    depthWrite: false,
    depthTest: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
  });
}

function sampleSpinnerTrail(spinner: SpinnerState, deltaTime: number): void {
  spinner.trailSampleTimer -= deltaTime;
  const speed = spinner.velocity.length();
  const isMoving = speed > 0.35 || spinner.group.position.distanceTo(spinner.previousTrailPosition) > 0.035;
  const targetStrength = isMoving ? 1 : 0;
  const response = 1 - Math.exp(-(isMoving ? 12 : 4.5) * deltaTime);
  spinner.trailVisibleStrength = THREE.MathUtils.lerp(spinner.trailVisibleStrength, targetStrength, response);

  const sampleInterval = reducedMotionQuery.matches ? 0.075 : 0.035;
  const minSampleDistance = reducedMotionQuery.matches ? 0.16 : 0.075;
  const movedFromLastSample = spinner.group.position.distanceTo(spinner.previousTrailPosition);

  if (spinner.trailSampleTimer <= 0 && movedFromLastSample > minSampleDistance) {
    const sample = projectToArenaSurface(spinner.group.position, 0.075);
    spinner.trailPoints.unshift(sample);
    spinner.previousTrailPosition.copy(spinner.group.position);
    spinner.trailSampleTimer = sampleInterval;
  }

  trimTrailPoints(spinner);
}

function trimTrailPoints(spinner: SpinnerState): void {
  const maxLength = reducedMotionQuery.matches
    ? 1.35
    : THREE.MathUtils.clamp(1.75 + spinner.velocity.length() * 0.16, 1.8, 2.8);
  let accumulatedLength = 0;
  let keepCount = spinner.trailPoints.length;

  for (let i = 1; i < spinner.trailPoints.length; i += 1) {
    accumulatedLength += spinner.trailPoints[i - 1].distanceTo(spinner.trailPoints[i]);
    if (accumulatedLength > maxLength) {
      keepCount = i + 1;
      break;
    }
  }

  spinner.trailPoints.length = Math.min(keepCount, maxTrailPoints);
}

function updateSolidTrail(spinner: SpinnerState): void {
  const currentPoint = projectToArenaSurface(spinner.group.position, 0.075);
  const points = [currentPoint, ...spinner.trailPoints].filter((point, index, array) => {
    return index === 0 || point.distanceTo(array[index - 1]) > 0.025;
  });

  if (points.length < 3 || spinner.trailVisibleStrength < 0.02) {
    spinner.trailMaterial.opacity = 0;
    spinner.trailMesh.geometry.setDrawRange(0, 0);
    return;
  }

  const ribbonPoints = smoothTrailPoints(points);
  const baseWidth = reducedMotionQuery.matches ? 0.18 : 0.34;
  const tailWidth = reducedMotionQuery.matches ? 0.014 : 0.02;
  const positions = spinner.trailMesh.userData.positions;
  const ribbonPointCount = Math.min(ribbonPoints.length, maxTrailRibbonPoints);
  let positionOffset = 0;

  for (let i = 0; i < ribbonPointCount; i += 1) {
    const previous = ribbonPoints[Math.max(i - 1, 0)];
    const next = ribbonPoints[Math.min(i + 1, ribbonPointCount - 1)];
    const tangent = scratchVector.subVectors(previous, next);
    tangent.y = 0;
    if (tangent.lengthSq() < 0.0001) {
      tangent.set(1, 0, 0);
    } else {
      tangent.normalize();
    }

    const normal = new THREE.Vector3(-tangent.z, 0, tangent.x);
    const t = ribbonPointCount === 1 ? 0 : i / (ribbonPointCount - 1);
    const width = THREE.MathUtils.lerp(baseWidth, tailWidth, t);
    const point = ribbonPoints[i];
    const left = point.clone().addScaledVector(normal, width);
    const right = point.clone().addScaledVector(normal, -width);
    positions[positionOffset] = left.x;
    positions[positionOffset + 1] = left.y;
    positions[positionOffset + 2] = left.z;
    positions[positionOffset + 3] = right.x;
    positions[positionOffset + 4] = right.y;
    positions[positionOffset + 5] = right.z;
    positionOffset += 6;
  }

  const geometry = spinner.trailMesh.geometry;
  const positionAttribute = geometry.getAttribute("position");
  positionAttribute.needsUpdate = true;
  geometry.setDrawRange(0, Math.max(ribbonPointCount - 1, 0) * 6);
  geometry.computeBoundingSphere();
  spinner.trailMaterial.opacity = spinner.trailVisibleStrength;
}

function updateTargetLine(spinner: SpinnerState): void {
  if (!spinner.targetLine) {
    return;
  }

  const target = spinner.visualTargetPosition;
  const direction = target.clone().sub(spinner.group.position);
  direction.y = 0;
  const distance = direction.length();
  if (distance <= spinner.radius * 1.12) {
    spinner.targetLine.line.visible = false;
    return;
  }

  spinner.targetLine.line.visible = true;
  direction.divideScalar(distance);

  const start = spinner.group.position.clone().addScaledVector(direction, spinner.radius * 1.08);
  const end = target.clone();
  start.copy(projectToArenaSurface(start, 0.05));
  end.copy(projectToArenaSurface(end, 0.05));

  const { positions, geometry } = spinner.targetLine;
  positions[0] = start.x;
  positions[1] = start.y;
  positions[2] = start.z;
  positions[3] = end.x;
  positions[4] = end.y;
  positions[5] = end.z;

  const positionAttribute = geometry.getAttribute("position");
  positionAttribute.needsUpdate = true;
  geometry.computeBoundingSphere();
}

function smoothTrailPoints(points: THREE.Vector3[]): THREE.Vector3[] {
  if (points.length < 4) {
    return points;
  }

  const smoothed: THREE.Vector3[] = [points[0].clone()];
  for (let i = 0; i < points.length - 1; i += 1) {
    const current = points[i];
    const next = points[i + 1];
    smoothed.push(current.clone().lerp(next, 0.35));
    smoothed.push(current.clone().lerp(next, 0.7));
  }
  smoothed.push(points[points.length - 1].clone());

  return smoothed;
}

function createArenaBonusPointMarkers(): THREE.Group {
  const group = new THREE.Group();
  group.name = "Arena Bonus Point Markers";
  const material = createVfxMaterial("#ffffff", 0.18);

  for (const point of activeArena.interestPoints) {
    const marker = new THREE.Mesh(new THREE.RingGeometry(0.42, 0.5, 32), material);
    marker.rotation.x = -Math.PI / 2;
    marker.position.copy(projectToArenaSurface(point, 0.055));
    group.add(marker);
  }

  return group;
}

function updateArenaBonusVisuals(deltaTime: number): void {
  arenaBonusVfxPool.syncActivePickups(getActiveArenaBonuses(arenaBonusState), deltaTime, elapsedTime);
  arenaBonusVfxPool.update(deltaTime, elapsedTime);
}

function spawnImpactSparks(origin: THREE.Vector3, normal: THREE.Vector3, critical = false): void {
  sparkVfxPool.spawnImpact(
    projectToArenaSurface(origin, 0.06),
    normal,
    critical,
    player.colorAccent,
    enemySpinners[0]?.colorAccent ?? "#ff3f8e",
  );
}

function handleResize(): void {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, maxRendererPixelRatio));
}
