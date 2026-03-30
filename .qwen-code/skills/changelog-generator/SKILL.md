---
name: changelog-generator
description: Generate a user-facing changelog from git commit history. Use when the user wants release notes, a changelog entry, or a summary of what changed between versions or dates. Transforms technical commits into readable, customer-friendly language.
---

# Changelog Generator Skill

Turn raw git commits into a polished, user-facing changelog.

## When to Use

- Preparing release notes for a new version
- Writing a CHANGELOG.md entry
- Creating app store update descriptions
- Summarising what changed this week/sprint for stakeholders

## How to Get Commits

```bash
# Commits since last tag
git log $(git describe --tags --abbrev=0)..HEAD --oneline

# Commits in last 7 days
git log --since="7 days ago" --oneline

# Commits between two versions
git log v1.2.0..v1.3.0 --oneline

# Full commit messages (for better context)
git log --since="7 days ago" --pretty=format:"%h %s%n%b"
```

## Categorisation Rules

Map commit prefixes/content to categories:

| Commit contains | Category |
|---|---|
| `feat:`, `add`, `new`, `implement` | ✨ New features |
| `fix:`, `bug`, `patch`, `resolve` | 🐛 Bug fixes |
| `perf:`, `speed`, `optimise`, `faster` | ⚡ Performance |
| `security`, `auth`, `vuln`, `cve` | 🔒 Security |
| `break`, `remove`, `deprecat` | ⚠️ Breaking changes |
| `docs`, `readme` | 📝 Documentation |
| `refactor`, `clean`, `test`, `ci`, `chore` | Skip (internal) |

## Output Format

```markdown
# Changelog — v1.3.0 (March 2026)

## ✨ New features
- **Feature name**: Plain English description of what users can now do.

## 🐛 Bug fixes
- Fixed issue where [thing] would [bad behaviour] when [condition].

## ⚡ Performance
- [Area] is now significantly faster.

## ⚠️ Breaking changes
- `old_function()` has been removed. Use `new_function()` instead.
```

## Writing Rules

- Write for users, not developers — "You can now export to PDF" not "Added PDF export endpoint"
- Lead with the user benefit: "Export to PDF" not "PDF export added"
- Skip all internal commits (refactors, tests, CI changes, dependency bumps)
- Keep each entry to 1-2 sentences max
- If a commit is unclear, use the PR title or description if available
- Breaking changes always go at the top, even if there's only one
