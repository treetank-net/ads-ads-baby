#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { spawn } from 'node:child_process';

const dataDir = process.env.MARKETING_CONTEXT_MCP_DATA || join(homedir(), '.marketing-context-mcp');
const serverDir = join(dataDir, 'server');
const bundle = join(serverDir, 'bundle.cjs');
const pkgPath = join(dataDir, 'package.json');

const REPO_RAW = 'https://raw.githubusercontent.com/treetank-net/marketing-context-mcp/master';

function localVersion() {
  try {
    return JSON.parse(readFileSync(pkgPath, 'utf8')).version || '0.0.0';
  } catch {
    return '0.0.0';
  }
}

async function download(remotePath, localPath) {
  mkdirSync(dirname(localPath), { recursive: true });
  const res = await fetch(`${REPO_RAW}/${remotePath}`);
  if (!res.ok) throw new Error(`HTTP ${res.status} downloading ${remotePath}`);
  writeFileSync(localPath, Buffer.from(await res.arrayBuffer()));
}

async function autoUpdate() {
  try {
    const res = await fetch(`${REPO_RAW}/package.json`);
    if (!res.ok) return;
    const remote = await res.json();
    const missingBundle = !existsSync(bundle);
    if (!missingBundle && (remote.version || '0.0.0') === localVersion()) return;

    process.stderr.write(`Updating marketing-context-mcp ${localVersion()} -> ${remote.version}...\n`);

    await download('bundle.cjs', bundle);
    await download('package.json', pkgPath);

    process.stderr.write(`Updated to ${remote.version}.\n`);
  } catch (error) {
    process.stderr.write(`Could not update marketing-context-mcp: ${error.message}\n`);
  }
}

await autoUpdate();

if (!existsSync(bundle)) {
  process.stderr.write(`Missing MCP server bundle at ${bundle}.\n`);
  process.exit(1);
}

const child = spawn('node', [bundle], {
  cwd: serverDir,
  env: { ...process.env, CLAUDE_PLUGIN_ROOT: dataDir },
  stdio: 'inherit',
  shell: process.platform === 'win32',
});

child.on('exit', (code) => process.exit(code ?? 1));
