---
name: qwen:new-project
description: Initialize a new project with deep context gathering, requirements, and a phased roadmap
argument-hint: "[project idea or --auto @brief.md]"
allowed-tools:
  - Read
  - Write
  - Bash
  - Task
---
<context>
**Flags:**
- `--auto` — Skip interactive questioning. Extract context from a provided document (@file reference or pasted text). Proceeds to requirements and roadmap automatically.
</context>

<objective>
Initialize a new project through a unified flow: questioning → research (optional) → requirements → roadmap.

**Creates:**
- `.planning/PROJECT.md` — project context and tech decisions
- `.planning/REQUIREMENTS.md` — scoped, prioritized requirements
- `.planning/ROADMAP.md` — phased execution plan
- `.planning/STATE.md` — project memory (current phase, progress)

**After this command:** Run `/qwen:plan` to plan Phase 1 in detail.
</objective>

<execution_context>
@~/.config/qwen-code/qwen-gsd/workflows/new-project.md
@~/.config/qwen-code/qwen-gsd/references/questioning.md
@~/.config/qwen-code/qwen-gsd/templates/project.md
@~/.config/qwen-code/qwen-gsd/templates/requirements.md
@~/.config/qwen-code/qwen-gsd/templates/roadmap.md
</execution_context>

<process>
Execute the new-project workflow from @~/.config/qwen-code/qwen-gsd/workflows/new-project.md end-to-end.
Respect all workflow gates (questioning, validation, approvals).
</process>
