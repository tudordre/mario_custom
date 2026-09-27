import { Input } from './input.js';
import { Player } from './player.js';
import { Renderer } from './renderer.js';
import { Sfx } from './sfx.js';
import { VIEW_W, World } from './world.js';

const MONEY_KEY = 'mario-custom-money';
const PIT_REWARD = 10;
const TIME_LIMIT = 60; // seconds

class Game {
  constructor() {
    /** @type {HTMLCanvasElement} */
    this.canvas = document.getElementById('game');
    this.moneyEl = document.getElementById('money');
    this.orangesEl = document.getElementById('oranges');
    this.timerEl = document.getElementById('timer');
    this.distanceEl = document.getElementById('distance');
    this.overlay = document.getElementById('overlay');
    this.gameOver = document.getElementById('gameOver');
    this.finalMoney = document.getElementById('finalMoney');
    this.finalMsg = document.getElementById('finalMsg');

    this.input = new Input();
    this.world = new World();
    this.player = new Player();
    this.renderer = new Renderer(this.canvas);
    this.sfx = new Sfx();

    this.cameraX = 0;
    /** Money collected this run */
    this.money = 0;
    this.maxX = 0;
    this.timeLeft = TIME_LIMIT;
    this.running = false;
    this.ended = false;
    this.pitRewardDone = false;
    this.endDelay = 0;
    this.lastTime = 0;
    this.moneyEl.textContent = '0';
    this._updateTimerHud();

    document.getElementById('startBtn').addEventListener('click', () => this.start());
    document.getElementById('restartBtn').addEventListener('click', () => this.start());

    window.addEventListener('keydown', (e) => {
      if (e.code === 'KeyR' && (this.ended || this.running)) this.start();
      if ((e.code === 'Enter' || e.code === 'Space') && !this.running && !this.ended) {
        e.preventDefault();
        this.start();
      }
      if ((e.code === 'Enter' || e.code === 'Space') && this.ended) {
        e.preventDefault();
        this.start();
      }
    });

    this.renderer.draw(this.world, this.player, 0);
    requestAnimationFrame((t) => this.loop(t));
  }

  start() {
    this.world.reset();
    this.player.reset();
    this.input.keys.clear();
    this.sfx._ensure();
    this.cameraX = 0;
    this.money = 0;
    this.maxX = this.player.x;
    this.timeLeft = TIME_LIMIT;
    this.running = true;
    this.ended = false;
    this.pitRewardDone = false;
    this.endDelay = 0;
    this.lastTime = performance.now();
    this.overlay.classList.add('hidden');
    this.overlay.classList.remove('visible');
    this.gameOver.classList.add('hidden');
    this._updateHud();
  }

  /**
   * @param {number} gained
   */
  _addMoney(gained) {
    if (gained <= 0) return;
    this.money += gained;
    localStorage.setItem(MONEY_KEY, String(this.money));
  }

  /**
   * @param {number} time
   */
  loop(time) {
    const dt = Math.min(0.033, (time - this.lastTime) / 1000 || 0);
    this.lastTime = time;

    this.world.updateBurstCoins(dt);

    if (this.running) {
      this.timeLeft = Math.max(0, this.timeLeft - dt);
      if (this.timeLeft <= 0 && this.player.alive) {
        this.player.alive = false;
        this.player.timedOut = true;
      }

      this.player.update(this.input, dt, this.world);
      if (this.player._shotRocket) this.sfx.playRocket();
      else if (this.player._shotFire) this.sfx.playFireball();
      if (this.player.lastBrickBreak === 'brick') this.sfx.playBrickBreak();
      if (this.player._mountedBird) this.sfx.playGrow();

      this.world.updateWingsSpawn(dt, this.player.x);
      this.world.updateBird(dt, this.player);
      this.world.updateAnimals(dt);
      const fireKills = this.world.updateFireballs(dt);
      if (fireKills > 0) this.sfx.playStomp();

      if (this.player._gotWings) this.sfx.playGrow();

      const animalEvent = this.player.resolveAnimals(this.world);
      if (animalEvent === 'stomp') this.sfx.playStomp();
      else if (animalEvent === 'grow' || animalEvent === 'fire' || animalEvent === 'rocket') {
        this.sfx.playGrow();
      } else if (animalEvent === 'dismount') this.sfx.playShrink();
      else if (animalEvent === 'downgrade' || animalEvent === 'die') this.sfx.playShrink();

      const { gained, count } = this.world.collectCoins(this.player);
      if (gained > 0) {
        this._addMoney(gained);
        for (let i = 0; i < count; i++) this.sfx.playCoin(i * 0.045);
      }

      this.input.endFrame();

      const target = this.player.x - VIEW_W * 0.35;
      this.cameraX = Math.max(0, this.cameraX + (target - this.cameraX) * Math.min(1, dt * 8));

      this.world.ensureGenerated(this.cameraX + VIEW_W);

      if (this.player.x > this.maxX) this.maxX = this.player.x;
      this._updateHud();

      if (!this.player.alive) this._beginEnd();
    } else if (this.endDelay > 0) {
      this.endDelay -= dt;
      if (this.endDelay <= 0) this._showGameOver();
    }

    this.renderer.draw(this.world, this.player, this.cameraX);
    requestAnimationFrame((t) => this.loop(t));
  }

  _updateHud() {
    this.moneyEl.textContent = String(this.money);
    const n = Math.min(3, this.player.orangeCount);
    this.orangesEl.textContent = this.player.hasRockets ? 'RACHETE!' : `${n}/3`;
    this.orangesEl.classList.toggle('ready', this.player.hasRockets);
    this.distanceEl.textContent = `${Math.floor(this.maxX / 32)}m`;
    this._updateTimerHud();
  }

  _updateTimerHud() {
    const secs = Math.ceil(this.timeLeft);
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    this.timerEl.textContent = `${m}:${String(s).padStart(2, '0')}`;
    this.timerEl.classList.toggle('urgent', this.timeLeft <= 10);
  }

  _beginEnd() {
    this.running = false;

    if (this.player.fellInPit && !this.pitRewardDone) {
      this.pitRewardDone = true;
      this._addMoney(PIT_REWARD);
      const pit = this.world.findPitAt(this.player.x, this.player.w);
      const burstX = pit
        ? pit.x + pit.w / 2
        : this.player.x + this.player.w / 2;
      this.world.spawnPitCoinBurst(burstX);
      this.sfx.playPitFall();
      for (let i = 0; i < 10; i++) this.sfx.playCoin(0.05 + i * 0.04);
      this.endDelay = 1.5;
      this._updateHud();
      return;
    }

    this._showGameOver();
  }

  _showGameOver() {
    this.ended = true;
    this.endDelay = 0;

    const pitBonus = this.player.fellInPit ? PIT_REWARD : 0;

    if (this.player.timedOut) {
      this.finalMsg.textContent = 'Timpul a expirat! Mario a murit.';
    } else if (this.player.killedByAnimal) {
      this.finalMsg.textContent = 'Un animal verde te-a prins!';
    } else if (pitBonus) {
      this.finalMsg.textContent = `Ai căzut în groapă! +${pitBonus} bani.`;
    } else {
      this.finalMsg.textContent = 'Game over!';
    }

    this.finalMoney.textContent = String(this.money);
    this.moneyEl.textContent = String(this.money);
    this.gameOver.classList.remove('hidden');
  }
}

new Game();
