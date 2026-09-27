export const TILE = 32;
export const GROUND_Y = 12; // tile row of ground top
export const VIEW_W = 960;
export const VIEW_H = 540;
export const GRAVITY = 1800;
export const MOVE_SPEED = 220;
export const JUMP_VELOCITY = -520;
export const BIRD_JUMP_VELOCITY = -780;
export const MAX_FALL = 900;
export const BIRD_H = 72; // taller than big Mario — clearly “mare”
export const BIRD_W = 56;

/**
 * @typedef {{ x: number, y: number, w: number, h: number, type: 'ground' | 'brick' | 'pipe' | 'pipeTop' }} Platform
 * @typedef {{ x: number, w: number }} Pit
 * @typedef {{ x: number, y: number, w: number, h: number, value: number, taken: boolean }} Coin
 * @typedef {{ x: number, y: number, w: number, h: number, color: 'green' | 'orange', vx: number, minX: number, maxX: number, alive: boolean, anim: number }} Animal
 * @typedef {{ x: number, y: number, w: number, h: number, vx: number, life: number, kind: 'fire' | 'rocket', flyY: number }} Fireball
 * @typedef {{ x: number, y: number, w: number, h: number, vx: number, facing: number, state: 'idle' | 'mounted' | 'fleeing', catchable: boolean, anim: number }} Bird
 * @typedef {{ x: number, y: number, vx: number, vy: number, life: number, spin: number }} BurstCoin
 * @typedef {{ x: number, y: number, w: number, h: number, bob: number, taken: boolean }} WingsPickup
 */

/**
 * Endless world that spawns bricks, pipes and pits ahead of the camera.
 */
export class World {
  constructor() {
    /** @type {Platform[]} */
    this.platforms = [];
    /** @type {Pit[]} */
    this.pits = [];
    /** @type {Coin[]} */
    this.coins = [];
    /** @type {Animal[]} */
    this.animals = [];
    /** @type {Fireball[]} */
    this.fireballs = [];
    /** @type {Bird | null} */
    this.bird = null;
    /** @type {BurstCoin[]} */
    this.burstCoins = [];
    /** @type {WingsPickup | null} */
    this.wingsPickup = null;
    this.wingsSpawnAt = 0;
    this.wingsSpawned = false;
    this.runTime = 0;
    /** @type {{ x: number, y: number }[]} */
    this.clouds = [];
    /** @type {{ x: number, y: number }[]} */
    this.hills = [];

    this.generatedUntil = 0;
    this.seedCounter = 0;
    this.reset();
  }

  reset() {
    this.platforms = [];
    this.pits = [];
    this.coins = [];
    this.animals = [];
    this.fireballs = [];
    this.bird = null;
    this.burstCoins = [];
    this.wingsPickup = null;
    this.wingsSpawned = false;
    this.runTime = 0;
    // Appear after a random 5–20 seconds
    this.wingsSpawnAt = 5 + Math.random() * 15;
    this.clouds = [];
    this.hills = [];
    this.generatedUntil = 0;
    this.seedCounter = 0;

    // Long safe starting runway — Mario begins firmly on ground
    const startTiles = 48;
    this._addGround(0, startTiles);
    this.generatedUntil = startTiles * TILE;

    // Starter coins on the runway
    for (let i = 0; i < 6; i++) {
      this._addCoin((10 + i * 3) * TILE, (GROUND_Y - 2) * TILE);
    }

    // Breakable bricks near start (jump under them)
    for (let i = 0; i < 4; i++) {
      this.platforms.push({
        x: (14 + i) * TILE,
        y: (GROUND_Y - 4) * TILE,
        w: TILE,
        h: TILE,
        type: 'brick',
      });
    }

    // Rideable bird — big, visible near the start
    this.bird = {
      x: 9 * TILE,
      y: GROUND_Y * TILE - BIRD_H,
      w: BIRD_W,
      h: BIRD_H,
      vx: 35,
      facing: 1,
      state: 'idle',
      catchable: true,
      anim: 0,
    };

    // Intro animals further along the runway
    this._addAnimal(22 * TILE, 'orange', 18 * TILE, 40 * TILE);
    this._addAnimal(28 * TILE, 'orange', 24 * TILE, 42 * TILE);
    this._addAnimal(34 * TILE, 'orange', 30 * TILE, 46 * TILE);
    this._addAnimal(42 * TILE, 'green', 36 * TILE, 48 * TILE);

    for (let i = 0; i < 8; i++) {
      this.clouds.push({
        x: i * 180 + Math.random() * 80,
        y: 40 + Math.random() * 120,
      });
      this.hills.push({
        x: i * 220 + Math.random() * 60,
        y: GROUND_Y * TILE,
      });
    }

    this.ensureGenerated(VIEW_W * 2);
  }

