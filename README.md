# Tiny HQ

Run a team of AI coding agents on your repo, and watch them work in a pixel-art office.

One **lead** agent plans the work and hands out tasks. Each **worker** gets its own desk, its own clone of your repo and its own Docker sandbox, then opens a pull request. Agents run **Claude Code** or **Codex**. Everything runs on your machine, with zero npm dependencies.

## Quick start

```bash
node bin/hq.js --demo          # simulated team, no tools needed
node bin/hq.js --repo ~/code/app   # real agents on a repo with a GitHub remote
```

HQ opens at http://localhost:7430:

1. **Team**: name the project, pick a lead and workers (Claude Code or Codex each).
2. **Setup**: a checklist of what's missing on your machine, with the command to fix each.
3. **Message the lead**, e.g. *"Plan two small tasks and assign them."*

## How it works

- The lead runs read-only and answers with a JSON plan. HQ turns it into tasks (one task = one branch = one PR).
- Each worker clones the repo into `.hq/workspaces/<name>`, checks out `hq/t<n>-<slug>`, and runs the agent inside `docker run` with only that folder mounted.
- Agents talk to HQ by printing lines:
  - `HQ_ASK: <question>` → shows up in **Action items**. The agent pauses until you answer, then resumes its session.
  - `HQ_MSG @Name: <text>` → delivered to a teammate's inbox.
- When a worker finishes, HQ commits, pushes and runs `gh pr create`. **HQ never merges**: it polls the PR and moves the card when a reviewer merges it.
- State lives in `.hq/state.json` in the managed repo.

## Requirements (live mode)

| What | Why |
| --- | --- |
| Node.js 20+ | Runs HQ |
| git + a GitHub remote | Clone, branch, push |
| GitHub CLI (`gh`), logged in | Open and read PRs |
| Docker + `docker build -t tiny-hq-agent sandbox/` | One container per agent run |
| Claude Code and/or Codex, plus `ANTHROPIC_API_KEY` / `OPENAI_API_KEY` | The agents |

Turn off **Settings → Run agents in Docker sandboxes** to run agents directly on your machine (with permission prompts).
