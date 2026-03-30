# Slash Commands Reference - Beauty Parlour Chatbot

**Based on:** qwen-gsd workflow system  
**Version:** 1.0.0

---

## 📋 Available Commands

Use these commands to trigger specific workflows in your development process.

---

## 🎯 Planning Commands

### `/plan`
**Purpose:** Create a detailed technical plan for a feature or task.

**Usage:**
```
/plan: [feature or task description]
```

**Examples:**
```
/plan: Add email notifications for appointment confirmations
/plan: Refactor the conversation flow engine to support multi-language
/plan: Create admin dashboard for salon management
/plan: Add WhatsApp template message support
```

**Output Includes:**
- Requirements analysis
- Technical approach
- Architecture decisions
- Acceptance criteria
- Implementation checklist
- Risk assessment
- Estimated complexity

---

### `/plan:feature`
**Purpose:** Specifically for new feature planning.

**Usage:**
```
/plan:feature: [feature name] - [description]
```

**Example:**
```
/plan:feature: SMS notifications - Send SMS reminders for upcoming appointments
```

---

### `/plan:refactor`
**Purpose:** Plan code refactoring or technical debt reduction.

**Usage:**
```
/plan:refactor: [area to refactor]
```

**Example:**
```
/plan:refactor: Migrate conversation state from Redis to database
/plan:refactor: Extract notification logic into separate service
```

---

### `/plan:architecture`
**Purpose:** Plan architectural changes or new system design.

**Usage:**
```
/plan:architecture: [system or component]
```

**Example:**
```
/plan:architecture: Design microservices architecture for scaling
/plan:architecture: Plan database sharding strategy for multi-tenant support
```

---

## 🔨 Building Commands

### `/build`
**Purpose:** Implement a feature following an approved plan.

**Usage:**
```
/build: [feature or task description]
```

**Examples:**
```
/build: Implement email notification service
/build: Create appointment CRUD endpoints
/build: Build dashboard analytics component
```

**Prerequisites:**
- Should follow a `/plan` command
- Acceptance criteria should be defined

**Output Includes:**
- Code implementation
- Following project conventions
- Inline documentation where needed
- Test coverage

---

### `/build:component`
**Purpose:** Create a React component.

**Usage:**
```
/build:component: [component name] with [features]
```

**Example:**
```
/build:component: AppointmentCard with status badges and edit actions
/build:component: DashboardChart with weekly revenue data
```

---

### `/build:api`
**Purpose:** Create API endpoints.

**Usage:**
```
/build:api: [endpoint description]
```

**Example:**
```
/build:api: POST /appointments/:id/cancel to cancel appointments
/build:api: GET /analytics/daily for daily metrics
```

---

### `/build:migration`
**Purpose:** Create database migrations.

**Usage:**
```
/build:migration: [migration description]
```

**Example:**
```
/build:migration: Add email_templates table
/build:migration: Add indexes to appointments table for performance
```

---

## 🔍 Review Commands

### `/review`
**Purpose:** Review code for quality, security, and performance.

**Usage:**
```
/review: [file, feature, or PR description]
```

**Examples:**
```
/review: Email notification implementation
/review: app/api/appointments.py for security issues
/review: DashboardRedesigned.tsx for performance
```

**Output Includes:**
- Code quality assessment
- Security vulnerabilities
- Performance issues
- Best practices violations
- Suggestions for improvement
- Checklist completion status

---

### `/review:security`
**Purpose:** Security-focused code review.

**Usage:**
```
/review:security: [area to review]
```

**Example:**
```
/review:security: Authentication flow
/review:security: Webhook handlers for injection attacks
/review:security: API input validation
```

---

### `/review:performance`
**Purpose:** Performance-focused review.

**Usage:**
```
/review:performance: [area to review]
```

**Example:**
```
/review:performance: Dashboard data loading
/review:performance: Database queries in appointment service
/review:performance: Frontend bundle size
```

---

### `/review:accessibility`
**Purpose:** Accessibility audit for UI components.

**Usage:**
```
/review:accessibility: [component or page]
```

**Example:**
```
/review:accessibility: Login page
/review:accessibility: Appointment form
/review:accessibility: Dashboard navigation
```

---

## 🐛 Debugging Commands

### `/debug`
**Purpose:** Systematically debug an issue.

**Usage:**
```
/debug: [issue description]
```

**Examples:**
```
/debug: Email notifications not being sent
/debug: Dashboard shows incorrect appointment count
/debug: WhatsApp webhook returning 500 error
/debug: Redis connection timeout issues
```

**Process:**
1. Reproduce the issue
2. Gather logs and error details
3. Form hypothesis
4. Test hypothesis
5. Implement fix
6. Verify fix
7. Add regression test

---

### `/debug:performance`
**Purpose:** Debug performance issues.

**Usage:**
```
/debug:performance: [slow feature]
```

**Example:**
```
/debug:performance: Dashboard takes 10 seconds to load
/debug:performance: Appointment search is slow
```

---

### `/debug:memory`
**Purpose:** Debug memory leaks or high memory usage.

**Usage:**
```
/debug:memory: [component or service]
```

**Example:**
```
/debug:memory: Backend worker process
/debug:memory: Frontend dashboard after extended use
```

---

## ✅ Testing Commands

### `/test`
**Purpose:** Write tests for a feature.

**Usage:**
```
/test: [feature or file]
```

**Examples:**
```
/test: Email notification service
/test: Appointment API endpoints
/test: useAppointments hook
```

**Output Includes:**
- Unit tests
- Integration tests
- E2E tests (if applicable)
- Test coverage report