  /**
   * Generate world content up to worldX (pixels).
   * @param {number} worldX
   * @param {{ prune?: boolean }} [opts]
   */
  ensureGenerated(worldX, opts = {}) {
    const prune = opts.prune !== false;
    const target = worldX + VIEW_W * 1.5;
    while (this.generatedUntil < target) {
      this._spawnChunk();
    }
    if (prune) this._prune(worldX - VIEW_W);
  }

  /**
   * Extend generation only — never prune (safe for far spawns like wings).
   * @param {number} worldX
   */
  generateAhead(worldX) {
    this.ensureGenerated(worldX, { prune: false });
  }

  /**
   * @param {number} leftBound
   */
  _prune(leftBound) {
    this.platforms = this.platforms.filter((p) => p.x + p.w > leftBound);
    this.pits = this.pits.filter((p) => p.x + p.w > leftBound);
    this.coins = this.coins.filter((c) => !c.taken && c.x + c.w > leftBound);
    this.animals = this.animals.filter((a) => a.alive && a.x + a.w > leftBound);
    this.fireballs = this.fireballs.filter((f) => f.life > 0 && f.x > leftBound - 40);
    this.clouds = this.clouds.filter((c) => c.x > leftBound - 200);
    this.hills = this.hills.filter((h) => h.x > leftBound - 300);
  }

  _spawnChunk() {
    this.seedCounter++;
    const start = this.generatedUntil;
    const roll = Math.random();

    // Difficulty ramps with distance (still mostly solid ground)
    const difficulty = Math.min(0.55, this.seedCounter * 0.015);

    if (roll < 0.30) {
      this._spawnFlat(start);
    } else if (roll < 0.52 + difficulty * 0.1) {
      this._spawnPit(start);
    } else if (roll < 0.70) {
      this._spawnBrickClimb(start);
    } else if (roll < 0.88) {
      this._spawnPipe(start);
    } else {
      this._spawnMixed(start);
    }

    // Decorations ahead
    if (Math.random() < 0.5) {
      this.clouds.push({
        x: this.generatedUntil + Math.random() * 100,
        y: 30 + Math.random() * 140,
      });
    }
    if (Math.random() < 0.4) {
      this.hills.push({
        x: this.generatedUntil + Math.random() * 80,
        y: GROUND_Y * TILE,
      });
    }
  }

  /**
   * Long stretch of solid ground.
   * @param {number} start
   */
  _spawnFlat(start) {
    const tiles = 8 + Math.floor(Math.random() * 10); // 8–17 tiles
    this._addGround(start / TILE, tiles);
    this.generatedUntil = start + tiles * TILE;
    this._scatterCoins(start, this.generatedUntil, GROUND_Y - 2);
    this._spawnAnimalsOnGround(start, this.generatedUntil);
  }

