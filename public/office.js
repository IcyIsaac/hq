// Pixel-art office, drawn procedurally at 16px tiles and scaled up crisply.
//
// Floor plan (tiles):  lead office (glass wall) | open-plan cubicles | kitchen
//                      meeting area             |                    | lounge
const T = 16, W = 36, H = 22; // tile size, office size in tiles

const C = {
  grass: '#5fae4a', grass2: '#6dbb53', grassDark: '#4c9a3c',
  trunk: '#6b4226', leaf: '#3f8f3a', leafHi: '#5cb04e', leafDark: '#2f6e2b',
  cap: '#4a3428', capHi: '#6b4b3a', trim: '#8b5a34',
  wallMain: '#dfe5ee', wallMainStripe: '#d2d9e4', wallLead: '#eadcc0', wallLeadStripe: '#ddcaa5',
  floorA: '#c98a4b', floorB: '#bf7f41', floorLine: '#a96c35',
  carpetA: '#a5afbf', carpetB: '#9da7b8', carpetLine: '#909aac',
  tileA: '#efe9da', tileB: '#dcd4c1',
  rug: '#8f3b3b', rugEdge: '#c9a24a', rug2: '#4b5f9e', rug2Edge: '#d9cfb0', rug3: '#3f7a6a', rug3Edge: '#e6d9a8',
  deskTop: '#e0b884', deskEdge: '#a8743f', execTop: '#9b6337', execEdge: '#6a3f1f',
  panelCap: '#d8dee8', panelFace: '#56688a', panelShade: '#3f4d68', cork: '#c9965a',
  chair: '#3b3f58', chairHi: '#555a7c', leather: '#6b2f2f', leatherHi: '#8a4040',
  monitor: '#2a2d3a', screenOff: '#1d2230', screenOn: '#59d38c', screenBlock: '#ff6b6b', screenReview: '#ffd166', screenPlan: '#6bb6ff',
  board: '#f7f3e8', boardEdge: '#7b8796',
  note: { todo: '#ffe08a', working: '#8ad3ff', review: '#ffb3d1', merged: '#9be29b', closed: '#cfcfcf' },
  pot: '#b0562e', couch: '#4f7cac', couchHi: '#6b97c7', couchDark: '#3a5f88', metal: '#9aa3ad', water: '#7cc7ff',
  glass: 'rgba(170, 220, 255, .38)', glassFrame: '#6b7a8c',
  shadow: 'rgba(0,0,0,.18)',
};
const SKIN = ['#f6d3b3', '#e8b48a', '#c98e62', '#9b6a43', '#6e4a2e'];
const HAIR = ['#2b1d14', '#5a3a22', '#b5652d', '#e3c16f', '#7a7a7a', '#d65f8a', '#3a4fa8'];
const SHIRT = ['#e85d5d', '#4f9de8', '#5cc48d', '#f2b134', '#9a6be8', '#e87fb6', '#3fc1c9', '#f08a3c'];
const PANTS = ['#2f3a5a', '#3b3b3b', '#5a4632', '#2e5a4a'];

// ---- floor plan --------------------------------------------------------------
const MAIN = { x0: 10.5, x1: 26.9 }; // open-plan floor between the lead office and the kitchen
const LEAD_DESK = { x: 4, y: 6.1, seat: { x: 5.75, y: 8.3 } };
const CUBE = { w: 3.5, h: 4, gap: 0.4, perRow: 4, rows: [7.1, 13.3] };

// One cubicle per worker, centred in rows of four.
function cubicles(n) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const row = Math.floor(i / CUBE.perRow), inRow = Math.min(CUBE.perRow, n - row * CUBE.perRow), col = i % CUBE.perRow;
    const rowW = inRow * CUBE.w + (inRow - 1) * CUBE.gap;
    const x = MAIN.x0 + (MAIN.x1 - MAIN.x0 - rowW) / 2 + col * (CUBE.w + CUBE.gap);
    const y = CUBE.rows[row] ?? CUBE.rows[0];
    out.push({ x, y, seat: { x: x + 1.75, y: y + 2.75 }, i });
  }
  return out;
}

const SPOTS = {
  board: { x: 15.1, y: 6 }, prs: { x: 22.8, y: 6 }, coffee: { x: 28.6, y: 6.9 }, cooler: { x: 31.95, y: 6.9 },
  couch: [{ x: 29.5, y: 18 }, { x: 30.6, y: 18 }, { x: 31.7, y: 18 }],
  meeting: [{ x: 4.6, y: 14.2 }, { x: 6, y: 14.2 }, { x: 7.4, y: 14.2 }, { x: 4.6, y: 17.3 }, { x: 6, y: 17.3 }, { x: 7.4, y: 17.3 }],
};

// Furniture and walls agents can't walk through (tile rects: x, y, w, h).
const SOLID = [
  [9.9, 5, 0.6, 3.5], [9.9, 10.5, 0.6, 1.6], // lead office glass wall (door between)
  [2, 10.9, 8.5, 1.2], // lead office south wall
  [26.9, 5, 0.6, 4.6], // kitchen divider
  [27.5, 5, 4, 1.3], [31.5, 5, 0.9, 1.3], [32.5, 5, 1.2, 1.5], // counter, cooler, fridge
  [29.7, 8.3, 1.7, 1.3], // kitchen table
  [29.2, 12, 2.6, 1.3], // TV stand
  [28.4, 18.4, 4.2, 1.3], [28.4, 17.3, 0.5, 1.4], [32.1, 17.3, 0.5, 1.4], // couch back & arms
  [3.7, 14.6, 4.6, 1.9], // meeting table
  [3.8, 5.6, 3.6, 1.8], // lead desk
  [25.6, 18.3, 1.1, 1.3], // printer
  [8.7, 5, 1, 1], [9.1, 18.6, 0.8, 1], [10.6, 18.6, 0.8, 1], [32.9, 12.3, 0.8, 1], [26, 5, 0.8, 0.9], // plants
];
const CUBE_SOLID = [[0, 0, 3.5, 1.75], [2.55, 1.75, 0.95, 0.85], [0, 0, 0.3, 3.2], [3.2, 0, 0.3, 3.2]];