---

### `/test:unit`
**Purpose:** Write unit tests specifically.

**Usage:**
```
/test:unit: [module or function]
```

**Example:**
```
/test:unit: appointment_service.create()
/test:unit: Conversation flow engine
```

---

### `/test:integration`
**Purpose:** Write integration tests.

**Usage:**
```
/test:integration: [feature or API]
```

**Example:**
```
/test:integration: Appointment booking flow
/test:integration: WhatsApp webhook handler
```

---

### `/test:e2e`
**Purpose:** Write end-to-end tests.

**Usage:**
```
/test:e2e: [user flow]
```

**Example:**
```
/test:e2e: Complete appointment booking via WhatsApp
/test:e2e: Admin login and dashboard view
```

---

### `/test:coverage`
**Purpose:** Analyze test coverage.

**Usage:**
```
/test:coverage: [module or project]
```

**Example:**
```
/test:coverage: Backend services
/test:coverage: Frontend components
```

---

## 🚀 Shipping Commands

### `/ship`
**Purpose:** Prepare code for deployment.

**Usage:**
```
/ship: [feature or release]
```

**Examples:**
```
/ship: Email notification feature
/ship: v2.0.0 release
/ship: Dashboard redesign
```

**Output Includes:**
- Final verification checklist
- Changelog entries
- Documentation updates
- Commit message draft
- Release notes (if applicable)

---

### `/ship:changelog`
**Purpose:** Generate changelog entries.

**Usage:**
```
/ship:changelog: [version or feature]
```

**Example:**
```
/ship:changelog: v1.2.0
/ship:changelog: Email notification feature
```

---

### `/ship:docs`
**Purpose:** Update documentation for release.

**Usage:**
```
/ship:docs: [feature or area]
```

**Example:**
```
/ship:docs: API documentation for notifications
/ship:docs: User guide for appointment management
```

---

### `/ship:commit`
**Purpose:** Prepare commit message.

**Usage:**
```
/ship:commit: [changes description]
```

**Example:**
```
/ship:commit: Add email notification service
/ship:commit: Fix appointment date validation bug
```

---

## 🛠️ Utility Commands

### `/progress`
**Purpose:** Check progress on a task or feature.

**Usage:**
```
/progress: [task or feature]
```

**Example:**
```
/progress: Email notification implementation
/progress: Dashboard redesign
```

**Output Includes:**
- Completed items
- Remaining items
- Blockers
- Next steps

---

### `/help`
**Purpose:** Get help with available commands.

**Usage:**
```
/help
/help: [command name]
```

**Example:**
```
/help
/help: /review
/help: /debug
```

---

### `/skill`
**Purpose:** Invoke a specific skill.

**Usage:**
```
/skill: [skill name] [task]
```

**Examples:**
```
/skill: fastapi-patterns Create appointment endpoint
/skill: react-patterns Build user profile component
/skill: ui-ux-pro-max Design login page
/skill: database-schema Add email templates table
```

---

## 🔄 Workflow Examples

### Example 1: New Feature
```
1. /plan: Add SMS notifications for appointments
2. Review plan and acceptance criteria
3. /build: Implement SMS notification service
4. /test: Add tests for SMS service
5. /review: Review SMS implementation
6. /ship: Prepare SMS feature for deployment
```

### Example 2: Bug Fix
```
1. /debug: SMS notifications failing to send
2. Follow debugging process
3. /test: Add regression test for the bug
4. /review: Review the fix
5. /ship:commit: Fix SMS notification delivery
```

### Example 3: Code Review Session
```
1. /review:security Authentication system
2. Address security issues found
3. /review:performance API endpoints
4. Optimize based on recommendations
5. /test:integration Auth flow
6. /ship: Prepare for merge
```

### Example 4: Dashboard Enhancement
```
1. /plan: Add revenue analytics to dashboard
2. /skill: ui-ux-pro-max Design analytics cards
3. /build:component: RevenueChart with weekly data
4. /build:api: GET /analytics/revenue endpoint
5. /test: Test analytics feature
6. /review: Review UI and API
7. /ship: Deploy analytics feature
```

---

## 📝 Command Shortcuts

You can also use natural language to trigger workflows:

| Natural Language | Triggers |
|-----------------|----------|
| "Let me plan..." | `/plan` |
| "Build this..." | `/build` |
| "Review this code..." | `/review` |
| "Debug this issue..." | `/debug` |
| "Write tests for..." | `/test` |
| "Prepare for deployment..." | `/ship` |
| "Use the [skill] skill..." | `/skill: [skill]` |

---

## 🎯 Best Practices

### When to Use Commands

**Always use `/plan` when:**
- Starting a new feature
- Making architectural changes
- Refactoring complex code
- The task has multiple steps

**Always use `/review` when:**
- Completing a feature
- Before committing code
- After fixing bugs
- Security-sensitive changes

**Always use `/test` when:**
- New feature implemented
- Bug fixed
- Refactoring completed
- Before shipping

**Always use `/ship` when:**
- Feature is complete
- Ready to merge
- Preparing a release
- Documentation needs updating

---

## 🔗 Integration with Qwen Code

These commands work seamlessly with Qwen Code's AI capabilities:

1. **Context Awareness:** Commands understand project context
2. **Skill Integration:** Commands can invoke specialized skills
3. **Multi-Step Workflows:** Commands chain together naturally
4. **Progress Tracking:** Commands maintain state across sessions

---

**Last Updated:** 2026-03-25  
**Version:** 1.0.0
