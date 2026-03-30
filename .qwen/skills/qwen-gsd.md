# Qwen GSD (Get-Shit-Done) Skill for Beauty Parlour Chatbot

**Version:** 1.0.0  
**Based on:** https://github.com/farhaanqazi/qwen-gsd

---

## 🎯 Purpose

This skill brings **spec-driven development** to the Beauty Parlour Chatbot project, structuring AI workflows into clear stages with acceptance criteria and verification checkpoints.

---

## 📋 Development Phases

### Phase 1: PLAN
**Goal:** Define requirements, architecture, and acceptance criteria before writing code.

**When to use:**
- Starting a new feature
- Refactoring existing code
- Fixing complex bugs
- Making architectural decisions

**Process:**
1. Understand the problem/requirement
2. Research existing codebase patterns
3. Define technical approach
4. List acceptance criteria
5. Identify potential risks
6. Create implementation checklist

**Example:**
```
/plan: Add email notifications for appointment confirmations
```

**Acceptance Criteria Template:**
- [ ] Requirements documented
- [ ] Technical approach defined
- [ ] Acceptance criteria listed
- [ ] Risks identified
- [ ] Implementation checklist created

---

### Phase 2: BUILD
**Goal:** Implement features following project conventions and best practices.

**When to use:**
- After planning phase is complete
- Making incremental improvements
- Following established patterns

**Process:**
1. Review plan and acceptance criteria
2. Follow existing code conventions
3. Apply UI/UX Pro Max guidelines (for UI work)
4. Write tests alongside features
5. Add inline documentation only where necessary

**Example:**
```
/build: Implement email notification service following the plan
```

**Acceptance Criteria Template:**
- [ ] Code follows project conventions
- [ ] Tests written and passing
- [ ] No linting errors
- [ ] Documentation updated (if needed)
- [ ] All acceptance criteria from plan met

---

### Phase 3: REVIEW
**Goal:** Ensure code quality, security, and performance before merging.

**When to use:**
- After completing implementation
- Before committing changes
- When reviewing PRs

**Process:**
1. Run project-specific build/lint commands
2. Check for security issues
3. Verify performance considerations
4. Review code quality
5. Ensure test coverage

**Example:**
```
/review: Review the email notification implementation
```

**Acceptance Criteria Template:**
- [ ] Build passes without errors
- [ ] Linting passes
- [ ] No security vulnerabilities
- [ ] Performance impact acceptable
- [ ] Test coverage adequate
- [ ] Code quality meets standards

---

### Phase 4: DEBUG
**Goal:** Systematically identify and fix issues.

**When to use:**
- When tests fail
- When runtime errors occur
- When behavior doesn't match expectations

**Process:**
1. Reproduce the issue
2. Gather error details and logs
3. Form hypothesis about root cause
4. Test hypothesis
5. Implement fix
6. Verify fix resolves issue
7. Add regression test if applicable

**Example:**
```
/debug: Email notifications not being sent when appointments are booked
```

**Acceptance Criteria Template:**
- [ ] Issue reproduced
- [ ] Root cause identified
- [ ] Fix implemented
- [ ] Fix verified
- [ ] Regression test added (if applicable)

---

### Phase 5: TEST
**Goal:** Ensure comprehensive test coverage for critical functionality.

**When to use:**
- After implementing new features
- When adding bug fixes
- Before deploying to production

**Process:**
1. Identify test scenarios
2. Write unit tests for business logic
3. Write integration tests for APIs
4. Write E2E tests for critical flows
5. Run full test suite
6. Verify coverage meets standards

**Example:**
```
/test: Add comprehensive tests for email notification service
```

**Acceptance Criteria Template:**
- [ ] Unit tests cover business logic
- [ ] Integration tests cover API endpoints
- [ ] E2E tests cover critical flows
- [ ] All tests passing
- [ ] Coverage meets project standards

---

### Phase 6: SHIP
**Goal:** Prepare code for deployment with proper documentation and changelog.

**When to use:**
- Before merging to main branch
- When preparing a release
- After completing a feature set

**Process:**
1. Verify all tests passing
2. Update changelog
3. Update documentation
4. Prepare commit message
5. Create release notes (if applicable)

**Example:**
```
/ship: Prepare email notification feature for deployment
```

**Acceptance Criteria Template:**
- [ ] All tests passing
- [ ] Changelog updated
- [ ] Documentation updated
- [ ] Commit message prepared
- [ ] Release notes ready (if applicable)

---

## 🔧 Specialized Skills

### Backend Skills

#### `fastapi-patterns`
**Purpose:** FastAPI best practices for the beauty parlour backend.

**When to use:**
- Creating new API endpoints
- Refactoring existing endpoints
- Designing request/response schemas

