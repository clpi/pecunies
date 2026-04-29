import type { AmbientFieldHandle } from './wasm';

type VortexOptions = {
  canvas: HTMLCanvasElement;
};

type Particle = {
  arm: number;
  angle: number;
  radius: number;
  depth: number;
  speed: number;
  size: number;
  pulse: number;
  scatterX: number;
  scatterY: number;
};

const COLOR_MODES = [
  { accent: [255, 106, 102], secondary: [255, 51, 71] },
  { accent: [245, 184, 75], secondary: [255, 210, 122] },
  { accent: [139, 202, 255], secondary: [93, 167, 255] },
  { accent: [244, 247, 248], secondary: [255, 255, 255] },
] as const;

export function mountVortexField({ canvas }: VortexOptions): AmbientFieldHandle {
  const context = canvas.getContext('2d', { alpha: false });

  if (!context) {
    throw new Error('Unable to initialize vortex canvas.');
  }

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const pointer = {
    x: window.innerWidth / 2,
    y: window.innerHeight / 2,
    targetX: window.innerWidth / 2,
    targetY: window.innerHeight / 2,
  };

  let width = 1;
  let height = 1;
  let dpr = 1;
  let mode = 0;
  let burst = 0;
  let particles: Particle[] = [];

  const seed = (): void => {
    const count = reducedMotion ? 320 : Math.min(1350, Math.max(720, Math.floor((width * height) / 1900)));
    const arms = 7;
    const maxRadius = Math.hypot(width, height) * 0.44;

    particles = Array.from({ length: count }, (_, index) => {
      const arm = index % arms;
      const ring = index / count;
      const spread = Math.pow(ring, 0.58);

      return {
        arm,
        angle: (arm / arms) * Math.PI * 2 + Math.random() * 0.58,
        radius: 22 + spread * maxRadius + Math.random() * 42,
        depth: 0.18 + Math.random() * 0.82,
        speed: (0.000002 + Math.random() * 0.000008) * (Math.random() > 0.5 ? 1 : -1),
        size: 0.18 + Math.random() * Math.random() * 1.35,
        pulse: Math.random() * Math.PI * 2,
        scatterX: 0,
        scatterY: 0,
      };
    });
  };

  const resize = (): void => {
    const rect = canvas.getBoundingClientRect();
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    width = Math.max(1, Math.floor(rect.width));
    height = Math.max(1, Math.floor(rect.height));
    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    seed();
  };

  const onPointerMove = (event: PointerEvent): void => {
    pointer.targetX = event.clientX;
    pointer.targetY = event.clientY;
  };

  const draw = (time: number): void => {
    pointer.x += (pointer.targetX - pointer.x) * 0.075;
    pointer.y += (pointer.targetY - pointer.y) * 0.075;

    const offsetX = (pointer.x / width - 0.5) || 0;
    const offsetY = (pointer.y / height - 0.5) || 0;
    const centerX = width * 0.5 + offsetX * 8;
    const centerY = height * 0.49 + offsetY * 6;
    const palette = COLOR_MODES[mode] ?? COLOR_MODES[0];

    context.globalCompositeOperation = 'source-over';
    context.fillStyle = 'rgba(7, 9, 11, 0.26)';
    context.fillRect(0, 0, width, height);

    context.save();
    context.translate(offsetX * -24, offsetY * -20);

    context.globalCompositeOperation = 'lighter';

    for (const particle of particles) {
      const drift = reducedMotion ? 0 : time * particle.speed;
      const spiral = particle.angle + drift + particle.radius * 0.0105;
      const pulseWave = 0.82 + Math.sin(time * 0.00008 + particle.pulse) * 0.18;
      const radius = particle.radius + Math.sin(time * 0.00004 + particle.pulse) * 2.5 + burst * 7;
      const perspective = 0.24 + particle.depth * 0.86;
      const parallaxX = offsetX * (8 + particle.depth * 16);
      const parallaxY = offsetY * (6 + particle.depth * 12);
      let x = centerX + Math.cos(spiral) * radius * perspective + parallaxX;
      let y = centerY + Math.sin(spiral) * radius * perspective * 0.62 + parallaxY;
      const screenX = x + offsetX * -24;
      const screenY = y + offsetY * -20;
      const dx = screenX - pointer.x;
      const dy = screenY - pointer.y;
      const distance = Math.hypot(dx, dy);
      const scatterRadius = 230;

      if (distance < scatterRadius) {
        const force = Math.pow((scatterRadius - distance) / scatterRadius, 2) * (22 + burst * 5);
        const safeDistance = distance || 1;
        particle.scatterX += (dx / safeDistance) * force;
        particle.scatterY += (dy / safeDistance) * force;
      }

      particle.scatterX *= 0.925;
      particle.scatterY *= 0.925;
      x += particle.scatterX;
      y += particle.scatterY;

      const tintMix = particle.depth > 0.62 ? palette.accent : palette.secondary;
      const alpha = (0.045 + particle.depth * 0.18) * pulseWave + burst * 0.025;
      const size = particle.size * (0.58 + particle.depth * 0.82 + burst * 0.32);

      context.beginPath();
      context.fillStyle = `rgba(${tintMix[0]}, ${tintMix[1]}, ${tintMix[2]}, ${Math.min(alpha, 0.82)})`;
      context.arc(x, y, size, 0, Math.PI * 2);
      context.fill();
    }

    context.restore();

    const vignette = context.createRadialGradient(centerX, centerY, 40, centerX, centerY, Math.max(width, height) * 0.72);
    vignette.addColorStop(0, 'rgba(255, 255, 255, 0.006)');
    vignette.addColorStop(0.58, 'rgba(0, 0, 0, 0)');
    vignette.addColorStop(1, 'rgba(0, 0, 0, 0.62)');
    context.globalCompositeOperation = 'source-over';
    context.fillStyle = vignette;
    context.fillRect(0, 0, width, height);

    burst *= 0.9;
    window.requestAnimationFrame(draw);
  };

  resize();
  window.addEventListener('resize', resize);
  window.addEventListener('pointermove', onPointerMove, { passive: true });
  window.requestAnimationFrame(draw);

  return {
    setMode(nextMode: number) {
      mode = Math.abs(nextMode) % COLOR_MODES.length;
    },
    burst() {
      burst = Math.min(1, burst + 0.42);
    },
  };
}
