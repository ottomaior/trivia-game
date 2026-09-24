import { Application, Container, Sprite, Texture } from 'pixi.js';

// The studio's light and particle layer: one transparent WebGL canvas over the
// stage. Sweeping spotlight beams, a focus spotlight, spark and confetti
// bursts, and points flying to the desks. Positions come from DOM rects, so
// callers point effects at real elements on the stage.

const PALETTE = [0xe8b23a, 0x1f6f6b, 0xf4e9d4, 0x9fd3e0, 0xb8462a, 0x6a3d7a];

interface Particle {
  sprite: Sprite;
  vx: number;
  vy: number;
  spin: number;
  life: number;
  maxLife: number;
  gravity: number;
  drag: number;
  fade: boolean;
  /** Homing target for flying points. */
  target?: { x: number; y: number };
}

function canvasTexture(w: number, h: number, draw: (g: CanvasRenderingContext2D) => void): Texture {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d')!);
  return Texture.from(c);
}

class StudioFx {
  private app: Application | null = null;
  private host: HTMLElement | null = null;
  private particles: Particle[] = [];
  private layer = new Container();
  private beams: Sprite[] = [];
  private spot: Sprite | null = null;
  private spotTarget: { x: number; y: number; w: number } | null = null;
  private time = 0;
  /** Bumped on every mount/destroy, so a slow init can tell it was superseded. */
  private generation = 0;

  get ready(): boolean {
    return this.app !== null;
  }

  async mount(host: HTMLElement): Promise<void> {
    const generation = ++this.generation;
    const app = new Application();
    await app.init({
      backgroundAlpha: 0,
      resizeTo: host,
      antialias: false,
      // Rendering at full 4K on a TV is wasted work for soft light and confetti.
      resolution: Math.min(window.devicePixelRatio || 1, 1),
      preference: 'webgl',
    });
    if (generation !== this.generation || !host.isConnected) {
      app.destroy(true);
      return;
    }
    this.app = app;
    this.host = host;
    app.canvas.setAttribute('data-testid', 'fx-canvas');
    host.appendChild(app.canvas);

    // Soft, wide light beams sweeping down from the rig.
    const beamTex = canvasTexture(128, 512, (g) => {
      const grad = g.createLinearGradient(0, 0, 0, 512);
      grad.addColorStop(0, 'rgba(255,255,255,0.9)');
      grad.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = grad;
      g.beginPath();
      g.moveTo(54, 0);
      g.lineTo(74, 0);
      g.lineTo(128, 512);
      g.lineTo(0, 512);
      g.closePath();
      g.fill();
    });
    for (let i = 0; i < 3; i++) {
      const beam = new Sprite(beamTex);
      beam.anchor.set(0.5, 0);
      beam.blendMode = 'add';
      beam.alpha = 0.13;
      beam.tint = i === 1 ? 0xffe7a8 : 0xf4e9d4;
      this.beams.push(beam);
      app.stage.addChild(beam);
    }

    const spotTex = canvasTexture(256, 256, (g) => {
      const grad = g.createRadialGradient(128, 128, 0, 128, 128, 128);
      grad.addColorStop(0, 'rgba(255,240,200,0.9)');
      grad.addColorStop(0.5, 'rgba(255,230,170,0.35)');
      grad.addColorStop(1, 'rgba(255,220,150,0)');
      g.fillStyle = grad;
      g.fillRect(0, 0, 256, 256);
    });
    this.spot = new Sprite(spotTex);
    this.spot.anchor.set(0.5);
    this.spot.blendMode = 'add';
    this.spot.alpha = 0;
    app.stage.addChild(this.spot);
    app.stage.addChild(this.layer);

    app.ticker.add((ticker) => this.tick(ticker.deltaMS / 1000));
  }

  destroy(): void {
    this.generation++;
    this.app?.destroy(true, { children: true });
    this.app = null;
    this.host = null;
    this.particles = [];
    this.beams = [];
    this.spot = null;
    this.layer = new Container();
  }

  /** Converts a DOM rect to canvas coordinates (centre point). */
  private centre(rect: DOMRect): { x: number; y: number } {
    const h = this.host!.getBoundingClientRect();
    return { x: rect.left + rect.width / 2 - h.left, y: rect.top + rect.height / 2 - h.top };
  }

