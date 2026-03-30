# Review Workflow

<purpose>
Verify completed work against the phase acceptance criteria.
Produce a verification report showing pass/fail/partial for each criterion.
</purpose>

## 1. Read Context

Load the following files:
- `.planning/phases/phase-N.md` — the phase plan with acceptance criteria
- `.planning/ROADMAP.md` — original phase goals
- `.planning/STATE.md` — completed tasks and notes
- `.planning/PROJECT.md` — project context

If the phase plan does not exist, error: "Phase plan not found. Run `/qwen:plan [N]` first."

## 2. Gather Completed Work

From `STATE.md`, identify:
- All completed tasks in this phase
- Files created or modified
- Features implemented

Build a list of artifacts to verify:
- Source files
- Configuration files
- Documentation
- Tests

## 3. Verify Each Acceptance Criterion

For each acceptance criterion in the phase plan:

### Step 3.1: State the Criterion
Write it verbatim from the plan.

### Step 3.2: Define Verification Method
How will you check this?

**Examples:**
- "User can log in" → Run login flow, check for successful authentication
- "API returns correct data" → Call endpoint, validate response schema
- "Database has correct schema" → Run migration, inspect tables

### Step 3.3: Execute Verification
Run the verification:

```bash
# Example: test login
curl -X POST http://localhost:3000/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"test123"}'
```

### Step 3.4: Record Result
Mark as:
- **PASS** — criterion fully met, verification succeeded
- **PARTIAL** — mostly met but with gaps or edge cases failing
- **FAIL** — criterion not met or verification failed

### Step 3.5: Add Evidence
For each result, include:
- Output from tests or commands
- Screenshots if UI-related
- Code snippets showing implementation

## 4. Check for Common Issues

### Code Quality
- No hardcoded secrets or credentials
- No TODOs in critical paths
- Error handling present for external calls
- Input validation on user-facing APIs

### Completeness
- All files from the plan exist
- All functions are implemented
- All edge cases handled

### Documentation
- README updated if new features added
- API documentation matches implementation
- Configuration documented

## 5. Produce Verification Report

Create `VERIFICATION.md` in the project root:

```markdown
# Phase [N] Verification Report

**Date:** [date]
**Phase:** [Phase name]

## Summary
- **Total criteria:** [N]
- **Pass:** [N]
- **Partial:** [N]
- **Fail:** [N]

## Criteria Results

### Criterion 1: [Name]
**Status:** PASS/PARTIAL/FAIL

**Verification method:**
[How it was tested]

**Evidence:**
```bash
[command output or test results]
```

**Notes:**
[Any context about this result]

### Criterion 2: ...

## Issues Found

| Issue | Severity | Description |
|-------|----------|-------------|
| [I1] | High/Medium/Low | [What's wrong] |

## Recommendations

- [ ] [Fix for issue 1]
- [ ] [Improvement for next phase]

## Sign-off

- [ ] All PASS criteria verified
- [ ] PARTIAL items documented with follow-up plan
- [ ] FAIL items have remediation plan

---

**Verified by:** [Qwen Code with qwen-gsd]
```

## 6. Update State

Update `STATE.md`:
- Set phase verification status
- Link to `VERIFICATION.md`
- Note any follow-up actions needed

## 7. Output Summary

Print:
```
✓ Phase [N] verification complete

[Pass count]/[Total] criteria passed
[Partial count] partial (documented in VERIFICATION.md)
[Fail count] failed (remediation plan needed)

Report: VERIFICATION.md

Next: 
- If all pass: /qwen:build [N+1] or /qwen:ship
- If partial/fail: fix issues, then re-run /qwen:review
```
