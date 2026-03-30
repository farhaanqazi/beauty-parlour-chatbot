# Ship Workflow

<purpose>
Prepare a release: run tests, check for TODOs and hardcoded values, generate changelog, bump version, and create release documentation.
</purpose>

## 1. Pre-flight Checks

### Step 1.1: Verify Current State
Check `STATE.md`:
- Current phase should be complete
- All phases should be verified

If not complete, error: "Project not ready to ship. Complete current phase first."

### Step 1.2: Check Git Status
```bash
git status
```

Ensure:
- Working directory is clean (no uncommitted changes)
- On main branch (or release branch)
- All commits are pushed

If not clean, commit or stash changes first.

## 2. Run Tests

### Step 2.1: Execute Full Test Suite
```bash
# Node.js projects
npm test

# Python projects
python -m pytest -v

# Or project-specific test command
[project test command]
```

### Step 2.2: Check Test Results
- All tests must pass
- Coverage should meet project threshold (if configured)

If tests fail:
- Read the full error output
- Debug using the debug workflow
- Fix and re-run

### Step 2.3: Run Linters
```bash
# ESLint (Node.js)
npm run lint

# Pylint/Flake8 (Python)
pylint src/
# or
flake8 src/

# Or project-specific lint command
[project lint command]
```

Fix any critical lint errors.

## 3. Code Quality Scan

### Step 3.1: Check for TODOs
```bash
grep -r "TODO\|FIXME\|XXX\|HACK" src/ --include="*.py" --include="*.js" --include="*.ts" --include="*.jsx" --include="*.tsx"
```

For each TODO found:
- If in critical path → must fix before shipping
- If minor → document in RELEASE.md as known issue

### Step 3.2: Check for Hardcoded Values
```bash
# Look for hardcoded URLs, paths, credentials
grep -r "http://\|https://\|/home/\|/Users/\|password\s*=\|api_key\s*=" src/ --include="*.py" --include="*.js" --include="*.ts"
```

Replace with:
- Environment variables
- Configuration files
- Constants at the top of the file

### Step 3.3: Check for Debug Code
```bash
# Look for debug prints, console.logs
grep -r "console.log\|print(\|debugger" src/ --include="*.py" --include="*.js" --include="*.ts"
```

Remove or gate behind debug flags.

## 4. Generate Changelog

### Step 4.1: Get Git Log Since Last Release
```bash
# Get last release tag
git describe --tags --abbrev=0

# Get commits since last release
git log $(git describe --tags --abbrev=0)..HEAD --oneline
```

### Step 4.2: Categorise Changes
Group commits by type:

```markdown
## [Version] - [Date]

### Added
- [Feature 1]
- [Feature 2]

### Changed
- [Change 1]
- [Change 2]

### Fixed
- [Bug fix 1]
- [Bug fix 2]

### Removed
- [Removed feature]

### Security
- [Security improvement]
```

### Step 4.3: Write Meaningful Entries
Transform commit messages into user-facing changelog entries:

**Bad:** `fix: stuff`
**Good:** `Fixed login redirect loop when using SSO authentication`

**Bad:** `refactor: update api`
**Good:** `Refactored API layer to use async/await, improving response times by 30%`

## 5. Version Bump

### Step 5.1: Determine Version Type
Ask the user or infer from changes:
- **MAJOR** (1.0.0 → 2.0.0): Breaking changes
- **MINOR** (1.2.0 → 1.3.0): New features, backwards compatible
- **PATCH** (1.2.3 → 1.2.4): Bug fixes only

### Step 5.2: Update Version Files
```bash
# npm projects (updates package.json)
npm version [major|minor|patch]

# Python projects (update pyproject.toml or setup.py)
# Edit version in pyproject.toml

# Or manually edit version file
```

### Step 5.3: Create Git Tag
```bash
git tag -a v[version] -m "Release v[version]"
git push origin v[version]
```

## 6. Create Release Documentation

Create `RELEASE.md`:

```markdown
# Release v[Version]

**Date:** [date]
**Type:** Major/Minor/Patch

## What's New

[2-3 sentences summarising the release]

## Changelog

[Full changelog from Step 4]

## Upgrade Instructions

### From v[previous] to v[current]

1. [Step 1: e.g., run migrations]
2. [Step 2: e.g., update config]
3. [Step 3: e.g., restart services]

## Known Issues

- [Issue 1]: [Description and workaround]
- [Issue 2]: [Description and workaround]

## Contributors

- [Contributor 1]
- [Contributor 2]

---

**Full diff:** [GitHub compare link]
```

## 7. Final Checks

### Step 7.1: Build the Project
```bash
# Node.js
npm run build

# Python
python -m build

# Or project-specific build command
```

Ensure build succeeds with no errors.

### Step 7.2: Verify Package Contents
```bash
# Check what will be published
npm pack --dry-run
# or
python -m build --outdir dist/
```

Ensure:
- All necessary files included
- No sensitive files (`.env`, credentials)
- No test files or dev dependencies in production package

## 8. Output Summary

Print:
```
✓ Release v[Version] ready

Tests: [pass count] passed
Changelog: [N] entries
Version: [old] → [new]

Files created:
- RELEASE.md
- Changelog updated
- Git tag: v[version]

Next:
- git push && git push --tags
- npm publish  (or equivalent)
- Create GitHub release from tag
```
