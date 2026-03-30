---
name: qwen:build
description: Execute the current phase plan — implement tasks with checkpoints and progress tracking
argument-hint: "[phase number, defaults to current]"
allowed-tools:
  - Read
  - Write
  - Bash
  - Task
---
<objective>
Execute all tasks in the current phase plan, in order.

**Reads:** `.planning/phases/phase-N.md`, `.planning/STATE.md`
**Updates:** `.planning/STATE.md` after each task completes

After each task: verify it works before moving on.
After all tasks: run `/qwen:review` to validate the phase.
</objective>

<execution_context>
@~/.config/qwen-code/qwen-gsd/workflows/build.md
@~/.config/qwen-code/qwen-gsd/references/verification-patterns.md
</execution_context>

<context>
Target phase: $ARGUMENTS
</context>

<process>
Execute the build workflow from @~/.config/qwen-code/qwen-gsd/workflows/build.md.
Work through tasks sequentially. After each task, verify before proceeding.
Update STATE.md to reflect progress.
</process>
