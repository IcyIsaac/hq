// Simulated agents: lets you see HQ in action with no CLI, Docker or GitHub.
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const pick = (a) => a[Math.floor(Math.random() * a.length)];

const IDEAS = [
  ['Add input validation to the signup form', 'Validate email and password client and server side.'],
  ['Write tests for the date utils', 'Cover parse, format and edge cases around time zones.'],
  ['Add dark mode toggle', 'Respect prefers-color-scheme and persist the choice.'],
  ['Fix flaky checkout test', 'The payment mock races with the redirect.'],
  ['Add a /health endpoint', 'Return version, uptime and DB status.'],
  ['Refactor API client to use fetch', 'Drop axios and add retries.'],
];

const STEPS = [
  (t) => `● Read(src/) — exploring for “${t.title}”`,
  () => `● Bash(git pull origin main)\n  └ Already up to date.`,
  () => `● Grep("${pick(['TODO', 'export function', 'useState', 'router'])}")\n  └ ${2 + Math.floor(Math.random() * 9)} matches`,
  () => `● Edit(src/${pick(['app', 'lib/utils', 'api/client', 'components/Form'])}.ts)\n  └ +${5 + Math.floor(Math.random() * 40)} −${Math.floor(Math.random() * 12)}`,
  () => `● Bash(npm run typecheck)\n  └ No errors`,
  () => `● Bash(npm test)\n  └ ${8 + Math.floor(Math.random() * 30)} passed`,
  (t) => `● Bash(git commit -m "${t.id}: ${t.title}")`,
];

export class DemoRunner {
  constructor(team) { this.team = team; this.speed = 1; }

  async plan(lead, request) {
    const team = this.team;
    team.setStatus(lead, 'planning');
    team.agentLog(lead, `▶ Claude Code · demo`);
    team.agentLog(lead, `● Read(README.md, package.json)`);
    team.say(lead, 'Let me sketch a plan on the board…');
    await wait(2500);
    team.agentLog(lead, `● Thinking about: “${request}”`);
    await wait(2500);
    const workers = team.state.agents.filter((a) => a.role === 'worker');
    const count = /\b(one|1|a single)\b/i.test(request) ? 1 : Math.min(workers.length + 1, 3);
    const chosen = [...IDEAS].sort(() => Math.random() - 0.5).slice(0, count);
    const named = workers.find((w) => request.toLowerCase().includes(w.name.toLowerCase()));
    const reply = `Got it! I split that into ${count} task${count > 1 ? 's' : ''} and handed them out.`;
    team.log(`${lead.name}: ${reply}`, lead.id);
    team.say(lead, reply);
    team.setStatus(lead, 'idle');
    chosen.forEach(([title, description], i) =>
      setTimeout(() => team.createTask(lead, { title, description, assignee: (named || workers[i % workers.length]).name }), 700 * i));
  }

  async work(worker, task) {
    const team = this.team;
    task.status = 'working';
    team.setStatus(worker, 'working');
    team.log(`${worker.name} started ${task.id}`, worker.id);
    team.agentLog(worker, `▶ ${worker.runtime === 'codex' ? 'Codex' : 'Claude Code'} · docker sandbox (demo)`);
    team.agentLog(worker, `$ git checkout -b ${task.branch}`);
    team.say(worker, task.step ? 'Thanks! Back on it.' : pick([`On it: ${task.title}`, `Starting ${task.id}!`, 'Let\'s do this.']));
    const askAt = Math.random() < 0.35 && !task.asked ? 3 : -1;
    for (let i = task.step || 0; i < STEPS.length; i++) {
      await wait(2200 + Math.random() * 2500);
      if (worker.taskId !== task.id) return;
      team.agentLog(worker, STEPS[i](task));
      if (i === askAt) {
        task.asked = true; task.step = i + 1;
        const q = pick([
          `Blocked website: registry.npmjs.org wants to fetch zod. Allow it?`,
          `Should ${task.title.toLowerCase()} also cover the admin pages?`,
          `I need a STRIPE_TEST_KEY to run the checkout tests. Can you add it?`,
        ]);
        team.agentLog(worker, `HQ_ASK: ${q}`);
        team.addAction(worker, q);
        return team.setStatus(worker, 'blocked');
      }
      if (i === 2 && Math.random() < 0.4) {
        const mate = team.state.agents.find((a) => a.role === 'worker' && a.id !== worker.id);
        if (mate) {
          const msg = `Heads up, I'm touching ${pick(['the API client', 'shared types', 'the router'])}.`;
          team.log(`${worker.name} → ${mate.name}: ${msg}`, worker.id);
          team.say(worker, msg, mate);
          setTimeout(() => team.say(mate, pick(['Thanks, I\'ll rebase after.', 'Got it 👍', 'Cool, I\'m not in there.'])), 3500);
        }
      }
    }
    team.setStatus(worker, 'reviewing');
    team.agentLog(worker, `$ git push -u origin ${task.branch}\n$ gh pr create`);
    await wait(1500);
    task.pr = `https://github.com/you/${team.state.project?.toLowerCase().replace(/\W+/g, '-') || 'repo'}/pull/${100 + Number(task.id.slice(2))}`;
    task.status = 'review';
    team.log(`${worker.name} opened a PR for ${task.id}`, worker.id);
    team.say(worker, `PR for ${task.id} is up for review! 🚀`);
    setTimeout(() => {
      task.status = 'merged';
      team.log(`${task.id} reviewed and merged by you 🎉`);
    }, 15000 + Math.random() * 15000);
    team.startNext(worker);
  }

  resume(worker) {
    const task = this.team.state.tasks.find((t) => t.id === worker.taskId);
    if (task) this.work(worker, task);
  }
}
