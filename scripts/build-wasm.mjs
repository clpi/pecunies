import { copyFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';

const root = resolve(import.meta.dirname, '..');
const crateDir = resolve(root, 'wasm/chaos-engine');
const outputFiles = [
  resolve(root, 'public/wasm/chaos_engine.wasm'),
  resolve(root, 'src/generated/chaos_engine.wasm'),
];
const builtFile = resolve(
  crateDir,
  'target/wasm32-unknown-unknown/release/chaos_engine.wasm',
);
const toolchain = process.env.WASM_RUST_TOOLCHAIN ?? 'nightly';
const rustc = execFileSync('rustup', ['which', '--toolchain', toolchain, 'rustc'], {
  encoding: 'utf8',
}).trim();

execFileSync('rustup', ['run', toolchain, 'cargo', 'build', '--target', 'wasm32-unknown-unknown', '--release'], {
  cwd: crateDir,
  stdio: 'inherit',
  env: {
    ...process.env,
    RUSTC: rustc,
  },
});

for (const outputFile of outputFiles) {
  mkdirSync(dirname(outputFile), { recursive: true });
  copyFileSync(builtFile, outputFile);
  process.stdout.write(`Built ${outputFile}\n`);
}
