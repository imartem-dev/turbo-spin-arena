import * as THREE from "three";

export type FinalImpactStyle = {
  text: string;
  color: string;
  glow: string;
  gradient: readonly (readonly [number, string])[];
};

export const victoryImpactStyle: Omit<FinalImpactStyle, "text"> = {
  color: "#28c8ff",
  glow: "rgba(35, 190, 255, 0.95)",
  gradient: [[0, "#efffff"], [0.26, "#85edff"], [0.55, "#31aeea"], [0.78, "#1263b7"], [1, "#bdf7ff"]],
};

export const defeatImpactStyle: Omit<FinalImpactStyle, "text"> = {
  color: "#ff2233",
  glow: "rgba(255, 20, 45, 0.9)",
  gradient: [[0, "#fff4f1"], [0.24, "#ff9b8f"], [0.52, "#f13b45"], [0.8, "#8e1228"], [1, "#ffb0a6"]],
};

const textStart = 0.75;
const duration = 2;

type SpeedLine = { angle: number; inner: number; outer: number; width: number; alpha: number };
type Debris = {
  angle: number; distance: number; originX: number; originY: number; size: number;
  rotation: number; spin: number; delay: number; color: string;
};

export class FinalImpactOverlay {
  private readonly canvas: HTMLCanvasElement;
  private readonly context: CanvasRenderingContext2D;
  private readonly projectedImpact = new THREE.Vector3();
  private readonly cameraStart = new THREE.Vector3();
  private readonly cameraDirection = new THREE.Vector3();
  private readonly speedLines: SpeedLine[] = [];
  private readonly debris: Debris[] = [];
  private elapsed = duration;
  private width = 1;
  private height = 1;
  private pixelRatio = 1;
  private impactX = 0.5;
  private impactY = 0.5;
  private cameraOffset = 0;
  private style: FinalImpactStyle = { text: "", ...victoryImpactStyle };

  constructor(private readonly camera: THREE.Camera, container: HTMLElement = document.body) {
    this.canvas = document.createElement("canvas");
    this.canvas.setAttribute("aria-hidden", "true");
    Object.assign(this.canvas.style, {
      position: "fixed", inset: "0", width: "100%", height: "100%", zIndex: "1000", pointerEvents: "none", display: "none",
    });
    const context = this.canvas.getContext("2d");
    if (!context) throw new Error("FinalImpactOverlay requires a 2D canvas context.");
    this.context = context;
    container.appendChild(this.canvas);
    this.resize();
  }

  triggerImpact(impactWorldPosition: THREE.Vector3, style: FinalImpactStyle): void {
    this.style = style;
    this.elapsed = 0;
    this.canvas.style.display = "block";
    this.restoreCamera();
    this.cameraStart.copy(this.camera.position);
    this.camera.updateMatrixWorld();
    this.projectedImpact.copy(impactWorldPosition).project(this.camera);
    const visible = Number.isFinite(this.projectedImpact.x) && Number.isFinite(this.projectedImpact.y)
      && this.projectedImpact.z >= -1 && this.projectedImpact.z <= 1;
    this.impactX = visible ? (this.projectedImpact.x * 0.5 + 0.5) * this.width : this.width * 0.5;
    this.impactY = visible ? (-this.projectedImpact.y * 0.5 + 0.5) * this.height : this.height * 0.5;
    this.cameraDirection.copy(impactWorldPosition).sub(this.cameraStart);
    if (this.cameraDirection.lengthSq() > 0.0001) this.cameraDirection.normalize();
    else this.camera.getWorldDirection(this.cameraDirection);
    this.createSpeedLines();
    this.createDebris();
    this.draw();
  }

  update(deltaTime: number): void {
    if (!this.isActive()) return;
    this.elapsed = Math.min(duration, this.elapsed + Math.max(0, deltaTime));
    this.updateCamera();
    this.draw();
    if (this.elapsed >= duration) {
      this.context.clearRect(0, 0, this.width, this.height);
      this.canvas.style.display = "none";
      this.restoreCamera();
    }
  }

  isActive(): boolean { return this.elapsed < duration; }

  resize(): void {
    this.width = Math.max(1, window.innerWidth);
    this.height = Math.max(1, window.innerHeight);
    this.pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = Math.round(this.width * this.pixelRatio);
    this.canvas.height = Math.round(this.height * this.pixelRatio);
    this.context.setTransform(this.pixelRatio, 0, 0, this.pixelRatio, 0, 0);
  }

  reset(): void {
    this.elapsed = duration;
    this.restoreCamera();
    this.context.clearRect(0, 0, this.width, this.height);
    this.canvas.style.display = "none";
  }

