/**
 * Ambient “system dust” particle field — terminal heat noise / cosmic entropy.
 * Layered drift + value noise, fixed pools, pointer repulsion, theme-aware tint.
 *
 * ─── CONFIG (tweak here) ─────────────────────────────────────────────────
 * localStorage `pecunies.particles` = 'minimal' | 'standard' | 'enhanced'
 * (defaults to 'standard' if unset)
 */
import type { AmbientFieldHandle } from './wasm';

export type ParticlePreset = 'minimal' | 'standard' | 'enhanced';

export type ParticleFieldOptions = {
  canvas: HTMLCanvasElement;
  /** Override localStorage preset */
  preset?: ParticlePreset;
};

// ─── Tunables ─────────────────────────────────────────────────────────────
const CONFIG = {
  /** Base multipliers per preset for particle counts */
  density: { minimal: 1.35, standard: 3.25, enhanced: 4.6 } as const,
  /** Global flow rotation speed (rad / ms) */
  flowRotate: 0.00000016,
  /** Pointer repulsion: max extra velocity (px/frame at ~60fps scale) */
  repelMax: 1.04,
  repelRadius: 224,
  /** Noise strength scales per layer (0 = back … 2 = fore) */
  noiseLayer: [0.22, 0.34, 0.52] as const,
  /** Velocity smoothing toward flow + noise */
  steer: 0.031,
  /** Extra vignette strength in enhanced */
  vignetteEnhanced: 0.08,
  /** Rare drift “current” pulses */
  clusterIntervalMs: 5200,
  clusterStrength: 0.017,
  /** Additional gentle gravity for dust fall by layer */
  fallBias: [0.0036, 0.0052, 0.0073] as const,
} as const;

// ─── Palette: dim terminal dust + theme accent (modes match terminalThemes.mode 0–3) ─
const MODE_DUST = [
  { dim: [52, 55, 58], mid: [82, 86, 90], hi: [136, 162, 148], signal: [198, 246, 220] },
  { dim: [54, 54, 52], mid: [86, 84, 78], hi: [188, 158, 94], signal: [255, 214, 148] },
  { dim: [50, 54, 58], mid: [80, 88, 94], hi: [114, 166, 202], signal: [176, 234, 255] },
  { dim: [56, 58, 60], mid: [88, 92, 96], hi: [156, 164, 172], signal: [228, 236, 242] },
] as const;

type LayerId = 0 | 1 | 2;

type DustParticle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  layer: LayerId;
  size: number;
  baseAlpha: number;
  flickerPhase: number;
  flickerRate: number;
  isSignal: boolean;
  colorJitter: number;
  hueShift: number;
  blur: number;
};

let noisePerm: Uint8Array | null = null;

function initNoisePerm(): void {
  if (noisePerm) {
    return;
  }
  const p = new Uint8Array(512);
  const base = new Uint8Array(256);
  for (let i = 0; i < 256; i++) {
    base[i] = i;
  }
  let seed = 2166136261;
  for (let i = 255; i > 0; i--) {
    seed = Math.imul(seed ^ i, 16777619);
    const j = (seed >>> 0) % (i + 1);
    const t = base[i];
    base[i] = base[j]!;
    base[j] = t!;
  }
  for (let i = 0; i < 512; i++) {
    p[i] = base[i & 255]!;
  }
  noisePerm = p;
}

function fade(t: number): number {
  return t * t * t * (t * (t * 6 - 15) + 10);
}

function lerp(a: number, b: number, t: number): number {
  return a + t * (b - a);
}

function grad2(hash: number, x: number, y: number): number {
  const h = hash & 3;
  const u = h < 2 ? x : y;
  const v = h < 2 ? y : x;
  return ((h & 1) === 0 ? u : -u) + ((h & 2) === 0 ? v : -v);
}

/** Classic 2D Perlin-style noise, ~[-1,1] */
function noise2(x: number, y: number): number {
  initNoisePerm();
  const p = noisePerm!;

  const X = Math.floor(x) & 255;
  const Y = Math.floor(y) & 255;
  const xf = x - Math.floor(x);
  const yf = y - Math.floor(y);
  const u = fade(xf);
  const v = fade(yf);

  const aa = p[p[X]! + Y]!;
  const ab = p[p[X]! + Y + 1]!;
  const ba = p[p[X + 1]! + Y]!;
  const bb = p[p[X + 1]! + Y + 1]!;

  const x1 = lerp(u, grad2(aa, xf, yf), grad2(ba, xf - 1, yf));
  const x2 = lerp(u, grad2(ab, xf, yf - 1), grad2(bb, xf - 1, yf - 1));
  return lerp(v, x1, x2);
}

