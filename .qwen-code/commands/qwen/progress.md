---
name: qwen:progress
description: Show current project state — active phase, completed tasks, what's next
allowed-tools:
  - Read
---
<objective>
Read .planning/STATE.md and .planning/ROADMAP.md and display a clear summary:
- Project name and goal (one line)
- Current phase and its completion percentage
- Last 3 completed tasks
- Next 3 pending tasks
- Any blockers noted in STATE.md

Keep it brief and scannable. This is a status check, not a report.
</objective>

<process>
Read the planning files and summarise. If no planning files exist, suggest running /qwen:new-project.
</process>
