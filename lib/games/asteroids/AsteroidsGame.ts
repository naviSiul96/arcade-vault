import {
  POINTS,
  POWERUP_DROP_CHANCE,
  POWERUP_DURATION,
  H,
  W,
} from './constants';
import {
  Asteroid,
  Bullet,
  Particle,
  PowerUp,
  Ship,
  type Keys,
} from './entities';
import type { AsteroidsCallbacks, AsteroidsHandle, GameStatus } from './types';
import { dist, rand } from './utils';

// Teclas del juego: se bloquea su acción por defecto (scroll de la página)
const GAME_KEYS = new Set(['ArrowLeft', 'ArrowRight', 'ArrowUp', 'Space']);

// No interferir con la escritura (p. ej. el input de iniciales del modal)
const isTextField = (t: EventTarget | null) =>
  t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement;

export class AsteroidsGame implements AsteroidsHandle {
  private readonly ctx: CanvasRenderingContext2D | null;
  private readonly callbacks: AsteroidsCallbacks;

  private keys: Keys = {};
  private justPressed: Keys = {};

  private ship = new Ship();
  private bullets: Bullet[] = [];
  private asteroids: Asteroid[] = [];
  private particles: Particle[] = [];
  private powerUps: PowerUp[] = [];
  private score = 0;
  private lives = 3;
  private level = 1;
  private status: GameStatus = 'playing';
  private deadTimer = 0;
  private powerUpSpawned = false;
  private killsSinceSpawn = 0;

  // Últimos valores notificados: los callbacks solo se disparan si cambian
  private emitted = { score: -1, lives: -1, level: -1 };

  private paused = false;
  private rafId: number | null = null;
  private lastTime: number | null = null;

  constructor(canvas: HTMLCanvasElement, callbacks: AsteroidsCallbacks) {
    this.ctx = canvas.getContext('2d');
    this.callbacks = callbacks;
    if (!this.ctx) return;

    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);

