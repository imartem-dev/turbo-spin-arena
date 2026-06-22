import * as THREE from "three";

export type DamageNumberSpawnOptions = {
  text: string;
  color: string;
  criticalScale: number;
  position: THREE.Vector3;
  direction: THREE.Vector3;
};

type DamageNumberSprite = {
  sprite: THREE.Sprite;
  material: THREE.SpriteMaterial;
  texture: THREE.CanvasTexture;
  canvas: HTMLCanvasElement;
  context: CanvasRenderingContext2D;
  velocity: THREE.Vector3;
  active: boolean;
  age: number;
  life: number;
  maxLife: number;
  baseScale: number;
  maxScale: number;
};

const poolSize = 10;
const hiddenPosition = new THREE.Vector3(0, -40, 0);

export class DamageNumberPool {
  private readonly numbers: DamageNumberSprite[] = [];

  constructor(
    private readonly scene: THREE.Scene,
    private readonly fontFamily: string,
    private readonly isFontReady: () => boolean,
  ) {
    for (let i = 0; i < poolSize; i += 1) {
      this.numbers.push(this.createDamageNumber());
    }
  }

  spawn(options: DamageNumberSpawnOptions): void {
    const damageNumber = this.acquireDamageNumber();
    this.drawText(damageNumber, options.text, options.color, options.criticalScale);

    damageNumber.sprite.position.copy(options.position);
    damageNumber.sprite.position.y += 1.7;
    damageNumber.sprite.renderOrder = 20;
    damageNumber.sprite.visible = true;
    damageNumber.material.opacity = 1;
    damageNumber.velocity.copy(options.direction).multiplyScalar(2.15).add(new THREE.Vector3(0, 3.1, 0));
    damageNumber.active = true;
    damageNumber.age = 0;
    damageNumber.life = 0.85;
    damageNumber.maxLife = 0.85;
    damageNumber.baseScale = 0.72 * options.criticalScale;
    damageNumber.maxScale = 1.08 * options.criticalScale;
  }

  update(deltaTime: number): void {
    for (const damageNumber of this.numbers) {
      if (!damageNumber.active) {
        continue;
      }

      damageNumber.life -= deltaTime;
      damageNumber.age += deltaTime;
      damageNumber.velocity.y -= 8.6 * deltaTime;
      damageNumber.sprite.position.addScaledVector(damageNumber.velocity, deltaTime);

      const ageRatio = 1 - Math.max(damageNumber.life / damageNumber.maxLife, 0);
      const grow = THREE.MathUtils.clamp(ageRatio / 0.22, 0, 1);
      const scale = THREE.MathUtils.lerp(damageNumber.baseScale, damageNumber.maxScale, grow);
      damageNumber.sprite.scale.set(scale, scale * 0.5, 1);
      damageNumber.material.opacity = ageRatio < 0.6 ? 1 : THREE.MathUtils.clamp(1 - (ageRatio - 0.6) / 0.4, 0, 1);

      if (damageNumber.life <= 0) {
        this.releaseDamageNumber(damageNumber);
      }
    }
  }

  dispose(): void {
    for (const damageNumber of this.numbers) {
      this.scene.remove(damageNumber.sprite);
      damageNumber.texture.dispose();
      damageNumber.material.dispose();
    }
  }

  private createDamageNumber(): DamageNumberSprite {
    const canvas = document.createElement("canvas");
    canvas.width = 256;
    canvas.height = 128;
    const context = canvas.getContext("2d");
    if (!context) {
      throw new Error("Failed to create damage number canvas context.");
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    const material = new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      opacity: 0,
      depthTest: false,
      depthWrite: false,
    });
    const sprite = new THREE.Sprite(material);
    sprite.visible = false;
    sprite.position.copy(hiddenPosition);
    this.scene.add(sprite);

    return {
      sprite,
      material,
      texture,
      canvas,
      context,
      velocity: new THREE.Vector3(),
      active: false,
      age: 0,
      life: 0,
      maxLife: 1,
      baseScale: 1,
      maxScale: 1,
    };
  }

  private acquireDamageNumber(): DamageNumberSprite {
    const idle = this.numbers.find((damageNumber) => !damageNumber.active);
    if (idle) {
      return idle;
    }

    return this.numbers.reduce((oldest, damageNumber) => (damageNumber.age > oldest.age ? damageNumber : oldest), this.numbers[0]);
  }

  private releaseDamageNumber(damageNumber: DamageNumberSprite): void {
    damageNumber.active = false;
    damageNumber.sprite.visible = false;
    damageNumber.sprite.position.copy(hiddenPosition);
    damageNumber.material.opacity = 0;
  }

  private drawText(damageNumber: DamageNumberSprite, text: string, color: string, scaleMultiplier: number): void {
    const { canvas, context } = damageNumber;
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.font = `900 ${Math.round(54 * scaleMultiplier)}px ${
      this.isFontReady() ? `"${this.fontFamily}", ` : ""
    }Impact, Arial Black, sans-serif`;
    context.lineJoin = "round";
    context.lineWidth = 9;
    context.strokeStyle = "rgba(0, 0, 0, 0.8)";
    context.strokeText(text, canvas.width / 2, canvas.height / 2 + 4);
    context.fillStyle = color;
    context.fillText(text, canvas.width / 2, canvas.height / 2 + 4);
    damageNumber.texture.needsUpdate = true;
  }
}
