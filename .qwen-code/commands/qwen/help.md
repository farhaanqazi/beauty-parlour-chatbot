---
name: qwen:help
description: Show all available qwen-gsd commands and skills with brief descriptions
allowed-tools:
  - Read
---
<objective>
Display a formatted help reference listing all /qwen:* commands and available skills.
</objective>

<process>
Print a clean, scannable reference. Group by category:

## Core workflow
/qwen:new-project  — Initialize project (requirements + roadmap)
/qwen:plan [N]     — Plan phase N in detail
/qwen:build [N]    — Execute current phase
/qwen:review       — Verify work against spec
/qwen:debug <err>  — Root cause analysis
/qwen:progress     — Show current project state
/qwen:ship         — Prepare for release (changelog, checks)

## Skills (say "use the X skill" to activate)
docx               — Create/edit Word documents
pdf                — Read, merge, split, create PDFs
code-review        — Systematic code quality review
changelog-generator — Git commits → user-facing changelog
debug              — Deep debugging workflow
test-writer        — Write tests for existing code
database-schema    — Design and document DB schemas
api-design         — REST/GraphQL API design
refactor           — Safe refactoring with behavior preservation

Say "use the skill-creator skill" to build your own custom skill.
</process>
