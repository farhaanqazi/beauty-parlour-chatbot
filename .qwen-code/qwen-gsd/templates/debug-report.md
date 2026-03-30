# Debug Report

**Date:** [date]
**Error:** [Brief description of the error]
**Severity:** Critical / High / Medium / Low

---

## Summary

| Field | Value |
|-------|-------|
| **Root cause** | [One sentence] |
| **Time to fix** | [X hours] |
| **Files changed** | [N] |
| **Verified** | [Yes/No] |

---

## Root Cause

[One sentence: the actual cause, not the symptom]

**Example:** "The user ID was passed as a string instead of an integer, causing a type mismatch in the database query."

---

## Why It Happened

[The chain of events that led to the error]

1. [Event 1 — e.g., "The API endpoint accepted user_id as a string parameter"]
2. [Event 2 — e.g., "The value was passed directly to the ORM without type conversion"]
3. [Event 3 — e.g., "PostgreSQL rejected the query due to type mismatch"]

**Underlying factors:**
- [Factor 1 — e.g., "No input validation at API boundary"]
- [Factor 2 — e.g., "Type assumptions not documented"]

---

## Fix Applied

[Description of what was changed]

### Code Changes

```diff
--- a/src/file.py
+++ b/src/file.py
@@ -10,7 +10,10 @@ def get_user(user_id):
-    query = f"SELECT * FROM users WHERE id = {user_id}"
+    # Validate and convert user_id to integer
+    if not isinstance(user_id, int):
+        user_id = int(user_id)
+    query = "SELECT * FROM users WHERE id = %s"
     cursor.execute(query, (user_id,))
```

### Files Modified

| File | Change |
|------|--------|
| `src/file.py` | Added type validation and parameterized query |
| `src/validator.py` | Added `validate_user_id()` function |

---

## Verification

### Original Failing Case

```bash
# Command that previously failed
[command]

# Output after fix
[output showing success]
```

### Test Results

```bash
# Test suite run
[command]
[N] tests passed
```

### Edge Cases Tested

- [x] Valid integer user_id
- [x] String user_id (e.g., "123")
- [x] Invalid input (e.g., "abc") — now fails gracefully
- [x] Null/undefined input — now fails gracefully

---

## Related Risk

[Similar code that could fail the same way]

| Location | Risk | Status |
|----------|------|--------|
| `src/other_file.py:45` | Same type assumption | ✅ Reviewed — safe |
| `src/api/users.py:22` | Same pattern | ⚠️ Needs fix |

### Follow-up Actions

- [ ] [Fix similar issue in src/api/users.py]
- [ ] [Add type hints to all API functions]
- [ ] [Add integration test for type validation]

---

## Prevention

[What could prevent this class of error in future]

### Immediate Actions

- [ ] Add input validation at all API boundaries
- [ ] Use type hints and enable strict type checking

### Long-term Improvements

- [ ] Add static type checking (mypy, TypeScript) to CI
- [ ] Create shared validation utilities
- [ ] Document type expectations in API spec

---

## Lessons Learned

1. [Lesson 1 — e.g., "Always validate external input, even from trusted sources"]
2. [Lesson 2 — e.g., "Type assumptions should be explicit, not implicit"]

---

**Reported by:** [Qwen Code with qwen-gsd debug skill]
**Reviewed by:** [Name, if applicable]
