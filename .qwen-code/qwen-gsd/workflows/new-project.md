# New Project Workflow

<purpose>
Initialize a new project through unified flow: questioning → research (optional) → requirements → roadmap.
This is the highest-leverage moment in any project. Deep questioning here means better plans and better outcomes.
</purpose>

## 1. Setup

Check if a `.planning/` directory already exists.
If it does, and `PROJECT.md` exists → error: "Project already initialized. Run `/qwen:progress` to see current state."

Create `.planning/` if it doesn't exist.

## 2. Auto Mode Check

Check if `--auto` is in $ARGUMENTS.

**If auto mode:**
- Look for an @file reference or pasted text in the arguments
- If none found, error: "Auto mode requires a brief or document. Usage: `/qwen:new-project --auto @brief.md`"
- Extract project name, goal, and key features from the document
- Skip to Step 5 (requirements) using the document as input
- Auto-approve requirements and roadmap

## 3. Project Questioning

Ask these questions — not all at once, but conversationally. Start with the first 3, then follow up:

**Round 1:**
1. What are you building? (one sentence)
2. Who is it for, and what problem does it solve for them?
3. What does success look like in 4-6 weeks?

**Round 2 (after getting answers):**
4. What's the tech stack? (or should we recommend one?)
5. Are there existing integrations or systems this must connect to?
6. What's the most technically uncertain part?

**Round 3 (if needed):**
7. Any hard constraints? (timeline, team size, must-have features for v1)
8. What are you explicitly NOT building in v1?

## 4. Create PROJECT.md

Write `.planning/PROJECT.md` using the template:

```markdown
# [Project Name]

## Goal
[One sentence: what this project does and for whom]

## Problem
[The problem being solved]

## Success criteria
[3-5 measurable outcomes for v1]

## Tech stack
[Language, framework, database, hosting]

## Integrations
[External systems, APIs]

## Constraints
[Timeline, team, non-goals]

## Open questions
[Unresolved technical decisions]
```

## 5. Requirements

Generate a prioritised requirements list:

```markdown
# Requirements

## Must have (v1)
- [ ] [Requirement 1]
- [ ] [Requirement 2]

## Should have (v1 if time allows)
- [ ] [Requirement]

## Won't have (v1)
- [Explicitly excluded item]
```

Present to user. Ask: "Does this capture what you want to build? Any changes?"
Revise until approved.

## 6. Roadmap

Generate a phased roadmap. Aim for 3-5 phases, each 1-2 weeks:

```markdown
# Roadmap

## Phase 1: Foundation
**Goal:** [What phase 1 delivers]
**Deliverables:**
- [D1]
- [D2]
**Done when:** [Acceptance criteria]

## Phase 2: Core Features
...
```

Present to user. Ask: "Does this phasing make sense? Want to adjust scope or order?"
Revise until approved.

## 7. Initialise State

Create `.planning/STATE.md`:

```markdown
# Project State

**Status:** Planning complete
**Current phase:** 1
**Last updated:** [date]

## Phase 1 status
Not started

## Notes
[Any context worth preserving across sessions]
```

## 8. Finish

Print:
```
✓ Project initialized

Next step: /qwen:plan 1
This will break Phase 1 into detailed tasks ready to build.
```
