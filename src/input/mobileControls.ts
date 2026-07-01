export type MobileControlVector = {
  x: number;
  y: number;
};

type MobileControlsOptions = {
  stick: HTMLElement;
  thumb: HTMLElement;
  dashButton: HTMLButtonElement;
  ultimateButton: HTMLButtonElement;
  onMove: (vector: MobileControlVector) => void;
  onDash: () => void;
  onUltimate: () => void;
};

export type MobileControls = {
  getMoveVector: () => MobileControlVector;
  reset: () => void;
  setDashReady: (ready: boolean, active: boolean) => void;
  setUltimateReady: (ready: boolean, active: boolean) => void;
};

const deadZone = 0.14;

export function createMobileControls(options: MobileControlsOptions): MobileControls {
  let activePointerId: number | null = null;
  let moveVector: MobileControlVector = { x: 0, y: 0 };

  const setStickVectorFromPointer = (event: PointerEvent): void => {
    const rect = options.stick.getBoundingClientRect();
    const centerX = rect.left + rect.width * 0.5;
    const centerY = rect.top + rect.height * 0.5;
    const offsetX = event.clientX - centerX;
    const offsetY = event.clientY - centerY;
    const distance = Math.hypot(offsetX, offsetY);
    const thumbRect = options.thumb.getBoundingClientRect();
    const joystickRadius = Math.max(1, Math.min(rect.width - thumbRect.width, rect.height - thumbRect.height) * 0.5);
    const clampedDistance = Math.min(distance, joystickRadius);
    const angle = Math.atan2(offsetY, offsetX);
    const normalizedDistance = clampedDistance / joystickRadius;

    if (normalizedDistance < deadZone) {
      moveVector = { x: 0, y: 0 };
      options.thumb.style.transform = "translate(-50%, -50%)";
      options.onMove(moveVector);
      return;
    }

    const thumbX = Math.cos(angle) * clampedDistance;
    const thumbY = Math.sin(angle) * clampedDistance;
    moveVector = {
      x: Math.cos(angle) * normalizedDistance,
      y: Math.sin(angle) * normalizedDistance,
    };
    options.thumb.style.transform = `translate(calc(-50% + ${thumbX}px), calc(-50% + ${thumbY}px))`;
    options.onMove(moveVector);
  };

  const resetStick = (): void => {
    activePointerId = null;
    moveVector = { x: 0, y: 0 };
    options.thumb.style.transform = "translate(-50%, -50%)";
    options.stick.classList.remove("active");
    options.onMove(moveVector);
  };

  options.stick.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    if (activePointerId !== null) {
      return;
    }
    activePointerId = event.pointerId;
    options.stick.setPointerCapture(event.pointerId);
    options.stick.classList.add("active");
    setStickVectorFromPointer(event);
  });

  options.stick.addEventListener("pointermove", (event) => {
    if (event.pointerId !== activePointerId) {
      return;
    }
    event.preventDefault();
    setStickVectorFromPointer(event);
  });

  options.stick.addEventListener("pointerup", (event) => {
    if (event.pointerId === activePointerId) {
      resetStick();
    }
  });
  options.stick.addEventListener("pointercancel", (event) => {
    if (event.pointerId === activePointerId) {
      resetStick();
    }
  });

  options.dashButton.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    options.onDash();
  });
  options.ultimateButton.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    options.onUltimate();
  });

  return {
    getMoveVector: () => moveVector,
    reset: resetStick,
    setDashReady: (ready, active) => {
      options.dashButton.classList.toggle("ready", ready);
      options.dashButton.classList.toggle("active", active);
      options.dashButton.disabled = !ready && !active;
    },
    setUltimateReady: (ready, active) => {
      options.ultimateButton.classList.toggle("ready", ready);
      options.ultimateButton.classList.toggle("active", active);
      options.ultimateButton.disabled = !ready && !active;
    },
  };
}
