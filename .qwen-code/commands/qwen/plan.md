---
name: qwen:plan
description: Plan the next phase in detail — break it into tasks, define acceptance criteria, identify risks
argument-hint: "[phase number, e.g. 1]"
allowed-tools:
  - Read
  - Write
  - Bash
  - Task
---
<objective>
Generate a detailed execution plan for a roadmap phase.

**Reads:** `.planning/ROADMAP.md`, `.planning/STATE.md`
**Creates:** `.planning/phases/phase-N.md` — tasks, subtasks, acceptance criteria, risks

**After this command:** Run `/qwen:build` to execute the plan.
</objective>

<execution_context>
@~/.config/qwen-code/qwen-gsd/workflows/plan-phase.md
@~/.config/qwen-code/qwen-gsd/references/phase-format.md
@~/.config/qwen-code/qwen-gsd/templates/phase.md
</execution_context>

<context>
Target phase: $ARGUMENTS
</context>

<process>
Execute the plan-phase workflow from @~/.config/qwen-code/qwen-gsd/workflows/plan-phase.md.
If no phase number provided, default to the current phase from STATE.md.
</process>
