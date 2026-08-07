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
 * game itself paints every frame into one 176x208 canvas, exactly like the
 * MIDlet did with its off-screen `Image`.
 */
class MainScene extends Phaser.Scene {
  private app!: App;
  private painter!: Painter;
  private texture!: Phaser.Textures.CanvasTexture;
  private lastTime = 0;

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

    const image = this.add.image(0, 0, TEXTURE_KEY).setOrigin(0, 0);
    image.setScrollFactor(0);

    const input = new Input();
    input.attach(window);

    this.app = new App(input, new SoundBank());
    this.app.push(new SplashScreen());

    image.setInteractive({ useHandCursor: false });
    image.on('pointerdown', (_pointer: Phaser.Input.Pointer, localX: number, localY: number) => {
      this.app.tap(Math.floor(localX), Math.floor(localY));
    });

    this.lastTime = this.time.now;
  }

  override update(time: number): void {
    const dt = Math.min(60, time - this.lastTime);
    this.lastTime = time;

    this.app.update(dt);
    this.app.draw(this.painter);
    this.texture.refresh();
  }
}

function integerZoom(): number {
  const margin = 40;
  const w = Math.max(320, window.innerWidth) - margin;
  const h = Math.max(320, window.innerHeight) - 260;
  return Math.max(1, Math.min(5, Math.floor(Math.min(w / SCREEN_W, h / SCREEN_H))));
}

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: SCREEN_W,
  height: SCREEN_H,
  zoom: integerZoom(),
  pixelArt: true,
  backgroundColor: '#000000',
  scale: {
    mode: Phaser.Scale.NONE,
    autoCenter: Phaser.Scale.CENTER_HORIZONTALLY,
  },
  scene: [MainScene],
});

window.addEventListener('resize', () => {
  game.scale.setZoom(integerZoom());
});
