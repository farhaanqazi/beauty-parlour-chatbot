# Verification Patterns

Use these patterns when verifying completed work.

## Acceptance Criteria Check

For each acceptance criterion in the phase spec:
1. State the criterion
2. How it was verified (ran X, saw Y)
3. Pass / Fail / Partial

## Code Checks

```bash
# Python: syntax check
python -m py_compile myfile.py

# Python: run tests
pytest -v

# Node: run tests
npm test

# Check for obvious issues
grep -rn "TODO\|FIXME\|HACK\|XXX" --include="*.py" --include="*.ts" --include="*.js" .

# Check for hardcoded secrets (basic)
grep -rn "password\s*=\s*['\"][^'\"]\|api_key\s*=\s*['\"]" --include="*.py" .
```

## Verification Report Format

```markdown
# Verification Report — Phase N

## Acceptance criteria
| Criterion | Status | Evidence |
|---|---|---|
| [criterion] | ✅ Pass | [how verified] |
| [criterion] | ❌ Fail | [what's missing] |
| [criterion] | ⚠ Partial | [what's done, what's not] |

## Issues found
- [Critical]: [description]
- [Warning]: [description]

## Recommendation
[Ready to ship / Needs fixes / Needs rework]
```