// Clickable things in the office (tile rects). `spot` = somewhere an idle agent can be sent.
const HOTSPOTS = [
  { id: 'board', label: 'Task board', hint: 'click to open', x: 11.4, y: 2.15, w: 7.4, h: 2.6 },
  { id: 'prs', label: 'Pull requests', hint: 'click to list PRs', x: 20.1, y: 2.15, w: 5.4, h: 2.6 },
  { id: 'coffee', label: 'Coffee machine', hint: 'send someone for coffee', x: 27.8, y: 3.8, w: 1.6, h: 2.4, spot: 'coffee' },
  { id: 'cooler', label: 'Water cooler', hint: 'send someone for a chat', x: 31.4, y: 3.6, w: 1.1, h: 2.8, spot: 'cooler' },
  { id: 'couch', label: 'Couch', hint: 'send someone on a break', x: 28.4, y: 17.2, w: 4.2, h: 2.2, spot: 'couch' },
  { id: 'meeting', label: 'Meeting table', hint: 'send someone to a meeting', x: 3.7, y: 14.4, w: 4.6, h: 2.2, spot: 'meeting' },
  { id: 'books', label: 'Bookshelf', hint: 'project info', x: 2.5, y: 2.3, w: 2.2, h: 2.8 },
  { id: 'tv', label: 'TV', hint: 'CI dashboard', x: 29.2, y: 11.4, w: 2.6, h: 2 },
  { id: 'fridge', label: 'Fridge', hint: 'snacks', x: 32.5, y: 3.4, w: 1.2, h: 3 },
];
const QUIPS = {
  coffee: ['☕ Refuel time.', 'Espresso. Double.', 'Coffee makes the tests pass.', 'Who left the pot empty?'],
  cooler: ['Anyone seen the staging logs?', '💧 Hydrating.', 'Who broke main? 👀', 'Hot take: tabs.'],
  couch: ['Five-minute break…', 'Thinking about types.', 'zZz', 'Rubber-ducking on the couch.'],
  meeting: ['Quick sync?', 'This could have been a PR comment.', 'Let’s whiteboard it.', 'Who’s taking notes?'],
};
const FX = { coffee: '☕', cooler: '💧', couch: '💤', books: '📚', board: '📌', prs: '🔀', meeting: '🗓️', tv: '📺', fridge: '🧃' };
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const rng = (seed) => () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);

// ---- walkable grid & A* (half-tile cells) ------------------------------------
const G = 2, GW = W * G, GH = H * G;

function buildGrid(cubes) {
  const grid = new Uint8Array(GW * GH).fill(1);
  const mark = ([x, y, w, h], v) => {
    for (let gy = Math.max(0, Math.floor(y * G)); gy < Math.min(GH, Math.ceil((y + h) * G)); gy++)
      for (let gx = Math.max(0, Math.floor(x * G)); gx < Math.min(GW, Math.ceil((x + w) * G)); gx++) grid[gy * GW + gx] = v;
  };
  mark([2.5, 5.5, 31, 14], 0); // interior floor
  for (const r of SOLID) mark(r, 1);
  for (const c of cubes) for (const [x, y, w, h] of CUBE_SOLID) mark([c.x + x, c.y + y, w, h], 1);
  return grid;
}

function nearestOpen(grid, gx, gy) {
  gx = Math.min(GW - 1, Math.max(0, gx)); gy = Math.min(GH - 1, Math.max(0, gy));
  if (!grid[gy * GW + gx]) return [gx, gy];
  for (let r = 1; r < 12; r++)
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
      const x = gx + dx, y = gy + dy;
      if (x >= 0 && y >= 0 && x < GW && y < GH && !grid[y * GW + x]) return [x, y];
    }
  return [gx, gy];
}

function findPath(grid, from, to) {
  const [sx, sy] = nearestOpen(grid, Math.floor(from.x * G), Math.floor(from.y * G));
  const [tx, ty] = nearestOpen(grid, Math.floor(to.x * G), Math.floor(to.y * G));
  const start = sy * GW + sx, goal = ty * GW + tx;
  const cost = new Float32Array(GW * GH).fill(Infinity), prev = new Int32Array(GW * GH).fill(-1);
  const heap = [[0, start]];
  cost[start] = 0;
  const push = (item) => { heap.push(item); let i = heap.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (heap[p][0] <= item[0]) break; heap[i] = heap[p]; i = p; } heap[i] = item; };
  const pop = () => {
    const top = heap[0], last = heap.pop();
    if (heap.length) { let i = 0; for (;;) { const l = 2 * i + 1, r = l + 1; let m = i; if (l < heap.length && heap[l][0] < (m === i ? last[0] : heap[m][0])) m = l; if (r < heap.length && heap[r][0] < (m === i ? last[0] : heap[m][0])) m = r; if (m === i) break; heap[i] = heap[m]; i = m; } heap[i] = last; }
    return top;
  };
  while (heap.length) {
    const [, cur] = pop();
    if (cur === goal) break;
    const cx = cur % GW, cy = (cur / GW) | 0;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = cx + dx, ny = cy + dy;
      if (nx < 0 || ny < 0 || nx >= GW || ny >= GH) continue;
      const n = ny * GW + nx;
      if (grid[n] || cost[cur] + 1 >= cost[n]) continue;
      cost[n] = cost[cur] + 1; prev[n] = cur;
      push([cost[n] + Math.abs(nx - tx) + Math.abs(ny - ty), n]);
    }
  }
  if (start !== goal && prev[goal] < 0) return [to];
  const cells = [];
  for (let c = goal; c !== -1; c = prev[c]) cells.unshift(c);
  // keep only corners
  const pts = [];
  for (let i = 1; i < cells.length; i++) {
    const a = cells[i - 1], b = cells[i], c = cells[i + 1];
    if (c === undefined || b - a !== c - b) pts.push({ x: (b % GW + 0.5) / G, y: (((b / GW) | 0) + 0.5) / G });
  }
  const exact = !grid[Math.floor(to.y * G) * GW + Math.floor(to.x * G)];
  if (exact) { if (pts.length) pts[pts.length - 1] = { x: to.x, y: to.y }; else pts.push({ x: to.x, y: to.y }); }
  if (pts.length > 1) { // step onto the grid along the first axis we'll travel
    const p0 = pts[0];
    pts.unshift(Math.abs(p0.x - from.x) < Math.abs(p0.y - from.y) ? { x: p0.x, y: from.y } : { x: from.x, y: p0.y });
  }
  return pts;
}

export class Office {
  constructor(canvas, handlers = {}) {
    this.c = canvas;
    this.h = handlers;
    this.layer = handlers.layer;
    this.ctx = canvas.getContext('2d');
    this.buf = Object.assign(document.createElement('canvas'), { width: W * T, height: H * T });
    this.b = this.buf.getContext('2d');
    this.bg = this.renderStatic();
    this.grass = this.ctx.createPattern(this.renderGrass(), 'repeat');
    this.treeSprite = this.renderTree();
    this.outerTrees = this.scatterTrees();
    this.setCubicles(0);
    this.insets = { l: 0, r: 0, t: 0, b: 0 };
    this.resize();
    addEventListener('resize', () => this.resize());
    this.sprites = new Map();
    this.bubbles = new Map();
    this.fx = [];
    this.hover = null;
    this.state = null; this.selected = null; this.t = 0;
    canvas.addEventListener('click', (e) => this.click(e));
    canvas.addEventListener('mousemove', (e) => this.move(e));
    canvas.addEventListener('mouseleave', () => this.setHover(null));
    // Keep animating even if one frame throws.
    const loop = (ts) => { requestAnimationFrame(loop); try { this.frame(ts); } catch (e) { if (!this.failed) console.error((this.failed = e)); } };
    requestAnimationFrame(loop);
  }

  setCubicles(n) {
    this.cubes = cubicles(n);
    this.grid = buildGrid(this.cubes);
  }