  private draw(): void {
    const context = this.context;
    const fade = 1 - smoothStep((this.elapsed - 1.72) / 0.28);
    context.clearRect(0, 0, this.width, this.height);
    context.save();
    context.globalAlpha = fade;
    const vignette = context.createRadialGradient(this.impactX, this.impactY, 0, this.impactX, this.impactY, Math.hypot(this.width, this.height) * 0.72);
    vignette.addColorStop(0, "rgba(2, 5, 12, 0.1)");
    vignette.addColorStop(0.45, "rgba(2, 5, 12, 0.42)");
    vignette.addColorStop(1, "rgba(0, 0, 0, 0.82)");
    context.fillStyle = vignette;
    context.fillRect(0, 0, this.width, this.height);
    this.drawSpeedLines(context);
    this.drawRays(context);
    this.drawText(context);
    this.drawDebris(context);
    context.restore();
  }

  private drawRays(context: CanvasRenderingContext2D): void {
    if (this.elapsed > 1.28) return;
    const expansion = easeOutCubic(Math.min(1, this.elapsed / 0.08));
    const fade = 1 - smoothStep((this.elapsed - 1.05) / 0.23);
    const length = Math.hypot(this.width, this.height) * 0.82 * expansion;
    const rayWidth = Math.min(this.width, this.height) * 0.075;
    context.save();
    context.translate(Math.sin(this.elapsed * 103) * 5.5, Math.cos(this.elapsed * 91) * 4.5);
    context.rotate(Math.sin(this.elapsed * 47) * 0.018);
    context.translate(this.impactX, this.impactY);
    const angles = [-0.78, 0.78, Math.PI - 0.78, Math.PI + 0.78];
    context.fillStyle = "#ffffff";
    context.globalAlpha = fade * 0.9;
    context.shadowColor = "rgba(255, 255, 255, 0.85)";
    context.shadowBlur = 12;
    for (let index = 0; index < angles.length; index += 1) {
      context.save();
      context.rotate(angles[index] + Math.sin(this.elapsed * (66 + index * 9) + index * 2.1) * 0.032);
      this.fillJaggedRay(context, length * 1.015, rayWidth * 1.24);
      context.restore();
    }
    context.fillStyle = this.style.color;
    context.globalAlpha = fade * 0.96;
    context.shadowColor = this.style.glow;
    context.shadowBlur = 14;
    for (let index = 0; index < angles.length; index += 1) {
      context.save();
      context.rotate(angles[index] + Math.sin(this.elapsed * (72 + index * 7) + index * 1.8) * 0.025);
      this.fillJaggedRay(context, length, rayWidth);
      context.restore();
    }
    context.restore();
  }

  private drawSpeedLines(context: CanvasRenderingContext2D): void {
    if (this.elapsed > 0.35) return;
    const opacity = 1 - easeInCubic(Math.min(1, this.elapsed / 0.35));
    const expansion = easeOutCubic(Math.min(1, this.elapsed / 0.08));
    context.save();
    context.strokeStyle = "#ffffff";
    context.lineCap = "round";
    for (const line of this.speedLines) {
      context.globalAlpha = opacity * line.alpha;
      context.lineWidth = line.width;
      context.beginPath();
      context.moveTo(this.impactX + Math.cos(line.angle) * line.inner * (0.35 + expansion * 0.65), this.impactY + Math.sin(line.angle) * line.inner * (0.35 + expansion * 0.65));
      context.lineTo(this.impactX + Math.cos(line.angle) * line.outer * expansion, this.impactY + Math.sin(line.angle) * line.outer * expansion);
      context.stroke();
    }
    context.restore();
  }

  private fillJaggedRay(context: CanvasRenderingContext2D, length: number, width: number): void {
    context.beginPath();
    context.moveTo(-width * 0.12, -width * 0.08);
    context.lineTo(length * 0.19, -width * 0.5);
    context.lineTo(length * 0.43, -width * 0.26);
    context.lineTo(length * 0.72, -width * 0.54);
    context.lineTo(length, 0);
    context.lineTo(length * 0.68, width * 0.46);
    context.lineTo(length * 0.38, width * 0.22);
    context.lineTo(length * 0.15, width * 0.52);
    context.closePath();
    context.fill();
  }

