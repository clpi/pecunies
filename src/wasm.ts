import wasmUrl from './generated/chaos_engine.wasm?url';

export type AmbientFieldHandle = {
  burst: () => void;
  destroy?: () => void;
  setMode: (mode: number) => void;
};

type AmbientFieldMount = {
  canvas: HTMLCanvasElement;
};

type ChaosEngine = {
  memory: WebAssembly.Memory;
  init(seed: number, count: number, width: number, height: number): void;
  resize(width: number, height: number): void;
  set_mode(mode: number): void;
  clear_attractors(): void;
  add_attractor(x: number, y: number, strength: number): void;
  pulse(x: number, y: number, power: number): void;
  step(delta: number): void;
  particles_ptr(): number;
  particles_len(): number;
};

const PALETTES = [
  { point: 'rgba(243, 239, 232, 0.92)', glow: 'rgba(216, 255, 62, 0.12)' },
  { point: 'rgba(243, 239, 232, 0.9)', glow: 'rgba(157, 214, 255, 0.12)' },
  { point: 'rgba(255, 255, 255, 0.92)', glow: 'rgba(255, 255, 255, 0.1)' },
];

export async function mountAmbientField({
  canvas,
}: AmbientFieldMount): Promise<AmbientFieldHandle> {
  const maybeContext = canvas.getContext('2d');

  if (!maybeContext) {
    return {
      burst() {},
      setMode() {},
    };
  }

  const context = maybeContext;
  const engine = await loadEngine();
  const pointer = { active: false, x: window.innerWidth * 0.5, y: window.innerHeight * 0.5 };
  let width = window.innerWidth;
  let height = window.innerHeight;
  let mode = 0;
  let burstStrength = 0;
  let lastTime = 0;

  resize();
  seed();

  window.addEventListener('resize', () => {
    resize();
    seed();
  });

  window.addEventListener('pointermove', (event) => {
    pointer.active = true;
    pointer.x = event.clientX;
    pointer.y = event.clientY;
  });

  window.addEventListener('pointerdown', (event) => {
    pointer.active = true;
    pointer.x = event.clientX;
    pointer.y = event.clientY;
    engine.pulse(pointer.x, pointer.y, 14);
    burstStrength = 108;
  });

  const tick = (frameTime: number) => {
    const delta = Math.min(0.033, ((frameTime - lastTime) || 16) / 1000);
    lastTime = frameTime;
    const seconds = frameTime / 1000;

    engine.clear_attractors();

    engine.add_attractor(
      width * 0.22 + Math.sin(seconds * 0.35) * width * 0.08,
      height * 0.3 + Math.cos(seconds * 0.23) * height * 0.08,
      mode === 2 ? 72 : 48,
    );

    engine.add_attractor(
      width * 0.78 + Math.cos(seconds * 0.31) * width * 0.1,
      height * 0.72 + Math.sin(seconds * 0.28) * height * 0.1,
      mode === 1 ? -54 : -32,
    );

    engine.add_attractor(width * 0.5, height * 0.5, mode === 0 ? 8 : 18);

    if (pointer.active) {
      engine.add_attractor(pointer.x, pointer.y, mode === 2 ? 132 : 108);
    }

    if (burstStrength > 1) {
      engine.add_attractor(width * 0.5, height * 0.42, burstStrength);
      burstStrength *= 0.95;
    }

    engine.step(delta);
    draw(context, engine, width, height, pointer, mode);
    window.requestAnimationFrame(tick);
  };

  window.requestAnimationFrame(tick);

  return {
    burst() {
      burstStrength = 124;
    },
    setMode(nextMode: number) {
      mode = nextMode;
      engine.set_mode(mode);
    },
  };

  function resize(): void {
    const dpr = window.devicePixelRatio || 1;
    width = window.innerWidth;
    height = window.innerHeight;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    engine.resize(width, height);
  }

  function seed(): void {
    engine.init(Math.floor(Math.random() * 2 ** 31), 2000, width, height);
  }
}

async function loadEngine(): Promise<ChaosEngine> {
  try {
    const { instance } = await WebAssembly.instantiateStreaming(fetch(wasmUrl), {});
    return instance.exports as unknown as ChaosEngine;
  } catch {
    const response = await fetch(wasmUrl);
    const bytes = await response.arrayBuffer();
    const { instance } = await WebAssembly.instantiate(bytes, {});
    return instance.exports as unknown as ChaosEngine;
  }
}

function draw(
  context: CanvasRenderingContext2D,
  engine: ChaosEngine,
  width: number,
  height: number,
  pointer: { active: boolean; x: number; y: number },
  mode: number,
): void {
  const palette = PALETTES[mode] ?? PALETTES[0];
  context.clearRect(0, 0, width, height);

  const centerGlow = context.createRadialGradient(
    width * 0.5,
    height * 0.45,
    0,
    width * 0.5,
    height * 0.45,
    width * 0.36,
  );
  centerGlow.addColorStop(0, palette.glow);
  centerGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');
  context.fillStyle = centerGlow;
  context.fillRect(0, 0, width, height);

  if (pointer.active) {
    const pointerGlow = context.createRadialGradient(pointer.x, pointer.y, 0, pointer.x, pointer.y, 180);
    pointerGlow.addColorStop(0, palette.glow);
    pointerGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');
    context.fillStyle = pointerGlow;
    context.fillRect(pointer.x - 180, pointer.y - 180, 360, 360);
  }

  const particles = new Float32Array(
    engine.memory.buffer,
    engine.particles_ptr(),
    engine.particles_len(),
  );

  context.globalCompositeOperation = 'screen';

  for (let index = 0; index < particles.length; index += 4) {
    const x = particles[index];
    const y = particles[index + 1];
    const vx = particles[index + 2];
    const vy = particles[index + 3];
    const speed = Math.min(1, (Math.abs(vx) + Math.abs(vy)) / 7.5);
    const alpha = 0.08 + speed * 0.42;
    const size = speed > 0.52 ? 2 : 1.2;

    context.fillStyle = withAlpha(palette.point, alpha);
    context.fillRect(x, y, size, size);
  }

  context.globalCompositeOperation = 'source-over';
}

function withAlpha(color: string, alpha: number): string {
  return color.replace(/[\d.]+\)$/, `${alpha})`);
}
