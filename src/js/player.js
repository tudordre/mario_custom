import {
  BIRD_JUMP_VELOCITY,
  GRAVITY,
  GROUND_Y,
  JUMP_VELOCITY,
  MAX_FALL,
  MOVE_SPEED,
  TILE,
  VIEW_H,
} from './world.js';

const SMALL_H = 32;
const BIG_H = 64;
const SMALL_W = 24;
const BIG_W = 28;

/** @typedef {'small' | 'big' | 'fire'} PowerForm */

export class Player {
  constructor() {
    this.reset();
  }

  reset() {
    this.w = SMALL_W;
    this.h = SMALL_H;
    /** @type {PowerForm} */
    this.form = 'small';
    this.big = false;
    this.x = TILE * 5;
    this.y = GROUND_Y * TILE - this.h;
    this.vx = 0;
    this.vy = 0;
    this.onGround = true;
    this.facing = 1;
    this.alive = true;
    this.fellInPit = false;
    this.timedOut = false;
    this.killedByAnimal = false;
    this.jumpBuffered = false;
    this.coyote = 0;
    this.anim = 0;
    this.invuln = 0;
    this.fireCooldown = 0;
    this.orangeCount = 0;
    this.onBird = false;
    this.hasWings = false;
    this._gotWings = false;
    this.prevBottom = this.y + this.h;
    this.prevTop = this.y;
    this.lastBrickBreak = null;
    this._shotFire = false;
    this._shotRocket = false;
    this._mountedBird = false;
    this._dismountedBird = false;
  }

  get hasRockets() {
    return this.orangeCount >= 3;
  }

  /**
   * @param {PowerForm} form
   * @param {import('./world.js').World} [world]
   */
  setForm(form, world) {
    const feet = this.y + this.h;
    this.form = form;
    this.big = form !== 'small';
    this.h = form === 'small' ? SMALL_H : BIG_H;
    this.w = form === 'small' ? SMALL_W : BIG_W;
    this.y = feet - this.h;
    if (world) this._unstuck(world);
  }

  /**
   * @param {import('./world.js').World} world
   */
  _unstuck(world) {
    for (const p of world.getSolidPlatforms()) {
      if (!this._overlaps(p)) continue;
      const overlapTop = this.y + this.h - p.y;
      const overlapBottom = p.y + p.h - this.y;
      if (overlapTop < overlapBottom && overlapTop > 0) {
        this.y = p.y - this.h;
      } else {
        this.y = p.y + p.h;
      }
    }
  }

  /**
   * @param {import('./input.js').Input} input
   * @param {number} dt
   * @param {import('./world.js').World} world
   */
  update(input, dt, world) {
    if (!this.alive) return;

    this.prevBottom = this.y + this.h;
    this.prevTop = this.y;
    this.lastBrickBreak = null;
    this._mountedBird = false;
    this._dismountedBird = false;
    this._gotWings = false;
    if (this.invuln > 0) this.invuln = Math.max(0, this.invuln - dt);
    if (this.fireCooldown > 0) this.fireCooldown = Math.max(0, this.fireCooldown - dt);

    let move = 0;
    if (input.isDown('left')) move -= 1;
    if (input.isDown('right')) move += 1;
    this.vx = move * (this.onBird ? MOVE_SPEED * 1.15 : MOVE_SPEED);
    if (move !== 0) this.facing = move;

    if (this.onGround) this.coyote = 0.1;
    else this.coyote = Math.max(0, this.coyote - dt);

    if (this.hasWings) {
      // Each press of ↑ = one jump flap; holding counts as a single press
      if (input.justPressed('jump')) {
        this.vy = JUMP_VELOCITY;
        this.onGround = false;
        this.coyote = 0;
      }
    } else if (input.isDown('jump')) {
      if (!this.jumpBuffered && (this.onGround || this.coyote > 0)) {
        this.vy = this.onBird ? BIRD_JUMP_VELOCITY : JUMP_VELOCITY;
        this.onGround = false;
        this.coyote = 0;
        this.jumpBuffered = true;
      }
    } else {
      this.jumpBuffered = false;
      if (this.vy < -120) this.vy *= 0.55;
    }

    // Ctrl: fireballs, or rockets after 3 orange animals
    this._shotFire = false;
    this._shotRocket = false;
    if (this.form === 'fire' && input.isDown('fire') && this.fireCooldown <= 0) {
      const sx = this.facing > 0 ? this.x + this.w : this.x - 10;
      const sy = this.y + this.h * 0.4;
      if (this.hasRockets) {
        world.spawnRocket(sx, sy, this.facing);
        this.fireCooldown = 0.45;
        this._shotRocket = true;
      } else {
        world.spawnFireball(sx, sy, this.facing);
        this.fireCooldown = 0.28;
        this._shotFire = true;
      }
    }

    this.vy = Math.min(MAX_FALL, this.vy + GRAVITY * dt);

    this.onGround = false;
    this.x += this.vx * dt;
    this._collideX(world);
    this.y += this.vy * dt;
    this._collideY(world);

    // Don't fly off the top of the screen
    if (this.y < 8) {
      this.y = 8;
      if (this.vy < 0) this.vy = 0;
    }

    if (this.x < 0) {
      this.x = 0;
      this.vx = 0;
    }

    if (!this.onGround && this.y + this.h > GROUND_Y * TILE + 8) {
      if (world.isOverPit(this.x, this.w)) this.fellInPit = true;
    }

    if (this.y > VIEW_H + 40) {
      this.alive = false;
    }

    this.anim += dt * (this.hasWings ? 12 : this.onGround && Math.abs(this.vx) > 10 ? 10 : 4);

    // Collect wings — lose the bird
    if (world.tryCollectWings(this)) {
      this.hasWings = true;
      this.onBird = false;
      this._gotWings = true;
    }

    // Try to mount bird (not while winged)
    if (!this.hasWings) this._tryMountBird(world);
  }

