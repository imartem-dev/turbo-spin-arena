import * as THREE from "three";

export type FireballHeadOptions = {
  textureUrl?: string;
  coreColor?: THREE.ColorRepresentation;
  flameColor?: THREE.ColorRepresentation;
  size?: number;
  flameSpeed?: number;
};

/** Procedural fireball nose. Its local +Z axis points in the direction of travel. */
export class FireballHead {
  readonly group = new THREE.Group();
  // phiLength = PI keeps only the local +Z hemisphere: the rear (-Z) half is open.
  private readonly coreGeometry = new THREE.SphereGeometry(0.5, 32, 32, 0, Math.PI);
  private readonly shellGeometry = new THREE.SphereGeometry(0.75, 32, 32, 0, Math.PI);
  private readonly coreMaterial: THREE.ShaderMaterial;
  private readonly shellMaterial: THREE.ShaderMaterial;
  private readonly auraMap: THREE.Texture;

  constructor(parent: THREE.Object3D, options: FireballHeadOptions = {}) {
    this.auraMap = new THREE.TextureLoader().load(options.textureUrl ?? `${import.meta.env.BASE_URL}assets/vfx/explosion/T_flare8_vfx.webp`);
    this.auraMap.wrapS = THREE.RepeatWrapping;
    this.auraMap.wrapT = THREE.RepeatWrapping;
    this.auraMap.colorSpace = THREE.NoColorSpace;

    this.group.name = "Fireball Head";
    this.group.visible = false;
    this.group.scale.setScalar(options.size ?? 1);
    this.coreMaterial = createCoreMaterial(options.coreColor ?? options.flameColor ?? "#ff7a18");
    this.shellMaterial = createShellMaterial(this.auraMap, options.flameColor ?? "#ff7a18", options.flameSpeed ?? 2.5);

    const core = new THREE.Mesh(this.coreGeometry, this.coreMaterial);
    core.name = "Fireball Inner Core";
    core.scale.set(0.8, 0.8, 1.8);
    core.renderOrder = 11;

    const shell = new THREE.Mesh(this.shellGeometry, this.shellMaterial);
    shell.name = "Fireball Flame Shell";
    shell.scale.set(1, 1, 2.3);
    shell.renderOrder = 10;
    this.group.add(shell, core);
    parent.add(this.group);
  }

  setColor(color: THREE.ColorRepresentation): void {
    const threeColor = new THREE.Color(color);
    this.coreMaterial.uniforms.uColor.value.copy(threeColor);
    this.shellMaterial.uniforms.uColor.value.copy(threeColor);
  }

  setPosition(x: number, y: number, z: number): void { this.group.position.set(x, y, z); }
  setRotation(x: number, y: number, z: number): void { this.group.rotation.set(x, y, z); }

  setDirection(direction: THREE.Vector3): void {
    if (direction.lengthSq() > 0.0001) this.group.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), direction);
  }

  setVisible(visible: boolean): void { this.group.visible = visible; }

  update(deltaTime: number, opacity: number): void {
    this.shellMaterial.uniforms.uTime.value += Math.max(0, deltaTime);
    this.coreMaterial.uniforms.uOpacity.value = opacity;
    this.shellMaterial.uniforms.uOpacity.value = opacity;
  }

  dispose(): void {
    this.group.removeFromParent();
    this.coreGeometry.dispose();
    this.shellGeometry.dispose();
    this.coreMaterial.dispose();
    this.shellMaterial.dispose();
    this.auraMap.dispose();
  }
}

function createCoreMaterial(color: THREE.ColorRepresentation): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: { uColor: { value: new THREE.Color(color) }, uFresnelPower: { value: 2 }, uOpacity: { value: 0 } },
    vertexShader: `varying vec3 vNormal,vViewDirection;void main(){vec4 p=modelViewMatrix*vec4(position,1.);vNormal=normalize(normalMatrix*normal);vViewDirection=normalize(-p.xyz);gl_Position=projectionMatrix*p;}`,
    fragmentShader: `uniform vec3 uColor;uniform float uFresnelPower,uOpacity;varying vec3 vNormal,vViewDirection;void main(){float center=pow(max(dot(normalize(vNormal),normalize(vViewDirection)),0.),uFresnelPower);float a=center*uOpacity;if(a<.01)discard;gl_FragColor=vec4(uColor*2.,a);}`,
    transparent: true, depthWrite: false, depthTest: false, blending: THREE.NormalBlending, toneMapped: false,
  });
}

function createShellMaterial(texture: THREE.Texture, color: THREE.ColorRepresentation, speed: number): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: { uAuraMap: { value: texture }, uTime: { value: 0 }, uSpeed: { value: speed }, uColor: { value: new THREE.Color(color) }, uOpacity: { value: 0 } },
    vertexShader: `varying float vFlow,vAngle;void main(){vFlow=clamp((.75-position.z)/1.5,0.,1.);vAngle=atan(position.y,position.x)/6.2831853+.5;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
    fragmentShader: `uniform sampler2D uAuraMap;uniform float uTime,uSpeed,uOpacity;uniform vec3 uColor;varying float vFlow,vAngle;void main(){float mask=texture2D(uAuraMap,vec2(vAngle,fract(vFlow+uTime*uSpeed))).r;float tailFade=1.-smoothstep(.2,1.,vFlow);float a=mask*tailFade*uOpacity;if(a<.01)discard;gl_FragColor=vec4(uColor*(1.5+mask*3.5),a);}`,
    transparent: true, depthWrite: false, depthTest: false, side: THREE.DoubleSide, blending: THREE.NormalBlending, toneMapped: false,
  });
}
