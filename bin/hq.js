#!/usr/bin/env node
import { resolve } from 'node:path';
import { exec } from 'node:child_process';
import { startServer } from '../src/server.js';

const args = process.argv.slice(2);
const opt = { repo: process.cwd(), port: 7430, open: true, demo: false };
for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a === '--repo') opt.repo = resolve(args[++i]);
  else if (a === '--port') opt.port = Number(args[++i]);
  else if (a === '--no-open') opt.open = false;
  else if (a === '--demo') opt.demo = true;
  else if (a === '--help' || a === '-h') {
    console.log(`tiny-hq --repo <path>   repo to manage (default: current folder)
        --port <n>      HQ port (default: 7430)
        --demo          simulate agents (no CLI / Docker needed)
        --no-open       don't open the browser`);
    process.exit(0);
  }
}

const url = await startServer(opt);
console.log(`Tiny HQ running at ${url}  (repo: ${opt.repo})`);
if (opt.open) exec(`${process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'start' : 'xdg-open'} ${url}`);
