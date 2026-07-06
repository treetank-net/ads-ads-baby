#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { homedir } from 'os';
import { dirname, join } from 'path';
import { spawn } from 'child_process';

const pluginName = 'google-ads-baby';
const dataDir = process.env.GOOGLE_ADS_BABY_DATA || join(homedir(), '.google-ads-baby');
const serverDir = join(dataDir, 'server');
const bundle = join(serverDir, 'bundle.cjs');
const pkgPath = join(dataDir, 'package.json');

const REPO_RAW = 'https://raw.githubusercontent.com/treetank-net/google-ads-baby/master';

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
    if (!missingBundle && (remote.version || '0.0.0') === localVersion()) return true;

    process.stderr.write(`Updating ${pluginName} ${localVersion()} -> ${remote.version}...\n`);

    await download('server/bundle.cjs', bundle);
    await download('package.json', pkgPath);

    process.stderr.write(`Updated to ${remote.version}.\n`);
    return true;
  } catch (error) {
    process.stderr.write(`Could not update ${pluginName}: ${error.message}\n`);
    return false;
  }
}

function startRealServer() {
  mkdirSync(join(dataDir, 'scripts'), { recursive: true });

  const child = spawn('node', [bundle], {
    cwd: serverDir,
    env: { ...process.env, CLAUDE_PLUGIN_ROOT: dataDir },
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });

  child.on('exit', (code) => process.exit(code ?? 1));
}

let updatePromise = null;

function ensureUpdate() {
  updatePromise ??= autoUpdate().finally(() => {
    updatePromise = null;
  });
  return updatePromise;
}

function send(message) {
  process.stdout.write(`${JSON.stringify(message)}\n`);
}

function result(id, value) {
  send({ jsonrpc: '2.0', id, result: value });
}

function error(id, code, message) {
  send({ jsonrpc: '2.0', id, error: { code, message } });
}

async function handleRequest(message) {
  const { id, method, params } = message;
  if (id === undefined || id === null) return;

  if (method === 'initialize') {
    result(id, {
      protocolVersion: params?.protocolVersion || '2025-06-18',
      capabilities: { tools: {} },
      serverInfo: { name: `${pluginName}-bootstrap`, version: localVersion() },
      instructions: `${pluginName} is downloading its runtime. Use update_plugin, then restart the MCP server or session to load the full toolset.`,
    });
    return;
  }

  if (method === 'tools/list') {
    result(id, {
      tools: [{
        name: 'update_plugin',
        description: `Download or repair the ${pluginName} runtime. Restart the MCP server/session after it completes.`,
        inputSchema: { type: 'object', properties: {}, additionalProperties: false },
      }],
    });
    return;
  }

  if (method === 'tools/call') {
    if (params?.name !== 'update_plugin') {
      error(id, -32601, `Unknown tool: ${params?.name || ''}`);
      return;
    }
    await ensureUpdate();
    const text = existsSync(bundle)
      ? `Runtime downloaded to ${bundle}. Restart MCP/session to load the full ${pluginName} toolset.`
      : `Runtime is still unavailable at ${bundle}. Check network access and call update_plugin again.`;
    result(id, { content: [{ type: 'text', text }] });
    return;
  }

  error(id, -32601, `Method not found: ${method}`);
}

function startBootstrapServer() {
  process.stderr.write(`Missing MCP server bundle at ${bundle}; starting bootstrap MCP with update_plugin.\n`);
  ensureUpdate().catch(() => {});

  let buffer = '';
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', (chunk) => {
    buffer += chunk;
    for (;;) {
      const index = buffer.indexOf('\n');
      if (index === -1) break;
      const line = buffer.slice(0, index).trim();
      buffer = buffer.slice(index + 1);
      if (!line) continue;
      try {
        handleRequest(JSON.parse(line)).catch((err) => {
          process.stderr.write(`Bootstrap request failed: ${err.message}\n`);
        });
      } catch (err) {
        process.stderr.write(`Invalid MCP message: ${err.message}\n`);
      }
    }
  });
  setInterval(() => {}, 60_000);
}

if (existsSync(bundle)) {
  await autoUpdate();
  if (existsSync(bundle)) {
    startRealServer();
  } else {
    startBootstrapServer();
  }
} else {
  startBootstrapServer();
}
