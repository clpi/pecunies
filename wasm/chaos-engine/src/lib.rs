#![no_std]
#![allow(static_mut_refs)]

use core::panic::PanicInfo;

const MAX_PARTICLES: usize = 2048;
const STRIDE: usize = 4;
const MAX_ATTRACTORS: usize = 6;

static mut WIDTH: f32 = 1280.0;
static mut HEIGHT: f32 = 720.0;
static mut COUNT: usize = 0;
static mut MODE: u32 = 0;
static mut SEED: u32 = 1;
static mut PHASE: f32 = 0.0;
static mut PARTICLES: [f32; MAX_PARTICLES * STRIDE] = [0.0; MAX_PARTICLES * STRIDE];
static mut ATTRACTORS: [f32; MAX_ATTRACTORS * 3] = [0.0; MAX_ATTRACTORS * 3];
static mut ATTRACTOR_COUNT: usize = 0;

#[panic_handler]
fn panic(_info: &PanicInfo) -> ! {
    loop {}
}

#[no_mangle]
pub extern "C" fn init(seed: u32, requested_count: u32, width: f32, height: f32) {
    unsafe {
        WIDTH = width.max(1.0);
        HEIGHT = height.max(1.0);
        COUNT = requested_count.min(MAX_PARTICLES as u32) as usize;
        SEED = seed.max(1);
        PHASE = 0.0;

        for index in 0..COUNT {
            let base = index * STRIDE;
            PARTICLES[base] = random_f32() * WIDTH;
            PARTICLES[base + 1] = random_f32() * HEIGHT;
            PARTICLES[base + 2] = (random_f32() - 0.5) * 2.4;
            PARTICLES[base + 3] = (random_f32() - 0.5) * 2.4;
        }
    }
}

#[no_mangle]
pub extern "C" fn resize(width: f32, height: f32) {
    unsafe {
        WIDTH = width.max(1.0);
        HEIGHT = height.max(1.0);
    }
}

#[no_mangle]
pub extern "C" fn set_mode(mode: u32) {
    unsafe {
        MODE = mode.min(2);
    }
}

#[no_mangle]
pub extern "C" fn clear_attractors() {
    unsafe {
        ATTRACTOR_COUNT = 0;
    }
}

#[no_mangle]
pub extern "C" fn add_attractor(x: f32, y: f32, strength: f32) {
    unsafe {
        if ATTRACTOR_COUNT >= MAX_ATTRACTORS {
            return;
        }

        let base = ATTRACTOR_COUNT * 3;
        ATTRACTORS[base] = x;
        ATTRACTORS[base + 1] = y;
        ATTRACTORS[base + 2] = strength;
        ATTRACTOR_COUNT += 1;
    }
}

#[no_mangle]
pub extern "C" fn pulse(x: f32, y: f32, power: f32) {
    unsafe {
        for index in 0..COUNT {
            let base = index * STRIDE;
            let dx = PARTICLES[base] - x;
            let dy = PARTICLES[base + 1] - y;
            let impulse = power / (dx * dx + dy * dy + 48.0);

            PARTICLES[base + 2] += dx * impulse * 2.4;
            PARTICLES[base + 3] += dy * impulse * 2.4;
        }
    }
}

#[no_mangle]
pub extern "C" fn step(delta: f32) {
    unsafe {
        let dt = delta.max(0.008).min(0.05) * 60.0;
        let (drag, swirl, noise, speed_limit) = match MODE {
            0 => (0.976, 0.018, 0.02, 3.6),
            1 => (0.984, 0.038, 0.045, 5.2),
            _ => (0.991, 0.076, 0.08, 7.2),
        };

        PHASE += delta * (1.2 + MODE as f32 * 0.8);

        for index in 0..COUNT {
            let base = index * STRIDE;
            let mut x = PARTICLES[base];
            let mut y = PARTICLES[base + 1];
            let mut vx = PARTICLES[base + 2];
            let mut vy = PARTICLES[base + 3];

            let mut ax = triangle_wave(y / HEIGHT + PHASE * 0.08) * 0.06;
            let mut ay = triangle_wave(x / WIDTH + 0.33 + PHASE * 0.05) * 0.06;

            for attractor_index in 0..ATTRACTOR_COUNT {
                let attractor_base = attractor_index * 3;
                let target_x = ATTRACTORS[attractor_base];
                let target_y = ATTRACTORS[attractor_base + 1];
                let strength = ATTRACTORS[attractor_base + 2];
                let dx = target_x - x;
                let dy = target_y - y;
                let distance_sq = dx * dx + dy * dy + 32.0;
                let pull = strength / distance_sq;

                ax += dx * pull;
                ay += dy * pull;
                ax += -dy * pull * swirl;
                ay += dx * pull * swirl;
            }

            vx = (vx + ax * dt + jitter(noise)) * drag;
            vy = (vy + ay * dt + jitter(noise)) * drag;

            let speed = vx.abs() + vy.abs();
            if speed > speed_limit {
                let scale = speed_limit / speed;
                vx *= scale;
                vy *= scale;
            }

            x += vx * dt;
            y += vy * dt;

            if x < -12.0 {
                x = WIDTH + 12.0;
            } else if x > WIDTH + 12.0 {
                x = -12.0;
            }

            if y < -12.0 {
                y = HEIGHT + 12.0;
            } else if y > HEIGHT + 12.0 {
                y = -12.0;
            }

            PARTICLES[base] = x;
            PARTICLES[base + 1] = y;
            PARTICLES[base + 2] = vx;
            PARTICLES[base + 3] = vy;
        }
    }
}

#[no_mangle]
pub extern "C" fn particles_ptr() -> *const f32 {
    unsafe { PARTICLES.as_ptr() }
}

#[no_mangle]
pub extern "C" fn particles_len() -> u32 {
    unsafe { (COUNT * STRIDE) as u32 }
}

fn jitter(amount: f32) -> f32 {
    (random_f32() - 0.5) * amount
}

fn random_f32() -> f32 {
    unsafe {
        SEED = SEED.wrapping_mul(1_664_525).wrapping_add(1_013_904_223);
        ((SEED >> 8) as f32) / ((u32::MAX >> 8) as f32)
    }
}

fn triangle_wave(value: f32) -> f32 {
    let wrapped = wrap01(value);
    1.0 - 4.0 * (wrapped - 0.5).abs()
}

fn wrap01(value: f32) -> f32 {
    let shifted = value + 4096.0;
    shifted - shifted as u32 as f32
}
