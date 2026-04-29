import './style.css';
import { TerminalApp } from './terminal/app';
import { createCommandRegistry } from './terminal/registry';
import { mountVortexField } from './vortex';

const appRoot = document.querySelector<HTMLDivElement>('#app');

if (!appRoot) {
  throw new Error('The #app container is missing.');
}

const registry = createCommandRegistry();
const terminalApp = new TerminalApp({
  root: appRoot,
  commands: registry.commands,
  featuredCommands: registry.featuredCommands,
});

terminalApp.boot();

const fieldCanvas = document.querySelector<HTMLCanvasElement>('#field-canvas');

if (fieldCanvas) {
  terminalApp.attachFieldHandle(mountVortexField({ canvas: fieldCanvas }));
}