function fbm2(x: number, y: number): number {
  let a = 0.5;
  let f = 1;
  let sum = 0;
  let norm = 0;
  for (let o = 0; o < 3; o++) {
    sum += a * noise2(x * f, y * f);
    norm += a;
    a *= 0.5;
    f *= 2;
  }
  return sum / norm;
}

function readPreset(explicit?: ParticlePreset): ParticlePreset {
  if (explicit) {
    return explicit;
  }
  try {
    const v = localStorage.getItem('pecunies.particles');
    if (v === 'minimal' || v === 'enhanced' || v === 'standard') {
      return v;
    }
  } catch {
    /* ignore */
  }
  return 'standard';
}

function layerCounts(
  w: number,
  h: number,
  preset: ParticlePreset,
  reducedMotion: boolean,
): [number, number, number] {
  const area = w * h;
  const d = CONFIG.density[preset] * (reducedMotion ? 0.12 : 1);
  const cap = (n: number, m: number) => Math.min(m, Math.max(0, Math.floor(n * d)));

  const back = cap(area / 1080, preset === 'enhanced' ? 1260 : preset === 'minimal' ? 460 : 980);
  const mid = cap(area / 2450, preset === 'enhanced' ? 720 : preset === 'minimal' ? 250 : 520);
  const fore = cap(area / 6900, preset === 'enhanced' ? 330 : preset === 'minimal' ? 120 : 240);
  return [back, mid, fore];
}

function seedParticles(
  w: number,
  h: number,
  preset: ParticlePreset,
  reducedMotion: boolean,
  pool: DustParticle[],
): void {
  const [nb, nm, nf] = layerCounts(w, h, preset, reducedMotion);
  pool.length = 0;

  const pushLayer = (count: number, layer: LayerId) => {
    for (let i = 0; i < count; i++) {
      const roll = Math.random();
      const isSignal = layer === 2 && roll > 0.9;
      const isMidSignal = layer === 1 && roll > 0.985;

      let size: number;
      let baseAlpha: number;
      if (layer === 0) {
        size = Math.random() < 0.76 ? 1 : Math.random() < 0.94 ? 2 : 3;
        baseAlpha = 0.09 + Math.random() * 0.14;
      } else if (layer === 1) {
        size = Math.random() < 0.58 ? 1 : Math.random() < 0.88 ? 2 : 3;
        baseAlpha = 0.11 + Math.random() * 0.16;
      } else {
        size = Math.random() < 0.42 ? 1 : Math.random() < 0.76 ? 2 : Math.random() < 0.94 ? 3 : 4;
        baseAlpha = 0.13 + Math.random() * 0.2;
      }

      if (isSignal || isMidSignal) {
        baseAlpha = Math.min(0.34, baseAlpha * 1.8);
        size = Math.min(3, size + 1);
      }

      pool.push({
        x: Math.random() * w,
        y: Math.random() * h,
        vx: 0,
        vy: 0,
        layer,
        size,
        baseAlpha,
        flickerPhase: Math.random() * Math.PI * 2,
        flickerRate: 0.00035 + Math.random() * 0.00085,
        isSignal: Boolean(isSignal || isMidSignal),
        colorJitter: Math.random(),
        hueShift: (Math.random() - 0.5) * 0.22,
        blur:
          layer === 0
            ? Math.random() * 0.6
            : layer === 1
              ? Math.random() * 0.9
              : Math.random() * 1.2,
      });
    }
  };

  pushLayer(nb, 0);
  pushLayer(nm, 1);
  pushLayer(nf, 2);
}