  sparks(rect: DOMRect, count = 60): void {
    if (!this.app) return;
    const c = this.centre(rect);
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const speed = 300 + Math.random() * 700;
      this.spawn({
        x: c.x + (Math.random() - 0.5) * rect.width * 0.8,
        y: c.y + (Math.random() - 0.5) * rect.height * 0.6,
        vx: Math.cos(a) * speed,
        vy: Math.sin(a) * speed - 200,
        size: 3 + Math.random() * 5,
        tint: Math.random() < 0.7 ? 0xffd66b : 0xf4e9d4,
        life: 0.5 + Math.random() * 0.5,
        gravity: 900,
        drag: 2.5,
        fade: true,
        blend: true,
      });
    }
  }

  confetti(count = 140): void {
    if (!this.app) return;
    const { width } = this.app.screen;
    for (let i = 0; i < count; i++) {
      this.spawn({
        x: Math.random() * width,
        y: -20 - Math.random() * 300,
        vx: (Math.random() - 0.5) * 160,
        vy: 120 + Math.random() * 200,
        size: 8 + Math.random() * 8,
        aspect: 0.5,
        tint: PALETTE[i % PALETTE.length]!,
        life: 4 + Math.random() * 2,
        gravity: 60,
        drag: 0.2,
        fade: false,
        spin: (Math.random() - 0.5) * 12,
      });
    }
  }

  /** Little golden points streaming from one element to another (e.g. tile → desk). */
  fly(from: DOMRect, to: DOMRect, count = 14): void {
    if (!this.app) return;
    const a = this.centre(from);
    const b = this.centre(to);
    for (let i = 0; i < count; i++) {
      this.spawn({
        x: a.x + (Math.random() - 0.5) * from.width * 0.5,
        y: a.y + (Math.random() - 0.5) * from.height * 0.5,
        vx: (Math.random() - 0.5) * 900,
        vy: -300 - Math.random() * 500,
        size: 7,
        tint: 0xffd66b,
        life: 1.4,
        gravity: 0,
        drag: 1.5,
        fade: false,
        blend: true,
        target: b,
      });
    }
  }

  /** Points a soft spotlight at an element, or turns it off with null. */
  spotlight(rect: DOMRect | null): void {
    if (!this.app) return;
    this.spotTarget = rect ? { ...this.centre(rect), w: Math.max(rect.width, rect.height) * 2.2 } : null;
  }

  private spawn(o: {
    x: number;
    y: number;
    vx: number;
    vy: number;
    size: number;
    tint: number;
    life: number;
    gravity: number;
    drag: number;
    fade: boolean;
    aspect?: number;
    spin?: number;
    blend?: boolean;
    target?: { x: number; y: number };
  }): void {
    const sprite = new Sprite(Texture.WHITE);
    sprite.anchor.set(0.5);
    sprite.width = o.size;
    sprite.height = o.size * (o.aspect ?? 1);
    sprite.tint = o.tint;
    sprite.position.set(o.x, o.y);
    if (o.blend) sprite.blendMode = 'add';
    this.layer.addChild(sprite);
    this.particles.push({
      sprite,
      vx: o.vx,
      vy: o.vy,
      spin: o.spin ?? 0,
      life: o.life,
      maxLife: o.life,
      gravity: o.gravity,
      drag: o.drag,
      fade: o.fade,
      target: o.target,
    });
  }

  private tick(dt: number): void {
    if (!this.app) return;
    this.time += dt;
    const { width, height } = this.app.screen;

    this.beams.forEach((beam, i) => {
      beam.position.set(width * (0.2 + i * 0.3), -height * 0.05);
      beam.height = height * 1.25;
      beam.width = width * 0.22;
      beam.rotation = Math.sin(this.time * (0.35 + i * 0.12) + i * 2) * 0.32;
    });

    if (this.spot) {
      const target = this.spotTarget;
      const goal = target ? 0.55 : 0;
      this.spot.alpha += (goal - this.spot.alpha) * Math.min(1, dt * 4);
      if (target) {
        this.spot.position.set(
          this.spot.x + (target.x - this.spot.x) * Math.min(1, dt * 6),
          this.spot.y + (target.y - this.spot.y) * Math.min(1, dt * 6),
        );
        this.spot.width = this.spot.height = target.w;
      }
    }

    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i]!;
      p.life -= dt;
      if (p.target) {
        // Home in on the target, harder as life runs out.
        const pull = (1 - p.life / p.maxLife) * 18;
        p.vx += (p.target.x - p.sprite.x) * pull * dt;
        p.vy += (p.target.y - p.sprite.y) * pull * dt;
        if (Math.hypot(p.target.x - p.sprite.x, p.target.y - p.sprite.y) < 14) p.life = 0;
      }
      p.vy += p.gravity * dt;
      p.vx *= 1 - Math.min(1, p.drag * dt);
      p.vy *= 1 - Math.min(1, p.drag * dt);
      p.sprite.x += p.vx * dt;
      p.sprite.y += p.vy * dt;
      p.sprite.rotation += p.spin * dt;
      if (p.fade) p.sprite.alpha = Math.max(0, p.life / p.maxLife);
      if (p.life <= 0 || p.sprite.y > height + 40) {
        p.sprite.destroy();
        this.particles.splice(i, 1);
      }
    }
  }
}

export const fx = new StudioFx();
