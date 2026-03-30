---
name: skill-creator
description: Create a new custom skill for Qwen Code. Use when the user wants to build a reusable skill — a SKILL.md package that extends Qwen Code's capabilities for a specific domain, workflow, or tool integration.
---

# Skill Creator

Build skills that make Qwen Code smarter for your specific context.

## What a Skill Is

A skill is a directory with a `SKILL.md` file. When Qwen Code reads it, that AI instance gains specialised knowledge for a domain — a database schema, a workflow, a tool integration, a set of standards.

```
my-skill/
├── SKILL.md          ← required: instructions for Qwen Code
├── scripts/          ← optional: reusable scripts
├── references/       ← optional: docs loaded into context as needed
└── assets/           ← optional: templates, fonts, files used in output
```

## SKILL.md Format

```markdown
---
name: my-skill
description: One sentence: what this skill does and when to use it. Written as "Use when..." or "This skill should be used when..."
---

# Skill Name

[2-3 sentences: what this skill does and why it exists]

## When to Use
[Bullet list of trigger situations]

## How to Use
[Step-by-step workflow with code examples]

## Key Rules
[Non-obvious things to remember]
```

## Creation Process

### Step 1: Define the concrete use case
Answer these before writing anything:
- What specific task does this skill handle?
- What does the user say that should trigger it?
- What would Qwen Code need to know that it doesn't know by default?

### Step 2: Identify reusable resources
- **scripts/**: Code that gets rewritten each time → make it a script
- **references/**: Documentation Qwen Code needs to reference → store it here
- **assets/**: Templates or files needed in the output → store here

### Step 3: Write SKILL.md
Focus on procedural knowledge — *how to do the thing*, not general background.
Use imperative form: "Run the script" not "You should run the script".
Include concrete examples with real code.

### Step 4: Install the skill
```bash
# Copy to Qwen Code skills directory
cp -r my-skill/ ~/.config/qwen-code/skills/

# Or for a project-local skill
cp -r my-skill/ .qwen-code/skills/
```

## Good Skill Description Examples

✓ `Use when the user wants to rotate, crop, or resize images. Handles JPEG, PNG, and WebP using Pillow.`

✓ `Use when working with the company's internal BigQuery tables. Provides schema for users, events, and revenue tables.`

✗ `Image processing skill` (too vague — won't trigger reliably)

✗ `A comprehensive, powerful tool for all image-related needs` (marketing copy — not useful)

## Checklist Before Distributing

- [ ] SKILL.md has valid YAML frontmatter (name + description)
- [ ] Description clearly states when to use it (not just what it is)
- [ ] Includes at least one concrete code example
- [ ] Scripts are executable (`chmod +x scripts/myscript.py`)
- [ ] No hardcoded absolute paths
- [ ] No secrets or credentials in any file
