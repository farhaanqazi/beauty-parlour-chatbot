---
name: qwen:review
description: Review and verify completed work against the phase spec — runs checks, lists gaps, produces a verification report
allowed-tools:
  - Read
  - Write
  - Bash
  - Task
---
<objective>
Verify completed phase work against its spec and acceptance criteria.

**Reads:** `.planning/phases/phase-N.md`, `.planning/STATE.md`
**Creates:** `.planning/VERIFICATION.md` — what passed, what failed, what's missing

Checks: acceptance criteria met, no obvious bugs, tests pass if present.
</objective>

<execution_context>
@~/.config/qwen-code/qwen-gsd/workflows/review.md
@~/.config/qwen-code/qwen-gsd/references/verification-patterns.md
@~/.config/qwen-code/qwen-gsd/templates/verification-report.md
</execution_context>

<process>
Execute the review workflow from @~/.config/qwen-code/qwen-gsd/workflows/review.md.
Be thorough and honest. Surface real gaps, not just "looks good".
</process>