    this.initGame();
    this.rafId = requestAnimationFrame(this.loop);
  }

  // ── API pública ─────────────────────────────────────────────────────────────

  pause() {
    this.paused = true;
  }

  resume() {
    this.paused = false;
    this.lastTime = null; // evita salto de movimiento al reanudar
  }

  restart() {
    this.paused = false;
    this.lastTime = null;
    this.initGame();
  }

  end() {
    if (this.status === 'gameover') return;
    if (!this.ship.dead) {
      this.explode(this.ship.x, this.ship.y, 14);
      this.ship.dead = true;
    }
    this.status = 'gameover';
    this.callbacks.onGameOver(this.score);
  }

  destroy() {
    if (this.rafId !== null) cancelAnimationFrame(this.rafId);
    this.rafId = null;
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
  }

  // ── Input ───────────────────────────────────────────────────────────────────

  private onKeyDown = (e: KeyboardEvent) => {
    if (GAME_KEYS.has(e.code) && !isTextField(e.target)) e.preventDefault();
    if (!this.keys[e.code]) this.justPressed[e.code] = true;
    this.keys[e.code] = true;
  };

  private onKeyUp = (e: KeyboardEvent) => {
    this.keys[e.code] = false;
  };

  private pressed(code: string): boolean {
    const val = !!this.justPressed[code];
    this.justPressed[code] = false;
    return val;
  }

  // ── Estado ──────────────────────────────────────────────────────────────────

  private initGame() {
    this.ship = new Ship();
    this.bullets = [];
    this.asteroids = [];
    this.particles = [];
    this.powerUps = [];
    this.powerUpSpawned = false;
    this.killsSinceSpawn = 0;
    this.score = 0;
    this.lives = 3;
    this.level = 1;
    this.status = 'playing';
    this.spawnAsteroids(4);
    this.notify();
  }

  private notify() {
    if (this.score !== this.emitted.score) {
      this.emitted.score = this.score;
      this.callbacks.onScore(this.score);
    }
    if (this.lives !== this.emitted.lives) {
      this.emitted.lives = this.lives;
      this.callbacks.onLives(this.lives);
    }
    if (this.level !== this.emitted.level) {
      this.emitted.level = this.level;
      this.callbacks.onLevel(this.level);
    }
  }

  private spawnAsteroids(count: number) {
    const SAFE_DIST = 130;
    for (let i = 0; i < count; i++) {
      let x: number;
      let y: number;
      do {
        x = rand(0, W);
        y = rand(0, H);
      } while (Math.hypot(x - W / 2, y - H / 2) < SAFE_DIST);
      this.asteroids.push(new Asteroid(x, y, 3));
    }
  }

  private nextLevel() {
    this.level++;
    this.bullets = [];
    this.particles = [];
    this.powerUps = [];
    this.powerUpSpawned = false;
    this.killsSinceSpawn = 0;
    this.ship.reset();
    this.spawnAsteroids(3 + this.level);
  }

  private explode(x: number, y: number, count = 8) {
    for (let i = 0; i < count; i++) this.particles.push(new Particle(x, y));
  }

  private killShip() {
    this.explode(this.ship.x, this.ship.y, 14);
    this.ship.dead = true;
    this.lives--;
    if (this.lives <= 0) {
      this.status = 'gameover';
      this.notify();
      this.callbacks.onGameOver(this.score);
    } else {
      this.status = 'dead';
      this.deadTimer = 2;
    }
  }

  // ── Update ──────────────────────────────────────────────────────────────────

  private updateParticles(dt: number) {
    this.particles.forEach((p) => p.update(dt));
    this.particles = this.particles.filter((p) => !p.dead);
  }

  private update(dt: number) {
    if (this.status === 'gameover') {
      this.updateParticles(dt);
      return;
    }

    if (this.status === 'dead') {
      this.deadTimer -= dt;
      this.updateParticles(dt);
      this.asteroids.forEach((a) => a.update(dt));
      if (this.deadTimer <= 0) {
        this.status = 'playing';
        this.ship.reset();
      }
      return;
    }

    // Disparar
    if (this.pressed('Space')) {
      this.bullets.push(...this.ship.tryShoot());
    }

    this.ship.update(dt, this.keys);
    this.bullets.forEach((b) => b.update(dt));
    this.asteroids.forEach((a) => a.update(dt));
    this.particles.forEach((p) => p.update(dt));
    this.powerUps.forEach((p) => p.update(dt));

    this.bullets = this.bullets.filter((b) => !b.dead);
    this.particles = this.particles.filter((p) => !p.dead);
    this.powerUps = this.powerUps.filter((p) => !p.dead);

    for (const p of this.powerUps) {
      if (!p.dead && dist(this.ship, p) < this.ship.radius + p.radius) {
        p.dead = true;
        this.ship.tripleShot = POWERUP_DURATION;
      }
    }

    // Bala vs asteroide
    const newAsteroids: Asteroid[] = [];
    for (const b of this.bullets) {
      for (const a of this.asteroids) {
        if (!a.dead && !b.dead && dist(b, a) < a.radius) {
          b.dead = true;
          a.dead = true;
          this.score += POINTS[a.size];
          this.explode(a.x, a.y, a.size * 5);
          newAsteroids.push(...a.split());
          if (!this.powerUpSpawned) {
            this.killsSinceSpawn++;
            const guaranteed = this.killsSinceSpawn >= 5;
            if (guaranteed || Math.random() < POWERUP_DROP_CHANCE) {
              this.powerUps.push(new PowerUp(a.x, a.y));
              this.powerUpSpawned = true;
            }
          }
        }
      }
    }
    this.asteroids = this.asteroids.filter((a) => !a.dead).concat(newAsteroids);
    this.bullets = this.bullets.filter((b) => !b.dead);

    // Nave vs asteroide
    if (this.ship.invincible <= 0) {
      for (const a of this.asteroids) {
        if (dist(this.ship, a) < this.ship.radius + a.radius * 0.82) {
          this.killShip();
          break;
        }
      }
    }

    // Nivel completado
    if (this.asteroids.length === 0) this.nextLevel();

    this.notify();
  }

  // ── Draw (solo el mundo; HUD y Game Over los pinta React) ───────────────────

  private draw() {
    const ctx = this.ctx;
    if (!ctx) return;

    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, W, H);

    this.particles.forEach((p) => p.draw(ctx));
    this.asteroids.forEach((a) => a.draw(ctx));
    this.powerUps.forEach((p) => p.draw(ctx));
    this.bullets.forEach((b) => b.draw(ctx));
    this.ship.draw(ctx);
  }

  // ── Loop principal ──────────────────────────────────────────────────────────

  private loop = (ts: number) => {
    const dt =
      this.lastTime === null ? 0 : Math.min((ts - this.lastTime) / 1000, 0.05);
    this.lastTime = ts;

    if (this.paused) {
      this.justPressed = {};
    } else {
      this.update(dt);
    }
    this.draw();

    this.rafId = requestAnimationFrame(this.loop);
  };
}
