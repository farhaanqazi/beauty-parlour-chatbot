---
name: qwen:debug
description: Deep root-cause debugging — trace an error through execution layers, identify the real cause, fix it
argument-hint: "<error message or description>"
allowed-tools:
  - Read
  - Write
  - Bash
  - Task
---
<objective>
Perform systematic root-cause analysis on a bug or error.

Steps:
1. Reproduce the error
2. Trace execution path
3. Identify root cause (not just symptoms)
4. Propose and implement fix
5. Verify fix doesn't break anything else

**Creates:** `.planning/DEBUG.md` — root cause analysis log
</objective>

<execution_context>
@~/.config/qwen-code/qwen-gsd/workflows/debug.md
@~/.config/qwen-code/qwen-gsd/templates/debug-report.md
</execution_context>

<context>
$ARGUMENTS
</context>

<process>
Execute the debug workflow. Never guess — trace to root cause.
</process>
