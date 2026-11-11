// The game always runs in landscape. If a phone is held upright (and the OS or host app
// does not rotate for us), the whole stage is turned 90° with CSS so you can simply hold
// the phone sideways. `view` is the size of the stage in its own (landscape) coordinates.
export const view = { w: window.innerWidth, h: window.innerHeight, rot: false };
const coarse = window.matchMedia('(pointer: coarse)');

export function updateView() {
  const W = window.innerWidth, H = window.innerHeight;
  view.rot = coarse.matches && H > W;
  view.w = view.rot ? H : W;
  view.h = view.rot ? W : H;
  const root = document.documentElement;
  root.classList.toggle('rot', view.rot);
  // CSS sizes use these instead of vw/vh so they follow the stage, not the screen
  root.style.setProperty('--vw', `${view.w / 100}px`);
  root.style.setProperty('--vh', `${view.h / 100}px`);
  document.body.classList.toggle('short', view.h < 520);
}

// Screen (client) coordinates -> stage coordinates.
export function toView(cx, cy) {
  return view.rot ? { x: cy, y: window.innerWidth - cx } : { x: cx, y: cy };
}
