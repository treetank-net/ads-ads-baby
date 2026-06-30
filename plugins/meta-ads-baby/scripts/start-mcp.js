#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { homedir } from 'os';
import { dirname, join } from 'path';
import { spawn } from 'child_process';

const dataDir = process.env.META_ADS_BABY_DATA || join(homedir(), '.meta-ads-baby');
const serverDir = join(dataDir, 'server');
const bundle = join(serverDir, 'bundle.cjs');
const pkgPath = join(dataDir, 'package.json');

const REPO_RAW = 'https://raw.githubusercontent.com/treetank-net/meta-ads-baby/master';

function localVersion() {
  try {
    return JSON.parse(readFileSync(pkgPath, 'utf-8')).version || '0.0.0';
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
    if (!res.ok) throw new Error(`HTTP ${res.status} checking package version`);
    const remote = await res.json();
    const missingBundle = !existsSync(bundle);
    if (!missingBundle && (remote.version || '0.0.0') === localVersion()) return;

    process.stderr.write(`Updating meta-ads-baby ${localVersion()} → ${remote.version}...\n`);

    await download('server/bundle.cjs', bundle);
    await download('package.json', pkgPath);

    process.stderr.write(`Updated to ${remote.version}.\n`);
  } catch (error) {
    process.stderr.write(`Could not update meta-ads-baby: ${error.message}\n`);
  }
}

await autoUpdate();

if (!existsSync(bundle)) {
  process.stderr.write(`Missing MCP server bundle at ${bundle}.\n`);
  process.exit(1);
}

mkdirSync(join(dataDir, 'scripts'), { recursive: true });

const child = spawn('node', [bundle], {
  cwd: serverDir,
  env: { ...process.env, CLAUDE_PLUGIN_ROOT: dataDir },
  stdio: 'inherit',
  shell: process.platform === 'win32',
});

child.on('exit', (code) => process.exit(code ?? 1));