  /**
   * @param {number} start
   */
  _spawnPit(start) {
    const approach = (6 + Math.floor(Math.random() * 5)) * TILE;
    this._addGround(start / TILE, approach / TILE);

    // 2–4 tile pits; size 3+ get helper bricks (not blocking walls)
    const gapTiles = 2 + Math.floor(Math.random() * 3);
    const gapStart = start + approach;
    const gapW = gapTiles * TILE;
    this.pits.push({ x: gapStart, w: gapW });

    if (gapTiles >= 3) {
      this._addPitCrossingHelpers(gapStart, gapTiles);
    }

    this._scatterCoins(start, gapStart, GROUND_Y - 2);
    this._spawnAnimalsOnGround(start, gapStart);

    const after = (6 + Math.floor(Math.random() * 5)) * TILE;
    this._addGround((gapStart + gapW) / TILE, after / TILE);
    this.generatedUntil = gapStart + gapW + after;
    this._scatterCoins(gapStart + gapW, this.generatedUntil, GROUND_Y - 2);
    this._spawnAnimalsOnGround(gapStart + gapW, this.generatedUntil);
  }

  /**
   * Stepping stones for wide pits: raise you before the gap + islands to hop across.
   * Never a solid brick wall/ceiling that blocks the jump arc.
   * @param {number} gapStart
   * @param {number} gapTiles
   */
  _addPitCrossingHelpers(gapStart, gapTiles) {
    const gapW = gapTiles * TILE;

    // Approach steps on solid ground (climb, then leap)
    this.platforms.push({
      x: gapStart - TILE * 2,
      y: (GROUND_Y - 1) * TILE,
      w: TILE,
      h: TILE,
      type: 'brick',
    });
    this.platforms.push({
      x: gapStart - TILE,
      y: (GROUND_Y - 2) * TILE,
      w: TILE,
      h: TILE,
      type: 'brick',
    });

    // Floating islands over the pit — spaced apart so you hop, not blocked
    const islandY = (GROUND_Y - 2) * TILE;
    const islandW = TILE;

    // Near side of the pit (after a short air gap from the last step)
    const firstX = gapStart + TILE * 0.75;
    this.platforms.push({
      x: firstX,
      y: islandY,
      w: islandW,
      h: TILE,
      type: 'brick',
    });
    this._addCoin(firstX + 8, islandY - TILE);

    // Extra mid island for wider pits (4+)
    if (gapTiles >= 4) {
      const midX = gapStart + gapW / 2 - islandW / 2;
      // Only if clearly separated from first/last
      if (midX > firstX + TILE * 1.5) {
        this.platforms.push({
          x: midX,
          y: islandY,
          w: islandW,
          h: TILE,
          type: 'brick',
        });
        this._addCoin(midX + 8, islandY - TILE);
      }
    }

    // Far side island, before landing ground (short hop to safety)
    const lastX = gapStart + gapW - TILE * 1.5;
    if (lastX > firstX + TILE * 1.75) {
      this.platforms.push({
        x: lastX,
        y: islandY,
        w: islandW,
        h: TILE,
        type: 'brick',
      });
      this._addCoin(lastX + 8, islandY - TILE);
    }

    // Landing step just after the pit (easy to climb onto ground)
    this.platforms.push({
      x: gapStart + gapW,
      y: (GROUND_Y - 1) * TILE,
      w: TILE,
      h: TILE,
      type: 'brick',
    });
  }

  /**
   * Staircase / stacked bricks to climb.
   * @param {number} start
   */
  _spawnBrickClimb(start) {
    const approach = (5 + Math.floor(Math.random() * 4)) * TILE;
    this._addGround(start / TILE, approach / TILE);
    let cursor = start + approach;

    const steps = 2 + Math.floor(Math.random() * 4);
    const stepDir = Math.random() < 0.5 ? 1 : -1; // up then maybe down
    let height = 1;

    for (let s = 0; s < steps; s++) {
      height = Math.max(1, Math.min(5, height + (s === 0 || Math.random() < 0.7 ? 1 : stepDir)));
      const y = (GROUND_Y - height) * TILE;
      const width = 1 + Math.floor(Math.random() * 2);
      for (let i = 0; i < width; i++) {
        this.platforms.push({
          x: cursor + i * TILE,
          y,
          w: TILE,
          h: TILE,
          type: 'brick',
        });
        this._addCoin(cursor + i * TILE + 8, y - TILE);
      }
      // Ground under bricks so you don't fall between
      this._addGround(cursor / TILE, width);
      cursor += width * TILE;
    }

    // Floating brick platform higher up
    if (Math.random() < 0.55) {
      const fy = (GROUND_Y - 5 - Math.floor(Math.random() * 2)) * TILE;
      const fw = 2 + Math.floor(Math.random() * 3);
      for (let i = 0; i < fw; i++) {
        this.platforms.push({
          x: cursor + i * TILE,
          y: fy,
          w: TILE,
          h: TILE,
          type: 'brick',
        });
        this._addCoin(cursor + i * TILE + 8, fy - TILE);
      }
    }

    const after = (5 + Math.floor(Math.random() * 5)) * TILE;
    this._addGround(cursor / TILE, after / TILE);
    this.generatedUntil = cursor + after;
    this._scatterCoins(start, cursor, GROUND_Y - 2);
    this._spawnAnimalsOnGround(start, cursor);
  }

