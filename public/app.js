import { Office, portrait } from './office.js';

const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const time = (t) => new Date(t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
const api = (path, body) => fetch(path, body ? { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) } : {})
  .then(async (r) => { const j = await r.json(); if (!r.ok) throw new Error(j.error); return j; });
const STATUS = { idle: 'Idle', planning: 'Planning', working: 'Working', blocked: 'Needs you', reviewing: 'Opening PR' };

let state = null;
let selected = null;
let popFor = null; // agent id the popup follows, if any

const office = new Office($('#office'), {
  layer: $('#bubbles'),
  onAgent: (id) => { select(id); showAgentPop(id); },
  onSpot: (id, e) => spotClicked(id, e),
  onEmpty: () => hidePop(),
  onHover: (hit, e) => showTip(hit, e),
  onFrame: () => followPop(),
});

// Centre the building in whatever space the floating windows leave open.
// Folding a window never resizes the office: the bottom inset always reserves the open task board.
const narrow = matchMedia('(max-width: 960px)');
const BOARD_H = 180; // open task board height incl. gap (see .col height in style.css)
function fitOffice() {
  const top = $('.hud.top').getBoundingClientRect().bottom;
  if (narrow.matches) return office.setInsets({ l: 8, r: 8, t: top + 4, b: 4 });
  office.setInsets({
    l: $('.hud.left').getBoundingClientRect().right,
    r: innerWidth - $('.hud.right').getBoundingClientRect().left,
    t: top,
    b: innerHeight - $('#msg').getBoundingClientRect().top + BOARD_H,
  });
}
const ro = new ResizeObserver(fitOffice);
for (const el of [$('.hud.top'), $('.hud.left'), $('.hud.right'), $('#msg')]) ro.observe(el);
addEventListener('resize', fitOffice);

// Click a window's title to fold it away; remembered per viewer.
const folded = (() => { try { return JSON.parse(localStorage.getItem('hq.folded')) || {}; } catch { return {}; } })();
for (const win of document.querySelectorAll('.win[id]')) {
  win.classList.toggle('collapsed', !!folded[win.id]);
  win.querySelector('.tab')?.addEventListener('click', (e) => {
    if (e.target.closest('button')) return;
    setFolded(win, !win.classList.contains('collapsed'));
  });
}
function setFolded(win, on) {
  win.classList.toggle('collapsed', on);
  folded[win.id] = on;
  try { localStorage.setItem('hq.folded', JSON.stringify(folded)); } catch {}
}
function flash(el) { el.classList.remove('flash'); void el.offsetWidth; el.classList.add('flash'); }

// ---- live updates ----------------------------------------------------------
const es = new EventSource('/events');
es.addEventListener('state', (e) => {
  const first = !state;
  state = JSON.parse(e.data);
  if (!selected || !state.agents.some((a) => a.id === selected)) selected = state.agents[0]?.id ?? null;
  render();
  if (first && !state.agents.length) openWelcome();
});
es.addEventListener('log', (e) => {
  const { agentId, line } = JSON.parse(e.data);
  const a = state?.agents.find((x) => x.id === agentId);
  if (!a) return;
  a.log.push({ at: Date.now(), line });
  if (agentId === selected) appendTerm(line);
});
es.addEventListener('say', (e) => {
  const { agentId, text, to, kind } = JSON.parse(e.data);
  office.say(agentId, text, { to, kind });
});

function select(id) { selected = id; render(); }
const agentById = (id) => state?.agents.find((a) => a.id === id);

// ---- rendering ---------------------------------------------------------------
function render() {
  office.update(state, selected);
  $('#mode').textContent = state.demo ? 'Demo' : state.settings.sandbox ? 'Sandbox · live' : 'Local · live';
  $('#mode').className = `pill ${state.demo ? 'demo' : 'live'}`;
  $('#project').textContent = state.project || 'No project yet';
  $('#repo').textContent = state.repo;
  renderTeam(); renderActivity(); renderBoard(); renderActions(); renderTargets(); renderTerm();
  if (popFor) showAgentPop(popFor, true);
}