  private drawText(context: CanvasRenderingContext2D): void {
    if (this.elapsed < textStart) return;
    const progress = Math.min(1, (this.elapsed - textStart) / 0.42);
    const scale = 1 + 2 * (1 - easeOutBack(progress));
    const fontSize = Math.max(54, Math.min(this.width * 0.18, this.height * 0.25, 190));
    const gradient = context.createLinearGradient(0, -fontSize * 0.6, 0, fontSize * 0.6);
    for (const [offset, color] of this.style.gradient) gradient.addColorStop(offset, color);
    context.save();
    context.translate(this.width * 0.5, this.height * 0.5);
    context.scale(scale, scale);
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.font = `900 italic ${fontSize}px Impact, Haettenschweiler, "Arial Black", sans-serif`;
    context.lineJoin = "round";
    context.shadowColor = this.style.glow;
    context.shadowBlur = fontSize * 0.18;
    context.lineWidth = Math.max(5, fontSize * 0.055);
    context.strokeStyle = "#ffffff";
    context.strokeText(this.style.text, 0, 0);
    context.fillStyle = gradient;
    context.fillText(this.style.text, 0, 0);
    context.lineWidth = Math.max(2, fontSize * 0.018);
    context.strokeStyle = "rgba(0, 0, 0, 0.65)";
    context.strokeText(this.style.text, 0, 0);
    context.restore();
  }

  private drawDebris(context: CanvasRenderingContext2D): void {
    const debrisTime = this.elapsed - 1.17;
    if (debrisTime < 0 || debrisTime > 0.68) return;
    const fontSize = Math.max(54, Math.min(this.width * 0.18, this.height * 0.25, 190));
    const textWidth = Math.min(this.width * 0.86, fontSize * 4.25);
    context.save();
    context.translate(this.width * 0.5, this.height * 0.5);
    context.shadowColor = this.style.glow;
    context.shadowBlur = 8;
    for (const shard of this.debris) {
      const localTime = debrisTime - shard.delay;
      if (localTime < 0) continue;
      const progress = Math.min(1, localTime / 0.56);
      const distance = shard.distance * easeOutCubic(progress);
      const x = shard.originX * textWidth + Math.cos(shard.angle) * distance;
      const y = shard.originY * fontSize * 0.72 + Math.sin(shard.angle) * distance + progress * progress * 34;
      context.save();
      context.translate(x, y);
      context.rotate(shard.rotation + shard.spin * localTime);
      context.globalAlpha = 1 - easeInCubic(progress);
      context.fillStyle = shard.color;
      const size = shard.size * (1 - progress * 0.38);
      context.beginPath();
      context.moveTo(-size * 0.62, -size * 0.24);
      context.lineTo(size * 0.12, -size * 0.58);
      context.lineTo(size * 0.58, size * 0.08);
      context.lineTo(-size * 0.14, size * 0.5);
      context.closePath();
      context.fill();
      context.restore();
    }
    context.restore();
  }

  private createSpeedLines(): void {
    this.speedLines.length = 0;
    const radius = Math.hypot(this.width, this.height);
    for (let index = 0; index < 52; index += 1) {
      this.speedLines.push({ angle: Math.random() * Math.PI * 2, inner: radius * (0.04 + Math.random() * 0.2), outer: radius * (0.58 + Math.random() * 0.58), width: 0.6 + Math.random() * 2.2, alpha: 0.25 + Math.random() * 0.65 });
    }
  }

  private createDebris(): void {
    this.debris.length = 0;
    const colors = this.style.color === victoryImpactStyle.color ? ["#ffffff", "#a9f8ff", "#36bfff"] : ["#ffffff", "#ffb0a6", "#ff3b4d", "#7d0d22"];
    for (let index = 0; index < 22; index += 1) {
      this.debris.push({ angle: Math.random() * Math.PI * 2, distance: 70 + Math.random() * Math.min(this.width, this.height) * 0.28, originX: Math.random() - 0.5, originY: Math.random() - 0.5, size: 4 + Math.random() * 10, rotation: Math.random() * Math.PI * 2, spin: (Math.random() - 0.5) * 11, delay: Math.random() * 0.09, color: colors[index % colors.length] });
    }
  }

  private updateCamera(): void {
    const attack = easeOutCubic(Math.min(1, this.elapsed / 0.09));
    const release = 1 - smoothStep((this.elapsed - 0.09) / 0.91);
    const strength = 0.42 * attack * release;
    this.camera.position.addScaledVector(this.cameraDirection, strength - this.cameraOffset);
    this.cameraOffset = strength;
  }

  private restoreCamera(): void {
    if (this.cameraOffset === 0) return;
    this.camera.position.addScaledVector(this.cameraDirection, -this.cameraOffset);
    this.cameraOffset = 0;
  }
}

function smoothStep(value: number): number {
  const clamped = Math.min(1, Math.max(0, value));
  return clamped * clamped * (3 - 2 * clamped);
}

function easeOutCubic(value: number): number { return 1 - Math.pow(1 - value, 3); }

function easeInCubic(value: number): number { return value * value * value; }

function easeOutBack(value: number): number {
  const overshoot = 1.70158;
  const shifted = value - 1;
  return 1 + (overshoot + 1) * shifted * shifted * shifted + overshoot * shifted * shifted;
}