**Key Patterns:**
- Async/await for all I/O operations
- Pydantic v2 schemas for validation
- Dependency injection for shared resources
- Proper error handling with HTTPException
- Type hints throughout

**Example:**
```
Use fastapi-patterns skill to create a new endpoint for salon availability
```

---

#### `database-schema`
**Purpose:** SQLAlchemy ORM patterns and database design.

**When to use:**
- Creating new models
- Designing migrations
- Writing complex queries

**Key Patterns:**
- Async SQLAlchemy 2.0 patterns
- Proper relationship definitions
- Index optimization
- Migration scripts

**Example:**
```
Use database-schema skill to add email templates table
```

---

#### `redis-patterns`
**Purpose:** Redis state management for conversation flows.

**When to use:**
- Managing conversation state
- Implementing caching
- Rate limiting

**Key Patterns:**
- TTL management
- Key naming conventions
- Atomic operations
- Connection pooling

**Example:**
```
Use redis-patterns skill to optimize conversation state storage
```

---

#### `notification-system`
**Purpose:** Background job processing for notifications.

**When to use:**
- Adding new notification types
- Optimizing worker pool
- Handling scheduled tasks

**Key Patterns:**
- Worker-safe job claiming (FOR UPDATE SKIP LOCKED)
- Retry logic with exponential backoff
- Job status tracking
- Graceful shutdown

**Example:**
```
Use notification-system skill to add SMS notifications
```

---

### Frontend Skills

#### `react-patterns`
**Purpose:** React 19 + TypeScript best practices.

**When to use:**
- Creating new components
- State management decisions
- Performance optimization

**Key Patterns:**
- Functional components with hooks
- TypeScript strict mode
- React Query for data fetching
- Zustand for global state
- Proper prop typing

**Example:**
```
Use react-patterns skill to create the appointment management component
```

---

#### `ui-ux-pro-max` (Already Loaded)
**Purpose:** Comprehensive UI/UX design system.

**When to use:** All UI/UX tasks

**Reference:** `.qwen/skills/ui-ux-pro-max.md`

---

#### `material-ui-patterns`
**Purpose:** MUI v7 component patterns.

**When to use:**
- Using MUI components
- Theming and customization
- Responsive layouts

**Key Patterns:**
- Theme customization
- Component styling with sx prop
- Responsive breakpoints
- Dark mode support

**Example:**
```
Use material-ui-patterns skill to customize the dashboard theme
```

---

### DevOps Skills

#### `docker`
**Purpose:** Containerization for deployment.

**When to use:**
- Creating Dockerfiles
- Docker Compose setup
- Multi-stage builds

**Example:**
```
Use docker skill to create production Dockerfile for backend
```

---

#### `git-workflow`
**Purpose:** Git branching and commit conventions.

**When to use:**
- Creating feature branches
- Writing commit messages
- Preparing PRs

**Key Patterns:**
- Feature branch naming: `feature/<name>`
- Commit message format: `<type>(<scope>): <description>`
- PR templates
- Squash merging

**Example:**
```
Use git-workflow skill to prepare the email notification feature for merge
```

---

### Analysis Skills

#### `security-audit`
**Purpose:** Security review of code changes.

**When to use:**
- Before deploying sensitive features
- After adding authentication/authorization
- When handling user data

**Focus Areas:**
- SQL injection prevention
- XSS protection
- CSRF tokens
- Secrets management
- Input validation

**Example:**
```
Use security-audit skill to review the authentication flow
```

---

#### `performance-audit`
**Purpose:** Performance optimization review.

**When to use:**
- After implementing features
- When experiencing slowness
- Before scaling

**Focus Areas:**
- Database query optimization
- API response times
- Frontend bundle size
- Caching strategies
- Memory usage

**Example:**
```
Use performance-audit skill to optimize dashboard loading
```

---

## 🤖 Subagents

### `qwen-planner`
**Purpose:** Create detailed technical plans for features.

**When to invoke:**
- Complex feature implementation
- Architecture decisions
- Multi-step refactoring

**Example:**
```
Invoke qwen-planner to design the email notification architecture
```

---

### `qwen-verifier`
**Purpose:** Verify implementation matches requirements.

**When to invoke:**
- After implementation complete
- Before merging
- When debugging discrepancies

**Example:**
```
Invoke qwen-verifier to check email notification implementation against plan
```

---

### `qwen-debugger`
**Purpose:** Deep debugging for complex issues.

**When to invoke:**
- Production bugs
- Intermittent failures
- Performance issues

**Example:**
```
Invoke qwen-debugger to investigate email delivery failures
```

---

### `qwen-researcher`
**Purpose:** Research best practices and alternatives.

**When to invoke:**
- Evaluating new libraries
- Comparing architectural approaches
- Finding solutions to novel problems

