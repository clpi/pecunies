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
  density: { minimal: 0.82, standard: 1.38, enhanced: 2.05 } as const,
  /** Global flow rotation speed (rad / ms) */
  flowRotate: 0.000000075,
  /** Pointer repulsion: max extra velocity (px/frame at ~60fps scale) */
  repelMax: 0.62,
  repelRadius: 214,
  /** Noise strength scales per layer (0 = back … 2 = fore) */
  noiseLayer: [0.13, 0.21, 0.32] as const,
  /** Velocity smoothing toward flow + noise */
  steer: 0.024,
  /** Extra vignette strength in enhanced */
  vignetteEnhanced: 0.055,
  /** Rare drift “current” pulses */
  clusterIntervalMs: 7600,
  clusterStrength: 0.0065,
  /** Additional gentle gravity for dust fall by layer */
  fallBias: [0.0014, 0.0022, 0.0031] as const,
} as const;

// ─── Palette: fixed atmospheric dust; intentionally independent of terminal theme ─
const DUST_HUES = [
  { dim: [24, 34, 54], mid: [54, 78, 114], hi: [102, 164, 220], signal: [178, 226, 255] },
  { dim: [28, 42, 48], mid: [48, 94, 106], hi: [94, 184, 188], signal: [174, 255, 238] },
  { dim: [38, 32, 56], mid: [78, 64, 116], hi: [150, 122, 214], signal: [220, 194, 255] },
  { dim: [46, 35, 28], mid: [96, 70, 48], hi: [180, 134, 84], signal: [255, 210, 142] },
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
  paletteIndex: number;
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
  const d = CONFIG.density[preset] * (reducedMotion ? 0.18 : 1);
  const cap = (n: number, max: number) => Math.min(max, Math.max(0, Math.floor(n * d)));

  const back = cap(area / 6200, preset === 'enhanced' ? 640 : preset === 'minimal' ? 180 : 430);
  const mid = cap(area / 13200, preset === 'enhanced' ? 260 : preset === 'minimal' ? 70 : 150);
  const fore = cap(area / 36000, preset === 'enhanced' ? 96 : preset === 'minimal' ? 24 : 56);
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
      let baseAlpha: number = 0;
      if (layer === 0) {
        size = Math.random() < 0.78 ? 1 : Math.random() < 0.95 ? 2 : 3;
        baseAlpha = 0.052 + Math.random() * 0.095;
      } else if (layer === 1) {
        size = Math.random() < 0.58 ? 1 : Math.random() < 0.86 ? 2 : Math.random() < 0.97 ? 3 : 4;
        baseAlpha = 0.072 + Math.random() * 0.12;
      } else {
        size = Math.random() < 0.4 ? 1 : Math.random() < 0.72 ? 2 : Math.random() < 0.92 ? 3 : 4;
        baseAlpha = 0.092 + Math.random() * 0.17;
      }

      if (isSignal || isMidSignal) {
        baseAlpha = Math.min(0.34, baseAlpha * 1.55);
        size = Math.min(5, size + 1);
      }

      const paletteRoll = Math.random();
      const paletteIndex =
        paletteRoll < 0.6 ? 0 : paletteRoll < 0.78 ? 1 : paletteRoll < 0.92 ? 2 : 3;

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
        hueShift: (Math.random() - 0.5) * 0.38,
        blur:
          layer === 0
            ? Math.random() * 0.9
            : layer === 1
              ? Math.random() * 1.45
              : Math.random() * 2.25,
        paletteIndex,
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
  let burst = 0;
  let lastTs = 0;
  let rafId = 0;
  let destroyed = false;
  let flowAngle = Math.random() * Math.PI * 2;
  let clusterAngle = Math.random() * Math.PI * 2;
  let clusterStrength = 0;
  let nextClusterAt = performance.now() + CONFIG.clusterIntervalMs * 0.3;
  let pauseTimer = 0;
  let frameCarry = 0;

  const pool: DustParticle[] = [];

  const layerSpeed = [0.022, 0.045, 0.076] as const;
  const layerParallax = [0.26, 0.54, 0.92] as const;

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
    if (destroyed) {
      return;
    }

    if (document.hidden) {
      pauseTimer = window.setTimeout(() => {
        rafId = requestAnimationFrame(draw);
      }, 280);
      return;
    }

    const dt = lastTs ? Math.min(32, ts - lastTs) : 16.67;
    lastTs = ts;
    frameCarry += dt;
    // Cap expensive particle simulation to roughly 30 FPS.
    if (frameCarry < 33) {
      rafId = requestAnimationFrame(draw);
      return;
    }
    frameCarry = 0;

    pointer.x += (pointer.tx - pointer.x) * 0.06;
    pointer.y += (pointer.ty - pointer.y) * 0.06;

    const px = pointer.x / width - 0.5;
    const py = pointer.y / height - 0.5;

    flowAngle += CONFIG.flowRotate * dt;
    const flowX = Math.cos(flowAngle) * 0.08;
    const flowY = Math.sin(flowAngle) * 0.064;

    if (ts >= nextClusterAt) {
      nextClusterAt = ts + CONFIG.clusterIntervalMs * (0.7 + Math.random() * 0.6);
      clusterAngle = Math.random() * Math.PI * 2;
      clusterStrength = CONFIG.clusterStrength * (preset === 'enhanced' ? 1.35 : 1);
    }
    clusterStrength *= 0.992;

    burst *= 0.94;

    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = '#030507';
    ctx.fillRect(0, 0, width, height);
    ctx.globalCompositeOperation = 'lighter';

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

      tx += burst * (Math.sin(ts * 0.002 + p.flickerPhase) * 0.09);
      ty += burst * (Math.cos(ts * 0.0017 + p.colorJitter) * 0.072);

      p.vx += (tx - p.vx) * CONFIG.steer;
      p.vy += (ty - p.vy) * CONFIG.steer;

      const dx = p.x - pointer.x;
      const dy = p.y - pointer.y;
      const dist = Math.hypot(dx, dy) || 1;
      const R = CONFIG.repelRadius * (0.85 + p.layer * 0.06);
      if (dist < R) {
        const f = ((R - dist) / R) ** 2 * CONFIG.repelMax * (0.42 + par * 0.5);
        p.vx += (dx / dist) * f;
        p.vy += (dy / dist) * f;
      }

      p.x += p.vx * dt * 0.022;
      p.y += p.vy * dt * 0.022 + CONFIG.fallBias[p.layer] * dt;

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
      let alpha = p.baseAlpha * flicker * (burst * 0.18 + 0.98);
      if (p.isSignal) {
        alpha = Math.min(0.42, alpha * 1.68);
      }

      const mix = p.colorJitter;
      const dust = DUST_HUES[p.paletteIndex] ?? DUST_HUES[0]!;
      const r = lerp(dust.dim[0], dust.mid[0], mix) + (p.isSignal ? dust.hi[0] - dust.mid[0] : 0) * 0.42;
      const g = lerp(dust.dim[1], dust.mid[1], mix) + (p.isSignal ? dust.hi[1] - dust.mid[1] : 0) * 0.42;
      const b = lerp(dust.dim[2], dust.mid[2], mix) + (p.isSignal ? dust.hi[2] - dust.mid[2] : 0) * 0.42;

      const hue = p.hueShift + hueNoise * 0.28;
      const fr = Math.min(
        255,
        Math.max(0, r + (p.isSignal ? dust.signal[0] - dust.hi[0] : 0) * 0.28 + hue * 18),
      );
      const fg = Math.min(
        255,
        Math.max(0, g + (p.isSignal ? dust.signal[1] - dust.hi[1] : 0) * 0.28 + hue * 7),
      );
      const fb = Math.min(
        255,
        Math.max(0, b + (p.isSignal ? dust.signal[2] - dust.hi[2] : 0) * 0.28 - hue * 10),
      );

      ctx.fillStyle = `rgba(${fr | 0}, ${fg | 0}, ${fb | 0}, ${alpha})`;
      const s = p.size;
      const rx = (p.x - px * par * 34) | 0;
      const ry = (p.y - py * par * 26) | 0;
      const glow = p.isSignal || (p.layer === 2 && s > 1);
      ctx.filter = glow && p.blur > 0.45 ? `blur(${Math.min(1.6, p.blur)}px)` : 'none';
      if (glow) {
        const chroma = Math.max(0.55, par) * 0.9;
        ctx.fillStyle = `rgba(255, 74, 64, ${alpha * 0.18})`;
        ctx.fillRect(rx + chroma, ry, s, s);
        ctx.fillStyle = `rgba(68, 210, 255, ${alpha * 0.22})`;
        ctx.fillRect(rx - chroma, ry, s, s);
        ctx.fillStyle = `rgba(${fr | 0}, ${fg | 0}, ${fb | 0}, ${alpha})`;
      }
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

    rafId = requestAnimationFrame(draw);
  };

  resize();
  window.addEventListener('resize', resize);
  window.addEventListener('pointermove', onPointerMove, { passive: true });
  window.addEventListener('visibilitychange', onVisibility);
  window.addEventListener('storage', onStorage);
  rafId = requestAnimationFrame(draw);

  return {
    setMode(_nextMode: number) {
      // Keep background neutral; route/theme changes should not recolor the field.
    },
    burst() {
      burst = Math.min(1, burst + 0.08);
    },
    destroy() {
      destroyed = true;
      window.clearTimeout(pauseTimer);
      window.cancelAnimationFrame(rafId);
      window.removeEventListener('resize', resize);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('storage', onStorage);
    },
  };
}

/** @deprecated use mountParticleField — alias for existing imports */
export const mountVortexField = mountParticleField;
