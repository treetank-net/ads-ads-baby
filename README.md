# ads-ads-baby

Marketplace hub for ads management, marketing analytics, and reporting Claude Code, Codex, and Cursor integrations.

## Plugins

| Plugin | Platform | Repo |
|--------|----------|------|
| **Google Ads Baby** | Google Ads | [treetank-net/google-ads-baby](https://github.com/treetank-net/google-ads-baby) |
| **Meta Ads Baby** | Meta (Facebook) Ads | [treetank-net/meta-ads-baby](https://github.com/treetank-net/meta-ads-baby) |
| **Google Analytics Baby** | Google Analytics 4 | [treetank-net/google-analytics-baby](https://github.com/treetank-net/google-analytics-baby) |
| **Report Baby** | PDF/PNG reports | [treetank-net/report-baby](https://github.com/treetank-net/report-baby) |
| **Marketing Context MCP** | Local marketing context | [treetank-net/marketing-context-mcp](https://github.com/treetank-net/marketing-context-mcp) |

## What is this?

This repo contains host-specific marketplace manifests and project-local configs that bundle the ads family for easy discovery and installation. Each plugin runs its own local MCP server.

Google Ads Baby and Meta Ads Baby use a two-phase mutation safety flow (prepare -> user confirmation -> execute). Google Analytics Baby is read-only and adds GA4-based campaign performance, tracking diagnostics, and Google Ads cost/ROAS context. Report Baby turns HTML, URLs, or built-in report templates into client-facing PDF/PNG deliverables. Marketing Context MCP provides durable local marketing memory for client context, decisions, reviews, and reusable procedures.

Claude Code loads each upstream plugin with its native lifecycle hooks. Codex uses local wrappers from `plugins/` and the shared global hook configuration in `codex/hooks.json` for mutating ads plugins. Cursor uses project-local `.cursor/mcp.json` plus `.cursor/hooks.json`.

The MCP servers enforce the final confirmation gate because not every host intercepts MCP tool calls in the same way. Marketing Context MCP is platform-neutral and does not participate in account mutation safety gates.

Current Codex builds do not load hooks from plugin cache (`plugin_hooks` was removed). Install `codex/hooks.json` as the Codex home `hooks.json`, then restart Codex. The hook commands are local and do not run `npx` or access the network on prompt submission.

## Cursor

Open this repository in Cursor, then enable the project MCP and hook configs:

```text
.cursor/mcp.json
.cursor/hooks.json
```

The Cursor config starts:

- `google-ads`
- `meta-ads`
- `google-analytics`
- `report`
- `marketing-context`

Google Ads Baby and Meta Ads Baby use `beforeSubmitPrompt` and `beforeMCPExecution` hooks to mirror the same safe-word flow used in Claude Code and Codex. The hooks are local Node scripts and do not run `npx` or access the network on prompt submission.

## Safety

All mutations require explicit user confirmation via a safe word. Both hosts require a real user reply containing that word before `confirm_mutation` can execute. This is especially critical for Meta Ads which has no test/sandbox mode. Google Analytics Baby and Report Baby do not mutate accounts and do not participate in the safety hook flow.

## License

MIT
