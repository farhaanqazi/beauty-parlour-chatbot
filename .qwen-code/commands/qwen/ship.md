---
name: qwen:ship
description: Prepare the project for release — generate changelog, run final checks, create release summary
argument-hint: "[version, e.g. 1.0.0]"
allowed-tools:
  - Read
  - Write
  - Bash
---
<objective>
Run pre-release checks and produce release artefacts.

Steps:
1. Run tests if present
2. Check for obvious issues (TODOs, console.logs, hardcoded values)
3. Generate user-facing changelog from recent commits
4. Update version if provided
5. Create RELEASE.md summary

Version: $ARGUMENTS (if provided, bump package.json/pyproject.toml)
</objective>

<execution_context>
@~/.config/qwen-code/qwen-gsd/workflows/ship.md
</execution_context>

<process>
Execute ship workflow. Be thorough on checks. The changelog should be user-friendly, not raw commit messages.
</process>