export function mountParticleField({ canvas, preset: presetOpt }: ParticleFieldOptions): AmbientFieldHandle {
  const ctx = canvas.getContext('2d', { alpha: false });

  if (!ctx) {
    return { setMode() {}, burst() {} };
  }

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let preset = readPreset(presetOpt);

  const pointer = {
    x: window.innerWidth * 0.5,
    y: window.innerHeight * 0.5,
    tx: window.innerWidth * 0.5,
    ty: window.innerHeight * 0.5,
  };

  let width = 1;
  let height = 1;
  let dpr = 1;
  let mode = 0;
  let burst = 0;
  let lastTs = 0;
  let flowAngle = Math.random() * Math.PI * 2;
  let clusterAngle = Math.random() * Math.PI * 2;
  let clusterStrength = 0;
  let nextClusterAt = performance.now() + CONFIG.clusterIntervalMs * 0.3;
  let pauseTimer = 0;
  let frameCarry = 0;

  const pool: DustParticle[] = [];

  const layerSpeed = [0.032, 0.068, 0.118] as const;
  const layerParallax = [0.44, 0.86, 1.38] as const;

  const resize = (): void => {
    const rect = canvas.getBoundingClientRect();
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    width = Math.max(1, Math.floor(rect.width));
    height = Math.max(1, Math.floor(rect.height));
    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    seedParticles(width, height, preset, reducedMotion, pool);
  };

  const onPointerMove = (e: PointerEvent): void => {
    pointer.tx = e.clientX;
    pointer.ty = e.clientY;
  };

  const onVisibility = (): void => {
    if (document.hidden) {
      return;
    }
    window.clearTimeout(pauseTimer);
    lastTs = 0;
  };

  const onStorage = (e: StorageEvent): void => {
    if (e.key === 'pecunies.particles') {
      preset = readPreset();
      seedParticles(width, height, preset, reducedMotion, pool);
    }
  };

  const draw = (ts: number): void => {
    if (document.hidden) {
      pauseTimer = window.setTimeout(() => {
        requestAnimationFrame(draw);
      }, 280);
      return;
    }

    const dt = lastTs ? Math.min(32, ts - lastTs) : 16.67;
    lastTs = ts;
    frameCarry += dt;
    // Cap expensive particle simulation to roughly 30 FPS.
    if (frameCarry < 33) {
      requestAnimationFrame(draw);
      return;
    }
    frameCarry = 0;

    pointer.x += (pointer.tx - pointer.x) * 0.06;
    pointer.y += (pointer.ty - pointer.y) * 0.06;

    const px = pointer.x / width - 0.5;
    const py = pointer.y / height - 0.5;

    flowAngle += CONFIG.flowRotate * dt;
    const flowX = Math.cos(flowAngle) * 0.06;
    const flowY = Math.sin(flowAngle) * 0.05;

    if (ts >= nextClusterAt) {
      nextClusterAt = ts + CONFIG.clusterIntervalMs * (0.7 + Math.random() * 0.6);
      clusterAngle = Math.random() * Math.PI * 2;
      clusterStrength = CONFIG.clusterStrength * (preset === 'enhanced' ? 1.35 : 1);
    }
    clusterStrength *= 0.992;

    const dust = MODE_DUST[mode % MODE_DUST.length] ?? MODE_DUST[0]!;
    burst *= 0.94;

    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = '#030405';
    ctx.fillRect(0, 0, width, height);

    const nScale = 0.00115;
    const t = ts * 0.00006;

    for (const p of pool) {
      const ls = layerSpeed[p.layer];
      const par = layerParallax[p.layer];

      const nx = fbm2(p.x * nScale + t, p.y * nScale * 1.1 - t * 0.4);
      const ny = fbm2(p.x * nScale * 1.3 - t * 0.3, p.y * nScale + t * 0.5 + 13.7);
      const hueNoise = fbm2(p.x * nScale * 0.58 + t * 0.42, p.y * nScale * 0.62 - t * 0.27);

      let tx = flowX * ls + nx * CONFIG.noiseLayer[p.layer] * ls * 2.9;
      let ty = flowY * ls + ny * CONFIG.noiseLayer[p.layer] * ls * 2.9;

      tx += Math.cos(clusterAngle) * clusterStrength * ls * 24;
      ty += Math.sin(clusterAngle) * clusterStrength * ls * 24;

      tx += burst * (Math.sin(ts * 0.002 + p.flickerPhase) * 0.06);
      ty += burst * (Math.cos(ts * 0.0017 + p.colorJitter) * 0.05);

      p.vx += (tx - p.vx) * CONFIG.steer;
      p.vy += (ty - p.vy) * CONFIG.steer;

      const dx = p.x - pointer.x;
      const dy = p.y - pointer.y;
      const dist = Math.hypot(dx, dy) || 1;
      const R = CONFIG.repelRadius * (0.85 + p.layer * 0.06);
      if (dist < R) {
        const f = ((R - dist) / R) ** 2 * CONFIG.repelMax * (0.35 + par * 0.4);
        p.vx += (dx / dist) * f;
        p.vy += (dy / dist) * f;
      }

      const sway = Math.sin(ts * (0.00058 + p.layer * 0.00012) + p.flickerPhase * 1.7) * (0.006 + p.layer * 0.003);
      p.x += (p.vx + sway) * dt * 0.028;
      p.y += p.vy * dt * 0.028 + (CONFIG.fallBias[p.layer] + p.layer * 0.0019) * dt;

      p.x -= px * par * 2.4;
      p.y -= py * par * 2.05;

      if (p.x < 0) {
        p.x += width;
      }
      if (p.x >= width) {
        p.x -= width;
      }
      if (p.y < 0) {
        p.y += height;
      }
      if (p.y >= height) {
        p.y -= height;
      }

      const flicker =
        0.88 +
        0.12 * Math.sin(ts * p.flickerRate + p.flickerPhase) +
        (preset === 'enhanced' ? 0.065 * Math.sin(ts * 0.0011 + p.x * 0.01) : 0);
      let alpha = p.baseAlpha * flicker * (burst * 0.12 + 0.92);
      if (p.isSignal) {
        alpha = Math.min(0.4, alpha * 1.95);
      }

      const mix = p.colorJitter;
      const r = lerp(dust.dim[0], dust.mid[0], mix) + (p.isSignal ? dust.hi[0] - dust.mid[0] : 0) * 0.35;
      const g = lerp(dust.dim[1], dust.mid[1], mix) + (p.isSignal ? dust.hi[1] - dust.mid[1] : 0) * 0.35;
      const b = lerp(dust.dim[2], dust.mid[2], mix) + (p.isSignal ? dust.hi[2] - dust.mid[2] : 0) * 0.35;

      const hue = p.hueShift + hueNoise * 0.12;
      const fr = Math.min(
        255,
        Math.max(0, r + (p.isSignal ? dust.signal[0] - dust.hi[0] : 0) * 0.25 + hue * 22),
      );
      const fg = Math.min(
        255,
        Math.max(0, g + (p.isSignal ? dust.signal[1] - dust.hi[1] : 0) * 0.25 + hue * 8),
      );
      const fb = Math.min(
        255,
        Math.max(0, b + (p.isSignal ? dust.signal[2] - dust.hi[2] : 0) * 0.25 - hue * 28),
      );

      ctx.fillStyle = `rgba(${fr | 0}, ${fg | 0}, ${fb | 0}, ${alpha})`;
      const s = p.size;
      const rx = p.x | 0;
      const ry = p.y | 0;
      ctx.filter = 'none';
      ctx.fillRect(rx, ry, s, s);
    }
    ctx.filter = 'none';

    const cx = width * 0.5 + px * 6;
    const cy = height * 0.5 + py * 5;
    const maxR = Math.max(width, height) * 0.72;
    const vig = ctx.createRadialGradient(cx, cy, maxR * 0.18, cx, cy, maxR);
    vig.addColorStop(0, 'rgba(0,0,0,0)');
    vig.addColorStop(0.55, 'rgba(0,0,0,0.12)');
    vig.addColorStop(
      1,
      `rgba(0,0,0,${0.42 + (preset === 'enhanced' ? CONFIG.vignetteEnhanced : 0)})`,
    );
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, width, height);

    requestAnimationFrame(draw);
  };

  resize();
  window.addEventListener('resize', resize);
  window.addEventListener('pointermove', onPointerMove, { passive: true });
  window.addEventListener('visibilitychange', onVisibility);
  window.addEventListener('storage', onStorage);
  requestAnimationFrame(draw);

  return {
    setMode(nextMode: number) {
      mode = Math.abs(nextMode) % MODE_DUST.length;
    },
    burst() {
      burst = Math.min(1, burst + 0.1);
    },
  };
}

/** @deprecated use mountParticleField — alias for existing imports */
export const mountVortexField = mountParticleField;