function renderTeam() {
  const el = $('#team');
  $('#team-count').textContent = state.agents.length ? `· ${state.agents.filter((a) => a.status !== 'idle').length} active` : '';
  if (!state.agents.length) { el.innerHTML = '<p class="empty">No team yet. Click <b>Team</b> to hire one.</p>'; return; }
  el.innerHTML = '';
  for (const a of state.agents) {
    const task = state.tasks.find((t) => t.id === a.taskId);
    const card = document.createElement('div');
    card.className = `card ${a.id === selected ? 'sel' : ''}`;
    card.innerHTML = `<canvas></canvas><div>
      <div><span class="name">${esc(a.name)}</span><span class="status s-${a.status}">${STATUS[a.status] ?? a.status}</span></div>
      <div class="role">${a.role === 'lead' ? 'Lead' : 'Developer'} · ${a.runtime === 'codex' ? 'Codex' : 'Claude Code'}</div>
      <div class="task">${task ? `${task.id} ${esc(task.title)}` : a.role === 'lead' ? 'Planning & assigning' : 'Waiting for work'}</div></div>`;
    portrait(card.querySelector('canvas'), a);
    card.onclick = () => { select(a.id); showAgentPop(a.id); };
    el.append(card);
  }
}

function renderActivity() {
  $('#activity').innerHTML = state.activity.slice(0, 80).map((e) => `<li><time>${time(e.at)}</time>${esc(e.text)}</li>`).join('')
    || '<li class="empty">Nothing yet. Tell the lead what to build.</li>';
}

function renderBoard() {
  for (const col of document.querySelectorAll('.col')) {
    const key = col.dataset.col;
    const tasks = state.tasks.filter((t) => (key === 'merged' ? ['merged', 'closed'].includes(t.status) : t.status === key));
    col.querySelector('div').innerHTML = tasks.map((t) => {
      const who = agentById(t.assignee)?.name ?? '?';
      const pr = t.pr ? ` · <a href="${esc(t.pr)}" target="_blank" rel="noopener">PR</a>` : '';
      return `<div class="task-card">${esc(t.title)}<small>${t.id} · ${esc(who)}${pr}${t.status === 'closed' ? ' · closed' : ''}</small></div>`;
    }).join('') || '<p class="empty">—</p>';
  }
}

function renderActions() {
  const open = state.actions.filter((a) => !a.resolved);
  $('#action-count').textContent = open.length || '';
  const el = $('#actions');
  if (!open.length) { el.innerHTML = '<p class="empty">Nothing needs you right now.</p>'; return; }
  el.innerHTML = '';
  for (const act of open) {
    const who = agentById(act.agentId)?.name ?? 'Agent';
    const div = document.createElement('div');
    div.className = 'action';
    div.innerHTML = `<b>${esc(who)}</b> asks: ${esc(act.text)}
      <form><input placeholder="Your answer" required /><button class="btn tiny primary">Reply</button></form>
      <div class="row" style="margin-top:6px"><button class="btn tiny" data-a="Yes, go ahead.">Allow</button><button class="btn tiny" data-a="No, skip it and continue without it.">Deny</button></div>`;
    const send = (answer) => api('/api/actions/resolve', { id: act.id, answer }).catch((e) => alert(e.message));
    div.querySelector('form').onsubmit = (e) => { e.preventDefault(); send(e.target[0].value); };
    div.querySelectorAll('[data-a]').forEach((b) => (b.onclick = () => send(b.dataset.a)));
    el.append(div);
  }
}

function renderTargets() {
  const to = $('#msg-to');
  const prev = to.value;
  to.innerHTML = state.agents.map((a) => `<option value="${a.id}">${a.role === 'lead' ? '★ ' : ''}${esc(a.name)}</option>`).join('');
  to.value = state.agents.some((a) => a.id === prev) ? prev : state.agents[0]?.id ?? '';
  updateMsgFace();
}
function updateMsgFace() {
  const a = agentById($('#msg-to').value);
  $('#msg-face').hidden = !a;
  if (a) portrait($('#msg-face'), a);
  $('#msg-text').placeholder = !a ? 'Hire a team first…' : a.role === 'lead' ? `Tell ${a.name} what to build…` : `Message ${a.name}…`;
}
$('#msg-to').onchange = updateMsgFace;

let termFor = null, termLen = 0;
function renderTerm() {
  const a = agentById(selected);
  $('#term-title').textContent = a ? `${a.name} · ${a.runtime === 'codex' ? 'Codex' : 'Claude Code'}` : 'Terminal';
  $('#stop').hidden = !a || a.status === 'idle';
  if (!a) { $('#term').textContent = ''; return; }
  if (termFor !== a.id || termLen > a.log.length) { $('#term').innerHTML = ''; termFor = a.id; termLen = 0; }
  for (const l of a.log.slice(termLen)) appendTerm(l.line, false);
}
function appendTerm(line, live = true) {
  const t = $('#term');
  const div = document.createElement('div');
  div.className = line.startsWith('✓') ? 'ok' : line.startsWith('$') ? 'cmd' : /^[✖!]/.test(line) || line.startsWith('HQ_ASK') ? 'err' : line.startsWith('●') ? 'tool' : '';
  div.textContent = line;
  const stick = t.scrollTop + t.clientHeight >= t.scrollHeight - 30;
  t.append(div);
  termLen++;
  if (stick || !live) t.scrollTop = t.scrollHeight;
}

