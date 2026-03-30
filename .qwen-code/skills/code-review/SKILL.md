---
name: code-review
description: Perform a systematic code review. Use when the user asks for a code review, wants feedback on their code quality, or needs an analysis of correctness, security, performance, and maintainability.
---

# Code Review Skill

Perform thorough, structured code reviews that surface real issues — not just style nits.

## Review Checklist

Work through these dimensions in order:

### 1. Correctness
- Does the code do what it's supposed to?
- Are there off-by-one errors, null/undefined cases, or unhandled edge cases?
- Is error handling complete (not just happy path)?
- Are async operations handled properly (no missing awaits, race conditions)?

### 2. Security
- User input: is it validated and sanitised before use?
- SQL: parameterised queries only — no string interpolation
- Auth: are endpoints protected that should be?
- Secrets: any hardcoded credentials, tokens, or API keys?
- Dependencies: any known-vulnerable packages?

### 3. Performance
- Any N+1 query problems?
- Unnecessary work inside loops?
- Missing indexes implied by the query patterns?
- Large data loaded into memory that could be streamed?

### 4. Maintainability
- Is the code readable to someone unfamiliar with it?
- Are functions doing one thing?
- Is there duplicated logic that should be extracted?
- Are names clear and accurate?

### 5. Test coverage
- Are the happy path and error cases tested?
- Any obvious untested branches?

## Output Format

```
## Code Review

### Critical (must fix before merge)
- [file:line] Issue description + suggested fix

### Warnings (should fix)
- [file:line] Issue description

### Suggestions (nice to have)
- [file:line] Suggestion

### Summary
X critical issues, Y warnings, Z suggestions.
Overall: [Ready to merge / Needs work / Major revision needed]
```

## Approach

- Be direct and specific — cite the exact line
- Explain *why* something is a problem, not just that it is
- Provide the fix, not just the critique
- Acknowledge what's done well (1-2 lines) — this isn't optional
- Don't pad with obvious style comments if there are real issues to surface
