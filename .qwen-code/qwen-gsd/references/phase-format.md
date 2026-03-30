# Phase Plan Format

This document defines the exact format for phase plan files (`.planning/phases/phase-N.md`).

## File Location

```
.planning/phases/phase-1.md
.planning/phases/phase-2.md
.planning/phases/phase-3.md
```

## Required Sections

### 1. Header

```markdown
# Phase [N]: [Phase Name]
```

The phase name should be descriptive: "Foundation", "Core Features", "API Development", "Polish & Launch".

### 2. Goal

```markdown
## Goal
[One sentence describing what this phase delivers]
```

**Good examples:**
- "Set up the project infrastructure: database, authentication, and deployment pipeline."
- "Implement the core CRUD operations for users, projects, and tasks."

**Bad examples:**
- "Build stuff" (too vague)
- "Complete phase 2" (circular reference)

### 3. Deliverables

```markdown
## Deliverables
- [Concrete deliverable 1]
- [Concrete deliverable 2]
- [Concrete deliverable 3]
```

Deliverables are _outcomes_, not activities:
- ✓ "User authentication working with email/password and OAuth"
- ✗ "Work on authentication"

### 4. Tasks

```markdown
## Tasks

### Task 1: [Task Name]
**What:** [What to build]
**How:** [How to build it]
**Done when:** [Acceptance criterion]
**Estimated effort:** [Small/Medium/Large]
```

**Task naming:**
- Use verb-noun format: "Create user model", "Implement login endpoint", "Set up database"
- Be specific: "Create PostgreSQL users table with id, email, password_hash columns"

**What field:**
- Describe the concrete output
- Include file paths where applicable
- Specify APIs, functions, or components

**How field:**
- Reference specific libraries or patterns
- Include key implementation details
- Link to documentation if using unfamiliar technology

**Done when field:**
- Must be verifiable: "User can log in with valid credentials" not "Authentication works"
- Include how to test: "Passes pytest test_user_login test"
- Avoid subjective criteria: "Looks good" is not verifiable

**Estimated effort:**
- **Small:** <2 hours — can be done in one sitting
- **Medium:** 2-8 hours — one work session
- **Large:** >8 hours — consider breaking into smaller tasks

### 5. Dependencies

```markdown
## Dependencies
- Task 1 → Task 2: [Why Task 2 depends on Task 1]
- External: [External dependency]
```

**Internal dependencies:**
- Which tasks must be done before others
- Why the dependency exists

**External dependencies:**
- APIs that need to be available
- Decisions that need to be made
- Other teams or services

### 6. Risks

```markdown
## Risks
| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| [Risk] | High/Medium/Low | High/Medium/Low | [Mitigation] |
```

**Common risks:**
- Technical uncertainty: "Never used WebSockets before"
- External dependencies: "Waiting on API access from third party"
- Complexity: "Real-time sync has known race conditions"
- Performance: "Large dataset may cause timeout"

### 7. Done When (Phase Acceptance Criteria)

```markdown
## Done When (Phase Acceptance Criteria)
- [ ] [Criterion 1]
- [ ] [Criterion 2]
- [ ] [Criterion 3]
```

These are the gates that must pass before the phase is complete.

**Good criteria:**
- "All 5 tasks completed and verified"
- "User can register, log in, and create a project"
- "API passes all integration tests"
- "Deployment to staging successful"

**Bad criteria:**
- "Everything works" (vague)
- "No bugs" (unrealistic)
- "Code is clean" (subjective)

## Example Phase Plan

```markdown
# Phase 1: Foundation

## Goal
Set up project infrastructure: database schema, authentication, and CI/CD pipeline.

## Deliverables
- PostgreSQL database with users and projects tables
- Email/password authentication with JWT
- GitHub Actions CI/CD pipeline

## Tasks

### Task 1: Create database schema
**What:** Set up PostgreSQL with users and projects tables
**How:** 
- Use Prisma ORM for schema definition
- users: id, email (unique), password_hash, created_at
- projects: id, user_id (FK), name, created_at
- Run migrations with `npx prisma migrate dev`
**Done when:** `npx prisma migrate dev` completes successfully and tables exist
**Estimated effort:** Small

### Task 2: Implement user registration
**What:** POST /api/register endpoint with email/password
**How:**
- Express.js route in src/routes/auth.ts
- Hash password with bcrypt (10 rounds)
- Store in users table
- Return JWT token
**Done when:** POST /api/register creates user and returns token; test_register passes
**Estimated effort:** Medium

## Dependencies
- Task 1 → Task 2: Registration requires users table
- External: Need JWT_SECRET in environment variables

## Risks
| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Prisma migration fails | Low | High | Test migration in isolated DB first |
| JWT library compatibility | Low | Medium | Use @types/jsonwebtoken, follow docs |

## Done When (Phase Acceptance Criteria)
- [ ] Database schema migrated successfully
- [ ] User can register with email/password
- [ ] User can log in and receive JWT
- [ ] CI/CD pipeline deploys to staging on push
```

## Version History

| Version | Date | Change |
|---------|------|--------|
| 1.0 | 2025-01-01 | Initial format |
