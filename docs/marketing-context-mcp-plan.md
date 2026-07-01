# Marketing Context MCP Plan

## Decision

Build a dedicated MCP server named `marketing-context`.

Package name: `@treetank/marketing-context-mcp`  
MCP server name: `marketing-context`  
Default env: `MARKETING_CONTEXT_DIR`  
Backward-compatible env: `MARKETING_KNOWLEDGE_DIR`

This replaces the interim `@movibe/memory-bank-mcp` usage currently wired in
`google-ads-baby`, but keeps the same product idea: local markdown knowledge,
easy cloud sync through Drive/OneDrive, no remote service, no OAuth.

## Why Not Fork Google Ads Baby

The useful pattern in `google-ads-baby` is the second MCP server:

- a separate `marketing-knowledge` server beside the ad platform server
- markdown files as the durable store
- host manifests wire both servers together
- hooks provide timely context to the model

The Google Ads API server itself should not be forked for this. The new server
must be platform-neutral and reusable by:

- `google-ads-baby`
- `meta-ads-baby`
- `google-analytics-baby`
- `report-baby`
- future marketing/ad-ops plugins

## Naming

Use `marketing-context`.

Rejected names:

- `ads-memory-baby`: too narrow and too cutesy for shared infrastructure
- `marketing-memory`: implies model memory instead of operational context
- `campaign-context`: good for ads, weaker for GA4/reporting

`marketing-context` describes the real job: provide relevant marketing,
client, account, decision, and procedure context to tools and agents.

## Storage Layout

```text
MARKETING_CONTEXT_DIR/
  general/
    copywriting-principles.md
    account-management-philosophy.md
    reporting-language-and-client-communication.md
  google-ads/
    always-never-checklist.md
    review-daily-monthly-procedures.md
    pmax-channel-diagnostics.md
    gaql-query-engine-rules.md
    mutation-safety-preview-workflow.md
  meta-ads/
  analytics/
  reporting/
  clients/
    <client-slug>/
      profile.md
      preferences.md
      decision-log.md
      review-log.md
      mutation-log.jsonl
      procedures/
        daily.md
        monthly.md
```

Markdown knowledge files use frontmatter:

```yaml
---
keywords: [pmax, feed-only, kanal, engaged-view]
applies_to: [google-ads]
task_type: [diagnosis, review]
risk_level: high
summary: "PMax channel diagnostics and leakage rules."
---
```

## MCP Tools

Read/search tools:

- `search_knowledge(query, applies_to?, task_type?, risk_level?, limit?)`
- `read_knowledge(path)`
- `list_knowledge(applies_to?, task_type?)`
- `get_client_context(client_slug, platform?)`

Write tools:

- `append_decision(client_slug, entry, platform?, account_id?, tags?)`
- `append_mutation(client_slug, platform, account_id, action, preview, result, tags?)`
- `append_review(client_slug, platform, summary, period?, tags?)`
- `upsert_client_profile(client_slug, section, content)`
- `append_preference(client_slug, preference, platform?, account_id?)`

Safety constraints:

- never write secrets, refresh tokens, access tokens, client secrets, cookies,
  private keys, or raw auth headers
- append-only for `decision-log.md`, `review-log.md`, and `mutation-log.jsonl`
- create new files only inside `MARKETING_CONTEXT_DIR`
- validate paths against traversal
- redact common secret patterns before writes

## Hidden Note Flow

Use `PostToolUse` hooks to detect interesting events and inject a reminder into
the model context:

> The user just did something important. Consider recording a concise note with
> `marketing-context.append_mutation` or `append_decision` if it will matter in
> future work.

The hook should not write the note itself. The model should decide whether the
event is worth recording and call the MCP tool naturally. This avoids a raw,
contextless append and lets the model include the business meaning.

### Event Classes

Mutation events:

- Google Ads: `google-ads__confirm_mutation`, `google-ads__confirm_all_mutations`
- Meta Ads: `meta-ads__confirm_mutation`, `meta-ads__confirm_all_mutations`
- future mutating tools with `confirm_*`, `execute_*`, or known write actions

Statistics/insight events:

- campaign stats, account diagnostics, GA4 reports, report generation
- tools returning unusually important findings, e.g. tracking failure, spend
  anomaly, PMax leakage, high-risk recommendation, monthly review

Ignore:

- setup/auth tools
- failed prepare tools
- read-only exploratory calls with no notable result
- repeated event for the same tool result within a short dedupe window

## Hidden Injection Compatibility

`../hooker` shows the most useful pattern:

- `inject "text"` is hidden in Claude Code through the raw stdout XML trick:
  close `local-command-stdout`, print instruction, reopen it
- JSON helpers like `systemMessage` are visible in Claude Code
- Codex supports fewer hook events and should be treated separately

Implementation strategy:

- Claude Code: use raw hidden injection for private reminders
- Codex: use `additionalContext` as the best available equivalent; verify
  visibility in the current runtime before relying on privacy
- keep reminder wording neutral and non-sensitive in case a host surfaces it

The hook should have a hard fallback: if hidden/context injection is unavailable,
do nothing rather than show noisy reminders to the user.

## Hook Package

Add a small hook script, not a full Hooker dependency:

```text
scripts/
  marketing-context-hook.js
```

Responsibilities:

- parse hook input JSON
- detect host: Claude Code vs Codex
- detect tool name and result
- classify event: mutation, stats, review, report, ignore
- emit hidden/context reminder only for interesting events
- dedupe by hash of tool name + action/account/result summary

Config:

```json
{
  "memoryToolServer": "marketing-context",
  "platforms": {
    "google-ads": {
      "mutationTools": ["confirm_mutation", "confirm_all_mutations"],
      "statTools": ["get_campaigns", "execute_gaql", "get_mutation_stats"]
    },
    "meta-ads": {
      "mutationTools": ["confirm_mutation", "confirm_all_mutations"],
      "statTools": ["get_insights", "get_mutation_stats"]
    }
  }
}
```

## Integration Steps

1. Create `marketing-context-mcp` package.
2. Implement filesystem-backed MCP tools and secret redaction.
3. Seed it with current `../marketing-knowledge` content.
4. Replace `@movibe/memory-bank-mcp` in `google-ads-baby` manifests.
5. Add the same server to `meta-ads-baby`, `google-analytics-baby`, and
   `report-baby`.
6. Add `PostToolUse` hook reminders for mutation/stat/review events.
7. Add docs and examples for team-shared Drive/OneDrive context dirs.
8. After the hook path is stable, add optional automatic summaries for
   confirmed mutations, but keep user/business interpretation model-driven.

## Initial Scope

P0:

- MCP server with read/search/append tools
- markdown + jsonl storage
- path and secret safety
- Google Ads Baby manifest migration
- PostToolUse reminder for confirmed mutations

P1:

- client context tools
- Meta/GA4/Report integration
- stats/review reminder classification
- dedupe state

P2:

- richer search scoring
- migration script from `MARKETING_KNOWLEDGE_DIR`
- optional hook recipes based on Hooker conventions
- UI-friendly status/debug tool

## Open Questions

- Do we keep the visible MCP server name `marketing-knowledge` for backward
  compatibility while the package is `@treetank/marketing-context-mcp`?
- Should client slugs be model-chosen, account-id-based, or explicitly mapped?
- How much result content should hooks inspect before they become too expensive
  or too host-specific?
- Should `append_mutation` accept raw preview/result or require a model-written
  `business_summary`?
