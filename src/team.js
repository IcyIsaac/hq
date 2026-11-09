import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { runAgent, prepareWorkspace, openPullRequest, prState } from './runner.js';
import { DemoRunner } from './demo.js';

const DEFAULT_SETTINGS = {
  sandbox: true, // run each agent in its own Docker container
  image: 'tiny-hq-agent',
  baseBranch: '', // empty = repo default branch
  pollSeconds: 60,
};

const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);

export class Team {
  constructor({ repo, demo, emit }) {
    this.repo = repo;
    this.dir = join(repo, '.hq');
    this.forceDemo = demo;
    this.emit = emit;
    this.procs = new Map(); // agentId -> running process handle
  }

  async load() {
    await mkdir(this.dir, { recursive: true });
    try { this.state = JSON.parse(await readFile(join(this.dir, 'state.json'), 'utf8')); }
    catch { this.state = this.blank(); }
    this.state.settings = { ...DEFAULT_SETTINGS, ...this.state.settings };
    if (this.forceDemo) this.state.demo = true;
    // Nothing survives a restart mid-run: park agents, put their unfinished work back in the queue, then pick it up again.
    for (const a of this.state.agents) {
      if (a.status === 'blocked') continue;
      a.status = 'idle';
      const t = this.state.tasks.find((x) => x.id === a.taskId);
      if (t?.status === 'working') t.status = 'todo';
      a.taskId = null;
    }
    this.demo = new DemoRunner(this);
    setTimeout(() => {
      for (const a of this.state.agents) if (a.role === 'worker' && !a.taskId) this.startNext(a);
    }, 1500);
    this.pollTimer = setInterval(() => this.pollPRs(), this.state.settings.pollSeconds * 1000);
  }

  blank() {
    return { project: null, agents: [], tasks: [], actions: [], activity: [], settings: { ...DEFAULT_SETTINGS }, demo: this.forceDemo };
  }

  snapshot() { return { ...this.state, repo: this.repo }; }

