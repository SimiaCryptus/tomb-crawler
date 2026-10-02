import { DEVICE_TYPES } from '../items/Inventory.js';
import { distance } from '../hex/Hex.js';

const CIRC = 2 * Math.PI * 16;
const $ = (id) => document.getElementById(id);

export class Hud {
  constructor(game) {
    this.game = game;
    this.root = $('hud');
    this.scoreEl = $('score');
    this.multEl = $('mult');
    this.multRing = $('mult-ring');
    this.multText = $('mult-text');
    this.livesEl = $('lives');
    this.distEl = $('distance');
    this.floaters = $('floaters');
    this.hurtEl = $('hurt-flash');
    this.slots = [...document.querySelectorAll('#inventory .slot')];
    this.fpLeft = $('fp-left');
    this.fpRight = $('fp-right');
    this.cache = {};

    this.multRing.style.strokeDasharray = String(CIRC);
    this.slots.forEach((b, i) => b.addEventListener('click', () => { b.blur(); game.selectSlot(i); }));
    const deploy = $('deploy-btn');
    deploy.addEventListener('click', () => { deploy.blur(); game.deploy(); });
    const pause = $('pause-btn');
    pause.addEventListener('click', () => { pause.blur(); game.togglePause(); });

    // First-person left/right turn controls.
    const turn = (el, d) => el.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      el.blur();
      game.turnRelative(d);
    });
    turn(this.fpLeft, -1);
    turn(this.fpRight, 1);
  }

  show(v) { this.root.classList.toggle('hidden', !v); }

  _set(name, value, fn) {
    if (this.cache[name] === value) return;
    this.cache[name] = value;
    fn(value);
  }

  update() {
    const g = this.game;
    if (!g.player) return;
    this._set('score', g.score, (v) => { this.scoreEl.textContent = String(v); });
    this._set('lives', g.player.lives, (v) => { this.livesEl.textContent = '☥'.repeat(Math.max(0, v)); });
    const [q, r] = g.player.logicalCell();
    this._set('dist', distance(q, r, 0, 0), (v) => { this.distEl.textContent = 'Depth ' + v; });

    const m = g.effects.mult;
    const cur = m.current;
    this._set('multOn', cur > 1, (v) => this.multEl.classList.toggle('hidden', !v));
    if (cur > 1) {
      this._set('multVal', cur, (v) => {
        this.multText.textContent = '×' + v;
        this.multEl.classList.toggle('x3', v >= 3);
      });
      this.multRing.style.strokeDashoffset = String(CIRC * (1 - m.fraction));
    }

    // Queued first-person turn indicator.
    let side = 0;
    const p = g.player;
    if (g.firstPerson && p.buffered >= 0) {
      const d = (p.buffered - p.facing + 6) % 6;
      side = d === 1 || d === 2 ? 1 : d === 4 || d === 5 ? -1 : 0;
    }
    this._set('fpQueued', side, (v) => {
      this.fpLeft.classList.toggle('queued', v < 0);
      this.fpRight.classList.toggle('queued', v > 0);
    });

    const inv = g.inventory;
    DEVICE_TYPES.forEach((t, i) => {
      const n = inv.counts[t];
      const sel = inv.selected === i;
      this._set('slot' + i, n + '|' + sel, () => {
        const s = this.slots[i];
        s.querySelector('.count').textContent = String(n);
        s.classList.toggle('selected', sel);
        s.classList.toggle('empty', n <= 0);
      });
    });
  }

  floater(text, x, z, cls) {
    if (this.root.classList.contains('hidden')) return;
    const p = this.game.renderer.project(x, 1.2, z);
    if (!p) return;
    const el = document.createElement('div');
    el.className = 'floater ' + cls;
    el.textContent = text;
    el.style.left = p.x + 'px';
    el.style.top = p.y + 'px';
    this.floaters.appendChild(el);
    setTimeout(() => el.remove(), 950);
  }

  hurt() {
    this.hurtEl.classList.add('on');
    setTimeout(() => this.hurtEl.classList.remove('on'), 60);
  }
}