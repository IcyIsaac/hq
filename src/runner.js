import { spawn, execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname } from 'node:path';
import { createInterface } from 'node:readline';

export const git = (cwd, args) => new Promise((ok, fail) =>
  execFile('git', args, { cwd, maxBuffer: 1 << 24 }, (e, out, err) => (e ? fail(new Error(err || e.message)) : ok(out.trim()))));

const gh = (cwd, args) => new Promise((ok, fail) =>
  execFile('gh', args, { cwd }, (e, out, err) => (e ? fail(new Error(err || e.message)) : ok(out.trim()))));

// Each worker gets its own clone of the repo, so agents never step on each other.
export async function prepareWorkspace(repo, ws, branch, baseBranch, log) {
  const origin = await git(repo, ['remote', 'get-url', 'origin']);
  if (!existsSync(ws)) {
    await mkdir(dirname(ws), { recursive: true });
    log(`$ git clone ${origin}`);
    await git(dirname(ws), ['clone', origin, ws]);
  }
  await git(ws, ['fetch', 'origin']);
  const base = baseBranch || (await git(ws, ['symbolic-ref', '--short', 'refs/remotes/origin/HEAD'])).replace('origin/', '');
  const exists = await git(ws, ['rev-parse', '--verify', branch]).then(() => true, () => false);
  if (exists) await git(ws, ['checkout', branch]);
  else await git(ws, ['checkout', '-B', branch, `origin/${base}`]);
  log(`$ git checkout ${branch}  (from ${base})`);
  return ws;
}

export async function openPullRequest(ws, task, agent, log) {
  if (await git(ws, ['status', '--porcelain'])) {
    await git(ws, ['add', '-A']);
    await git(ws, ['commit', '-m', `${task.id}: ${task.title}`]);
  }
  const base = (await git(ws, ['symbolic-ref', '--short', 'refs/remotes/origin/HEAD'])).replace('origin/', '');
  if (!(await git(ws, ['log', `origin/${base}..HEAD`, '--oneline']))) return null;
  log(`$ git push -u origin ${task.branch}`);
  await git(ws, ['push', '-u', 'origin', task.branch, '--force-with-lease']);
  const existing = await gh(ws, ['pr', 'view', task.branch, '--json', 'url', '-q', '.url']).catch(() => '');
  if (existing) return existing;
  log('$ gh pr create');
  return gh(ws, ['pr', 'create', '--head', task.branch, '--base', base, '--title', `${task.id}: ${task.title}`,
    '--body', `${task.description}\n\n---\nOpened by **${agent.name}** from Tiny HQ.`]);
}

export const prState = (repo, url) => gh(repo, ['pr', 'view', url, '--json', 'state', '-q', '.state']);

function agentCommand({ agent, prompt, readOnly, sandbox }) {
  if (agent.runtime === 'codex') {
    return ['codex', 'exec', '--json', '--skip-git-repo-check',
      ...(readOnly ? ['--sandbox', 'read-only'] : sandbox ? ['--dangerously-bypass-approvals-and-sandbox'] : ['--full-auto']), prompt];
  }
  const perms = readOnly ? ['--permission-mode', 'plan'] : sandbox ? ['--dangerously-skip-permissions'] : ['--permission-mode', 'acceptEdits'];
  return ['claude', '-p', prompt, '--output-format', 'stream-json', '--verbose', ...perms,
    ...(agent.sessionId ? ['--resume', agent.sessionId] : [])];
}

// Wrap the agent CLI in a throwaway Docker container that only sees its own workspace.
function sandboxed(cmd, cwd, agent, image) {
  const home = homedir();
  return ['docker', 'run', '--rm', '-i', '--name', `hq-${agent.name.toLowerCase()}-${Date.now()}`,
    '-v', `${cwd}:/work`, '-w', '/work',
    '-e', 'ANTHROPIC_API_KEY', '-e', 'OPENAI_API_KEY', '-e', 'CLAUDE_CODE_OAUTH_TOKEN',
    ...(existsSync(`${home}/.gitconfig`) ? ['-v', `${home}/.gitconfig:/home/agent/.gitconfig:ro`] : []),
    image, ...cmd];
}

export function runAgent({ agent, prompt, cwd, settings, readOnly, onLine, onText, onSession }) {
  const base = agentCommand({ agent, prompt, readOnly, sandbox: settings.sandbox });
  const [bin, ...args] = settings.sandbox ? sandboxed(base, cwd, agent, settings.image) : base;
  onLine(`▶ ${agent.runtime === 'codex' ? 'Codex' : 'Claude Code'} ${settings.sandbox ? '· docker sandbox' : '· local'}`);
  const child = spawn(bin, args, { cwd, env: process.env, stdio: ['ignore', 'pipe', 'pipe'] });

  createInterface({ input: child.stdout }).on('line', (raw) => {
    let ev;
    try { ev = JSON.parse(raw); } catch { onLine(raw); onText(raw); return; }
    if (ev.session_id) onSession(ev.session_id);
    if (ev.thread_id) onSession(ev.thread_id);
    // Claude Code stream-json
    if (ev.type === 'assistant') {
      for (const c of ev.message?.content || []) {
        if (c.type === 'text') { onText(c.text); onLine(`● ${c.text}`); }
        if (c.type === 'tool_use') onLine(`● ${c.name}(${summarize(c.input)})`);
      }
    } else if (ev.type === 'result') onLine(`✓ done (${Math.round((ev.duration_ms || 0) / 1000)}s)`);
    // Codex exec --json
    else if (ev.type === 'item.completed' && ev.item) {
      const it = ev.item;
      if (it.text) { onText(it.text); onLine(`● ${it.text}`); }
      else if (it.command) onLine(`● $ ${it.command}`);
    }
  });
  createInterface({ input: child.stderr }).on('line', (l) => onLine(`! ${l}`));

  const done = new Promise((ok) => {
    child.on('error', (e) => { onLine(`✖ ${e.message}`); ok({ code: -1 }); });
    child.on('close', (code) => ok({ code }));
  });
  return { done, kill: () => child.kill('SIGTERM') };
}

function summarize(input = {}) {
  const v = input.command || input.file_path || input.pattern || input.url || input.description || '';
  return String(v).slice(0, 80);
}
