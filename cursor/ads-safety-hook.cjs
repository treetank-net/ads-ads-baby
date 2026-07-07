#!/usr/bin/env node
const fs = require("fs");
const os = require("os");
const path = require("path");

const mode = process.argv[2];

function readStdin() {
  return new Promise((resolve) => {
    let input = "";
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (chunk) => {
      input += chunk;
    });
    process.stdin.on("end", () => resolve(input));
  });
}

function parseJson(input) {
  try {
    return JSON.parse(input || "{}");
  } catch {
    return {};
  }
}

function pickToolName(payload) {
  const server =
    payload.server ||
    payload.server_name ||
    payload.mcp_server ||
    payload.mcpServer ||
    payload.tool?.server ||
    payload.tool_call?.server ||
    "";
  const name =
    payload.tool_name ||
    payload.toolName ||
    payload.name ||
    payload.tool?.name ||
    payload.tool_call?.name ||
    payload.request?.params?.name ||
    "";

  if (String(name).includes("__")) return String(name);
  if (server && name) return `${server}__${name}`;
  return String(name || "");
}

function pickToolInput(payload) {
  return (
    payload.tool_input ||
    payload.toolInput ||
    payload.args ||
    payload.arguments ||
    payload.tool?.args ||
    payload.tool_call?.args ||
    payload.request?.params?.arguments ||
    {}
  );
}

function pickPrompt(payload, raw) {
  return String(
    payload.prompt ||
      payload.message ||
      payload.text ||
      payload.user_prompt ||
      payload.userPrompt ||
      payload.input ||
      raw ||
      ""
  );
}

function configFor(toolName) {
  if (/meta[-_]ads/.test(toolName)) {
    return {
      prefix: "meta-ads",
      stateDir:
        process.env.META_ADS_BABY_DATA || path.join(os.homedir(), ".meta-ads-baby"),
      stateFile: ".mads-confirm-state",
      safeWordFile: ".mads-safe-word",
      safetyEnv: "META_ADS_SAFETY_LEVEL",
      ttlEnv: "META_ADS_CONFIRM_STATE_TTL_SECONDS",
      yoloEnv: "META_ADS_YOLO"
    };
  }
  return {
    prefix: "google-ads",
    stateDir:
      process.env.GOOGLE_ADS_BABY_DATA || path.join(os.homedir(), ".google-ads-baby"),
    stateFile: ".gads-confirm-state",
    safeWordFile: ".gads-safe-word",
    safetyEnv: "GOOGLE_ADS_SAFETY_LEVEL",
    ttlEnv: "GOOGLE_ADS_CONFIRM_STATE_TTL_SECONDS",
    yoloEnv: "GOOGLE_ADS_YOLO"
  };
}

function readFile(file) {
  try {
    return fs.readFileSync(file, "utf8");
  } catch {
    return "";
  }
}

function readConfig(dir, key) {
  try {
    const cfg = JSON.parse(fs.readFileSync(path.join(dir, "config.json"), "utf8"));
    return String(cfg[key] || "");
  } catch {
    return "";
  }
}

function readState(file) {
  const raw = readFile(file).trim();
  if (!raw) return { state: "", ts: 0 };
  const [state, ts] = raw.split(":");
  return { state, ts: Number.parseInt(ts, 10) || 0 };
}

function writeState(file, state) {
  fs.writeFileSync(file, `${state}:${Math.floor(Date.now() / 1000)}`);
}

function safeWordPresent(prompt, word) {
  if (!word) return false;
  const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|[^A-Za-z0-9_-])${escaped}(?=$|[^A-Za-z0-9_-])`, "i").test(prompt);
}

function allow() {
  process.stdout.write(JSON.stringify({ continue: true, permission: "allow" }));
}

function deny(message) {
  process.stdout.write(
    JSON.stringify({
      continue: true,
      permission: "deny",
      user_message: message,
      agent_message: message
    })
  );
}

async function main() {
  const raw = await readStdin();
  const payload = parseJson(raw);
  const toolName = pickToolName(payload);
  const toolInput = pickToolInput(payload);
  const cfg = configFor(toolName);

  fs.mkdirSync(cfg.stateDir, { recursive: true });
  const statePath = path.join(cfg.stateDir, cfg.stateFile);
  const safeWordPath = path.join(cfg.stateDir, cfg.safeWordFile);

  if (mode === "user-submit") {
    for (const candidate of [configFor("google-ads"), configFor("meta-ads")]) {
      fs.mkdirSync(candidate.stateDir, { recursive: true });
      const candidateStatePath = path.join(candidate.stateDir, candidate.stateFile);
      const state = readState(candidateStatePath);
      if (state.state !== "pending") continue;
      const safeWord = readFile(path.join(candidate.stateDir, candidate.safeWordFile)).trim();
      if (!safeWord || safeWordPresent(pickPrompt(payload, raw), safeWord)) {
        writeState(candidateStatePath, "user-confirmed");
      }
    }
    return allow();
  }

  if (mode !== "pre-tool") return allow();

  if (/(google[-_]ads|meta[-_]ads)__prepare_/.test(toolName)) {
    writeState(statePath, "pending");
    if (toolInput && toolInput.safe_word) {
      fs.writeFileSync(safeWordPath, String(toolInput.safe_word));
    }
    return allow();
  }

  if (!/(google[-_]ads|meta[-_]ads)__confirm_(all_)?mutation/.test(toolName)) {
    return allow();
  }

  const safetyLevel = process.env[cfg.safetyEnv] || readConfig(cfg.stateDir, "safetyLevel") || "standard";
  if (safetyLevel === "off" || process.env[cfg.yoloEnv] === "1") return allow();

  if (!fs.existsSync(statePath)) {
    return deny("Brak operacji do potwierdzenia. Najpierw wywołaj prepare_*.");
  }

  const state = readState(statePath);
  const savedTtl = readConfig(cfg.stateDir, "confirmStateTtlSeconds");
  let ttl = Number.parseInt(process.env[cfg.ttlEnv] || savedTtl, 10);
  if (Number.isNaN(ttl)) ttl = safetyLevel === "strict" ? 300 : 3600;

  if (ttl !== 0 && state.ts && Math.floor(Date.now() / 1000) - state.ts > ttl) {
    try {
      fs.unlinkSync(statePath);
    } catch {}
    return deny("Potwierdzenie wygasło. Przygotuj operację ponownie za pomocą prepare_*.");
  }

  if (state.state !== "user-confirmed") {
    return deny("Wymagana odpowiedź użytkownika przed potwierdzeniem. Zapytaj użytkownika i poczekaj na odpowiedź.");
  }

  return allow();
}

main().catch((error) => {
  process.stderr.write(`${error && error.stack ? error.stack : error}\n`);
  process.exit(1);
});
