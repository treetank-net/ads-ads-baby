---
name: google-ads-safety
description: Safely confirm Google Ads mutations in Codex using a real user reply and server-side safe-word confirmation.
---

# Google Ads Safety

For every Google Ads mutation:

1. Call the appropriate `prepare_*` tool with a random safe word.
2. Show the complete preview and safe word to the user, then stop and wait.
3. Only after a new user message explicitly confirms the action and includes that safe word, call `confirm_mutation`.

The global Codex `UserPromptSubmit` hook records the real user confirmation. The MCP server rejects `confirm_mutation` without that recorded confirmation.
Never use `confirm_safe_word` for normal operation or call `confirm_mutation` in the same turn as `prepare_*`.
