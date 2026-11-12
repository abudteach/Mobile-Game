import { TEAM_CSS, MAP_W, MAP_H, HALF_W, HALF_H } from './config.js';
import { t, tr } from './i18n.js';

const ICONS = {
  fire: '<svg viewBox="0 0 24 24"><path d="M12 2c3.5 4.6 6 7.6 6 11a6 6 0 1 1-12 0c0-3.4 2.5-6.400 6-11z" fill="currentColor"/></svg>',
  ability: '<svg viewBox="0 0 24 24"><path d="M13.5 2 5 13.5h5.2L9 22l9-12h-5.4z" fill="currentColor"/></svg>',
  ult: '<svg viewBox="0 0 24 24"><path d="m12 2 2.9 6.300 6.9.800-5.100 4.700 1.400 6.800L12 17.200 5.900 20.600l1.400-6.800L2.200 9.100l6.900-.8z" fill="currentColor"/></svg>',
};

// In-match DOM overlay: score bar, minimap, kill feed, announcements, floating numbers.
export class Hud {
  constructor(root, buttons) {
    this.root = root;
    this.el = document.createElement('div');
    this.el.className = 'hud';
    this.el.innerHTML = `
      <div class="top">
        <div class="score s0"><b class="k0">0</b></div>
        <div class="mid">
          <div class="timer-row"><i class="wp wp0"></i><div class="timer">3:00</div><i class="wp wp1"></i></div>
          <div class="paintbar"><div class="pb pb0"></div><div class="pb pb1"></div><span class="pct pct0">0%</span><span class="pct pct1">0%</span></div>
          <div class="structs">
            <div class="st st0"><i class="ic tower"></i><div class="sb"><div class="sf t0"></div></div><i class="ic core"></i><div class="sb"><div class="sf c0"></div></div></div>
            <div class="st st1"><div class="sb"><div class="sf c1"></div></div><i class="ic core"></i><div class="sb"><div class="sf t1"></div></div><i class="ic tower"></i></div>
          </div>
        </div>
        <div class="score s1"><b class="k1">0</b></div>
      </div>
      <canvas class="minimap" width="192" height="108"></canvas>
      <div class="level"><span class="lv">1</span><div class="xp"><div class="xpf"></div></div></div>
      <div class="feed"></div>
      <div class="announce"></div>
      <div class="respawn"></div>
      <div class="talents"></div>
      <div class="tips"></div>
      <div class="floaters"></div>
      <div class="hint">${t('controls')}</div>`;
    root.appendChild(this.el);
    const q = (s) => this.el.querySelector(s);
    this.q = q;
    this.timer = q('.timer');
    this.pb0 = q('.pb0'); this.pb1 = q('.pb1'); this.pct0 = q('.pct0'); this.pct1 = q('.pct1');
    this.k0 = q('.k0'); this.k1 = q('.k1');
    this.sf = { t0: q('.t0'), c0: q('.c0'), t1: q('.t1'), c1: q('.c1') };
    this.feedEl = q('.feed');
    this.annEl = q('.announce');
    this.respawnEl = q('.respawn');
    this.talentEl = q('.talents');
    this.wp = [q('.wp0'), q('.wp1')];
    this.tipsEl = q('.tips');
    this.floaters = q('.floaters');
    this.lv = q('.lv'); this.xpf = q('.xpf');
    this.mini = q('.minimap');
    this.mctx = this.mini.getContext('2d');
    this.floatCount = 0;
    this.buttons = buttons;
    for (const type of ['fire', 'ability', 'ult']) buttons[type].el.querySelector('.act-icon').innerHTML = ICONS[type];
    if (matchMedia('(pointer: coarse)').matches) q('.hint').remove();
    else setTimeout(() => q('.hint')?.classList.add('fade'), 9000);
  }

  setTop(cov0, cov1, left, kills, structs, wells) {
    if (wells) wells.forEach((o, i) => { this.wp[i].className = `wp wp${i} ${o < 0 ? '' : 'o' + o}`; });
    const m = Math.floor(left / 60), s = Math.floor(left % 60);
    this.timer.textContent = `${m}:${s < 10 ? '0' : ''}${s}`;
    this.timer.classList.toggle('hot', left <= 30);
    const p0 = Math.round(cov0 * 1000) / 10, p1 = Math.round(cov1 * 1000) / 10;
    // the bar shows the share of painted ground, the numbers show true arena coverage
    const sum = cov0 + cov1 || 1;
    const w0 = cov0 + cov1 > 0 ? (cov0 / sum) * 100 : 50;
    this.pb0.style.width = `${w0}%`;
    this.pb1.style.width = `${100 - w0}%`;
    this.pct0.textContent = `${p0.toFixed(1)}%`;
    this.pct1.textContent = `${p1.toFixed(1)}%`;
    this.k0.textContent = kills[0];
    this.k1.textContent = kills[1];
    for (const key in structs) this.sf[key].style.width = `${Math.max(0, structs[key]) * 100}%`;
  }

