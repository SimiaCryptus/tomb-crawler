import { listGenerators } from '../world/gen/registry.js';

const $ = (id) => document.getElementById(id);

const FORMAT = {
  volume: (v) => Math.round(v * 100) + '%',
  tilt: (v) => v + '°',
  fov: (v) => v + '°',
  fpFov: (v) => v + '°',
  distance: (v) => String(v),
  wallHeight: (v) => Number(v).toFixed(1),
  fog: (v) => '×' + Number(v).toFixed(2),
};

export class Screens {
  constructor(game) {
    this.game = game;
    this.els = {
      title: $('screen-title'),
      pause: $('screen-pause'),
      gameover: $('screen-gameover'),
      settings: $('screen-settings'),
    };
    document.querySelectorAll('[data-action]').forEach((b) => {
      b.addEventListener('click', () => { b.blur(); game.action(b.dataset.action); });
    });

    // Generator options come from the registry, so new generators show up automatically.
    const gen = $('set-generator');
    if (gen) {
      for (const g of listGenerators()) {
        const o = document.createElement('option');
        o.value = g.id;
        o.textContent = g.name;
        o.title = g.description || '';
        gen.appendChild(o);
      }
      const r = document.createElement('option');
      r.value = 'random';
      r.textContent = 'Random each run';
      gen.appendChild(r);
    }

    // Every [data-setting] control maps directly onto a settings key.
    this.inputs = [...document.querySelectorAll('[data-setting]')];
    for (const el of this.inputs) {
      const name = el.dataset.setting;
      const evt = el.tagName === 'SELECT' ? 'change' : 'input';
      el.addEventListener(evt, () => {
        const v = el.type === 'range' ? Number(el.value) : el.value;
        this._label(name, v);
        game.applySettings({ [name]: v });
      });
    }
  }

  _label(name, v) {
    const el = document.querySelector(`[data-val="${name}"]`);
    if (el) el.textContent = FORMAT[name] ? FORMAT[name](v) : String(v);
  }

  show(name) {
    for (const [k, el] of Object.entries(this.els)) el.classList.toggle('hidden', k !== name);
  }

  fillTitle(store) {
    $('title-best').textContent = String(store.best || 0);
    $('title-dist').textContent = String(store.bestDist || 0);
  }

  fillGameOver(d) {
    $('go-score').textContent = String(d.score);
    $('go-best').textContent = String(d.best);
    $('go-dist').textContent = String(d.dist);
    $('go-bonus').textContent = String(d.bonus);
    $('go-coins').textContent = String(d.coins);
    $('go-wasted').textContent = String(d.wasted);
    $('go-kills').textContent = String(d.kills);
    $('go-layout').textContent = d.layout || '';
    $('go-newbest').classList.toggle('hidden', !d.newBest);
  }

  fillSettings(s) {
    for (const el of this.inputs) {
      const name = el.dataset.setting;
      if (s[name] === undefined) continue;
      el.value = String(s[name]);
      this._label(name, el.type === 'range' ? Number(el.value) : el.value);
    }
  }
}