  save() {
    clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => writeFile(join(this.dir, 'state.json'), JSON.stringify(this.state, null, 2)).catch(() => {}), 200);
  }

  changed() { this.save(); this.emit('state', this.snapshot()); }

  log(text, agentId = null) {
    const entry = { at: Date.now(), agentId, text };
    this.state.activity.unshift(entry);
    this.state.activity.length = Math.min(this.state.activity.length, 200);
    this.changed();
  }

  agent(idOrName) {
    const k = String(idOrName).toLowerCase();
    return this.state.agents.find((a) => a.id === idOrName || a.name.toLowerCase() === k);
  }

  // ---- Team setup ----------------------------------------------------------

  configure({ project, lead, workers, demo }) {
    if (!lead?.name || !workers?.length) throw new Error('Need a lead and at least one worker');
    const mk = (p, role, i) => ({
      id: randomUUID().slice(0, 8), name: p.name.trim(), role, runtime: p.runtime || 'claude',
      status: 'idle', taskId: null, sessionId: null, desk: i, log: [], inbox: [],
      look: p.look ?? Math.floor(Math.random() * 1000),
    });
    this.state = {
      ...this.blank(), settings: this.state.settings,
      project: project || 'My project', demo: !!(demo || this.forceDemo),
      agents: [mk(lead, 'lead', 0), ...workers.map((w, i) => mk(w, 'worker', i + 1))],
    };
    this.log(`Team assembled: ${this.state.agents.map((a) => a.name).join(', ')}`);
    return this.snapshot();
  }

  reset() { for (const id of this.procs.keys()) this.stop(id); this.state = this.blank(); this.changed(); }

  updateSettings(s) { Object.assign(this.state.settings, s); if ('demo' in s) this.state.demo = !!s.demo; this.changed(); }

  agentLog(agent, line) {
    agent.log.push({ at: Date.now(), line });
    if (agent.log.length > 400) agent.log.splice(0, agent.log.length - 400);
    this.emit('log', { agentId: agent.id, line });
    this.save();
  }

  setStatus(agent, status) { agent.status = status; this.changed(); }

  // ---- Messaging -----------------------------------------------------------

  async message(to, text) {
    const target = this.agent(to) || this.state.agents.find((a) => a.role === 'lead');
    if (!target) throw new Error('No team yet');
    this.log(`You → ${target.name}: ${text}`);
    this.emit('say', { agentId: target.id, from: 'you', text, kind: 'incoming' });
    if (target.role === 'lead') this.plan(target, text);
    else { target.inbox.push(`From the user: ${text}`); if (target.status === 'idle' && target.taskId) this.work(target); }
    return { ok: true };
  }

  // Protocol lines agents print to talk to HQ.
  handleLine(agent, text) {
    for (const raw of text.split('\n')) {
      const line = raw.trim();
      let m;
      if ((m = line.match(/^HQ_ASK:\s*(.+)/))) this.addAction(agent, m[1]);
      else if ((m = line.match(/^HQ_MSG\s+@(\S+?):\s*(.+)/))) {
        const to = this.agent(m[1]);
        if (to) { to.inbox.push(`From ${agent.name}: ${m[2]}`); this.log(`${agent.name} → ${to.name}: ${m[2]}`, agent.id); this.say(agent, m[2], to); }
      }
    }
  }

  // Speech bubble over an agent's head in the office (optionally walking over to a teammate).
  say(agent, text, to = null, kind = to ? 'msg' : 'say') {
    this.emit('say', { agentId: agent.id, to: to?.id ?? null, text: String(text).slice(0, 180), kind });
  }

  addAction(agent, text) {
    this.state.actions.push({ id: randomUUID().slice(0, 8), agentId: agent.id, text, at: Date.now(), resolved: false });
    agent.blocked = true;
    this.log(`${agent.name} needs you: ${text}`, agent.id);
    this.say(agent, text, null, 'ask');
  }

  resolveAction(id, answer) {
    const a = this.state.actions.find((x) => x.id === id);
    if (!a) throw new Error('Unknown action');
    a.resolved = true; a.answer = answer;
    const agent = this.agent(a.agentId);
    this.log(`You answered ${agent?.name}: ${answer}`);
    if (agent) {
      agent.inbox.push(`The user answered your question "${a.text}": ${answer}`);
      const open = this.state.actions.some((x) => !x.resolved && x.agentId === agent.id);
      if (!open && agent.status === 'blocked') { agent.blocked = false; this.state.demo ? this.demo.resume(agent) : this.work(agent); }
    }
    this.changed();
  }

  stop(id) {
    const p = this.procs.get(id);
    if (p) { p.kill(); this.procs.delete(id); }
    const a = this.agent(id);
    if (a) this.setStatus(a, 'idle');
  }

  // ---- Lead: plan & assign -------------------------------------------------

  async plan(lead, request) {
    if (this.state.demo) return this.demo.plan(lead, request);
    this.setStatus(lead, 'planning');
    const workers = this.state.agents.filter((a) => a.role === 'worker');
    const open = this.state.tasks.filter((t) => t.status !== 'merged').map((t) => `- [${t.status}] ${t.title} (${this.agent(t.assignee)?.name})`).join('\n') || '(none)';
    const prompt = `You are ${lead.name}, the lead engineer of a small AI team working on this repository.
Your workers: ${workers.map((w) => w.name).join(', ')}.
Current tasks:
${open}

The user says: "${request}"

Read the codebase as needed, then split the work into small, independent tasks (one task = one branch = one PR).
Do not edit files yourself. Finish your reply with exactly one fenced json block:
\`\`\`json
{"reply": "short message to the user", "tasks": [{"title": "...", "description": "detailed instructions", "assignee": "<worker name>"}]}
\`\`\``;
    const result = await this.runFor(lead, prompt, this.repo, { readOnly: true });
    const m = result.text.match(/```json\s*([\s\S]*?)```/g);
    let plan;
    try { plan = JSON.parse(m.at(-1).replace(/```(json)?/g, '')); }
    catch { this.setStatus(lead, 'idle'); return this.log(`${lead.name} couldn't produce a plan. See their terminal.`, lead.id); }
    if (plan.reply) { this.log(`${lead.name}: ${plan.reply}`, lead.id); this.say(lead, plan.reply); }
    for (const t of plan.tasks || []) this.createTask(lead, t);
    this.setStatus(lead, 'idle');
  }

  createTask(lead, { title, description, assignee }) {
    const worker = this.agent(assignee) || this.state.agents.find((a) => a.role === 'worker' && !a.taskId) || this.state.agents.find((a) => a.role === 'worker');
    const n = this.state.tasks.length + 1;
    const task = { id: `T-${n}`, title, description, assignee: worker.id, status: 'todo', branch: `hq/t${n}-${slug(title)}`, pr: null, at: Date.now() };
    this.state.tasks.push(task);
    this.log(`${lead.name} assigned ${task.id} “${title}” to ${worker.name}`, lead.id);
    if (!worker.taskId) this.startNext(worker);
    return task;
  }

  startNext(worker) {
    const next = this.state.tasks.find((t) => t.assignee === worker.id && t.status === 'todo');
    worker.taskId = next?.id ?? null;
    worker.sessionId = null;
    if (!next) return this.setStatus(worker, 'idle');
    this.state.demo ? this.demo.work(worker, next) : this.work(worker);
  }

  // ---- Worker: code in sandbox, open PR -------------------------------------

  async work(worker) {
    const task = this.state.tasks.find((t) => t.id === worker.taskId);
    if (!task || this.procs.has(worker.id)) return;
    task.status = 'working';
    this.setStatus(worker, 'working');
    this.log(`${worker.name} started ${task.id}`, worker.id);
    try {
      const ws = await prepareWorkspace(this.repo, join(this.dir, 'workspaces', worker.name.toLowerCase()), task.branch, this.state.settings.baseBranch, (l) => this.agentLog(worker, l));
      const inbox = worker.inbox.splice(0).join('\n');
      const teammates = this.state.agents.filter((a) => a.id !== worker.id).map((a) => `${a.name} (${a.role})`).join(', ');
      const prompt = worker.sessionId
        ? `${inbox}\nContinue the task.`
        : `You are ${worker.name}, a developer on an AI team. Teammates: ${teammates}.
Task ${task.id}: ${task.title}
${task.description}
${inbox ? `\nMessages:\n${inbox}\n` : ''}
You are on branch ${task.branch}. Implement the task, run the project's checks if any, and commit your work with clear messages. Do not push; HQ pushes and opens the PR.
To ask the user something (a decision, a secret, a blocked website), print a line "HQ_ASK: <question>" and stop.
To message a teammate, print a line "HQ_MSG @<name>: <message>".`;
      await this.runFor(worker, prompt, ws);
      if (worker.blocked) return this.setStatus(worker, 'blocked');
      this.setStatus(worker, 'reviewing');
      task.pr = await openPullRequest(ws, task, worker, (l) => this.agentLog(worker, l));
      if (task.pr) {
        task.status = 'review';
        this.log(`${worker.name} opened a PR for ${task.id}: ${task.pr}`, worker.id);
      } else {
        task.status = 'closed';
        this.log(`${worker.name} finished ${task.id} with no changes`, worker.id);
      }
    } catch (e) {
      this.agentLog(worker, `✖ ${e.message}`);
      this.log(`${worker.name} hit an error on ${task.id}: ${e.message}`, worker.id);
      task.status = 'todo';
      worker.taskId = null;
      return this.setStatus(worker, 'idle');
    }
    this.startNext(worker);
  }

  runFor(agent, prompt, cwd, opts = {}) {
    let text = '';
    const handle = runAgent({
      agent, prompt, cwd, settings: this.state.settings, ...opts,
      onLine: (l) => this.agentLog(agent, l),
      onText: (t) => {
        text += t + '\n';
        this.handleLine(agent, t);
        const first = t.split('\n').map((l) => l.trim()).find((l) => l && !l.startsWith('HQ_') && !l.startsWith('```'));
        if (first) this.say(agent, first);
      },
      onSession: (id) => { agent.sessionId = id; },
    });
    this.procs.set(agent.id, handle);
    return handle.done.then((r) => { this.procs.delete(agent.id); return { ...r, text }; });
  }

  // HQ never merges. It just watches PRs and reports what reviewers decide.
  async pollPRs() {
    if (this.state.demo) return;
    for (const t of this.state.tasks.filter((x) => x.status === 'review' && x.pr)) {
      const s = await prState(this.repo, t.pr).catch(() => null);
      if (s === 'MERGED') { t.status = 'merged'; this.log(`${t.id} was merged 🎉`); }
      else if (s === 'CLOSED') { t.status = 'closed'; this.log(`${t.id} PR was closed`); }
    }
    this.changed();
  }
}
