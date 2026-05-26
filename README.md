# ads-ads-baby

Marketplace hub for ads management Claude Code plugins with two-phase mutation safety.

## Plugins

| Plugin | Platform | Repo |
|--------|----------|------|
| **Google Ads Baby** | Google Ads | [treetank-net/google-ads-baby](https://github.com/treetank-net/google-ads-baby) |
| **Meta Ads Baby** | Meta (Facebook) Ads | [treetank-net/meta-ads-baby](https://github.com/treetank-net/meta-ads-baby) |

## What is this?

This repo is a Claude Code / Codex marketplace manifest that bundles both plugins for easy discovery and installation. Each plugin runs its own local MCP server with a two-phase mutation safety flow (prepare → user confirmation → execute).

## Safety

All mutations require explicit user confirmation via a safe word mechanism enforced by hooks. The LLM cannot execute mutations without a real user message in between. This is especially critical for Meta Ads which has no test/sandbox mode.

## License

MIT