  /**
   * Green pipe — short enough to jump, or with brick steps if taller.
   * @param {number} start
   */
  _spawnPipe(start) {
    const approach = (6 + Math.floor(Math.random() * 5)) * TILE;
    this._addGround(start / TILE, approach / TILE);
    let cursor = start + approach;

    // Mostly 2 tiles (jumpable); sometimes 3 with helper bricks
    const tall = Math.random() < 0.4;
    const pipeTiles = tall ? 3 : 2;
    const pipeH = pipeTiles * TILE;
    const pipeW = TILE * 2;

    if (tall) {
      // Brick steps so you can climb and jump over the tall pipe
      const stepHeights = [1, 2];
      for (const h of stepHeights) {
        this.platforms.push({
          x: cursor,
          y: (GROUND_Y - h) * TILE,
          w: TILE,
          h: TILE,
          type: 'brick',
        });
        cursor += TILE;
      }
      // Extra floating brick near pipe lip
      this.platforms.push({
        x: cursor - TILE * 0.25,
        y: (GROUND_Y - 3) * TILE,
        w: TILE,
        h: TILE,
        type: 'brick',
      });
    }

    const pipeX = cursor;
    const pipeY = GROUND_Y * TILE - pipeH;

    this.platforms.push({
      x: pipeX,
      y: pipeY + TILE * 0.55,
      w: pipeW,
      h: pipeH - TILE * 0.55,
      type: 'pipe',
    });
    this.platforms.push({
      x: pipeX - 4,
      y: pipeY,
      w: pipeW + 8,
      h: TILE * 0.55,
      type: 'pipeTop',
    });

    // Ground under the approach + pipe area
    this._addGround((start + approach) / TILE, (pipeX + pipeW - start - approach) / TILE);

    const after = (6 + Math.floor(Math.random() * 5)) * TILE;
    this._addGround((pipeX + pipeW) / TILE, after / TILE);
    this.generatedUntil = pipeX + pipeW + after;

    // Coins above / before the pipe
    this._scatterCoins(start, pipeX, GROUND_Y - 2);
    this._addCoin(pipeX + pipeW / 2 - 8, pipeY - TILE);
    this._spawnAnimalsOnGround(start, pipeX);
  }

  /**
   * Mix of pit + pipe or bricks.
   * @param {number} start
   */
  _spawnMixed(start) {
    if (Math.random() < 0.5) {
      this._spawnPipe(start);
      this._spawnPit(this.generatedUntil);
    } else {
      this._spawnBrickClimb(start);
      if (Math.random() < 0.6) this._spawnPipe(this.generatedUntil);
    }
  }

  /**
   * @param {number} tileX
   * @param {number} tileCount
   */
  _addGround(tileX, tileCount) {
    const count = Math.max(1, Math.floor(tileCount));
    this.platforms.push({
      x: tileX * TILE,
      y: GROUND_Y * TILE,
      w: count * TILE,
      h: (VIEW_H / TILE - GROUND_Y) * TILE,
      type: 'ground',
    });
  }

  /**
   * @param {number} x
   * @param {number} y
   * @param {number} [value]
   */
  _addCoin(x, y, value = 1) {
    this.coins.push({
      x,
      y,
      w: 16,
      h: 16,
      value,
      taken: false,
    });
  }

