# Qwen Code - Project Instructions

**Project:** Beauty Parlour Chatbot  
**Location:** `f:\beauty_parlour_chatbot`

---

## 🎨 Active Skills

### UI/UX Pro Max (Loaded)
**File:** `.qwen/skills/ui-ux-pro-max.md`

This skill is automatically applied to all UI/UX tasks. It provides:
- 50+ UI styles (glassmorphism, brutalism, minimalism, etc.)
- 161 color palettes organized by product type
- 57 font pairings with Google Fonts imports
- 99 UX guidelines and anti-patterns
- 25 chart types with recommendations
- 10 technology stack best practices

**When to apply:** Any task involving UI structure, visual design, interaction patterns, or user experience.

**Data location:** `.qwen/skills/ui-ux-pro-max-skill-main/src/ui-ux-pro-max/data/`

---

## 📁 Project Structure

```
beauty_parlour_chatbot/
├── .qwen/
│   ├── QWEN.md              # This file (persistent instructions)
│   ├── output-language.md   # Language preference (English)
│   └── skills/
│       ├── ui-ux-pro-max.md           # Consolidated skill reference
│       └── ui-ux-pro-max-skill-main/  # Full skill data & scripts
├── Beauty_Parlour_chatbot-/  # Backend code
│   ├── app/
│   ├── sql/
│   ├── tests/
│   └── .env
├── frontend/                  # Frontend code
├── venv/                      # Python virtual environment
└── start_backend.bat          # Backend startup script
```

---

## 🛠️ Development Guidelines

### General
- **Language:** English for all explanations and documentation
- **Code Style:** Follow existing project conventions
- **Comments:** Add sparingly, focus on _why_ not _what_
- **Tests:** Add tests for new features when applicable

### UI/UX (with UI/UX Pro Max skill)
Always apply the 10 priority categories:
1. **Accessibility** (CRITICAL) - Contrast 4.5:1, focus states, keyboard nav
2. **Touch & Interaction** (CRITICAL) - 44×44px targets, 8px+ spacing
3. **Performance** (HIGH) - Image optimization, lazy loading, CLS < 0.1
4. **Style Selection** (HIGH) - Match product type, SVG icons, consistency
5. **Layout & Responsive** (HIGH) - Mobile-first, no horizontal scroll
6. **Typography & Color** (MEDIUM) - 16px base, semantic tokens
7. **Animation** (MEDIUM) - 150-300ms, motion has meaning
8. **Forms & Feedback** (MEDIUM) - Visible labels, error placement
9. **Navigation Patterns** (HIGH) - Predictable back, bottom nav ≤5
10. **Charts & Data** (LOW) - Legends, tooltips, accessible colors

### Backend (Python/FastAPI)
- Use the virtual environment (`venv\`)
- Check `.env` for configuration
- Run migrations with `python run_migration.py`

---

## 🔧 Useful Commands

### Backend
```bash
# Start backend
.\start_backend.bat

# Or manually
.\venv\Scripts\activate
python -m uvicorn app.main:app --reload

# Run tests
python -m pytest

# Test Supabase connection
python test_supabase_connection.py
```

### UI/UX Search (with skill data)
```bash
# Search design system
python .qwen/skills/ui-ux-pro-max-skill-main/src/ui-ux-pro-max/scripts/search.py "<query>" --design-system

# Search specific domain
python .qwen/skills/ui-ux-pro-max-skill-main/src/ui-ux-pro-max/scripts/search.py "<query>" --domain <domain>

# Available domains: product, style, typography, color, landing, chart, ux, google-fonts, prompt
```

---

## 📋 Pre-Commit Checklist

Before committing code:

### Visual Quality
- [ ] No emojis as icons (use SVG)
- [ ] Consistent icon family
- [ ] Pressed states don't shift layout
- [ ] Semantic color tokens used (no hardcoded hex)

### Interaction
- [ ] Touch targets ≥44×44px
- [ ] Clear pressed feedback
- [ ] Micro-interactions 150-300ms
- [ ] Disabled states clear

### Accessibility
- [ ] Alt text for images
- [ ] Form labels present
- [ ] Color not sole indicator
- [ ] Keyboard navigation works
- [ ] Focus states visible

### Responsive
- [ ] Mobile-first approach
- [ ] No horizontal scroll
- [ ] Safe areas respected
- [ ] 4/8dp spacing rhythm

---

## 📚 Resources

### Skill Data Files
- `products.csv` - 161 product types
- `styles.csv` - 50+ UI styles
- `colors.csv` - 161 color palettes
- `typography.csv` - 57 font pairings
- `ux-guidelines.csv` - 99 UX guidelines
- `charts.csv` - 25 chart types
- `landing.csv` - Landing page structures

### External References
- Material Design 3 (MD)
- Apple Human Interface Guidelines (HIG)
- WCAG 2.1 Accessibility Guidelines
- Core Web Vitals (Performance)

---

## 🚀 Getting Started

1. **Clone/Setup:** Ensure all files are in place
2. **Install dependencies:** `pip install -r requirements.txt`
3. **Configure .env:** Set Supabase URL and keys
4. **Start backend:** `.\start_backend.bat`
5. **Develop:** Follow UI/UX Pro Max guidelines for all UI work

---

**Last Updated:** 2026-03-19
