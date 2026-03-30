---
name: git-workflow
description: Use when setting up Git repositories, defining branch strategies, writing commit messages, or creating PR templates. Ensures consistent version control practices across the team.
---

# Git Workflow Skill

Establish and maintain consistent Git practices for branching, commits, and pull requests.

## When to Use

- Initializing a new Git repository
- Setting up team Git workflows
- Writing commit messages
- Creating pull request descriptions
- Resolving merge conflicts
- Defining release strategies

## Repository Setup

### Initialize with .gitignore

```bash
git init

# Create .gitignore
cat > .gitignore << 'EOF'
# Dependencies
node_modules/
__pycache__/
vendor/

# Build outputs
dist/
build/
*.egg-info/

# Environment
.env
.env.local
.env.*.local

# IDE
.vscode/
.idea/
*.swp
*.swo

# OS
.DS_Store
Thumbs.db

# Logs
*.log
npm-debug.log*

# Testing
coverage/
.nyc_output/
EOF
```

### Initial Commit Structure

```bash
git add .
git commit -m "chore: initial project setup

- Add project structure
- Configure build tooling
- Set up development environment"
git branch -M main
```

## Branch Naming Convention

```
<type>/<description>

Types:
- feature/  — New feature
- fix/      — Bug fix
- hotfix/   — Urgent production fix
- refactor/ — Code refactoring
- docs/     — Documentation changes
- test/     — Test additions/changes
- chore/    — Maintenance tasks

Examples:
feature/user-authentication
fix/login-redirect-loop
hotfix/payment-processing-error
refactor/extract-payment-service
docs/api-endpoints
test/add-user-validation-tests
chore/update-dependencies
```

## Commit Message Convention

### Format

```
<type>(<scope>): <subject>

<body>

<footer>
```

### Types

| Type | Description |
|------|-------------|
| feat | New feature |
| fix | Bug fix |
| docs | Documentation only |
| style | Formatting, no code change |
| refactor | Code restructuring |
| test | Adding tests |
| chore | Maintenance, tooling |

### Good Commit Messages

```
feat(auth): add password reset functionality

- Add POST /auth/password-reset endpoint
- Send reset email via SendGrid
- Add token expiration (24 hours)
- Rate limit to 3 requests per hour

Closes #123
```

```
fix(api): handle null user in order endpoint

When a deleted user's order is fetched, the user
field was null causing a 500 error. Now returns
null user field instead of crashing.

Fixes #456
```

### Bad Commit Messages

```
✗ fix stuff
✗ wip
✗ update
✗ fixed bug
✗ asdf
```

## Git Workflow Patterns

### Feature Branch Workflow (Recommended for most teams)

```bash
# 1. Create feature branch from main
git checkout main
git pull origin main
git checkout -b feature/user-authentication

# 2. Work on feature (commit frequently)
git add .
git commit -m "feat(auth): add login endpoint"
git commit -m "feat(auth): add password hashing"

# 3. Keep branch updated
git fetch origin
git rebase origin/main

# 4. Push and create PR
git push -u origin feature/user-authentication
# Then create PR on GitHub/GitLab

# 5. After PR merge, clean up
git checkout main
git pull origin main
git branch -d feature/user-authentication
```

### Release Branch Workflow

```bash
# 1. Create release branch
git checkout -b release/v1.2.0

# 2. Final testing, version bump, changelog
# 3. Merge to main and develop
git checkout main
git merge --no-ff release/v1.2.0
git tag -a v1.2.0 -m "Release v1.2.0"

git checkout develop
git merge --no-ff release/v1.2.0

# 4. Delete release branch
git branch -d release/v1.2.0
```

### Hotfix Workflow

```bash
# 1. Create hotfix from main
git checkout main
git checkout -b hotfix/login-error

# 2. Fix and test
# 3. Merge to main and tag
git checkout main
git merge --no-ff hotfix/login-error
git tag -a v1.2.1 -m "Hotfix: login error"

# 4. Merge to develop
git checkout develop
git merge --no-ff hotfix/login-error
```

## Pull Request Template

Create `.github/PULL_REQUEST_TEMPLATE.md`:

```markdown
## Description

[Brief description of what this PR does]

## Related Issue

Fixes #[issue number]

## Type of Change

- [ ] 🐛 Bug fix
- [ ] ✨ New feature
- [ ] 📝 Documentation
- [ ] ♻️ Refactoring
- [ ] ⚡ Performance improvement
- [ ] 🧪 Test addition
- [ ] 🔒 Security fix

## Testing

- [ ] Tests pass locally
- [ ] New tests added for new functionality
- [ ] Manual testing completed

## Checklist

- [ ] Code follows project style guidelines
- [ ] Self-review completed
- [ ] Comments added for complex logic
- [ ] Documentation updated if needed
- [ ] No new warnings introduced
```

## Merge Strategies

### Squash and Merge (Recommended for feature branches)

```
Before:
A — B — C (feature branch)
     \
      D — E (main)

After:
A — B — C — F (main, F = squash of A,B,C)
```

**Use when:** Many small commits on feature branch that should be one logical change.

### Rebase and Merge

```
Before:
A — B — C (feature branch)
     \
      D — E (main)

After:
A — B — C
        \
         D' — E' — C' (main rebased, then fast-forward)
```

**Use when:** Want linear history, commits are already well-structured.

### Create Merge Commit

```
Before:
A — B — C (feature branch)
     \
      D — E (main)

After:
A — B — C
     \   \
      D — E — F (merge commit F)
```

**Use when:** Want to preserve branch structure, release branches.

## Resolving Merge Conflicts

```bash
# 1. Fetch latest
git fetch origin

# 2. Start rebase
git checkout feature/my-branch
git rebase origin/main

# 3. When conflict occurs:
#    - Open conflicted files
#    - Look for <<<<<<<, =======, >>>>>>> markers
#    - Edit to resolve
#    - git add <resolved-file>
#    - git rebase --continue

# 4. If too complex, abort
git rebase --abort
```

## Git Aliases (Recommended)

Add to `~/.gitconfig`:

```ini
[alias]
    co = checkout
    br = branch
    ci = commit
    st = status
    lg = log --oneline --graph --decorate
    last = log -1 HEAD
    unstage = reset HEAD --
    amend = commit --amend
    cleanup = branch --merged | grep -v "\\*\\|main\\|develop" | xargs -n 1 branch -d
```

## Best Practices

- [ ] Commit small, logical changes
- [ ] Write descriptive commit messages
- [ ] Keep main branch always deployable
- [ ] Review your own PR before requesting review
- [ ] Delete branches after merge
- [ ] Use `.gitignore` from project start
- [ ] Tag releases with semantic versions
