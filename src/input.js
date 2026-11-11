// Unified input: touch (virtual stick + aim buttons) and desktop (WASD + mouse).
// Screen right = world +x, screen down = world +z (the camera looks "north").
const DEAD = 0.28;

export class Input {
  constructor(root) {
    this.root = root;
    this.move = { x: 0, z: 0 };
    this.actions = []; // {type:'fire'|'ability'|'ult', aimed, dx, dz, mag}
    this.aiming = null; // {type, dx, dz, mag} while an aim button is dragged
    this.keys = new Set();
    this.mouse = { x: 0, y: 0, down: false, seen: false };
    this.enabled = false;
    this.stickId = null;
    this.stick = { ox: 0, oy: 0 };
    this.listeners = [];
    this.build();
  }

  on(target, type, fn, opts) {
    target.addEventListener(type, fn, opts);
    this.listeners.push(() => target.removeEventListener(type, fn, opts));
  }

  build() {
    const el = (cls, parent = this.root) => { const d = document.createElement('div'); d.className = cls; parent.appendChild(d); return d; };
    this.zone = el('touch-zone');
    this.base = el('stick-base');
    this.knob = el('stick-knob', this.base);
    this.buttons = {};
    for (const type of ['fire', 'ability', 'ult']) {
      const b = el(`act-btn act-${type}`);
      b.innerHTML = '<div class="act-fill"></div><div class="act-icon"></div><div class="act-knob"></div><div class="act-label"></div>';
      this.buttons[type] = { el: b, id: null, vx: 0, vy: 0, knob: b.querySelector('.act-knob') };
      this.bindButton(type);
    }

    // movement stick (touch) / mouse fire (desktop) on the play field
    this.on(this.zone, 'pointerdown', (e) => {
      if (!this.enabled) return;
      if (e.pointerType === 'mouse') {
        this.mouse.seen = true;
        this.mouse.x = e.clientX; this.mouse.y = e.clientY;
        if (e.button === 0) this.mouse.down = true;
        if (e.button === 2) this.actions.push({ type: 'ability', aimed: false, mouse: true });
        return;
      }
      if (this.stickId !== null || e.clientX > window.innerWidth * 0.55) return;
      this.stickId = e.pointerId;
      this.zone.setPointerCapture(e.pointerId);
      this.stick.ox = e.clientX; this.stick.oy = e.clientY;
      this.base.style.left = `${e.clientX}px`;
      this.base.style.top = `${e.clientY}px`;
      this.base.classList.add('on');
      this.setStick(0, 0);
    });
    this.on(this.zone, 'pointermove', (e) => {
      if (e.pointerType === 'mouse') { this.mouse.seen = true; this.mouse.x = e.clientX; this.mouse.y = e.clientY; return; }
      if (e.pointerId !== this.stickId) return;
      const R = this.base.offsetWidth * 0.5 || 60;
      let vx = (e.clientX - this.stick.ox) / R, vy = (e.clientY - this.stick.oy) / R;
      const m = Math.hypot(vx, vy);
      if (m > 1) { vx /= m; vy /= m; }
      this.setStick(vx, vy);
    });
    const end = (e) => {
      if (e.pointerType === 'mouse') { this.mouse.down = false; return; }
      if (e.pointerId !== this.stickId) return;
      this.stickId = null;
      this.base.classList.remove('on');
      this.base.style.left = this.base.style.top = '';
      this.setStick(0, 0);
    };
    this.on(this.zone, 'pointerup', end);
    this.on(this.zone, 'pointercancel', end);
    this.on(this.zone, 'contextmenu', (e) => e.preventDefault());

    this.on(window, 'keydown', (e) => {
      if (!this.enabled || e.repeat) return;
      const k = e.key.toLowerCase();
      this.keys.add(k);
      if (k === ' ' || k === 'q') { this.actions.push({ type: 'ability', aimed: false, mouse: true }); e.preventDefault(); }
      if (k === 'e' || k === 'r' || k === 'f') this.actions.push({ type: 'ult', aimed: false, mouse: true });
    });
    this.on(window, 'keyup', (e) => this.keys.delete(e.key.toLowerCase()));
    this.on(window, 'blur', () => { this.keys.clear(); this.mouse.down = false; });
  }

  setStick(vx, vy) {
    this.touchMove = { x: vx, z: vy };
    this.knob.style.transform = `translate(${vx * 42}%, ${vy * 42}%)`;
  }

  bindButton(type) {
    const b = this.buttons[type];
    this.on(b.el, 'pointerdown', (e) => {
      if (!this.enabled || b.id !== null) return;
      e.preventDefault();
      e.stopPropagation();
      b.id = e.pointerId;
      b.el.setPointerCapture(e.pointerId);
      const rect = b.el.getBoundingClientRect();
      b.cx = rect.left + rect.width / 2; b.cy = rect.top + rect.height / 2; b.R = rect.width * 0.62;
      b.vx = b.vy = 0;
      b.el.classList.add('held');
    });
    this.on(b.el, 'pointermove', (e) => {
      if (e.pointerId !== b.id) return;
      let vx = (e.clientX - b.cx) / b.R, vy = (e.clientY - b.cy) / b.R;
      const m = Math.hypot(vx, vy);
      if (m > 1) { vx /= m; vy /= m; }
      b.vx = vx; b.vy = vy;
      b.knob.style.transform = `translate(${vx * 55}%, ${vy * 55}%)`;
      const mag = Math.min(1, m);
      this.aiming = mag > DEAD ? { type, dx: vx / mag, dz: vy / mag, mag: (mag - DEAD) / (1 - DEAD) } : null;
    });
    const release = (e, cancelled) => {
      if (e.pointerId !== b.id) return;
      b.id = null;
      b.el.classList.remove('held');
      b.knob.style.transform = '';
      const m = Math.hypot(b.vx, b.vy);
      if (!cancelled) {
        if (m > DEAD) this.actions.push({ type, aimed: true, dx: b.vx / m, dz: b.vy / m, mag: (Math.min(1, m) - DEAD) / (1 - DEAD) });
        else this.actions.push({ type, aimed: false });
      }
      if (this.aiming && this.aiming.type === type) this.aiming = null;
    };
    this.on(b.el, 'pointerup', (e) => release(e, false));
    this.on(b.el, 'pointercancel', (e) => release(e, true));
    this.on(b.el, 'contextmenu', (e) => e.preventDefault());
  }

  // Called once per frame by the match.
  poll() {
    let x = 0, z = 0;
    const k = this.keys;
    if (k.has('a') || k.has('arrowleft')) x -= 1;
    if (k.has('d') || k.has('arrowright')) x += 1;
    if (k.has('w') || k.has('arrowup')) z -= 1;
    if (k.has('s') || k.has('arrowdown')) z += 1;
    if (x || z) { const l = Math.hypot(x, z); x /= l; z /= l; } else if (this.touchMove) { x = this.touchMove.x; z = this.touchMove.z; }
    this.move.x = x; this.move.z = z;
    const actions = this.actions;
    this.actions = [];
    return actions;
  }

  setEnabled(on) {
    this.enabled = on;
    if (!on) { this.keys.clear(); this.mouse.down = false; this.aiming = null; this.actions.length = 0; this.touchMove = null; }
  }

  dispose() {
    for (const off of this.listeners) off();
    for (const n of [this.zone, this.base, ...Object.values(this.buttons).map((b) => b.el)]) n.remove();
  }
}
