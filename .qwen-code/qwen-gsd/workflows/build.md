# Build Workflow

<purpose>
Execute all tasks in a phase plan sequentially, verifying each task before moving to the next.
This workflow ensures steady, verified progress through the phase.
</purpose>

## 1. Read Context

Load the following files:
- `.planning/phases/phase-N.md` — the phase plan with tasks
- `.planning/STATE.md` — current project state
- `.planning/PROJECT.md` — project context and tech stack

If the phase plan does not exist, error: "Phase plan not found. Run `/qwen:plan [N]` first."

## 2. Determine Starting Point

Read `STATE.md` to find:
- `current_phase` — which phase we're on
- `completed_tasks` — which tasks are already done
- `current_task` — which task to resume from (if interrupted)

If resuming, start from `current_task`.
If starting fresh, start from Task 1.

## 3. Execute Tasks Sequentially

For each task in the phase plan:

### Step 3.1: Announce Task
Print:
```
▶ Task N: [Task Name]
  What: [Task description]
  Done when: [Acceptance criterion]
```

### Step 3.2: Implement
Follow the "How" instructions from the task plan.

**Implementation rules:**
- Write code that matches the project's existing style
- Create files at the specified paths
- Implement functions with proper error handling
- Add comments only for complex logic (not obvious things)
- Follow the tech stack from PROJECT.md

### Step 3.3: Self-Review Before Verification
Before marking as complete:
- Review the code for obvious bugs
- Check that all specified files were created
- Verify the implementation matches the "What" description

### Step 3.4: Verify
Run the verification for the "Done when" criterion:

**For code tasks:**
```bash
# Run the code or test
node src/file.js
# or
python -m pytest tests/test_file.py -v
```

**For config/setup tasks:**
```bash
# Verify the file exists and has correct content
cat config/file.yaml
```

**For documentation tasks:**
- Read the generated document
- Confirm it covers all required sections

If verification fails:
1. Read the error output fully
2. Debug using the debug workflow patterns
3. Fix and re-verify

### Step 3.5: Update State
After successful verification, update `STATE.md`:
- Add task to `completed_tasks`
- Set `current_task` to the next task
- Add a brief note about what was done
- Update timestamp

```markdown
## Task N completed
- **Completed:** [date]
- **Notes:** [Brief summary of what was implemented]
```

### Step 3.6: Checkpoint
Before moving to the next task, create a checkpoint:
- Commit to git if git is being used
- Note any deviations from the plan
- Flag any new risks discovered

## 4. Handle Blockers

If a task is blocked:
- Document the blocker in `STATE.md`
- Flag it for user decision
- Do not proceed to the next task until resolved

Common blockers:
- Missing credentials or API keys
- Unclear requirements
- Technical impossibility (report and suggest alternatives)

## 5. Complete Phase

After all tasks are done:

### Step 5.1: Update Phase State
Update `STATE.md`:
- Set phase status to "complete"
- Increment `current_phase` if there's a next phase
- Add phase completion summary

### Step 5.2: Print Summary
```
✓ Phase [N] complete

[Tasks completed]/[Total tasks] tasks completed
All acceptance criteria verified

Next: /qwen:review [N]
```

## 6. Quality Gates

**Before completing any task:**
- Code runs without errors
- Tests pass (if applicable)
- No TODOs or placeholders left in critical paths
- Files are at correct locations

**Before completing the phase:**
- All tasks verified
- STATE.md is up to date
- No known blockers for the next phase
