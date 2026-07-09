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

## How the plugins work together

The intended review-to-report pipeline:

1. **Diagnose** — Google Ads Baby's read-only analysis tools (`get_account_hygiene_report`, `get_budget_scaling_candidates`, `get_search_terms_waste_candidates`, `get_pmax_channel_breakdown`) scan an account and return findings with severity, ready-to-run `prepare_*` actions, and a suggested follow-up task.
2. **Remember** — findings, decisions, and follow-up tasks land in Marketing Context (`append_task`, `append_review`, `append_decision`), grounded in its knowledge library (workflow articles set the thresholds the analysis tools mirror). Per-client observations (audience CPA patterns, dayparting insights, quality-score issues) belong there too.
3. **Act** — the `prepare_*` → safe word → confirm flow executes approved changes; every mutation is logged to the local audit history and can be recorded back into the client's decision log.
4. **Measure** — Google Analytics Baby pulls GA4-side campaign performance and Google Ads cost/ROAS for the linked accounts.
5. **Report** — Report Baby renders the results into client-facing PDF/PNG deliverables (`render_report`, `render_chart`, `render_metric_cards`).

Current Codex builds do not load hooks from plugin cache (`plugin_hooks` was removed). Install `codex/hooks.json` as the Codex home `hooks.json`, then restart Codex. The hook commands are local and do not run `npx` or access the network on prompt submission.

## Cursor

Enabling a plugin in Cursor is only the first step. After installing or enabling any `*-baby` plugin, restart Cursor and start a new agent chat. Existing chats may not see MCP servers that were attached after the session started.

### Post-install checklist

1. Restart Cursor and open a new agent chat.
2. Open Cursor Settings -> MCP, or the MCP/tools panel in the agent UI.
3. Confirm the expected MCP servers are visible and connected:

| Server | Plugin |
| --- | --- |
| `google-ads` | `google-ads-baby` |
| `meta-ads` | `meta-ads-baby` |
| `google-analytics` | `google-analytics-baby` |
| `report` | `report-baby` |
| `marketing-context` | `marketing-context-mcp` |

If a plugin is enabled but its server is missing or shows an error, the plugin is not usable in that agent session yet.

### Reliable workspace setup

For the most predictable Cursor setup, open this hub repository or copy these files into the target workspace:

```text
.cursor/mcp.json
.cursor/hooks.json
```

If you copy the files, update the `cwd` paths in `.cursor/mcp.json` so they point to the local plugin directories. The MCP config starts all five servers listed above.

Cursor marketplace installation does not reliably install workspace safety hooks. For Google Ads Baby and Meta Ads Baby, `.cursor/hooks.json` is required for the host-level safe-word flow:

- `beforeSubmitPrompt` records the real user safe-word reply.
- `beforeMCPExecution` blocks unsafe `confirm_mutation` / `confirm_all_mutations` calls.
- The hook script is `cursor/ads-safety-hook.cjs`.

The MCP servers still enforce their final confirmation gate, but the workspace hooks prevent the common agent mistake of preparing and confirming a mutation in the same turn.

### Authentication

| Plugin | Setup | Notes |
| --- | --- | --- |
| `report-baby` | No auth required | Local render tools. |
| `marketing-context-mcp` | Optional `MARKETING_CONTEXT_DIR` | Defaults to `~/.marketing-context`. |
| `google-analytics-baby` | Run `setup_google_auth` from the agent | Read-only GA4 OAuth; token is stored locally. |
| `google-ads-baby` | Run `setup_google_auth`, then configure developer token and MCC/customer access | Separate from GA4 auth. |
| `meta-ads-baby` | Run Meta auth setup from the agent | Meta has no sandbox; keep safety hooks enabled. |

Useful first prompts after MCP is connected:

```text
Set up Google Ads authentication.
Set up Meta Ads authentication.
Set up Google Analytics authentication.
```

### First test

In a new agent chat, ask:

```text
Which MCP servers are connected? List the available tools from google-ads, google-analytics, report, meta-ads, and marketing-context.
```

If the agent only reports unrelated servers such as `cursor-app-control` or `figma`, the `*-baby` MCP servers are not available in that session. Restart Cursor, open a new chat, and check Settings -> MCP again.

### Known Cursor marketplace pitfalls

Cursor can show a plugin as enabled while its MCP server did not start. When debugging, check Cursor logs for plugin resolution or cache errors. A common failure mode is a marketplace entry pointing at a branch ref that Cursor cannot resolve, for example `git ls-remote did not return a resolvable commit for ref "main"`. In that case the plugin may be skipped during cache/resolve even though it appears in the Customize UI.

Also avoid installing the same plugin from multiple marketplaces at once. Duplicate `google-ads-baby` entries can make Cursor resolve or cache the wrong copy.

## Safety

All mutations require explicit user confirmation via a safe word. Both hosts require a real user reply containing that word before `confirm_mutation` can execute. This is especially critical for Meta Ads which has no test/sandbox mode. Google Analytics Baby and Report Baby do not mutate accounts and do not participate in the safety hook flow.

## License

MIT
