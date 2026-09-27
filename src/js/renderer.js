import { GROUND_Y, TILE, VIEW_H, VIEW_W } from './world.js';

/**
 * Retro Mario-inspired canvas renderer (original art, no Nintendo assets).
 */
export class Renderer {
  /**
   * @param {HTMLCanvasElement} canvas
   */
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.ctx.imageSmoothingEnabled = false;
  }

  /**
   * @param {import('./world.js').World} world
   * @param {import('./player.js').Player} player
   * @param {number} cameraX
   */
  draw(world, player, cameraX) {
    const ctx = this.ctx;
    const cam = Math.floor(cameraX);

    ctx.clearRect(0, 0, VIEW_W, VIEW_H);

    // Sky
    const sky = ctx.createLinearGradient(0, 0, 0, VIEW_H);
    sky.addColorStop(0, '#5c94fc');
    sky.addColorStop(1, '#7ab8ff');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);

    this._drawHills(world, cam);
    this._drawClouds(world, cam);
    this._drawPits(world, cam);
    this._drawPlatforms(world, cam);
    this._drawCoins(world, cam);
    this._drawBurstCoins(world, cam);
    this._drawWingsPickup(world, cam);
    this._drawAnimals(world, cam);
    this._drawFireballs(world, cam);
    this._drawBird(world, cam);
    this._drawPlayer(player, cam);
  }

  /**
   * @param {import('./world.js').World} world
   * @param {number} cam
   */
  _drawHills(world, cam) {
    const ctx = this.ctx;
    for (const h of world.hills) {
      const x = h.x - cam;
      if (x < -200 || x > VIEW_W + 200) continue;
      ctx.fillStyle = '#3cb043';
      ctx.beginPath();
      ctx.moveTo(x, h.y);
      ctx.quadraticCurveTo(x + 70, h.y - 90, x + 140, h.y);
      ctx.fill();
      ctx.fillStyle = '#2d8a34';
      ctx.beginPath();
      ctx.moveTo(x + 40, h.y);
      ctx.quadraticCurveTo(x + 100, h.y - 60, x + 180, h.y);
      ctx.fill();
    }
  }

  /**
   * @param {import('./world.js').World} world
   * @param {number} cam
   */
  _drawClouds(world, cam) {
    const ctx = this.ctx;
    ctx.fillStyle = 'rgba(255,255,255,0.92)';
    for (const c of world.clouds) {
      const x = c.x - cam * 0.35;
      if (x < -100 || x > VIEW_W + 100) continue;
      this._cloud(x, c.y);
    }
  }

  /**
   * @param {number} x
   * @param {number} y
   */
  _cloud(x, y) {
    const ctx = this.ctx;
    ctx.beginPath();
    ctx.arc(x, y, 18, 0, Math.PI * 2);
    ctx.arc(x + 22, y - 8, 22, 0, Math.PI * 2);
    ctx.arc(x + 48, y, 16, 0, Math.PI * 2);
    ctx.arc(x + 24, y + 6, 14, 0, Math.PI * 2);
    ctx.fill();
  }

  /**
   * Dark void under pits.
   * @param {import('./world.js').World} world
   * @param {number} cam
   */
  _drawPits(world, cam) {
    const ctx = this.ctx;
    const groundTop = GROUND_Y * TILE;
    for (const pit of world.pits) {
      const x = pit.x - cam;
      if (x + pit.w < 0 || x > VIEW_W) continue;
      ctx.fillStyle = '#1a1020';
      ctx.fillRect(x, groundTop, pit.w, VIEW_H - groundTop);
      // Jagged edges
      ctx.fillStyle = '#2a1830';
      for (let i = 0; i < pit.w; i += 8) {
        ctx.fillRect(x + i, groundTop, 4, 6 + (i % 16));
      }
    }
  }

  /**
   * Coins bursting out of a pit.
   * @param {import('./world.js').World} world
   * @param {number} cam
   */
  _drawBurstCoins(world, cam) {
    const ctx = this.ctx;
    for (const c of world.burstCoins) {
      const x = c.x - cam;
      if (x < -20 || x > VIEW_W + 20) continue;
      const alpha = Math.min(1, c.life * 2);
      const spin = 0.55 + 0.45 * Math.abs(Math.sin(c.spin));
      const w = 10 * spin;
      const h = 12;

      ctx.globalAlpha = alpha;
      ctx.fillStyle = '#f4c400';
      ctx.beginPath();
      ctx.ellipse(x, c.y, w / 2, h / 2, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffe566';
      ctx.beginPath();
      ctx.ellipse(x - 1, c.y - 2, w * 0.2, h * 0.15, 0, 0, Math.PI * 2);
      ctx.fill();
      if (spin > 0.7) {
        ctx.fillStyle = '#b8860b';
        ctx.font = 'bold 10px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('$', x, c.y + 1);
      }
      ctx.globalAlpha = 1;
    }
  }

  /**
   * Floating wings power-up.
   * @param {import('./world.js').World} world
   * @param {number} cam
   */
  _drawWingsPickup(world, cam) {
    const w = world.wingsPickup;
    if (!w || w.taken) return;
    const x = w.x - cam;
    if (x + w.w < 0 || x > VIEW_W) return;
    const y = w.y + Math.sin(w.bob) * 6;
    this._drawWingPair(x + w.w / 2, y + w.h / 2, 1, w.bob * 3, 1.15);
  }

  /**
   * @param {number} cx
   * @param {number} cy
   * @param {number} face
   * @param {number} flap
   * @param {number} scale
   */
  _drawWingPair(cx, cy, face, flap, scale = 1) {
    const ctx = this.ctx;
    const f = Math.sin(flap) * 10;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(face * scale, scale);

    // Left wing (behind)
    ctx.fillStyle = '#f0f4ff';
    ctx.strokeStyle = '#8899cc';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-2, 2);
    ctx.quadraticCurveTo(-22, -8 + f, -28, 4);
    ctx.quadraticCurveTo(-20, 14, -2, 8);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Right wing
    ctx.beginPath();
    ctx.moveTo(2, 2);
    ctx.quadraticCurveTo(22, -8 - f, 28, 4);
    ctx.quadraticCurveTo(20, 14, 2, 8);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Soft pink tips
    ctx.fillStyle = '#ffb6c8';
    ctx.beginPath();
    ctx.ellipse(-24, 2 + f * 0.3, 5, 4, 0, 0, Math.PI * 2);
    ctx.ellipse(24, 2 - f * 0.3, 5, 4, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  /**
   * @param {import('./world.js').World} world
   * @param {number} cam
   */
  _drawCoins(world, cam) {
    const ctx = this.ctx;
    const t = performance.now() / 1000;
    for (const c of world.coins) {
      if (c.taken) continue;
      const x = c.x - cam;
      if (x + c.w < 0 || x > VIEW_W) continue;

      const spin = 0.55 + 0.45 * Math.abs(Math.sin(t * 6 + c.x * 0.05));
      const w = c.w * spin;
      const h = c.h;
      const cx = x + c.w / 2;
      const cy = c.y + h / 2 + Math.sin(t * 4 + c.x * 0.08) * 2;

      ctx.fillStyle = '#f4c400';
      ctx.beginPath();
      ctx.ellipse(cx, cy, w / 2, h / 2, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#ffe566';
      ctx.beginPath();
      ctx.ellipse(cx - w * 0.1, cy - h * 0.15, w * 0.25, h * 0.2, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = '#b8860b';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(cx, cy, w / 2, h / 2, 0, 0, Math.PI * 2);
      ctx.stroke();

      // "$" mark when facing camera
      if (spin > 0.7) {
        ctx.fillStyle = '#b8860b';
        ctx.font = 'bold 12px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('$', cx, cy + 1);
      }
    }
  }

  /**
   * @param {import('./world.js').World} world
   * @param {number} cam
   */
  _drawPlatforms(world, cam) {
    const ctx = this.ctx;
    for (const p of world.platforms) {
      const x = p.x - cam;
      if (x + p.w < -TILE || x > VIEW_W + TILE) continue;

      if (p.type === 'ground') {
        this._drawGround(x, p.y, p.w, p.h);
      } else if (p.type === 'brick') {
        this._drawBrick(x, p.y, p.w, p.h);
      } else if (p.type === 'pipe' || p.type === 'pipeTop') {
        this._drawPipePart(p, x);
      }
    }
  }

  /**
   * @param {number} x
   * @param {number} y
   * @param {number} w
   * @param {number} h
   */
  _drawGround(x, y, w, h) {
    const ctx = this.ctx;
    // Dirt
    ctx.fillStyle = '#c84c0c';
    ctx.fillRect(x, y, w, h);
    // Grass top
    ctx.fillStyle = '#00a800';
    ctx.fillRect(x, y, w, 8);
    ctx.fillStyle = '#80d010';
    for (let i = 0; i < w; i += 8) {
      ctx.fillRect(x + i, y, 4, 4);
    }
    // Speckles
    ctx.fillStyle = '#a03800';
    for (let i = 0; i < w; i += 16) {
      ctx.fillRect(x + i + 4, y + 20, 3, 3);
      ctx.fillRect(x + i + 10, y + 36, 2, 2);
    }
  }

  /**
   * @param {number} x
   * @param {number} y
   * @param {number} w
   * @param {number} h
   */
  _drawBrick(x, y, w, h) {
    const ctx = this.ctx;
    ctx.fillStyle = '#c84c0c';
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = '#8b2e05';
    ctx.lineWidth = 2;
    ctx.strokeRect(x + 1, y + 1, w - 2, h - 2);
    // Mortar lines
    ctx.fillStyle = '#f0d0a0';
    ctx.fillRect(x + 2, y + h / 2 - 1, w - 4, 2);
    ctx.fillRect(x + w / 2 - 1, y + 2, 2, h / 2 - 3);
    // Highlight
    ctx.fillStyle = 'rgba(255,200,120,0.35)';
    ctx.fillRect(x + 3, y + 3, w * 0.35, 4);
  }

  /**
   * @param {import('./world.js').Platform} p
   * @param {number} x
   */
  _drawPipePart(p, x) {
    const ctx = this.ctx;
    if (p.type === 'pipeTop') {
      ctx.fillStyle = '#00a800';
      ctx.fillRect(x, p.y, p.w, p.h);
      ctx.fillStyle = '#80d010';
      ctx.fillRect(x + 4, p.y + 3, 8, p.h - 6);
      ctx.fillStyle = '#007000';
      ctx.fillRect(x + p.w - 12, p.y + 3, 8, p.h - 6);
      ctx.strokeStyle = '#004000';
      ctx.lineWidth = 2;
      ctx.strokeRect(x + 1, p.y + 1, p.w - 2, p.h - 2);
    } else {
      ctx.fillStyle = '#00a800';
      ctx.fillRect(x, p.y, p.w, p.h);
      ctx.fillStyle = '#80d010';
      ctx.fillRect(x + 6, p.y, 10, p.h);
      ctx.fillStyle = '#007000';
      ctx.fillRect(x + p.w - 14, p.y, 8, p.h);
      // Rings
      ctx.fillStyle = '#004000';
      for (let yy = p.y + 10; yy < p.y + p.h; yy += 18) {
        ctx.fillRect(x + 2, yy, p.w - 4, 2);
      }
    }
  }

  /**
   * @param {import('./world.js').World} world
   * @param {number} cam
   */
  _drawFireballs(world, cam) {
    const ctx = this.ctx;
    const t = performance.now() / 1000;
    for (const f of world.fireballs) {
      const x = f.x - cam;
      if (x + f.w < 0 || x > VIEW_W) continue;
      const cx = x + f.w / 2;
      const cy = f.y + f.h / 2;
      const dir = f.vx >= 0 ? 1 : -1;

      if (f.kind === 'rocket') {
        ctx.save();
        ctx.translate(cx, cy);
        ctx.scale(dir, 1);

        // Exhaust
        ctx.fillStyle = '#ff6600';
        ctx.beginPath();
        ctx.moveTo(-f.w / 2 - 4, -3);
        ctx.lineTo(-f.w / 2 - 14 - Math.sin(t * 30) * 3, 0);
        ctx.lineTo(-f.w / 2 - 4, 3);
        ctx.fill();
        ctx.fillStyle = '#ffcc00';
        ctx.fillRect(-f.w / 2 - 8, -2, 6, 4);

        // Body
        ctx.fillStyle = '#c0c0c0';
        ctx.fillRect(-f.w / 2, -5, f.w - 4, 10);
        ctx.fillStyle = '#e52521';
        ctx.beginPath();
        ctx.moveTo(f.w / 2 - 4, -5);
        ctx.lineTo(f.w / 2 + 6, 0);
        ctx.lineTo(f.w / 2 - 4, 5);
        ctx.fill();
        // Fins
        ctx.fillStyle = '#2050f0';
        ctx.fillRect(-f.w / 2, -8, 6, 3);
        ctx.fillRect(-f.w / 2, 5, 6, 3);

        ctx.restore();
      } else {
        const pulse = 1 + Math.sin(t * 20 + f.x) * 0.15;
        ctx.fillStyle = '#ff4400';
        ctx.beginPath();
        ctx.arc(cx, cy, 7 * pulse, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#ffcc00';
        ctx.beginPath();
        ctx.arc(cx - 1, cy - 1, 3.5 * pulse, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#fff8e0';
        ctx.beginPath();
        ctx.arc(cx - 2, cy - 2, 1.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  /**
   * Cute blob animals — green (hostile) / orange (power-up).
   * @param {import('./world.js').World} world
   * @param {number} cam
   */
  _drawAnimals(world, cam) {
    const ctx = this.ctx;
    for (const a of world.animals) {
      if (!a.alive) continue;
      const x = Math.floor(a.x - cam);
      if (x + a.w < 0 || x > VIEW_W) continue;

      const bob = Math.sin(a.anim) * 1.5;
      const face = a.vx >= 0 ? 1 : -1;
      const body = a.color === 'orange' ? '#ff8c1a' : '#3cb043';
      const dark = a.color === 'orange' ? '#cc5500' : '#1e7a28';
      const belly = a.color === 'orange' ? '#ffc878' : '#a8e063';

      ctx.save();
      ctx.translate(x + a.w / 2, a.y + bob);
      ctx.scale(face, 1);

      // Body
      ctx.fillStyle = body;
      ctx.beginPath();
      ctx.ellipse(0, a.h / 2, a.w / 2, a.h / 2, 0, 0, Math.PI * 2);
      ctx.fill();

      // Belly
      ctx.fillStyle = belly;
      ctx.beginPath();
      ctx.ellipse(2, a.h / 2 + 2, a.w * 0.28, a.h * 0.28, 0, 0, Math.PI * 2);
      ctx.fill();

      // Ears / horns
      ctx.fillStyle = dark;
      ctx.beginPath();
      ctx.moveTo(-10, 6);
      ctx.lineTo(-6, -4);
      ctx.lineTo(-2, 6);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(2, 6);
      ctx.lineTo(6, -4);
      ctx.lineTo(10, 6);
      ctx.fill();

      // Eyes
      ctx.fillStyle = '#fff';
      ctx.fillRect(2, a.h * 0.28, 7, 7);
      ctx.fillStyle = '#111';
      ctx.fillRect(5, a.h * 0.32, 3, 3);

      // Feet
      ctx.fillStyle = dark;
      ctx.fillRect(-12, a.h - 4, 8, 4);
      ctx.fillRect(2, a.h - 4, 8, 4);

      ctx.restore();
    }
  }

  /**
   * Tall rideable bird — drawn to fill its full hitbox.
   * @param {import('./world.js').World} world
   * @param {number} cam
   */
  _drawBird(world, cam) {
    const bird = world.bird;
    if (!bird) return;
    const x = Math.floor(bird.x - cam);
    if (x + bird.w < -40 || x > VIEW_W + 40) return;

    const ctx = this.ctx;
    const flap = Math.sin(bird.anim) * (bird.h * 0.08);
    const face = bird.facing >= 0 ? 1 : -1;
    const fleeing = bird.state === 'fleeing';
    const hw = bird.w / 2;
    const hh = bird.h / 2;

    ctx.save();
    ctx.translate(x + hw, bird.y + hh);
    ctx.scale(face, 1);
    if (fleeing) ctx.globalAlpha = 0.9;

    // Body (fills most of height)
    ctx.fillStyle = fleeing ? '#7a8aaa' : '#4a90d9';
    ctx.beginPath();
    ctx.ellipse(0, hh * 0.12, hw * 0.78, hh * 0.72, 0, 0, Math.PI * 2);
    ctx.fill();

    // Belly
    ctx.fillStyle = '#c8e0f8';
    ctx.beginPath();
    ctx.ellipse(hw * 0.1, hh * 0.2, hw * 0.42, hh * 0.42, 0, 0, Math.PI * 2);
    ctx.fill();

    // Head
    ctx.fillStyle = fleeing ? '#7a8aaa' : '#3d7fc4';
    ctx.beginPath();
    ctx.arc(0, -hh * 0.55, hw * 0.55, 0, Math.PI * 2);
    ctx.fill();

    // Beak
    ctx.fillStyle = '#ffaa00';
    ctx.beginPath();
    ctx.moveTo(hw * 0.35, -hh * 0.55);
    ctx.lineTo(hw * 0.95, -hh * 0.48);
    ctx.lineTo(hw * 0.35, -hh * 0.38);
    ctx.fill();

    // Eye
    const eye = Math.max(4, hw * 0.18);
    ctx.fillStyle = '#fff';
    ctx.fillRect(hw * 0.05, -hh * 0.7, eye, eye);
    ctx.fillStyle = '#111';
    ctx.fillRect(hw * 0.05 + eye * 0.35, -hh * 0.7 + eye * 0.3, eye * 0.4, eye * 0.4);

    // Wing
    ctx.fillStyle = fleeing ? '#5a6a80' : '#2e6bb0';
    ctx.beginPath();
    ctx.ellipse(-hw * 0.25, 0, hw * 0.4, hh * 0.45 + flap, -0.35, 0, Math.PI * 2);
    ctx.fill();

    // Legs
    ctx.strokeStyle = '#ffaa00';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(-hw * 0.25, hh * 0.7);
    ctx.lineTo(-hw * 0.3, hh * 0.95);
    ctx.moveTo(hw * 0.15, hh * 0.7);
    ctx.lineTo(hw * 0.22, hh * 0.95);
    ctx.stroke();

    // Crest
    ctx.fillStyle = '#e52521';
    ctx.beginPath();
    ctx.moveTo(-hw * 0.15, -hh * 0.85);
    ctx.lineTo(0, -hh * 1.05);
    ctx.lineTo(hw * 0.15, -hh * 0.85);
    ctx.fill();

    ctx.restore();
  }

  /**
   * Simple original plumber sprite (red / big / fire-orange).
   * @param {import('./player.js').Player} player
   * @param {number} cam
   */
  _drawPlayer(player, cam) {
    const ctx = this.ctx;
    const x = Math.floor(player.x - cam);
    const y = Math.floor(player.y);
    const f = player.facing;
    const scaleY = player.h / 32;
    const bob = player.onGround && Math.abs(player.vx) > 10
      ? Math.sin(player.anim) * 1.5
      : 0;
    // Sit a bit higher when riding
    const sit = player.onBird ? -6 : 0;

    const fire = player.form === 'fire';
    const shirt = fire ? '#ff8c1a' : '#e52521';
    const overalls = fire ? '#fff' : '#2050f0';
    const cap = fire ? '#ff6600' : '#e52521';

    if (!(player.invuln > 0 && Math.floor(player.invuln * 20) % 2 === 0)) {
      ctx.save();
      ctx.translate(x + player.w / 2, y + bob + sit);
      ctx.scale(f, scaleY);

      // Wings behind the body
      if (player.hasWings) {
        ctx.restore();
        this._drawWingPair(
          x + player.w / 2,
          y + bob + sit + player.h * 0.35,
          f,
          player.anim,
          player.h / 32,
        );
        ctx.save();
        ctx.translate(x + player.w / 2, y + bob + sit);
        ctx.scale(f, scaleY);
      }

      ctx.fillStyle = '#6b3a1a';
      ctx.fillRect(-10, 26, 9, 6);
      ctx.fillRect(1, 26, 9, 6);

      ctx.fillStyle = overalls;
      ctx.fillRect(-8, 14, 16, 14);
      ctx.fillStyle = fire ? '#ffd700' : '#e8c060';
      ctx.fillRect(-3, 16, 6, 6);

      ctx.fillStyle = shirt;
      ctx.fillRect(-9, 8, 18, 8);
      ctx.fillRect(-12, 9, 4, 8);
      ctx.fillRect(8, 9, 4, 8);

      ctx.fillStyle = '#f4c4a0';
      ctx.fillRect(-7, 0, 14, 10);

      ctx.fillStyle = cap;
      ctx.fillRect(-8, -4, 16, 5);
      ctx.fillRect(-4, -7, 10, 4);

      ctx.fillStyle = '#111';
      ctx.fillRect(2, 2, 3, 3);

      ctx.fillStyle = '#4a2010';
      ctx.fillRect(0, 6, 7, 2);

      ctx.restore();
    }

    if (!player.alive) {
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.fillRect(x - 4, y - 4, player.w + 8, player.h + 8);
    }
  }
}