  /**
   * Scatter coins along a ground stretch.
   * @param {number} fromX
   * @param {number} toX
   * @param {number} tileRow
   */
  _scatterCoins(fromX, toX, tileRow) {
    const span = toX - fromX;
    if (span < TILE * 2) return;
    const count = 1 + Math.floor(span / (TILE * 4));
    for (let i = 0; i < count; i++) {
      if (Math.random() > 0.75) continue;
      const x = fromX + TILE + (span - TILE * 2) * ((i + 0.5) / count);
      const bob = Math.random() < 0.35 ? 1 : 0;
      this._addCoin(x, (tileRow - bob) * TILE + 8);
    }
  }

  /**
   * @param {number} x
   * @param {'green' | 'orange'} color
   * @param {number} minX
   * @param {number} maxX
   */
  _addAnimal(x, color, minX, maxX) {
    const w = 28;
    const h = 24;
    this.animals.push({
      x,
      y: GROUND_Y * TILE - h,
      w,
      h,
      color,
      vx: (Math.random() < 0.5 ? -1 : 1) * (45 + Math.random() * 25),
      minX,
      maxX: Math.max(minX + TILE, maxX),
      alive: true,
      anim: Math.random() * 10,
    });
  }

  /**
   * @param {number} fromX
   * @param {number} toX
   */
  _spawnAnimalsOnGround(fromX, toX) {
    const span = toX - fromX;
    if (span < TILE * 6) return;
    const rolls = 1 + (span > TILE * 12 && Math.random() < 0.45 ? 1 : 0);
    for (let i = 0; i < rolls; i++) {
      if (Math.random() > 0.7) continue;
      const color = Math.random() < 0.58 ? 'green' : 'orange';
      const x = fromX + TILE * 2 + Math.random() * (span - TILE * 4);
      this._addAnimal(x, color, fromX + TILE, toX - TILE * 2);
    }
  }

  /**
   * Remove a brick hit from below.
   * @param {Platform} brick
   */
  breakBrick(brick) {
    if (brick.type !== 'brick') return;
    const i = this.platforms.indexOf(brick);
    if (i >= 0) this.platforms.splice(i, 1);
    // Chance of a coin popping out
    if (Math.random() < 0.45) {
      this._addCoin(brick.x + 8, brick.y - TILE);
    }
  }

  /**
   * @param {number} x
   * @param {number} y
   * @param {number} facing
   */
  spawnFireball(x, y, facing) {
    this.fireballs.push({
      x,
      y,
      w: 14,
      h: 14,
      vx: facing * 340,
      life: 2.0,
      kind: 'fire',
      flyY: y,
    });
  }

  /**
   * Bigger / faster rocket after 3 orange animals.
   * @param {number} x
   * @param {number} y
   * @param {number} facing
   */
  spawnRocket(x, y, facing) {
    this.fireballs.push({
      x,
      y,
      w: 28,
      h: 14,
      vx: facing * 420,
      life: 2.4,
      kind: 'rocket',
      flyY: y,
    });
  }

  /**
   * Move fireballs/rockets at the height they were fired; kill green animals on hit.
   * @param {number} dt
   */
  updateFireballs(dt) {
    let kills = 0;

    for (const f of this.fireballs) {
      if (f.life <= 0) continue;
      f.x += f.vx * dt;
      f.life -= dt;
      // Stay at the height they were shot from
      f.y = f.flyY;

      for (const p of this.platforms) {
        if (
          !(
            f.x < p.x + p.w &&
            f.x + f.w > p.x &&
            f.y < p.y + p.h &&
            f.y + f.h > p.y
          )
        ) {
          continue;
        }
        // Only stop on walls / bricks / pipe body — not ground (can fly above it)
        if (p.type === 'ground' || p.type === 'pipeTop') continue;
        if (p.type === 'pipe' || p.type === 'brick') {
          if (f.kind === 'rocket' && p.type === 'brick') {
            this.breakBrick(p);
          }
          f.life = 0;
          break;
        }
      }

      if (f.life <= 0) continue;

      const pad = f.kind === 'rocket' ? 8 : 4;
      for (const a of this.animals) {
        if (!a.alive || a.color !== 'green') continue;
        if (
          f.x - pad < a.x + a.w &&
          f.x + f.w + pad > a.x &&
          f.y - pad < a.y + a.h &&
          f.y + f.h + pad > a.y
        ) {
          a.alive = false;
          f.life = 0;
          kills += 1;
          break;
        }
      }
    }
    this.fireballs = this.fireballs.filter((f) => f.life > 0);
    return kills;
  }