**Example:**
```
Invoke qwen-researcher to find best email service for transactional emails
```

---

## 📝 Usage Examples

### Example 1: Adding a New Feature

```
User: Add email notifications for appointment confirmations

Assistant: I'll use the qwen-gsd workflow to implement this feature.

**Phase 1: PLAN**
Let me first understand the requirements and create a plan.
[Creates detailed plan with acceptance criteria]

**Phase 2: BUILD**
Now implementing the email notification service following the plan...
[Implements code following project conventions]

**Phase 3: REVIEW**
Let me review the implementation for quality and security...
[Runs security-audit and performance-audit]

**Phase 4: TEST**
Adding comprehensive tests for the email service...
[Writes unit, integration, and E2E tests]

**Phase 5: SHIP**
Preparing the feature for deployment...
[Updates changelog, documentation, prepares commit message]
```

### Example 2: Debugging an Issue

```
User: Email notifications aren't being sent

Assistant: I'll use the DEBUG phase to systematically identify and fix this issue.

1. **Reproduce:** Let me check the logs and reproduce the issue
2. **Gather:** Collecting error details from notification worker logs
3. **Hypothesize:** Based on the logs, I suspect the SMTP configuration is incorrect
4. **Test:** Testing the hypothesis by checking the .env configuration
5. **Fix:** Implementing the fix for the SMTP settings
6. **Verify:** Verifying emails are now being sent
7. **Regression Test:** Adding a test to prevent this issue in the future
```

### Example 3: Code Review

```
User: Review my appointment API changes

Assistant: I'll use the REVIEW phase with specialized skills.

**Review Checklist:**
- [x] Build passes: Running `npm run build` and `pytest`
- [x] Linting: Running ESLint and Ruff
- [x] Security: Using security-audit skill to check for vulnerabilities
- [x] Performance: Using performance-audit skill to check query optimization
- [x] Code Quality: Checking against fastapi-patterns and react-patterns
- [x] Tests: Verifying test coverage

**Issues Found:**
1. Missing input validation on appointment date
2. Database query N+1 issue in appointment list
3. Missing error handling for email service

**Recommendations:**
[Detailed recommendations with code examples]
```

---

## ✅ Integration with Existing Skills

This qwen-gsd skill works alongside your existing **UI/UX Pro Max** skill:

- **qwen-gsd:** Provides the development workflow and process
- **UI/UX Pro Max:** Provides design system and UI/UX best practices

**When to use both:**
```
User: Create a new appointment management dashboard

Assistant: I'll use qwen-gsd for the development workflow and UI/UX Pro Max for the design.

**Phase 1: PLAN**
[Create plan using qwen-gsd]

**Phase 2: BUILD**
- Backend: Using fastapi-patterns skill
- Frontend: Using react-patterns + UI/UX Pro Max skills
  - Applying accessibility guidelines (UI/UX Pro Max Category 1)
  - Using touch & interaction best practices (Category 2)
  - Following performance guidelines (Category 3)
  [Continue with implementation]
```

---

## 🚀 Quick Start

### For New Features:
```
1. Say: "/plan: [feature description]"
2. Review the plan and acceptance criteria
3. Say: "/build: [feature description]"
4. Say: "/review: [feature description]"
5. Say: "/test: [feature description]"
6. Say: "/ship: [feature description]"
```

### For Bug Fixes:
```
1. Say: "/debug: [issue description]"
2. Follow the systematic debugging process
3. Say: "/test: [fix verification]"
```

### For Code Review:
```
1. Say: "/review: [file or feature description]"
2. Review the comprehensive checklist
3. Address any issues found
```

---

## 📊 Project-Specific Conventions

### Backend (FastAPI)
- **Build Command:** `pytest` for tests, `ruff check` for linting
- **Type Checking:** MyPy (if configured)
- **Code Style:** Follow existing patterns in `Beauty_Parlour_chatbot-/app/`

### Frontend (React)
- **Build Command:** `npm run build`
- **Lint Command:** `npm run lint`
- **Type Checking:** TypeScript strict mode
- **Code Style:** Follow existing patterns in `frontend/src/`

### Database
- **Migrations:** Manual SQL scripts in `Beauty_Parlour_chatbot-/sql/`
- **Testing:** `python test_supabase_connection.py`

---

## 📈 Acceptance Criteria Standards

### Must Have (P0)
- Core functionality works as specified
- No critical security vulnerabilities
- No performance regressions
- Tests passing

### Should Have (P1)
- Edge cases handled
- Error messages user-friendly
- Documentation updated
- Logs added for debugging

### Nice to Have (P2)
- Performance optimizations
- Additional test coverage
- Code refactoring
- Enhanced error handling

---

**Last Updated:** 2026-03-25  
**Maintained By:** Project Team  
**Version:** 1.0.0
