type RunnerMount = {
  canvas: HTMLCanvasElement;
  scoreOutput: HTMLElement;
  statusOutput: HTMLElement;
  unlockOutput: HTMLElement;
  toggleButton: HTMLButtonElement;
  resetButton: HTMLButtonElement;
};

type Orb = {
  kind: 'good' | 'bad';
  x: number;
  y: number;
  radius: number;
  speed: number;
  drift: number;
  wobble: number;
};

export function mountSignalGame({
  canvas,
  scoreOutput,
  statusOutput,
  unlockOutput,
  toggleButton,
  resetButton,
}: RunnerMount): void {
  const maybeContext = canvas.getContext('2d');

  if (!maybeContext) {
    statusOutput.textContent = 'Canvas unavailable in this browser.';
    return;
  }

  const context = maybeContext;

  const keys = new Set<string>();
  const pointer = { active: false, x: 0, y: 0 };
  const player = { x: 180, y: 150, radius: 14, targetX: 180, targetY: 150 };
  let width = 360;
  let height = 300;
  let running = false;
  let score = 0;
  let shield = 3;
  let unlocked = false;
  let lastFrame = 0;
  let goodSpawn = 0;
  let badSpawn = 0;
  let animationFrame = 0;
  let time = 0;
  const orbs: Orb[] = [];

  const resizeObserver = new ResizeObserver(() => {
    resizeCanvas();
    drawScene();
  });

  resizeObserver.observe(canvas);
  resizeCanvas();
  resetWorld();
  drawScene();

  canvas.addEventListener('pointerdown', (event) => {
    pointer.active = true;
    updatePointer(event);
  });

  canvas.addEventListener('pointermove', (event) => {
    if (!pointer.active) {
      return;
    }

    updatePointer(event);
  });

  canvas.addEventListener('pointerleave', () => {
    pointer.active = false;
  });

  canvas.addEventListener('pointerup', () => {
    pointer.active = false;
  });

  window.addEventListener('keydown', (event) => {
    if (event.key.startsWith('Arrow')) {
      event.preventDefault();
      keys.add(event.key);
    }
  });

  window.addEventListener('keyup', (event) => {
    keys.delete(event.key);
  });

  toggleButton.addEventListener('click', () => {
    running = !running;
    toggleButton.textContent = running ? 'Pause run' : 'Launch run';

    if (running) {
      statusOutput.textContent = 'Runner online. Keep moving.';
      lastFrame = 0;
      animationFrame = window.requestAnimationFrame(loop);
      return;
    }

    statusOutput.textContent = 'Run paused.';
    window.cancelAnimationFrame(animationFrame);
  });

  resetButton.addEventListener('click', () => {
    running = false;
    toggleButton.textContent = 'Launch run';
    window.cancelAnimationFrame(animationFrame);
    resetWorld();
    drawScene();
  });

  function resizeCanvas(): void {
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;

    width = Math.max(rect.width, 240);
    height = Math.max(rect.height, 220);
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function resetWorld(): void {
    orbs.length = 0;
    score = 0;
    shield = 3;
    unlocked = false;
    goodSpawn = 0;
    badSpawn = 0;
    time = 0;
    player.x = width * 0.5;
    player.y = height * 0.75;
    player.targetX = player.x;
    player.targetY = player.y;
    scoreOutput.textContent = '0 / 12';
    statusOutput.textContent = 'Collect bright nodes, dodge red voids.';
    unlockOutput.textContent = 'Score 12 to unlock a hidden note.';
  }

  function updatePointer(event: PointerEvent): void {
    const bounds = canvas.getBoundingClientRect();
    player.targetX = event.clientX - bounds.left;
    player.targetY = event.clientY - bounds.top;
  }

  function loop(frameTime: number): void {
    const delta = Math.min(0.035, ((frameTime - lastFrame) || 16) / 1000);
    lastFrame = frameTime;
    time += delta;
    update(delta);
    drawScene();

    if (running) {
      animationFrame = window.requestAnimationFrame(loop);
    }
  }

  function update(delta: number): void {
    goodSpawn -= delta;
    badSpawn -= delta;

    if (goodSpawn <= 0) {
      spawnOrb('good');
      goodSpawn = 0.55;
    }

    if (badSpawn <= 0) {
      spawnOrb('bad');
      badSpawn = 1.15;
    }

    if (pointer.active) {
      player.x += (player.targetX - player.x) * 0.18;
      player.y += (player.targetY - player.y) * 0.18;
    }

    const speed = 240 * delta;

    if (keys.has('ArrowLeft')) {
      player.x -= speed;
    }
    if (keys.has('ArrowRight')) {
      player.x += speed;
    }
    if (keys.has('ArrowUp')) {
      player.y -= speed;
    }
    if (keys.has('ArrowDown')) {
      player.y += speed;
    }

    player.x = clamp(player.x, player.radius, width - player.radius);
    player.y = clamp(player.y, player.radius, height - player.radius);

    for (let index = orbs.length - 1; index >= 0; index -= 1) {
      const orb = orbs[index];
      orb.y += orb.speed * delta;
      orb.x += Math.sin(time * 3 + orb.wobble) * orb.drift * delta;

      if (orb.y - orb.radius > height + 20) {
        orbs.splice(index, 1);
        continue;
      }

      if (!isColliding(player, orb)) {
        continue;
      }

      orbs.splice(index, 1);

      if (orb.kind === 'good') {
        score += 1;
        scoreOutput.textContent = `${score} / 12`;
        statusOutput.textContent = `Node captured. Shield at ${shield}.`;

        if (!unlocked && score >= 12) {
          unlocked = true;
          unlockOutput.textContent =
            'Unlocked: build for delight on purpose. People feel craft before they have words for it.';
        }

        continue;
      }

      shield -= 1;
      statusOutput.textContent = `Void impact. Shield at ${Math.max(shield, 0)}.`;

      if (shield <= 0) {
        running = false;
        toggleButton.textContent = 'Launch run';
        statusOutput.textContent = 'Run lost. Reset and try again.';
        unlockOutput.textContent = unlocked
          ? unlockOutput.textContent
          : 'Almost there. Reset and score 12 to unlock the hidden note.';
        return;
      }
    }
  }

  function drawScene(): void {
    context.clearRect(0, 0, width, height);

    const background = context.createLinearGradient(0, 0, 0, height);
    background.addColorStop(0, 'rgba(10, 18, 30, 0.98)');
    background.addColorStop(1, 'rgba(5, 9, 16, 0.98)');
    context.fillStyle = background;
    context.fillRect(0, 0, width, height);

    context.strokeStyle = 'rgba(125, 207, 255, 0.08)';
    context.lineWidth = 1;
    for (let x = 0; x <= width; x += 32) {
      context.beginPath();
      context.moveTo(x, 0);
      context.lineTo(x, height);
      context.stroke();
    }
    for (let y = 0; y <= height; y += 32) {
      context.beginPath();
      context.moveTo(0, y);
      context.lineTo(width, y);
      context.stroke();
    }

    for (const orb of orbs) {
      context.beginPath();
      context.fillStyle =
        orb.kind === 'good' ? 'rgba(112, 242, 196, 0.92)' : 'rgba(255, 88, 120, 0.92)';
      context.shadowBlur = orb.kind === 'good' ? 18 : 20;
      context.shadowColor =
        orb.kind === 'good' ? 'rgba(112, 242, 196, 0.55)' : 'rgba(255, 88, 120, 0.5)';
      context.arc(orb.x, orb.y, orb.radius, 0, Math.PI * 2);
      context.fill();
    }

    context.shadowBlur = 0;
    context.fillStyle = 'rgba(247, 236, 213, 0.9)';
    context.beginPath();
    context.moveTo(player.x, player.y - player.radius - 4);
    context.lineTo(player.x + player.radius + 6, player.y + player.radius);
    context.lineTo(player.x - player.radius - 6, player.y + player.radius);
    context.closePath();
    context.fill();

    context.font = '13px "IBM Plex Mono", monospace';
    context.fillStyle = 'rgba(158, 178, 196, 0.92)';
    context.fillText(`shield ${shield}`, 14, 24);
    context.fillText(`score ${score}`, 14, 44);
  }

  function spawnOrb(kind: Orb['kind']): void {
    orbs.push({
      kind,
      x: Math.random() * (width - 40) + 20,
      y: -18,
      radius: kind === 'good' ? 7 + Math.random() * 4 : 10 + Math.random() * 5,
      speed: kind === 'good' ? 100 + Math.random() * 50 : 120 + Math.random() * 75,
      drift: kind === 'good' ? 16 + Math.random() * 20 : 26 + Math.random() * 24,
      wobble: Math.random() * Math.PI * 2,
    });
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function isColliding(
  player: { x: number; y: number; radius: number },
  orb: { x: number; y: number; radius: number },
): boolean {
  const dx = player.x - orb.x;
  const dy = player.y - orb.y;
  const totalRadius = player.radius + orb.radius;

  return dx * dx + dy * dy < totalRadius * totalRadius;
}