  /**
   * Idle patrol / follow rider / flee forever.
   * @param {number} dt
   * @param {import('./player.js').Player} player
   */
  updateBird(dt, player) {
    const bird = this.bird;
    if (!bird) return;

    bird.anim += dt * (bird.state === 'fleeing' ? 16 : 8);

    if (bird.state === 'mounted' && player.onBird) {
      // Sit under the rider — same feet as Mario
      bird.facing = player.facing;
      bird.x = player.x + player.w / 2 - bird.w / 2;
      bird.y = player.y + player.h - bird.h;
      bird.vx = player.vx;
      return;
    }

    if (bird.state === 'fleeing') {
      bird.x += bird.vx * dt;
      // Stay on ground while fleeing if possible
      if (!this.isOverPit(bird.x, bird.w) && this._hasGroundUnder(bird.x + bird.w / 2)) {
        bird.y = GROUND_Y * TILE - bird.h;
      } else {
        bird.y += 200 * dt;
      }
      return;
    }

    // Idle patrol
    bird.x += bird.vx * dt;
    bird.facing = bird.vx >= 0 ? 1 : -1;
    const probe = bird.vx > 0 ? bird.x + bird.w + 4 : bird.x - 4;
    if (this.isOverPit(probe, 2) || !this._hasGroundUnder(probe)) {
      bird.vx *= -1;
    }
    // Keep near start runway (visible early)
    if (bird.x < 7 * TILE) {
      bird.x = 7 * TILE;
      bird.vx = Math.abs(bird.vx);
    }
    if (bird.x > 18 * TILE) {
      bird.x = 18 * TILE;
      bird.vx = -Math.abs(bird.vx);
    }
    bird.y = GROUND_Y * TILE - bird.h;
  }

  /**
   * Knock rider off — bird flees and cannot be caught again.
   * @param {import('./player.js').Player} player
   */
  frightenBird(player) {
    const bird = this.bird;
    if (!bird) return;
    bird.state = 'fleeing';
    bird.catchable = false;
    bird.vx = (player.facing >= 0 ? 1 : -1) * 380;
    bird.facing = bird.vx >= 0 ? 1 : -1;
    player.onBird = false;
  }

  /**
   * Patrol animals along the ground; reverse at pits / patrol ends.
   * @param {number} dt
   */
  updateAnimals(dt) {
    for (const a of this.animals) {
      if (!a.alive) continue;
      a.anim += dt * 10;
      a.x += a.vx * dt;

      const probe = a.vx > 0 ? a.x + a.w + 4 : a.x - 4;
      if (this.isOverPit(probe, 2) || !this._hasGroundUnder(probe)) {
        a.vx *= -1;
      }
      if (a.x < a.minX) {
        a.x = a.minX;
        a.vx = Math.abs(a.vx);
      } else if (a.x > a.maxX) {
        a.x = a.maxX;
        a.vx = -Math.abs(a.vx);
      }

      // Fall into pit if somehow over one
      if (this.isOverPit(a.x, a.w)) {
        a.y += 400 * dt;
        if (a.y > VIEW_H) a.alive = false;
      } else {
        a.y = GROUND_Y * TILE - a.h;
      }
    }
  }

  /**
   * @param {number} x
   */
  _hasGroundUnder(x) {
    if (this.isOverPit(x, 2)) return false;
    for (const p of this.platforms) {
      if (p.type !== 'ground') continue;
      if (x >= p.x && x <= p.x + p.w) return true;
    }
    return false;
  }

