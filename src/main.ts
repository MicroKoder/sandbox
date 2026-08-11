import Phaser from 'phaser';

import { App } from './app/app.ts';
import { SoundBank } from './app/sound.ts';
import { Painter } from './core/painter.ts';
import { SCREEN_H, SCREEN_W } from './core/screen.ts';
import { SplashScreen } from './screens/menu.ts';
import { Input } from './ui/input.ts';

const TEXTURE_KEY = 'screen';

/**
 * Phaser hosts the game loop, scaling, input plumbing and texture upload; the
 * game paints every frame into one logical canvas (wide 320×200), then FIT-scales
 * it into the browser stage like a modern web game.
 */
class MainScene extends Phaser.Scene {
  private app!: App;
  private painter!: Painter;
  private texture!: Phaser.Textures.CanvasTexture;
  private image!: Phaser.GameObjects.Image;
  private lastTime = 0;
  private drag: { x: number; y: number; moved: boolean } | null = null;

  constructor() {
    super('main');
  }

  create(): void {
    const texture = this.textures.createCanvas(TEXTURE_KEY, SCREEN_W, SCREEN_H);
    if (!texture) throw new Error('Unable to allocate the screen texture');
    this.texture = texture;

    const ctx = texture.getContext();
    ctx.imageSmoothingEnabled = false;
    this.painter = new Painter(ctx, SCREEN_W, SCREEN_H);

    this.image = this.add.image(0, 0, TEXTURE_KEY).setOrigin(0, 0);
    this.image.setScrollFactor(0);

    const input = new Input();
    input.attach(window);

    this.app = new App(input, new SoundBank());
    this.app.push(new SplashScreen());

    this.image.setInteractive({ useHandCursor: false });
    this.image.on('pointerdown', (pointer: Phaser.Input.Pointer, localX: number, localY: number) => {
      this.drag = { x: localX, y: localY, moved: false };
      pointer.event?.preventDefault?.();
    });
    this.image.on('pointermove', (pointer: Phaser.Input.Pointer, localX: number, localY: number) => {
      if (!this.drag || !pointer.isDown) return;
      const dy = localY - this.drag.y;
      const dx = localX - this.drag.x;
      if (!this.drag.moved && Math.hypot(dx, dy) < 3) return;
      this.drag.moved = true;
      // Finger down → content follows → reveal rows above (negative scroll).
      this.app.scroll(localX, localY, -dy);
      this.drag.x = localX;
      this.drag.y = localY;
    });
    this.image.on('pointerup', (_pointer: Phaser.Input.Pointer, localX: number, localY: number) => {
      const drag = this.drag;
      this.drag = null;
      if (!drag || drag.moved) return;
      this.app.tap(Math.floor(localX), Math.floor(localY));
    });
    this.image.on('pointerupoutside', () => {
      this.drag = null;
    });

    const canvas = this.game.canvas;
    canvas.addEventListener(
      'wheel',
      (event) => {
        event.preventDefault();
        const rect = canvas.getBoundingClientRect();
        const lx = ((event.clientX - rect.left) / rect.width) * SCREEN_W;
        const ly = ((event.clientY - rect.top) / rect.height) * SCREEN_H;
        // Wheel down reveals lower rows.
        this.app.scroll(lx, ly, event.deltaY);
      },
      { passive: false },
    );

    this.lastTime = this.time.now;
    this.layout();
    this.scale.on('resize', () => this.layout());
  }

  private layout(): void {
    const { width, height } = this.scale;
    // Continuous FIT fills tablets better than integer zoom with large letterboxing.
    const zoom = Math.max(1, Math.min(width / SCREEN_W, height / SCREEN_H));
    const drawW = SCREEN_W * zoom;
    const drawH = SCREEN_H * zoom;
    this.image.setScale(zoom);
    this.image.setPosition(Math.floor((width - drawW) / 2), Math.floor((height - drawH) / 2));
  }

  override update(time: number): void {
    const dt = Math.min(60, time - this.lastTime);
    this.lastTime = time;

    this.app.update(dt);
    this.app.draw(this.painter);
    this.texture.refresh();
  }
}

function stageSize(): { w: number; h: number } {
  const stage = document.getElementById('game');
  if (stage) {
    const rect = stage.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) {
      return { w: Math.floor(rect.width), h: Math.floor(rect.height) };
    }
  }
  return { w: Math.max(640, window.innerWidth - 48), h: Math.max(400, window.innerHeight - 160) };
}

const initial = stageSize();

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: initial.w,
  height: initial.h,
  pixelArt: true,
  backgroundColor: '#050505',
  scale: {
    mode: Phaser.Scale.RESIZE,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  scene: [MainScene],
});

window.addEventListener('resize', () => {
  const { w, h } = stageSize();
  game.scale.resize(w, h);
});

// Collapsible help panel for tablets.
const helpToggle = document.getElementById('help-toggle');
const appRoot = document.getElementById('app');
helpToggle?.addEventListener('click', () => {
  const open = appRoot?.classList.toggle('help-open');
  helpToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
  helpToggle.textContent = open ? '✕' : '?';
  // Phaser needs a resize after the stage reflows.
  requestAnimationFrame(() => {
    const { w, h } = stageSize();
    game.scale.resize(w, h);
  });
});