  setButtons(h) {
    const b = this.buttons;
    const ammo = Math.min(h.def.ammo, h.ammo + (h.ammo < h.def.ammo ? h.reload : 0));
    b.fire.el.style.setProperty('--p', ammo / h.def.ammo);
    b.fire.el.classList.toggle('empty', h.ammo < 1);
    b.fire.el.querySelector('.act-label').textContent = '●'.repeat(h.ammo) + '○'.repeat(h.def.ammo - h.ammo);
    const cd = h.cd / (h.cdMax || h.def.ability.cd);
    b.ability.el.style.setProperty('--p', 1 - cd);
    b.ability.el.classList.toggle('empty', h.cd > 0);
    b.ability.el.querySelector('.act-label').textContent = h.cd > 0 ? Math.ceil(h.cd) : '';
    b.ult.el.style.setProperty('--p', h.ult);
    b.ult.el.classList.toggle('empty', h.ult < 1);
    b.ult.el.classList.toggle('ready', h.ult >= 1);
    b.ult.el.querySelector('.act-label').textContent = h.ult >= 1 ? '' : `${Math.floor(h.ult * 100)}%`;
  }

  setLevel(level, frac) {
    this.lv.textContent = level;
    this.xpf.style.width = `${frac * 100}%`;
  }

  feed(html) {
    const d = document.createElement('div');
    d.className = 'feed-item';
    d.innerHTML = html;
    this.feedEl.prepend(d);
    while (this.feedEl.children.length > 4) this.feedEl.lastChild.remove();
    setTimeout(() => d.remove(), 4500);
  }

  announce(text, color = '#fff', sub = '') {
    this.annEl.innerHTML = `<div class="ann" style="--c:${color}">${text}${sub ? `<small>${sub}</small>` : ''}</div>`;
  }

  count(text) {
    this.annEl.innerHTML = `<div class="ann count">${text}</div>`;
  }

  tips(lines) {
    this.tipsEl.innerHTML = lines.map((l) => `<div>${l}</div>`).join('');
    this.tipsEl.classList.toggle('show', lines.length > 0);
  }

  // Talent choice: three cards; `onPick(i)` is called with the chosen index. Pass null to hide.
  talents(options, onPick) {
    this.talentEl.innerHTML = '';
    this.talentEl.classList.toggle('show', !!options);
    if (!options) return;
    const head = document.createElement('div');
    head.className = 'tl-head';
    head.textContent = t('talentPick');
    this.talentEl.appendChild(head);
    const row = document.createElement('div');
    row.className = 'tl-row';
    options.forEach((o, i) => {
      const b = document.createElement('button');
      b.className = 'tl-card';
      b.innerHTML = `<i>${i + 1}</i><b>${tr(o.name)}</b><span>${tr(o.text)}</span>`;
      b.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); onPick(i); });
      row.appendChild(b);
    });
    this.talentEl.appendChild(row);
  }

  respawn(sec) {
    this.respawnEl.textContent = sec > 0 ? `${t('respawn')} ${Math.ceil(sec)}` : '';
    this.respawnEl.classList.toggle('show', sec > 0);
  }

  floater(x, y, text, cls = '') {
    if (this.floatCount > 26) return;
    const d = document.createElement('div');
    d.className = `floater ${cls}`;
    d.textContent = text;
    d.style.left = `${x + (Math.random() - 0.5) * 30}px`;
    d.style.top = `${y}px`;
    this.floaters.appendChild(d);
    this.floatCount++;
    setTimeout(() => { d.remove(); this.floatCount--; }, 800);
  }

  minimap(paintCanvas, units, player, wells = []) {
    const c = this.mctx, W = this.mini.width, H = this.mini.height;
    c.drawImage(paintCanvas, 0, 0, W, H);
    const sx = W / MAP_W, sz = H / MAP_H;
    for (const w of wells) {
      c.strokeStyle = w.owner < 0 ? '#ffffff' : TEAM_CSS[w.owner];
      c.lineWidth = 2.5;
      c.beginPath(); c.arc((w.x + HALF_W) * sx, (w.z + HALF_H) * sz, w.r * sx, 0, Math.PI * 2); c.stroke();
    }
    for (const u of units) {
      if (!u.alive) continue;
      const x = (u.x + HALF_W) * sx, y = (u.z + HALF_H) * sz;
      c.fillStyle = TEAM_CSS[u.team];
      c.strokeStyle = u === player ? '#fff' : '#17132f';
      c.lineWidth = u === player ? 2.5 : 1.5;
      c.beginPath();
      if (u.kind === 'hero') c.arc(x, y, u === player ? 5 : 4, 0, Math.PI * 2);
      else if (u.kind === 'minion') c.arc(x, y, 1.6, 0, Math.PI * 2);
      else c.rect(x - 4, y - 4, 8, 8);
      c.fill();
      if (u.kind !== 'minion') c.stroke();
    }
  }

  dispose() { this.el.remove(); }
}
