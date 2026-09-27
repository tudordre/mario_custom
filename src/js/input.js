/** @typedef {'left' | 'right' | 'jump' | 'fire'} Action */

export class Input {
  constructor() {
    /** @type {Set<string>} */
    this.keys = new Set();
    /** @type {Set<string>} */
    this._just = new Set();
    /** Explicit Ctrl tracking (Left + Right) */
    this.ctrlLeft = false;
    this.ctrlRight = false;
    this._ctrlJust = false;

    this._onKeyDown = (e) => {
      if (!this.keys.has(e.code)) this._just.add(e.code);
      this.keys.add(e.code);

      if (e.key === 'Control' || e.code === 'ControlLeft' || e.code === 'ControlRight') {
        const wasDown = this.ctrlLeft || this.ctrlRight;
        if (e.code === 'ControlRight' || e.location === 2) this.ctrlRight = true;
        else this.ctrlLeft = true;
        // Also set by code for reliability
        if (e.code === 'ControlLeft') this.ctrlLeft = true;
        if (e.code === 'ControlRight') this.ctrlRight = true;
        if (!wasDown) this._ctrlJust = true;
        e.preventDefault();
      }

      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) {
        e.preventDefault();
      }
    };

    this._onKeyUp = (e) => {
      this.keys.delete(e.code);
      if (e.key === 'Control' || e.code === 'ControlLeft' || e.code === 'ControlRight') {
        if (e.code === 'ControlRight' || e.location === 2) this.ctrlRight = false;
        else this.ctrlLeft = false;
        if (e.code === 'ControlLeft') this.ctrlLeft = false;
        if (e.code === 'ControlRight') this.ctrlRight = false;
        // If browser only says "Control" without side, clear both when none reported
        if (e.key === 'Control' && e.code !== 'ControlLeft' && e.code !== 'ControlRight') {
          if (e.location === 2) this.ctrlRight = false;
          else this.ctrlLeft = false;
        }
      }
    };

    window.addEventListener('keydown', this._onKeyDown);
    window.addEventListener('keyup', this._onKeyUp);
    window.addEventListener('blur', () => {
      this.keys.clear();
      this.ctrlLeft = false;
      this.ctrlRight = false;
    });
  }

  /** Call once per frame after reading just-pressed. */
  endFrame() {
    this._just.clear();
    this._ctrlJust = false;
  }

  /** @param {Action} action */
  isDown(action) {
    switch (action) {
      case 'left':
        return this.keys.has('ArrowLeft') || this.keys.has('KeyA');
      case 'right':
        return this.keys.has('ArrowRight') || this.keys.has('KeyD');
      case 'jump':
        return this.keys.has('ArrowUp') || this.keys.has('KeyW') || this.keys.has('Space');
      case 'fire':
        return (
          this.ctrlLeft ||
          this.ctrlRight ||
          this.keys.has('ControlLeft') ||
          this.keys.has('ControlRight')
        );
      default:
        return false;
    }
  }

  /** @param {Action} action */
  justPressed(action) {
    switch (action) {
      case 'fire':
        return (
          this._ctrlJust ||
          this._just.has('ControlLeft') ||
          this._just.has('ControlRight')
        );
      case 'jump':
        return this._just.has('ArrowUp') || this._just.has('KeyW') || this._just.has('Space');
      default:
        return false;
    }
  }

  destroy() {
    window.removeEventListener('keydown', this._onKeyDown);
    window.removeEventListener('keyup', this._onKeyUp);
  }
}
