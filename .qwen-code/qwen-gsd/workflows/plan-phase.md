# Plan Phase Workflow

<purpose>
Break down a roadmap phase into detailed, executable tasks with acceptance criteria and effort estimates.
This workflow transforms high-level goals into actionable plans.
</purpose>

## 1. Read Context

Load the following files:
- `.planning/ROADMAP.md` — phase goals and deliverables
- `.planning/PROJECT.md` — project context and tech stack
- `.planning/STATE.md` — current project state
- `.planning/phases/` — existing phase plans (if any)

If `ROADMAP.md` does not exist, error: "No roadmap found. Run `/qwen:new-project` first."

## 2. Select Phase

If a phase number is provided as argument, use that phase.
If no phase number provided, read `STATE.md` and use the `current_phase` value.
If `STATE.md` has no current phase, default to phase 1.

Extract from `ROADMAP.md`:
- Phase goal
- Deliverables list
- Acceptance criteria for the phase
- Any constraints or notes

## 3. Ask Clarifying Questions (if needed)

If any of these are unclear from the roadmap, ask before planning:
- What does "done" look like for this phase?
- Are there any external dependencies (APIs, services, teams)?
- Any technical constraints or preferences not in PROJECT.md?
- What's the timeline for this phase?

Do not proceed until all ambiguities are resolved.

## 4. Generate Task Breakdown

For each deliverable, break it into tasks. Each task must have:

**Task structure:**
```markdown
### Task N: [Task Name]
**What:** [What to build — be concrete about files, functions, APIs]
**How:** [Approach — specific steps, libraries, patterns to use]
**Done when:** [Concrete, verifiable acceptance criterion]
**Estimated effort:** [Small (<2h) / Medium (2-8h) / Large (>8h)]
```

**Task quality rules:**
- Each task should be completable in one session (2-8 hours ideal)
- Tasks must be independently verifiable
- No vague tasks like "set up authentication" — break into "create user model", "implement login endpoint", etc.
- Include file paths where applicable
- Reference specific libraries or patterns from PROJECT.md

## 5. Identify Dependencies

After listing all tasks, identify:
- Which tasks must be done before others
- External dependencies (waiting on APIs, services, decisions)
- Parallelizable tasks (can be done simultaneously)

## 6. Identify Risks

List technical risks for this phase:
- Uncertain technical decisions
- Complex integrations
- Performance concerns
- Security considerations

For each risk, add a mitigation:
```
- [Risk]: [Mitigation]
```

## 7. Create Phase Plan File

Create `.planning/phases/phase-N.md`:

```markdown
# Phase [N]: [Phase Name]

## Goal
[One sentence from ROADMAP.md]

## Deliverables
- [Deliverable 1]
- [Deliverable 2]

## Tasks

### Task 1: [Name]
**What:** [Description]
**How:** [Approach with specific files/functions]
**Done when:** [Acceptance criterion]
**Estimated effort:** [Small/Medium/Large]

### Task 2: ...

## Dependencies
- Task 1 → Task 2 (Task 2 requires Task 1's output)
- External: [Any external dependency]

## Risks
- [Risk]: [Mitigation]

## Done When (Phase Acceptance Criteria)
- [Criterion 1 from ROADMAP.md]
- [Criterion 2]
```

## 8. Update State

Update `.planning/STATE.md`:
- Set `current_phase` to N
- Set phase status to "planning_complete"
- Add timestamp

## 9. Output Summary

Print:
```
✓ Phase [N] plan created

[Task count] tasks identified
[Large task count] large tasks (consider breaking down further)
[Risk count] risks identified

Next: /qwen:build [N]
```