// ---- in-office interactions -------------------------------------------------
function showTip(hit, e) {
  const tip = $('#tip');
  if (!hit || !state) { tip.hidden = true; return; }
  if (hit.type === 'agent') {
    const a = agentById(hit.id);
    const task = state.tasks.find((t) => t.id === a?.taskId);
    tip.innerHTML = `<b>${esc(a?.name)}</b> · ${STATUS[a?.status] ?? ''}${task ? ` · ${esc(task.id)}` : ''}`;
  } else {
    const sel = agentById(selected);
    const hint = hit.spot.spot && sel?.status === 'idle' ? `send ${sel.name} here` : hit.spot.hint;
    tip.innerHTML = `<b>${esc(hit.spot.label)}</b> · ${esc(hint)}`;
  }
  tip.hidden = false;
  tip.style.left = `${e.clientX + 14}px`;
  tip.style.top = `${e.clientY + 16}px`;
}

function placePop(x, y) {
  const pop = $('#pop');
  pop.hidden = false;
  const w = pop.offsetWidth, h = pop.offsetHeight;
  pop.style.left = `${Math.min(Math.max(8, x - w / 2), innerWidth - w - 8)}px`;
  pop.style.top = `${Math.max(8, y - h - 12)}px`;
}
function hidePop() { $('#pop').hidden = true; popFor = null; }
function followPop() {
  if (!popFor) return;
  const p = office.agentScreen(popFor, 2.2);
  if (p) placePop(p.x, p.y);
}

function showAgentPop(id, refresh = false) {
  const a = agentById(id);
  if (!a) return hidePop();
  if (refresh && $('#pop').hidden) return;
  popFor = id;
  const task = state.tasks.find((t) => t.id === a.taskId);
  const pop = $('#pop');
  pop.innerHTML = `<h4><canvas class="face"></canvas>${esc(a.name)}<span class="status s-${a.status}">${STATUS[a.status]}</span><button class="btn tiny close" data-x>✕</button></h4>
    <p>${a.role === 'lead' ? 'Lead' : 'Developer'} · ${a.runtime === 'codex' ? 'Codex' : 'Claude Code'}<br>${task ? `${esc(task.id)} ${esc(task.title)}` : a.role === 'lead' ? 'Plans the work and hands out tasks.' : 'No task right now.'}</p>
    <div class="row">
      <button class="btn tiny primary" data-do="msg">💬 Message</button>
      <button class="btn tiny" data-do="term">Terminal</button>
      ${a.status !== 'idle' ? '<button class="btn tiny" data-do="stop">Stop</button>' : ''}
    </div>
    ${a.status === 'idle' && a.role !== 'lead' ? '<p style="margin:8px 0 0">Tip: click the floor, couch or coffee machine to send them there.</p>' : ''}`;
  const face = pop.querySelector('.face');
  portrait(face, a);
  Object.assign(face.style, { width: '22px', height: '22px', imageRendering: 'pixelated', borderRadius: '3px' });
  pop.querySelector('[data-x]').onclick = hidePop;
  pop.querySelector('[data-do=msg]').onclick = () => {
    $('#msg-to').value = id; updateMsgFace();
    $('#msg-text').focus(); flash($('#msg'));
  };
  pop.querySelector('[data-do=term]').onclick = () => { setFolded($('#w-term'), false); flash($('#w-term')); };
  pop.querySelector('[data-do=stop]')?.addEventListener('click', () => api('/api/agents/stop', { id }));
  followPop();
}

function spotClicked(id, e) {
  if (id === 'board') { hidePop(); setFolded($('#w-board'), false); return flash($('#w-board')); }
  const pop = $('#pop');
  if (id === 'prs') {
    const prs = state.tasks.filter((t) => t.pr);
    pop.innerHTML = `<h4>🔀 Pull requests<button class="btn tiny close" data-x>✕</button></h4>
      ${prs.length ? `<ul>${prs.map((t) => `<li><a href="${esc(t.pr)}" target="_blank" rel="noopener">${esc(t.id)}</a> ${esc(t.title)} <span class="muted">(${t.status})</span></li>`).join('')}</ul>` : '<p>No PRs yet.</p>'}
      <p>HQ never merges. Review and merge on GitHub.</p>`;
  } else if (id === 'books') {
    pop.innerHTML = `<h4>📚 ${esc(state.project || 'Project')}<button class="btn tiny close" data-x>✕</button></h4>
      <p>${esc(state.repo)}</p>
      <p>${state.agents.length} on the team · ${state.tasks.length} tasks · ${state.tasks.filter((t) => t.pr).length} PRs</p>`;
  } else return;
  popFor = null;
  pop.querySelector('[data-x]').onclick = hidePop;
  placePop(e.clientX, e.clientY);
}