  // The office fills the screen; the building is centred in the area the floating windows leave free.
  setInsets(insets) { this.insets = insets; this.resize(); }

  resize() {
    const dpr = devicePixelRatio || 1, vw = this.c.clientWidth, vh = this.c.clientHeight;
    this.c.width = Math.round(vw * dpr); this.c.height = Math.round(vh * dpr);
    const { l, r, t, b } = this.insets;
    const fw = Math.max(vw - l - r, 1), fh = Math.max(vh - t - b, 1);
    const s = Math.min(fw / (W * T), fh / (H * T));
    this.view = {
      dpr, s: s * dpr,
      ox: Math.round((l + (fw - W * T * s) / 2) * dpr), oy: Math.round((t + (fh - H * T * s) / 2) * dpr),
    };
  }

  scatterTrees() {
    const r = rng(42), out = [];
    for (let i = 0; i < 260; i++) {
      const x = -40 + r() * (W + 80), y = -30 + r() * (H + 60);
      if (x > -1.5 && x < W + 0.5 && y > -1.5 && y < H + 0.5) continue;
      out.push({ x: Math.floor(x), y: Math.floor(y), flower: r() < 0.3 });
    }
    return out.sort((a, b) => a.y - b.y);
  }

  renderGrass() {
    const cv = Object.assign(document.createElement('canvas'), { width: 4 * T, height: 4 * T });
    const g = cv.getContext('2d'), r = rng(3);
    for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) {
      g.fillStyle = (x + y) % 2 ? C.grass : C.grass2; g.fillRect(x * T, y * T, T, T);
      g.fillStyle = C.grassDark;
      for (let k = 0; k < 3; k++) g.fillRect(x * T + Math.floor(r() * 15), y * T + Math.floor(r() * 14), 1, 2);
    }
    return cv;
  }

  renderTree() {
    const cv = Object.assign(document.createElement('canvas'), { width: 20, height: 26 });
    this.tree(cv.getContext('2d'), 2, 1);
    return cv;
  }

  // ---- coordinates & input ---------------------------------------------------
  toWorld(e) {
    const { dpr, s, ox, oy } = this.view;
    return { x: (e.clientX * dpr - ox) / s / T, y: (e.clientY * dpr - oy) / s / T };
  }

  // CSS-pixel position of a world point (in tiles).
  toScreen(x, y) {
    const { dpr, s, ox, oy } = this.view;
    return { x: (ox + x * T * s) / dpr, y: (oy + y * T * s) / dpr };
  }

  agentScreen(id, above = 1.3) {
    const sp = this.sprites.get(id);
    return sp && this.toScreen(sp.x, sp.y - above);
  }

  pick(e) {
    const p = this.toWorld(e);
    for (const sp of [...this.sprites.values()].sort((a, b) => b.y - a.y))
      if (Math.abs(p.x - sp.x) < 0.5 && p.y > sp.y - 1.2 && p.y < sp.y + 0.2) return { type: 'agent', id: sp.id, p };
    for (const sp of this.sprites.values()) {
      const d = sp.station;
      if (d && p.x > d.x && p.x < d.x + (d.lead ? 3.6 : CUBE.w) && p.y > d.y - 0.8 && p.y < d.seat.y + 0.3) return { type: 'agent', id: sp.id, p };
    }
    const pad = 0.35; // forgiving hit area, objects are small on phones
    const spot = HOTSPOTS.find((z) => p.x > z.x - pad && p.x < z.x + z.w + pad && p.y > z.y - pad && p.y < z.y + z.h + pad);
    if (spot) return { type: 'spot', id: spot.id, spot, p };
    if (p.x > 2.4 && p.x < 33.6 && p.y > 5.2 && p.y < 19.6) return { type: 'floor', p };
    return { type: 'none', p };
  }

  canWalk() {
    const sp = this.sprites.get(this.selected);
    return sp?.agent.status === 'idle';
  }

  move(e) {
    const hit = this.pick(e);
    const live = hit.type === 'agent' || hit.type === 'spot' || (hit.type === 'floor' && this.canWalk());
    this.c.style.cursor = live ? 'pointer' : 'default';
    this.setHover(hit.type === 'agent' || hit.type === 'spot' ? hit : null, e);
  }

  setHover(hit, e) {
    this.hover = hit;
    this.h.onHover?.(hit, e);
  }

  click(e) {
    const hit = this.pick(e);
    if (hit.type === 'agent') return this.h.onAgent?.(hit.id, e);
    if (hit.type === 'spot') {
      const sp = this.sprites.get(this.selected);
      if (hit.spot.spot && sp?.agent.status === 'idle') this.sendTo(sp, hit.spot.spot);
      else this.burst(hit.p.x, hit.p.y, FX[hit.id]);
      return this.h.onSpot?.(hit.id, e);
    }
    if (hit.type === 'floor' && this.canWalk()) {
      const sp = this.sprites.get(this.selected);
      sp.manual = { x: hit.p.x, y: hit.p.y, until: performance.now() + 20000 };
      this.fx.push({ x: hit.p.x, y: hit.p.y, mark: true, t0: this.t });
      return;
    }
    this.h.onEmpty?.(e);
  }

  spot(name, i) {
    const s = SPOTS[name];
    return Array.isArray(s) ? s[i % s.length] : s;
  }

  sendTo(sp, name) {
    sp.manual = { ...this.spot(name, sp.idx), until: performance.now() + 20000, quip: name };
  }

  burst(x, y, text) { if (text) this.fx.push({ x, y, text, t0: this.t }); }

  // Speech bubble over an agent's head. With `to`, the speaker walks over to that teammate.
  say(id, text, { to, kind = 'say' } = {}) {
    const sp = this.sprites.get(id);
    if (!sp || !this.layer) return;
    const mate = to && this.sprites.get(to);
    if (mate) sp.visit = { id: to, until: performance.now() + 7000 };
    this.bubbles.get(id)?.el.remove();
    const el = document.createElement('div');
    el.className = `say ${kind}`;
    const head = kind === 'incoming' ? '📨 From you' : kind === 'ask' ? '❗ Needs you' : mate ? `@${mate.agent.name}` : '';
    if (head) el.append(Object.assign(document.createElement('span'), { className: 'to', textContent: head }));
    el.append(text.length > 140 ? text.slice(0, 137) + '…' : text);
    this.layer.append(el);
    this.bubbles.set(id, { el, until: performance.now() + Math.min(9000, 3200 + text.length * 45) });
  }

  // ---- agents ----------------------------------------------------------------
  update(state, selected) {
    this.state = state; this.selected = selected;
    const workers = state.agents.filter((a) => a.role === 'worker');
    if (workers.length !== this.cubes.length) this.setCubicles(workers.length);
    const ids = new Set(state.agents.map((a) => a.id));
    for (const id of this.sprites.keys()) if (!ids.has(id)) this.sprites.delete(id);
    state.agents.forEach((a, i) => {
      const station = a.role === 'lead' ? { ...LEAD_DESK, lead: true } : this.cubes[workers.indexOf(a)];
      let s = this.sprites.get(a.id);
      if (!s) {
        // Appear where they'd be, so a reload doesn't pile everyone at the door.
        s = { id: a.id, path: [], wanderAt: 0, station, idx: i, agent: a };
        const g = this.targetFor(a, s);
        Object.assign(s, { x: g.x, y: g.y, goal: g, arrived: g });
        this.sprites.set(a.id, s);
      }
      s.agent = a; s.station = station; s.idx = i;
    });
  }

  targetFor(a, s) {
    const now = performance.now();
    const seat = s.station.seat;
    const mate = s.visit && now < s.visit.until && this.sprites.get(s.visit.id);
    if (mate) return { x: mate.station.seat.x + (mate.station.lead ? 1.2 : -0.9), y: mate.station.seat.y };
    if (a.status === 'planning') return SPOTS.board;
    if (a.status === 'reviewing') return SPOTS.prs;
    if (a.status === 'working' || a.status === 'blocked') return seat;
    if (s.manual && now < s.manual.until) return s.manual;
    if (a.role === 'lead') return seat;
    if (s.idleSpot && now < s.wanderAt) return s.idleSpot;
    s.wanderAt = now + 9000 + Math.random() * 9000;
    s.idleName = pick(['coffee', 'cooler', 'couch', 'meeting', null, null]);
    s.idleSpot = s.idleName ? this.spot(s.idleName, s.idx) : seat;
    return s.idleSpot;
  }

  go(s, g) {
    s.goal = g;
    s.path = findPath(this.grid, s, g);
  }

  frame(ts) {
    const dt = Math.min(50, ts - (this.last || ts)); this.last = ts; this.t = ts;
    const now = performance.now();
    const b = this.b;
    b.drawImage(this.bg, 0, 0);
    if (this.state) this.drawBoards(b);
    for (const s of this.sprites.values()) {
      const g = this.targetFor(s.agent, s);
      if (!s.goal || Math.abs(g.x - s.goal.x) > 0.05 || Math.abs(g.y - s.goal.y) > 0.05) this.go(s, g);
      this.step(s, dt);
      if (!s.moving && s.arrived !== s.goal) {
        s.arrived = s.goal;
        const q = s.goal.quip || (s.goal === s.idleSpot && s.idleName);
        if (q && s.agent.status === 'idle' && Math.random() < (s.goal.quip ? 1 : 0.4)) this.say(s.id, pick(QUIPS[q]), { kind: 'quip' });
      }
    }
    this.drawStations(b);
    const list = [...this.sprites.values()].sort((a, c) => a.y - c.y);
    for (const s of list) this.drawAgent(b, s);
    this.drawForeground(b);
    if (this.hover?.type === 'spot') {
      const z = this.hover.spot;
      b.strokeStyle = '#ffd166'; b.lineWidth = 1; b.setLineDash([2, 2]); b.lineDashOffset = -Math.floor(ts / 120);
      b.strokeRect(Math.round(z.x * T) + 0.5, Math.round(z.y * T) + 0.5, Math.round(z.w * T), Math.round(z.h * T));
      b.setLineDash([]);
    }

    const ctx = this.ctx, { s, ox, oy, dpr } = this.view;
    ctx.imageSmoothingEnabled = false;
    ctx.setTransform(s, 0, 0, s, ox, oy);
    ctx.fillStyle = this.grass;
    ctx.fillRect(-ox / s, -oy / s, this.c.width / s + T, this.c.height / s + T);
    for (const tr of this.outerTrees) {
      if (tr.flower) { ctx.fillStyle = '#ffe08a'; ctx.fillRect(tr.x * T + 6, tr.y * T + 8, 2, 2); ctx.fillStyle = '#ff9ec7'; ctx.fillRect(tr.x * T + 10, tr.y * T + 11, 2, 2); }
      else ctx.drawImage(this.treeSprite, tr.x * T - 2, tr.y * T - 1);
    }
    ctx.drawImage(this.buf, 0, 0);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    for (const sp of list) this.drawLabel(ctx, sp);

    // floating emoji & click markers
    this.fx = this.fx.filter((f) => ts - f.t0 < 1200);
    for (const f of this.fx) {
      const k = (ts - f.t0) / 1200, p = this.toScreen(f.x, f.y - (f.mark ? 0 : k * 1.5));
      ctx.globalAlpha = 1 - k;
      if (f.mark) {
        const r = (4 + k * 10) * dpr;
        ctx.strokeStyle = '#ffd166'; ctx.lineWidth = 2 * dpr;
        ctx.beginPath(); ctx.ellipse(p.x * dpr, p.y * dpr, r, r / 2, 0, 0, 7); ctx.stroke();
      } else {
        ctx.font = `${22 * dpr}px serif`; ctx.textAlign = 'center';
        ctx.fillText(f.text, p.x * dpr, p.y * dpr); ctx.textAlign = 'left';
      }
      ctx.globalAlpha = 1;
    }

    // keep speech bubbles pinned over heads
    for (const [id, bub] of this.bubbles) {
      const pos = this.agentScreen(id, 1.55);
      if (!pos || now > bub.until + 400) { bub.el.remove(); this.bubbles.delete(id); continue; }
      if (now > bub.until) bub.el.classList.add('fade');
      const half = (bub.w ||= bub.el.offsetWidth) / 2;
      const x = Math.min(Math.max(pos.x, half + 6), innerWidth - half - 6);
      const tf = `translate(${Math.round(x)}px, ${Math.round(pos.y)}px) translate(-50%, -100%)`;
      bub.el.style.transform = tf;
      bub.el.style.setProperty('--pos', tf);
    }
    this.h.onFrame?.();
  }

  step(s, dt) {
    const p = s.path[0];
    if (!p) { s.moving = false; return; }
    const dx = p.x - s.x, dy = p.y - s.y, d = Math.hypot(dx, dy), v = dt * 0.0045;
    if (d <= v) { s.x = p.x; s.y = p.y; s.path.shift(); }
    else { s.x += (dx / d) * v; s.y += (dy / d) * v; s.dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'r' : 'l') : dy > 0 ? 'd' : 'u'; }
    s.moving = s.path.length > 0;
  }

  // ---- static background --------------------------------------------------
  renderStatic() {
    const cv = Object.assign(document.createElement('canvas'), { width: W * T, height: H * T });
    const g = cv.getContext('2d');
    const r = rng(7);
    const px = (x, y, w, h, c) => { g.fillStyle = c; g.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); };
    const t = (v) => v * T;

    // grass margin
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      px(x * T, y * T, T, T, (x + y) % 2 ? C.grass : C.grass2);
      for (let k = 0; k < 3; k++) px(x * T + Math.floor(r() * 15), y * T + Math.floor(r() * 14), 1, 2, C.grassDark);
    }
    // building footprint shadow
    px(t(2) + 4, t(2) + 4, t(32), t(18), 'rgba(0,0,0,.2)');

    // floors: wood everywhere, carpet tiles in the open plan, checker tiles in the kitchen
    g.save(); g.beginPath(); g.rect(t(2), t(5), t(32), t(15)); g.clip();
    for (let y = t(5); y < t(20); y += 8) for (let x = t(2); x < t(34) + 16; x += 32) {
      const off = (y / 8) % 2 ? 16 : 0;
      px(x - off, y, 32, 8, ((x + off) / 32 + y / 8) % 2 ? C.floorA : C.floorB);
      px(x - off, y + 7, 32, 1, C.floorLine); px(x - off, y, 1, 8, C.floorLine);
    }
    g.restore();
    for (let y = t(5); y < t(20); y += T) for (let x = t(MAIN.x0); x < t(MAIN.x1); x += T) {
      const w = Math.min(T, t(MAIN.x1) - x);
      px(x, y, w, T, ((x - t(MAIN.x0)) / T + y / T) % 2 < 1 ? C.carpetA : C.carpetB);
      px(x, y, w, 1, C.carpetLine);
      if (r() < 0.5) px(x + Math.floor(r() * 12) + 2, y + Math.floor(r() * 12) + 2, 1, 1, C.carpetLine);
    }
    for (let y = t(5); y < t(12); y += 8) for (let x = t(27.4); x < t(34); x += 8)
      px(x, y, Math.min(8, t(34) - x), 8, ((x - t(27.4)) / 8 + (y - t(5)) / 8) % 2 ? C.tileA : C.tileB);

    // rugs
    this.rug(g, t(2.8), t(7.9), t(6.6), t(2.8), C.rug, C.rugEdge);
    this.rug(g, t(2.9), t(13.2), t(6.4), t(5.6), C.rug3, C.rug3Edge);
    this.rug(g, t(28.2), t(13.6), t(5), t(4.6), C.rug2, C.rug2Edge);

    // back wall: warm in the lead office, cool in the open plan, tiles in the kitchen
    const wallFace = (x0, x1, base, stripe) => {
      px(t(x0), t(2), t(x1 - x0), t(3), base);
      for (let x = t(x0); x < t(x1); x += 8) px(x, t(2), 4, t(3), stripe);
    };
    wallFace(2, 10.2, C.wallLead, C.wallLeadStripe);
    wallFace(10.2, 27.2, C.wallMain, C.wallMainStripe);
    px(t(27.2), t(2), t(6.8), t(3), '#f4f1ea');
    for (let y = t(2); y < t(5); y += 6) for (let x = t(27.2); x < t(34); x += 6) { px(x, y, 6, 1, '#dcd7cb'); px(x, y, 1, 6, '#dcd7cb'); }
    px(t(2), t(5) - 4, t(32), 4, C.trim);
    px(t(2), t(5), t(32), 4, 'rgba(0,0,0,.12)'); // wall shadow on the floor
    px(t(10.2), t(2), 2, t(3), '#bfa98a'); px(t(27.2), t(2), 2, t(3), '#bfa98a'); // corner seams

    // windows
    const win = (x, w) => {
      px(t(x), t(2) + 6, t(w), 28, C.trim); px(t(x) + 3, t(2) + 9, t(w) - 6, 22, '#9fd6ff');
      px(t(x) + 3, t(2) + 9, t(w) - 6, 6, '#c8ebff'); px(t(x) + t(w) / 2 - 1, t(2) + 9, 2, 22, C.trim);
      px(t(x) - 2, t(2) + 33, t(w) + 4, 3, '#efe6d2');
    };
    win(5.6, 2.6);
    win(31.2, 2.2);
    // bookshelf (lead office)
    px(t(2.6), t(2) + 6, t(2), 42, '#6b4226');
    for (let s = 0; s < 3; s++) for (let k = 0; k < 7; k++) px(t(2.6) + 3 + k * 4, t(2) + 9 + s * 13, 3, 10, SHIRT[(k + s) % SHIRT.length]);
    for (let s = 0; s < 3; s++) px(t(2.6) + 1, t(2) + 19 + s * 13, t(2) - 2, 2, '#4a2e18');
    // framed certificate & clock
    px(t(8.6), t(2) + 10, 14, 11, C.trim); px(t(8.6) + 2, t(2) + 12, 10, 7, '#fff8e0');
    px(t(19.2), t(2) + 10, 12, 12, '#2a2d3a'); px(t(19.2) + 2, t(2) + 12, 8, 8, '#fff'); px(t(19.2) + 5, t(2) + 13, 1, 4, '#2a2d3a'); px(t(19.2) + 5, t(2) + 16, 3, 1, '#2a2d3a');
    // HQ sign over the kitchen pass
    px(t(25.7), t(2) + 6, 20, 12, '#2f4b6e');
    g.fillStyle = '#ffd166'; g.font = 'bold 8px monospace'; g.fillText('HQ', t(25.7) + 4, t(2) + 15);

    // kitchen: counter, coffee machine, sink, cooler, fridge, table
    px(t(27.5), t(4.6), t(4), 22, '#8a5a2b'); px(t(27.5), t(4.6), t(4), 6, '#d9cdb5'); px(t(27.5), t(4.6) + 20, t(4), 2, '#5e3a1a');
    for (let k = 0; k < 3; k++) px(t(27.9) + k * 20, t(4.6) + 10, 12, 1, '#5e3a1a');
    px(t(28.1), t(3.6), 12, 18, '#3b3b3b'); px(t(28.1) + 2, t(3.6) + 3, 8, 3, '#ff6b6b'); px(t(28.1) + 4, t(3.6) + 10, 4, 5, '#fff');
    px(t(29.7), t(4.6) + 1, 16, 4, '#9aa3ad'); px(t(29.7) + 7, t(4.6) - 4, 2, 5, '#9aa3ad');
    px(t(30.7), t(4.6) - 2, 6, 3, '#e85d5d'); px(t(30.7) + 7, t(4.6) - 2, 6, 3, '#4f9de8'); // mugs
    px(t(31.6), t(3.7), 12, 10, C.water); px(t(31.6) + 2, t(3.7) + 2, 4, 4, '#bfe6ff'); px(t(31.6) + 1, t(3.7) + 10, 10, 16, '#e4e8ee'); px(t(31.6) + 1, t(3.7) + 24, 10, 2, '#9aa3ad');
    px(t(32.6), t(3.3), 17, 34, '#e9eef3'); px(t(32.6), t(3.3) + 13, 17, 1, '#aab3bd'); px(t(32.6) + 13, t(3.3) + 4, 2, 6, '#9aa3ad'); px(t(32.6) + 13, t(3.3) + 17, 2, 8, '#9aa3ad');
    px(t(32.6) + 3, t(3.3) + 3, 4, 3, '#ffd166'); px(t(32.6) + 7, t(3.3) + 5, 3, 3, '#ff9ec7'); // fridge magnets
    g.fillStyle = C.shadow; g.beginPath(); g.ellipse(t(30.55), t(9.6), 16, 4, 0, 0, 7); g.fill();
    g.fillStyle = '#e0b884'; g.beginPath(); g.ellipse(t(30.55), t(8.8), 15, 9, 0, 0, 7); g.fill();
    px(t(30.55) - 2, t(8.8) + 8, 4, 7, '#a8743f');
    for (const sx of [29.3, 31.8]) { px(t(sx) - 4, t(9.1), 8, 6, '#c75a3a'); px(t(sx) - 1, t(9.1) + 6, 2, 4, '#5e3a1a'); }
    px(t(30.3), t(8.4), 4, 4, '#fff'); // cup

    // lounge: TV, couch seat (back is foreground), beanbag
    px(t(29.2), t(12.1), t(2.6), 12, '#5e3a1a'); px(t(29.2), t(12.1), t(2.6), 3, '#7a4a26');
    px(t(29.5), t(11.0), t(2), 20, '#1b1e2b'); px(t(29.5) + 2, t(11.0) + 2, t(2) - 4, 14, '#2c4a6e');
    px(t(29.5) + 4, t(11.0) + 5, 10, 2, C.screenOn); px(t(29.5) + 4, t(11.0) + 9, 16, 2, C.screenOn); px(t(29.5) + 4, t(11.0) + 13, 7, 2, C.screenBlock);
    px(t(28.5), t(17.2), t(4), 16, C.couch); px(t(28.5) + 2, t(17.2) + 2, t(4) - 4, 6, C.couchHi);
    g.fillStyle = '#e87fb6'; g.beginPath(); g.ellipse(t(33), t(15.6), 9, 7, 0, 0, 7); g.fill();
    px(t(33) - 4, t(15.6) - 4, 5, 2, '#f4a7cc');

    // meeting area: table & chairs
    for (const cx of [4.6, 6, 7.4]) for (const cy of [14.1, 16.9]) { px(t(cx) - 6, t(cy) - 4, 12, 9, C.chair); px(t(cx) - 6, t(cy) - 4, 12, 2, C.chairHi); }
    px(t(3.7) + 3, t(14.6) + 4, t(4.6), t(1.9), C.shadow);
    px(t(3.7), t(14.6), t(4.6), t(1.9), C.execEdge); px(t(3.7), t(14.6), t(4.6), t(1.9) - 5, '#b98a5a');
    px(t(4.4), t(15.0), 10, 7, '#fff'); px(t(6.6), t(15.2), 8, 6, '#fff8e0'); px(t(5.6), t(15.1), 5, 5, '#4f9de8');

    // printer
    px(t(25.6), t(18.3), 18, 14, '#d9dde3'); px(t(25.6), t(18.3), 18, 4, '#aab3bd'); px(t(25.6) + 3, t(18.3) + 6, 12, 2, '#2a2d3a'); px(t(25.6) + 4, t(18.3) - 3, 10, 4, '#fff');

    // interior walls: lead office glass wall (with door) and south wall, kitchen divider
    this.glassWall(g, t(9.95), t(4.6), t(8.5) - t(4.6));
    this.glassWall(g, t(9.95), t(10.5), t(11.4) - t(10.5));
    px(t(9.9), t(8.5), 3, t(2), C.glassFrame); // door frame posts
    px(t(9.9) + 6, t(8.5), 3, t(2), C.glassFrame);
    px(t(2), t(10.9), t(8.5), 8, C.cap); px(t(2), t(10.9), t(8.5), 2, C.capHi);
    px(t(2), t(10.9) + 8, t(8.5), 10, C.wallLead);
    for (let x = t(2); x < t(10.5); x += 8) px(x, t(10.9) + 8, 4, 10, C.wallLeadStripe);
    px(t(2), t(10.9) + 16, t(8.5), 2, C.trim);
    px(t(2), t(10.9) + 18, t(8.5), 3, 'rgba(0,0,0,.12)');
    px(t(26.9), t(4.6), 8, t(9.6) - t(4.6), C.cap); px(t(26.9), t(4.6), 2, t(9.6) - t(4.6), C.capHi);
    px(t(26.9), t(9.6), 8, 10, '#f4f1ea'); px(t(26.9), t(9.6) + 8, 8, 2, C.trim);

    // outer walls
    px(t(2) - 4, t(2) - 4, t(32) + 8, 4, C.cap);
    px(t(2) - 4, t(2) - 4, 6, t(18) + 8, C.cap); px(t(34) - 2, t(2) - 4, 6, t(18) + 8, C.cap);
    px(t(2) - 4, t(19.75), t(15.5) + 4, 8, C.cap); px(t(19.5), t(19.75), t(14.5) + 4, 8, C.cap);
    px(t(2) - 4, t(19.75), t(15.5) + 4, 2, C.capHi); px(t(19.5), t(19.75), t(14.5) + 4, 2, C.capHi);
    px(t(2) + 2, t(5), 3, t(15), 'rgba(0,0,0,.1)'); px(t(34) - 5, t(5), 3, t(15), 'rgba(0,0,0,.1)');
    // entrance & doormat
    px(t(17.5), t(19.75), t(2), 8, '#c98a4b');
    px(t(17.6), t(20.3), t(1.8), 10, '#8f3b3b'); px(t(17.6) + 3, t(20.3) + 3, t(1.8) - 6, 4, '#c9a24a');

    // trees around the building
    const trees = [[0.5, 0.2], [5, 0], [10, 0.1], [22, 0], [29, 0], [33, 0.2], [0.2, 6], [0.3, 12], [0.4, 17.5], [34.3, 5], [34.4, 11], [34.2, 17], [6, 20.4], [12, 20.5], [24, 20.4], [30, 20.5]];
    for (const [x, y] of trees) this.tree(g, x * T, y * T);
    return cv;
  }

  glassWall(g, x, y, h) {
    g.fillStyle = C.glassFrame; g.fillRect(x, y, 8, h);
    g.fillStyle = C.glass; g.fillRect(x + 2, y + 2, 4, h - 4);
    g.fillStyle = 'rgba(255,255,255,.6)';
    for (let k = 6; k < h - 6; k += 18) g.fillRect(x + 3, y + k, 1, 5);
  }

  rug(g, x, y, w, h, c, e) {
    g.fillStyle = e; g.fillRect(x, y, w, h);
    g.fillStyle = c; g.fillRect(x + 3, y + 3, w - 6, h - 6);
    g.fillStyle = e; for (let i = x + 8; i < x + w - 8; i += 8) g.fillRect(i, y + h / 2, 3, 1);
  }

  tree(g, x, y) {
    g.fillStyle = C.shadow; g.beginPath(); g.ellipse(x + 8, y + 22, 10, 3, 0, 0, 7); g.fill();
    g.fillStyle = C.trunk; g.fillRect(x + 6, y + 14, 4, 8);
    g.fillStyle = C.leafDark; g.beginPath(); g.arc(x + 8, y + 9, 9, 0, 7); g.fill();
    g.fillStyle = C.leaf; g.beginPath(); g.arc(x + 7, y + 8, 7.5, 0, 7); g.fill();
    g.fillStyle = C.leafHi; g.fillRect(x + 3, y + 4, 3, 3); g.fillRect(x + 8, y + 3, 2, 2);
  }

  // ---- dynamic scenery -----------------------------------------------------
  drawBoards(b) {
    const tasks = this.state.tasks;
    // task whiteboard
    const x = 11.6 * T, y = 2 * T + 6, w = 7 * T, h = 32;
    b.fillStyle = C.boardEdge; b.fillRect(x - 2, y - 2, w + 4, h + 4);
    b.fillStyle = C.board; b.fillRect(x, y, w, h);
    b.fillStyle = '#9aa3ad'; b.fillRect(x + 4, y + h + 2, w - 8, 2); // marker tray
    ['todo', 'working', 'review', 'merged'].forEach((col, i) => {
      const cx = x + 3 + i * 27;
      b.fillStyle = '#d0d4da'; b.fillRect(cx + 24, y + 2, 1, h - 4);
      b.fillStyle = C.note[col]; b.fillRect(cx, y + 2, 22, 3);
      tasks.filter((t) => t.status === col).slice(0, 8).forEach((t, k) => {
        b.fillStyle = C.note[col]; b.fillRect(cx + (k % 2) * 11, y + 8 + Math.floor(k / 2) * 6, 10, 5);
        b.fillStyle = 'rgba(0,0,0,.25)'; b.fillRect(cx + (k % 2) * 11 + 2, y + 10 + Math.floor(k / 2) * 6, 6, 1);
      });
    });
    // PR board
    const px = 20.3 * T, pw = 5 * T;
    b.fillStyle = '#2f4b6e'; b.fillRect(px - 2, y - 2, pw + 4, h + 4);
    b.fillStyle = '#1f2f45'; b.fillRect(px, y, pw, h);
    b.fillStyle = '#ffd166'; b.fillRect(px + 3, y + 3, 14, 2);
    tasks.filter((t) => t.pr).slice(-5).forEach((t, k) => {
      const ry = y + 8 + k * 5;
      b.fillStyle = t.status === 'merged' ? '#9b7bff' : t.status === 'closed' ? '#888' : '#5cd18a';
      b.fillRect(px + 3, ry, 3, 3);
      b.fillStyle = '#c9d6e8'; b.fillRect(px + 8, ry + 1, 20 + ((k * 13) % 40), 1);
    });
  }

  screen(b, x, y, st, i) {
    const on = st && st !== 'idle';
    b.fillStyle = C.monitor; b.fillRect(x, y, 20, 13); b.fillRect(x + 8, y + 13, 4, 3);
    b.fillStyle = !on ? C.screenOff : st === 'blocked' ? C.screenBlock : st === 'reviewing' ? C.screenReview : st === 'planning' ? C.screenPlan : C.screenOn;
    b.fillRect(x + 2, y + 2, 16, 9);
    if (on && st !== 'blocked') {
      b.fillStyle = 'rgba(0,0,0,.35)';
      for (let l = 0; l < 3; l++) b.fillRect(x + 3, y + 3 + l * 3, 4 + ((Math.floor(this.t / 300) + l * 5 + i) % 11), 1);
    }
    if (st === 'blocked' && Math.floor(this.t / 400) % 2) { b.fillStyle = '#fff'; b.fillRect(x + 9, y + 3, 2, 4); b.fillRect(x + 9, y + 8, 2, 2); }
  }

  drawStations(b) {
    const byStation = new Map([...this.sprites.values()].map((s) => [s.station, s.agent]));
    // lead's executive desk
    {
      const x = LEAD_DESK.x * T, y = LEAD_DESK.y * T, a = this.state?.agents.find((q) => q.role === 'lead');
      b.fillStyle = C.leather; b.fillRect(x + 21, y + 30, 16, 12); b.fillStyle = C.leatherHi; b.fillRect(x + 21, y + 30, 16, 3);
      b.fillStyle = C.shadow; b.fillRect(x + 3, y + 22, 56, 4);
      b.fillStyle = C.execEdge; b.fillRect(x, y + 8, 58, 16);
      b.fillStyle = C.execTop; b.fillRect(x, y + 6, 58, 12);
      this.screen(b, x + 19, y - 4, a?.status, 0);
      b.fillStyle = '#d9d9d9'; b.fillRect(x + 21, y + 13, 16, 3);
      b.fillStyle = '#ffd166'; b.fillRect(x + 4, y + 2, 2, 8); b.fillRect(x + 2, y, 7, 3); // lamp
      b.fillStyle = '#fff'; b.fillRect(x + 44, y + 9, 9, 6); b.fillStyle = '#e85d5d'; b.fillRect(x + 46, y + 10, 5, 1);
      this.plant(b, x + 50, y - 4);
    }
    // cubicles
    for (const c of this.cubes) this.cubicle(b, c, byStation.get(c));
  }

  cubicle(b, c, a) {
    const X = Math.round(c.x * T), Y = Math.round(c.y * T), i = c.i, r = rng(c.i * 17 + 5);
    const px = (x, y, w, h, col) => { b.fillStyle = col; b.fillRect(X + x, Y + y, w, h); };
    px(4, 4, 48, 48, 'rgba(0,0,0,.06)'); // cubicle floor
    // back panel with pin board
    px(0, -12, 56, 2, C.panelCap); px(0, -10, 56, 14, C.panelFace); px(0, 3, 56, 1, C.panelShade);
    px(6, -7, 12, 8, C.cork);
    const notes = [C.note.todo, C.note.review, C.note.merged, C.note.working];
    for (let k = 0; k < 3; k++) px(7 + k * 4, -6 + (k % 2) * 3, 3, 3, notes[(i + k) % 4]);
    // desk + L-return
    px(4, 4, 48, 20, C.deskTop); px(4, 22, 48, 4, C.deskEdge);
    px(41, 26, 11, 13, C.deskTop); px(41, 37, 11, 3, C.deskEdge);
    // chair
    px(21, 31, 14, 11, C.chair); px(21, 31, 14, 2, C.chairHi);
    // monitor, keyboard, mouse
    this.screen(b, X + 18, Y + 1, a?.status, i);
    px(20, 17, 16, 3, '#d9d9d9'); px(38, 17, 2, 3, '#bfbfbf');
    // personal touches
    const items = [
      () => this.plant(b, X + 43, Y + 22),
      () => { px(8, 10, 4, 5, '#fff'); px(12, 11, 1, 2, '#fff'); },
      () => { px(43, 28, 8, 6, '#fff'); px(44, 29, 6, 1, '#bbb'); px(44, 31, 4, 1, '#bbb'); },
      () => { px(7, 8, 7, 6, C.trim); px(8, 9, 5, 4, '#9fd6ff'); },
      () => { px(44, 27, 6, 4, '#e85d5d'); px(45, 26, 4, 1, '#ffd166'); },
    ];
    items[Math.floor(r() * items.length)](); items[(Math.floor(r() * items.length) + 2) % items.length]();
    // side panels (drawn last so they frame the desk)
    for (const sx of [0, 52]) { px(sx, -12, 4, 62, C.panelCap); px(sx + (sx ? 0 : 3), -10, 1, 60, '#8a96a8'); px(sx, 46, 4, 6, C.panelFace); }
  }

  plant(b, x, y) {
    b.fillStyle = C.pot; b.fillRect(x, y + 6, 7, 6);
    b.fillStyle = C.leaf; b.fillRect(x - 1, y, 9, 6); b.fillStyle = C.leafHi; b.fillRect(x + 2, y - 2, 3, 4);
  }

  bigPlant(b, x, y) {
    b.fillStyle = C.shadow; b.fillRect(x - 1, y + 13, 12, 3);
    b.fillStyle = C.pot; b.fillRect(x + 1, y + 8, 9, 7); b.fillStyle = '#8f4423'; b.fillRect(x + 1, y + 8, 9, 2);
    b.fillStyle = C.leafDark; b.fillRect(x - 2, y + 1, 15, 8);
    b.fillStyle = C.leaf; b.fillRect(x, y - 3, 11, 9); b.fillStyle = C.leafHi; b.fillRect(x + 2, y - 5, 3, 5); b.fillRect(x + 7, y - 2, 3, 3);
  }

  drawForeground(b) {
    for (const [x, y] of [[8.75, 4.6], [9.15, 18.2], [10.65, 18.2], [32.95, 11.9], [26.05, 4.6]]) this.bigPlant(b, x * T, y * T);
    // couch back & arms sit in front of anyone on the couch
    const t = (v) => v * T;
    b.fillStyle = C.couchDark; b.fillRect(t(28.4), t(18.3), t(4.2), 10);
    b.fillStyle = C.couch; b.fillRect(t(28.4), t(18.3), t(4.2), 4);
    b.fillStyle = C.couch; b.fillRect(t(28.4), t(17.2), 8, 26); b.fillRect(t(32.6) - 8, t(17.2), 8, 26);
    b.fillStyle = C.couchHi; b.fillRect(t(28.4), t(17.2), 8, 3); b.fillRect(t(32.6) - 8, t(17.2), 8, 3);
  }

  drawAgent(b, s) {
    const a = s.agent;
    const k = a.look;
    const skin = SKIN[k % SKIN.length], hair = HAIR[Math.floor(k / 5) % HAIR.length];
    const shirt = a.role === 'lead' ? '#2f4b6e' : SHIRT[Math.floor(k / 7) % SHIRT.length], pants = PANTS[Math.floor(k / 3) % PANTS.length];
    const seat = s.station.seat;
    const seated = !s.moving && (a.status === 'working' || a.status === 'blocked' || a.status === 'idle') && Math.abs(s.y - seat.y) < 0.05 && Math.abs(s.x - seat.x) < 0.05;
    const x = Math.round(s.x * T) - 5, y = Math.round(s.y * T) - 16;
    const step = s.moving ? Math.floor(this.t / 140) % 2 : 0;
    const bob = seated && a.status === 'working' ? Math.floor(this.t / 180) % 2 : 0;
    const px = (dx, dy, w, h, c) => { b.fillStyle = c; b.fillRect(x + dx, y + dy + bob, w, h); };

    b.fillStyle = C.shadow; b.beginPath(); b.ellipse(x + 5, y + 16, 6, 2, 0, 0, 7); b.fill();
    if (this.selected === a.id || this.hover?.id === a.id) {
      b.strokeStyle = this.selected === a.id ? '#ffd166' : '#ffffff'; b.lineWidth = 1;
      b.beginPath(); b.ellipse(x + 5, y + 16, 7, 3, 0, 0, 7); b.stroke();
    }
    const back = seated || s.dir === 'u';
    // legs
    if (!seated) { px(2, 12, 2, 3 - step, pants); px(6, 12, 2, 2 + step, pants); }
    // body + arms
    px(1, 7, 8, 6, shirt);
    px(0, 8 + (seated && bob ? 0 : step), 1, 4, skin); px(9, 8 + (seated && !bob ? 0 : step), 1, 4, skin);
    if (a.role === 'lead') px(4, 7, 2, 4, '#ffd166'); // tie
    // head
    px(1, 1, 8, 7, back ? hair : skin);
    px(1, 0, 8, 3, hair); px(0, 1, 1, 4, hair); px(9, 1, 1, 4, hair);
    if (!back) {
      px(3, 4, 1, 2, '#2a2d3a'); px(6, 4, 1, 2, '#2a2d3a');
      px(2, 6, 1, 1, '#f2a5a5'); px(7, 6, 1, 1, '#f2a5a5');
    }
    // status bubble
    const st = a.status;
    const icon = st === 'blocked' ? '!' : st === 'planning' ? '…' : st === 'reviewing' ? 'PR' : st === 'idle' && !seated && a.role !== 'lead' ? '☕' : null;
    if (icon) {
      const float = Math.floor(this.t / 400) % 2;
      const bw = icon.length > 1 ? 13 : 9;
      b.fillStyle = st === 'blocked' ? '#ff6b6b' : '#fff'; b.fillRect(x + 5 - bw / 2, y - 12 - float, bw, 9);
      b.fillRect(x + 4, y - 3 - float, 2, 2);
      b.fillStyle = st === 'blocked' ? '#fff' : '#2a2d3a'; b.font = 'bold 7px monospace';
      b.fillText(icon, x + 5 - bw / 2 + 2, y - 5 - float);
    }
  }

  drawLabel(ctx, s) {
    const a = s.agent;
    const { dpr, s: sc, ox, oy } = this.view;
    const x = ox + s.x * T * sc, y = oy + (s.y * T + 3) * sc, fs = Math.round(Math.max(10, Math.min(14, sc / dpr * 4.5)) * dpr);
    ctx.font = `${fs}px 'Pixelify Sans', ui-monospace, monospace`;
    const w = ctx.measureText(a.name).width + 10 * dpr, h = fs + 6 * dpr;
    ctx.fillStyle = this.selected === a.id ? '#ffd166' : 'rgba(22,26,38,.8)';
    ctx.fillRect(x - w / 2, y, w, h);
    ctx.fillStyle = this.selected === a.id ? '#1b1e2b' : '#fff';
    ctx.fillText(a.name, x - w / 2 + 5 * dpr, y + fs);
  }
}

// Small face portrait for team cards.
export function portrait(cv, a) {
  cv.width = 12; cv.height = 12;
  const g = cv.getContext('2d'), k = a.look;
  const px = (x, y, w, h, c) => { g.fillStyle = c; g.fillRect(x, y, w, h); };
  px(0, 0, 12, 12, '#c98a4b');
  px(2, 9, 8, 3, a.role === 'lead' ? '#2f4b6e' : SHIRT[Math.floor(k / 7) % SHIRT.length]);
  px(3, 3, 6, 6, SKIN[k % SKIN.length]);
  const hair = HAIR[Math.floor(k / 5) % HAIR.length];
  px(3, 2, 6, 2, hair); px(2, 3, 1, 3, hair); px(9, 3, 1, 3, hair);
  px(4, 5, 1, 1, '#2a2d3a'); px(7, 5, 1, 1, '#2a2d3a');
}
