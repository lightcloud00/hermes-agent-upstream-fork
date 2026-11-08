# CLAUDE.md

Short Claude Code entry point, so a session here does not load the 95 KB upstream `AGENTS.md`.
`AGENTS.md` stays the canonical development guide; Hermes itself still reads it first.
Read only the sections the task needs (`grep -n '^## ' AGENTS.md` lists them).

Always:
- Never break per-conversation prompt caching: no mid-conversation context edits, toolset swaps or system-prompt rebuilds (AGENTS.md "Important Policies").
- Keep the core narrow; new capability goes in a CLI command plus skill, a gated tool, or a plugin (AGENTS.md "Contribution Rubric").
- Run tests with `scripts/run_tests.sh`, never bare `pytest` (AGENTS.md "Testing").
- Before touching tools, config, plugins, skills, cron, profiles or the update pipeline, read that AGENTS.md section and "Known Pitfalls".