addEventListener('keydown', (e) => { if (e.key === 'Escape') hidePop(); });

$('#repo').onclick = () => {
  navigator.clipboard?.writeText(state.repo).then(() => office.burst(4, 3.5, '📋')).catch(() => {});
};

// ---- chat bar & menus ---------------------------------------------------------
$('#msg').onsubmit = (e) => {
  e.preventDefault();
  const text = $('#msg-text').value.trim();
  if (!text) return;
  if (!state.agents.length) return openWelcome();
  api('/api/message', { to: $('#msg-to').value, text }).then(() => ($('#msg-text').value = '')).catch((err) => alert(err.message));
};
$('#stop').onclick = () => selected && api('/api/agents/stop', { id: selected });

document.querySelectorAll('[data-open]').forEach((b) => (b.onclick = () => ({ welcome: openWelcome, setup: openSetup, settings: openSettings })[b.dataset.open]()));

const NAMES = ['Max', 'Rosa', 'Kenji', 'Nia', 'Otto', 'Priya', 'Leo', 'Zoe'];
function workerRow(name = NAMES[$('#workers').children.length % NAMES.length], runtime = 'claude') {
  const row = document.createElement('div');
  row.className = 'row';
  row.innerHTML = `<input required value="${esc(name)}" /><select><option value="claude">Claude Code</option><option value="codex">Codex</option></select><button type="button" class="btn tiny">✕</button>`;
  row.querySelector('select').value = runtime;
  row.querySelector('button').onclick = () => row.remove();
  $('#workers').append(row);
}
$('#add-worker').onclick = () => $('#workers').children.length < 8 && workerRow();

function openWelcome() {
  const f = $('#welcome-form');
  $('#workers').innerHTML = '';
  const lead = state?.agents.find((a) => a.role === 'lead');
  const workers = state?.agents.filter((a) => a.role === 'worker') ?? [];
  if (lead) { f.project.value = state.project; f.lead.value = lead.name; f.leadRuntime.value = lead.runtime; }
  (workers.length ? workers : [{ name: 'Max' }, { name: 'Rosa' }]).forEach((w) => workerRow(w.name, w.runtime));
  f.demo.checked = state?.demo ?? true;
  $('#welcome').showModal();
}
$('#welcome').addEventListener('close', () => {
  if ($('#welcome').returnValue !== 'ok') return;
  const f = $('#welcome-form');
  api('/api/team', {
    project: f.project.value, demo: f.demo.checked,
    lead: { name: f.lead.value, runtime: f.leadRuntime.value },
    workers: [...$('#workers').children].map((r) => ({ name: r.querySelector('input').value, runtime: r.querySelector('select').value })),
  }).then(() => { if (!f.demo.checked) openSetup(); }).catch((e) => alert(e.message));
});

async function openSetup() {
  $('#checks').innerHTML = '<li>Checking…</li>';
  $('#setup').showModal();
  const { checks } = await api('/api/setup');
  $('#checks').innerHTML = checks.map((c) => `<li class="${c.ok ? 'ok' : c.optional ? 'opt' : 'no'}"><b>${esc(c.label)}</b> <span class="muted">— ${esc(c.why)}</span>${c.ok ? '' : `<code>${esc(c.fix)}</code>`}</li>`).join('')
    + `<li class="opt"><b>Sandbox image</b> <span class="muted">— build once after installing Docker</span><code>docker build -t tiny-hq-agent sandbox/</code></li>`;
}
$('#recheck').onclick = openSetup;

function openSettings() {
  const f = $('#settings-form');
  f.demo.checked = state.demo; f.sandbox.checked = state.settings.sandbox;
  f.image.value = state.settings.image; f.baseBranch.value = state.settings.baseBranch;
  $('#settings').showModal();
}
$('#settings').addEventListener('close', () => {
  if ($('#settings').returnValue !== 'ok') return;
  const f = $('#settings-form');
  api('/api/settings', { demo: f.demo.checked, sandbox: f.sandbox.checked, image: f.image.value, baseBranch: f.baseBranch.value });
});
$('#reset').onclick = () => { if (confirm('Clear the team, tasks and history?')) { api('/api/reset'); $('#settings').close(); } };