  /**
   * Collect overlapping coins; returns { gained, count }.
   * @param {{ x: number, y: number, w: number, h: number }} player
   */
  collectCoins(player) {
    let gained = 0;
    let count = 0;
    for (const c of this.coins) {
      if (c.taken) continue;
      if (
        player.x < c.x + c.w &&
        player.x + player.w > c.x &&
        player.y < c.y + c.h &&
        player.y + player.h > c.y
      ) {
        c.taken = true;
        gained += c.value;
        count += 1;
      }
    }
    return { gained, count };
  }

  /**
   * Solid platforms the player can stand on (not pit voids).
   * @returns {Platform[]}
   */
  getSolidPlatforms() {
    return this.platforms;
  }

  /**
   * Check if world X is over a pit (no ground).
   * @param {number} x
   * @param {number} w
   */
  isOverPit(x, w) {
    const left = x;
    const right = x + w;
    for (const pit of this.pits) {
      if (right > pit.x + 4 && left < pit.x + pit.w - 4) return true;
    }
    return false;
  }

  /**
   * Find pit under x (center), or null.
   * @param {number} x
   * @param {number} w
   */
  findPitAt(x, w) {
    const cx = x + w / 2;
    for (const pit of this.pits) {
      if (cx >= pit.x && cx <= pit.x + pit.w) return pit;
    }
    for (const pit of this.pits) {
      if (x + w > pit.x && x < pit.x + pit.w) return pit;
    }
    return null;
  }

  /**
   * 10 coins burst upward out of a pit.
   * @param {number} x - center of burst
   */
  spawnPitCoinBurst(x) {
    const ground = GROUND_Y * TILE;
    for (let i = 0; i < 10; i++) {
      const angle = -Math.PI / 2 + (i - 4.5) * 0.18;
      const speed = 220 + Math.random() * 140;
      this.burstCoins.push({
        x: x + (i - 4.5) * 6,
        y: ground + 8,
        vx: Math.cos(angle) * speed * 0.55,
        vy: Math.sin(angle) * speed - 80,
        life: 1.4 + Math.random() * 0.4,
        spin: Math.random() * Math.PI * 2,
      });
    }
  }

  /**
   * @param {number} dt
   */
  updateBurstCoins(dt) {
    for (const c of this.burstCoins) {
      c.vy += 900 * dt;
      c.x += c.vx * dt;
      c.y += c.vy * dt;
      c.life -= dt;
      c.spin += dt * 10;
    }
    this.burstCoins = this.burstCoins.filter((c) => c.life > 0 && c.y < VIEW_H + 40);
  }

  /**
   * Tick spawn timer; place wings ahead of the player once.
   * @param {number} dt
   * @param {number} playerX
   */
  updateWingsSpawn(dt, playerX) {
    this.runTime += dt;
    if (this.wingsPickup && !this.wingsPickup.taken) {
      this.wingsPickup.bob += dt * 4;
    }
    if (this.wingsSpawned || this.runTime < this.wingsSpawnAt) return;

    this.wingsSpawned = true;
    const x = playerX + VIEW_W * 0.55;
    // Only extend the level — do not prune, or ground under the player vanishes
    this.generateAhead(x + VIEW_W);
    this.wingsPickup = {
      x,
      y: (GROUND_Y - 4) * TILE,
      w: 36,
      h: 28,
      bob: 0,
      taken: false,
    };
  }

  /**
   * @param {{ x: number, y: number, w: number, h: number, hasWings?: boolean }} player
   * @returns {boolean} true if just collected
   */
  tryCollectWings(player) {
    const w = this.wingsPickup;
    if (!w || w.taken || player.hasWings) return false;
    const bobY = w.y + Math.sin(w.bob) * 6;
    if (
      player.x < w.x + w.w &&
      player.x + player.w > w.x &&
      player.y < bobY + w.h &&
      player.y + player.h > bobY
    ) {
      w.taken = true;
      // Wings replace the bird — it disappears
      player.onBird = false;
      this.bird = null;
      return true;
    }
    return false;
  }
}