  /**
   * @param {import('./world.js').World} world
   */
  _tryMountBird(world) {
    if (this.hasWings) return;
    const bird = world.bird;
    if (!bird || this.onBird || !bird.catchable || bird.state !== 'idle') return;
    if (!this._overlaps(bird)) return;
    this.onBird = true;
    bird.state = 'mounted';
    this._mountedBird = true;
    // Sit onto the bird
    this.y = bird.y + 12 - this.h;
    this.vy = 0;
  }

  /**
   * @param {import('./world.js').World} world
   * @returns {'stomp' | 'grow' | 'fire' | 'rocket' | 'downgrade' | 'die' | 'dismount' | null}
   */
  resolveAnimals(world) {
    if (!this.alive) return null;

    for (const a of world.animals) {
      if (!a.alive) continue;
      if (!this._overlaps(a)) continue;

      const fromAbove =
        this.vy >= 0 &&
        this.prevBottom <= a.y + 10 &&
        this.y + this.h - a.y <= a.h * 0.55;

      if (a.color === 'green' && fromAbove) {
        a.alive = false;
        this.vy = (this.onBird ? BIRD_JUMP_VELOCITY : JUMP_VELOCITY) * 0.55;
        this.onGround = false;
        this.y = a.y - this.h;
        return 'stomp';
      }

      if (this.invuln > 0) continue;

      if (a.color === 'orange') {
        a.alive = false;
        this.orangeCount += 1;
        if (this.form === 'small') {
          this.setForm('big', world);
          this.invuln = 0.7;
          return this.hasRockets ? 'rocket' : 'grow';
        }
        if (this.form === 'big') {
          this.setForm('fire', world);
          this.invuln = 0.7;
          return this.hasRockets ? 'rocket' : 'fire';
        }
        this.setForm('fire', world);
        this.invuln = 0.35;
        return this.hasRockets ? 'rocket' : 'fire';
      }

      // Green — side bump: wings/bird first, then fire → big → small → die
      this.vx = this.x + this.w / 2 < a.x + a.w / 2 ? -180 : 180;
      this.vy = -220;
      this.onGround = false;

      if (this.hasWings) {
        this.hasWings = false;
        this.invuln = 1.2;
        return 'downgrade';
      }

      if (this.onBird) {
        world.frightenBird(this);
        this._dismountedBird = true;
        this.invuln = 1.2;
        return 'dismount';
      }

      if (this.form === 'fire') {
        this.setForm('big', world);
        this.invuln = 1.0;
        return 'downgrade';
      }
      if (this.form === 'big') {
        this.setForm('small', world);
        this.invuln = 1.0;
        return 'downgrade';
      }

      this.alive = false;
      this.killedByAnimal = true;
      return 'die';
    }
    return null;
  }

  /**
   * @param {import('./world.js').World} world
   */
  _collideX(world) {
    for (const p of world.getSolidPlatforms()) {
      if (!this._overlaps(p)) continue;
      if (this.vx > 0) this.x = p.x - this.w;
      else if (this.vx < 0) this.x = p.x + p.w;
      else {
        const cx = this.x + this.w / 2;
        const pcx = p.x + p.w / 2;
        this.x = cx < pcx ? p.x - this.w : p.x + p.w;
      }
      this.vx = 0;
    }
  }

  /**
   * @param {import('./world.js').World} world
   */
  _collideY(world) {
    const platforms = [...world.getSolidPlatforms()];
    for (const p of platforms) {
      if (!p || !this._overlaps(p)) continue;
      if (this.vy > 0) {
        this.y = p.y - this.h;
        this.vy = 0;
        this.onGround = true;
      } else if (this.vy < 0) {
        const headHit = this.prevTop >= p.y + p.h - 4;
        if (p.type === 'brick' && headHit) {
          world.breakBrick(p);
          this.lastBrickBreak = 'brick';
          this.vy = Math.min(this.vy + 80, 0);
          this.y = p.y + p.h;
        } else {
          this.y = p.y + p.h;
          this.vy = 0;
        }
      }
    }
  }

  /**
   * @param {{ x: number, y: number, w: number, h: number }} p
   */
  _overlaps(p) {
    return (
      this.x < p.x + p.w &&
      this.x + this.w > p.x &&
      this.y < p.y + p.h &&
      this.y + this.h > p.y
    );
  }
}
