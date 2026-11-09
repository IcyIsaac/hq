import { execFile } from 'node:child_process';

const run = (cmd, args, cwd) => new Promise((ok) =>
  execFile(cmd, args, { cwd, timeout: 8000 }, (err, stdout) => ok(err ? null : stdout.trim())));

const mac = process.platform === 'darwin';

// Each check: what it is, why HQ needs it, and the command that fixes it.
export async function checkSetup(repo) {
  const checks = [
    { id: 'node', label: 'Node.js 20+', why: 'Runs HQ', ok: Number(process.versions.node.split('.')[0]) >= 20, fix: mac ? 'brew install node' : 'https://nodejs.org' },
    { id: 'git', label: 'git', why: 'Each agent clones, branches and pushes', ok: !!(await run('git', ['--version'])), fix: mac ? 'xcode-select --install' : 'sudo apt install git' },
    { id: 'repo', label: 'Git repo with a GitHub remote', why: 'Agents push branches and open PRs', ok: !!(await run('git', ['remote', 'get-url', 'origin'], repo)), fix: 'gh repo create --source . --push' },
    { id: 'gh', label: 'GitHub CLI (gh)', why: 'Opens and reads pull requests', ok: !!(await run('gh', ['auth', 'status'])), fix: mac ? 'brew install gh && gh auth login' : 'sudo apt install gh && gh auth login' },
    { id: 'docker', label: 'Docker', why: 'Each agent runs in its own sandbox container', ok: !!(await run('docker', ['info', '--format', '{{.ServerVersion}}'])), fix: mac ? 'brew install --cask docker' : 'https://docs.docker.com/engine/install/' },
    { id: 'claude', label: 'Claude Code', why: 'Agent runtime', ok: !!(await run('claude', ['--version'])), fix: 'npm install -g @anthropic-ai/claude-code' },
    { id: 'codex', label: 'Codex CLI (optional)', why: 'Alternative agent runtime', ok: !!(await run('codex', ['--version'])), fix: 'npm install -g @openai/codex', optional: true },
  ];
  return { checks, ready: checks.every((c) => c.ok || c.optional) };
}
