# Debug Workflow

<purpose>
Systematically trace errors to their root cause using a structured protocol.
This workflow avoids guesswork and surface-level fixes.
</purpose>

## 1. Reproduce

### Step 1.1: Capture the Error
Get the complete error output:
- Full stack trace (not just the last line)
- Command or action that triggered it
- Environment details (OS, versions, relevant config)

### Step 1.2: Confirm Reproducibility
Run the failing action again:
```bash
# Exact command that fails
[command]
```

If it fails consistently → proceed.
If it's intermittent → add logging to catch it when it happens.

### Step 1.3: Minimise the Reproduction
Strip away anything not essential to reproducing the error:
- Comment out unrelated code
- Use minimal input that still triggers the error
- Isolate to a single file or function if possible

## 2. Isolate

### Step 2.1: Read the Stack Trace
Read bottom-up:
- **Bottom**: where the error originated (often library code)
- **Middle**: the call chain
- **Top**: your code that triggered it

Find the first line that's *your code* — start there.

### Step 2.2: Binary Search the Code
Comment out sections until the error disappears:
1. Comment out half the relevant code
2. Run again
3. If error gone → culprit is in commented section
4. If error remains → culprit is in remaining section
5. Repeat until isolated to a few lines

### Step 2.3: Add Debug Output
Before the failing line, print all relevant values:

```python
# Python example
print(f"DEBUG: input={input!r}, type={type(input)}")
print(f"DEBUG: config={config}")
print(f"DEBUG: intermediate_result={result!r}")
```

```javascript
// JavaScript example
console.log('DEBUG:', { input, type: typeof input, config, result });
```

## 3. Trace

### Step 3.1: Follow the Data
Trace the failing value through its journey:
1. Where does it originate?
2. What transformations does it undergo?
3. Where does it become invalid?

### Step 3.2: Check Assumptions
For each transformation, verify:
- Expected type vs actual type
- Expected value vs actual value
- Null/undefined checks present?
- Error handling for edge cases?

### Step 3.3: Identify the Root Cause
The root cause is the *first* place where:
- A wrong assumption was made
- A validation was missing
- An edge case wasn't handled

Not where the error was thrown — where it *originated*.

## 4. Fix

### Step 4.1: Fix the Root Cause
Apply the fix at the source, not the symptom:

**Bad (symptom fix):**
```python
# Just catch the error and ignore it
try:
    result = risky_operation()
except Exception:
    pass  # Error gone but problem remains
```

**Good (root cause fix):**
```python
# Validate input before the operation
if not valid_input(input):
    raise ValueError(f"Invalid input: {input!r}")
result = risky_operation(input)
```

### Step 4.2: Add Defensive Checks
Prevent the same class of error:
- Input validation at function boundaries
- Type checks where types matter
- Null checks before property access
- Error messages that explain *why* something failed

### Step 4.3: Update Related Code
Check for similar patterns in the codebase:
```bash
# Search for similar patterns
grep -r "similar_pattern" src/
```

Fix all instances, not just the one that failed.

## 5. Verify

### Step 5.1: Re-run Original Failing Case
```bash
# Exact command from Step 1
[command]
```

Confirm it now succeeds.

### Step 5.2: Run Related Tests
```bash
# Full test suite or relevant subset
npm test
# or
python -m pytest
```

### Step 5.3: Test Edge Cases
Test the boundaries:
- Empty inputs
- Maximum values
- Invalid inputs (should fail gracefully)
- Concurrent operations (if applicable)

## 6. Document

Create or update `DEBUG.md`:

```markdown
# Debug Report

**Date:** [date]
**Error:** [Brief description]

## Root Cause
[One sentence: the actual cause, not the symptom]

## Why It Happened
[The chain of events: A led to B which led to C]

## Fix Applied
[What was changed — include code diff or description]

```diff
- old_code
+ new_code
```

## Verification
- [x] Original failing case now passes
- [x] Related tests pass
- [x] Edge cases handled

## Related Risk
[Any similar code that could fail the same way]

## Prevention
[What could prevent this class of error in future]
```

## 7. Output Summary

Print:
```
✓ Debug complete

Root cause: [one sentence]
Fix: [brief description]
Verified: [how confirmed]

Report: DEBUG.md
```
