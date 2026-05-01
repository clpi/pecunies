import './style.css';
import { TerminalApp } from './terminal/app';
import { createCommandRegistry } from './terminal/registry';
import { mountParticleField } from './particle-field';
import { setKnownCommandNames } from './terminal/render';

const appRoot = document.querySelector<HTMLDivElement>('#app');

if (!appRoot) {
  throw new Error('The #app container is missing.');
}

const registry = createCommandRegistry();
setKnownCommandNames(registry.commands.flatMap((c) => [c.name, ...c.aliases]));

const terminalApp = new TerminalApp({
  root: appRoot,
  commands: registry.commands,
  featuredCommands: registry.featuredCommands,
});

terminalApp.boot();

const fieldCanvas = document.querySelector<HTMLCanvasElement>('#field-canvas');

if (fieldCanvas) {
  terminalApp.attachFieldHandle(mountParticleField({ canvas: fieldCanvas }));
}
