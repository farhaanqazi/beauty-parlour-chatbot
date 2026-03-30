---
name: debug
description: Systematic root cause debugging. Use when the user has an error, unexpected behaviour, or failing test and wants it traced to its actual cause — not just a surface fix.
---

# Debug Skill

Find the real cause of bugs. Never guess — trace.

## Debugging Protocol

### Step 1: Reproduce reliably
Before touching anything, confirm the error is reproducible.
```bash
# Run the failing command/test
# Copy the exact error output — full stack trace, not just the last line
```

### Step 2: Read the full error
Most bugs are in the stack trace. Read it bottom-up:
- **Bottom**: where the error originated
- **Top**: what called it
- Identify the first line in *your code* (not library code) — that's usually where to look

### Step 3: Isolate
- Comment out code until the error disappears — then you know the culprit block
- Add print/log statements to confirm what values actually are vs what you think they are
- Don't assume — verify with output

### Step 4: Trace the data
```python
# Before the failing line, print every value involved
print(f"DEBUG: input={input!r}, type={type(input)}")
print(f"DEBUG: config={config}")
print(f"DEBUG: result_so_far={result!r}")
```

### Step 5: Check the common causes first

**Python:**
- `None` where an object is expected → check return values of functions that could return `None`
- `KeyError` → key doesn't exist, use `.get()` or check first
- `AttributeError` → wrong type or `None` in the chain
- `ImportError` → package not installed or wrong name

**JavaScript/TypeScript:**
- `Cannot read property X of undefined` → something in the chain is `null/undefined`
- `is not a function` → wrong type, or method doesn't exist on this object
- Async issues → missing `await`, or `.then()` chain broken

**Database:**
- Run the query directly in a DB client with the actual values to confirm it works
- Check connection string, credentials, and that migrations have run

**API/Network:**
- Print the full request (URL, headers, body) and full response before parsing
- Check status codes — a 401 that gets parsed as JSON looks like a weird JSON error

### Step 6: Fix and verify
- Fix only the root cause — not the symptom
- Re-run the original failing case
- Run the full test suite to confirm nothing else broke

## Common Patterns

```python
# Pattern: unexpected None
result = get_user(id)
if result is None:
    raise ValueError(f"User {id} not found")  # explicit, not AttributeError later

# Pattern: type confusion
value = request.get('count')  # could be string "5" not int 5
count = int(value) if value is not None else 0
```

## Debug Report Format

When the investigation is complete:

```
Root cause: [one sentence — the actual cause]
Why it happened: [the chain of events that led to it]
Fix applied: [what was changed]
Verification: [how it was confirmed fixed]
Related risk: [anything similar nearby that could fail the same way]
```
