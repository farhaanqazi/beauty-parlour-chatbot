# UI/UX Pro Max - Design Intelligence Skill for Qwen Code

**Loaded Skill:** UI/UX Pro Max v1.0  
**Purpose:** Comprehensive UI/UX design intelligence for web and mobile applications  
**Data:** 50+ styles, 161 color palettes, 57 font pairings, 161 product types, 99 UX guidelines, 25 chart types  
**Stacks:** React, Next.js, Vue, Svelte, SwiftUI, React Native, Flutter, Tailwind, shadcn/ui, HTML/CSS

---

## 🎯 When to Use This Skill

### MUST USE - Invoke this skill for:
- Designing new pages (Landing Page, Dashboard, Admin, SaaS, Mobile App)
- Creating or refactoring UI components (buttons, modals, forms, tables, charts)
- Choosing color schemes, typography systems, spacing standards, or layout systems
- Reviewing UI code for user experience, accessibility, or visual consistency
- Implementing navigation structures, animations, or responsive behavior
- Making product-level design decisions (style, hierarchy, brand expression)
- Improving perceived quality, clarity, or usability of interfaces

### RECOMMENDED - Use this skill for:
- UI looks "not professional enough" but reason is unclear
- Receiving feedback on usability or experience
- Pre-launch UI quality optimization
- Aligning cross-platform design (Web / iOS / Android)
- Building design systems or reusable component libraries

### SKIP - Don't use for:
- Pure backend logic development
- Only API or database design
- Performance optimization unrelated to the interface
- Infrastructure or DevOps work
- Non-visual scripts or automation tasks

**Decision Criteria:** If the task will change how a feature **looks, feels, moves, or is interacted with**, use this skill.

---

## 📋 Rule Categories by Priority (1 = Highest)

| Priority | Category | Impact | Key Checks | Common Anti-Patterns |
|----------|----------|--------|------------|---------------------|
| 1 | Accessibility | CRITICAL | Contrast 4.5:1, Alt text, Keyboard nav, Aria-labels | Removing focus rings, Icon-only buttons without labels |
| 2 | Touch & Interaction | CRITICAL | Min 44×44px, 8px+ spacing, Loading feedback | Hover-only interactions, Instant state changes (0ms) |
| 3 | Performance | HIGH | WebP/AVIF, Lazy loading, CLS < 0.1 | Layout thrashing, Cumulative Layout Shift |
| 4 | Style Selection | HIGH | Match product type, Consistency, SVG icons | Mixing styles randomly, Emoji as icons |
| 5 | Layout & Responsive | HIGH | Mobile-first, Viewport meta, No horizontal scroll | Horizontal scroll, Fixed px widths, Disable zoom |
| 6 | Typography & Color | MEDIUM | Base 16px, Line-height 1.5, Semantic tokens | Text < 12px body, Gray-on-gray, Raw hex in components |
| 7 | Animation | MEDIUM | 150-300ms, Motion has meaning, Spatial continuity | Decorative-only animation, Animating width/height |
| 8 | Forms & Feedback | MEDIUM | Visible labels, Error near field, Helper text | Placeholder-only labels, Errors only at top |
| 9 | Navigation Patterns | HIGH | Predictable back, Bottom nav ≤5, Deep linking | Overloaded nav, Broken back behavior |
| 10 | Charts & Data | LOW | Legends, Tooltips, Accessible colors | Color-only data conveyance |

---

## ✅ Quick Reference Checklist

### 1. Accessibility (CRITICAL)
- `color-contrast` - Minimum 4.5:1 for normal text (3:1 large text)
- `focus-states` - Visible focus rings (2-4px) on interactive elements
- `alt-text` - Descriptive alt text for meaningful images
- `aria-labels` - aria-label for icon-only buttons
- `keyboard-nav` - Tab order matches visual order
- `form-labels` - Use `<label>` with `for` attribute
- `heading-hierarchy` - Sequential h1→h6, no level skipping
- `color-not-only` - Don't convey info by color alone
- `reduced-motion` - Respect `prefers-reduced-motion`
- `touch-target-size` - Min 44×44pt touch targets

### 2. Touch & Interaction (CRITICAL)
- `touch-spacing` - Minimum 8px gap between touch targets
- `hover-vs-tap` - Use click/tap for primary interactions, not hover alone
- `loading-buttons` - Disable + show spinner during async operations
- `error-feedback` - Clear error messages near the problem field
- `cursor-pointer` - Add `cursor-pointer` to clickable elements
- `tap-delay` - Use `touch-action: manipulation` to reduce 300ms delay
- `press-feedback` - Visual feedback on press (ripple/highlight)
- `safe-area-awareness` - Keep targets away from notch, Dynamic Island, gesture bar

### 3. Performance (HIGH)
- `image-optimization` - Use WebP/AVIF, responsive images, lazy load
- `image-dimension` - Declare width/height or use `aspect-ratio`
- `font-display` - Use `font-display: swap` to avoid FOIT
- `critical-css` - Prioritize above-the-fold CSS
- `lazy-loading` - Lazy load non-critical components
- `content-jumping` - Reserve space for async content (CLS < 0.1)
- `virtualize-lists` - Virtualize lists with 50+ items
- `debounce-throttle` - Debounce/throttle high-frequency events

### 4. Style Selection (HIGH)
- `style-match` - Match style to product type
- `consistency` - Use same style across all pages
- `no-emoji-icons` - Use SVG icons (Heroicons, Lucide), not emojis
- `effects-match-style` - Shadows, blur, radius aligned with chosen style
- `icon-style-consistent` - One icon set/language across the product
- `primary-action` - Only ONE primary CTA per screen

### 5. Layout & Responsive (HIGH)
- `viewport-meta` - `width=device-width initial-scale=1` (never disable zoom)
- `mobile-first` - Design mobile-first, then scale up
- `breakpoint-consistency` - Systematic breakpoints (375/768/1024/1440)
- `readable-font-size` - Minimum 16px body on mobile
- `line-length-control` - Mobile: 35-60 chars; Desktop: 60-75 chars
- `horizontal-scroll` - No horizontal scroll on mobile
- `spacing-scale` - Use 4pt/8dp spacing system
- `z-index-management` - Define layered z-index scale (0/10/20/40/100/1000)

### 6. Typography & Color (MEDIUM)
- `line-height` - 1.5-1.75 for body text
- `font-pairing` - Match heading/body font personalities
- `font-scale` - Consistent type scale (12/14/16/18/24/32)
- `contrast-readability` - Dark text on light backgrounds
- `weight-hierarchy` - Bold headings (600-700), Regular body (400)
- `color-semantic` - Define semantic color tokens, not raw hex
- `color-dark-mode` - Design light/dark variants together

### 7. Animation (MEDIUM)
- `duration-timing` - 150-300ms for micro-interactions; ≤400ms complex
- `transform-performance` - Use transform/opacity only; avoid width/height
- `loading-states` - Show skeleton/progress when loading >300ms
- `easing` - Use ease-out for entering, ease-in for exiting
- `motion-meaning` - Every animation must express cause-effect
- `exit-faster-than-enter` - Exit animations ~60-70% of enter duration
- `stagger-sequence` - Stagger list items by 30-50ms per item

### 8. Forms & Feedback (MEDIUM)
- `input-labels` - Visible label per input (not placeholder-only)
- `error-placement` - Show error below the related field
- `submit-feedback` - Loading then success/error on submit
- `required-indicators` - Mark required fields (e.g., asterisk)
- `toast-dismiss` - Auto-dismiss toasts in 3-5s
- `confirmation-dialogs` - Confirm before destructive actions
- `inline-validation` - Validate on blur, not keystroke
- `password-toggle` - Provide show/hide toggle for password fields
- `undo-support` - Allow undo for destructive actions

### 9. Navigation Patterns (HIGH)
- `bottom-nav-limit` - Max 5 items; use labels with icons
- `back-behavior` - Predictable and consistent back navigation
- `deep-linking` - All key screens reachable via deep link/URL
- `nav-label-icon` - Navigation items must have icon + text label
- `nav-state-active` - Current location visually highlighted
- `modal-escape` - Clear close/dismiss affordance for modals
- `state-preservation` - Back restores scroll position and state

### 10. Charts & Data (LOW)
- `chart-type` - Match chart type to data (trend→line, comparison→bar)
- `color-guidance` - Accessible palettes; avoid red/green only
- `data-table` - Provide table alternative for accessibility
- `legend-visible` - Always show legend near the chart
- `tooltip-on-interact` - Tooltips on hover/tap showing exact values
- `axis-labels` - Label axes with units and readable scale
- `empty-data-state` - Show meaningful empty state, not blank chart

---

## 🚫 Common Professional UI Rules (Frequently Overlooked)

### Icons & Visual Elements
| Rule | Standard | Avoid |
|------|----------|-------|
| No Emoji as Icons | Use SVG icons (Lucide, Heroicons) | Emojis (🎨🚀⚙️) for navigation/settings |
| Vector-Only Assets | SVG or platform vectors | Raster PNG that blur/pixelate |
| Stable Interaction States | Color/opacity transitions without layout shift | Layout-shifting transforms |
| Consistent Icon Sizing | Define token sizes (icon-sm, icon-md = 24pt) | Random values (20pt/24pt/28pt) |
| Stroke Consistency | Consistent stroke width per layer | Mixing thick/thin arbitrarily |
| Touch Target Minimum | 44×44pt with hitSlop expansion | Small icons without expanded tap area |

### Light/Dark Mode Contrast
- Primary text contrast ≥4.5:1 in BOTH light and dark mode
- Secondary text contrast ≥3:1 in BOTH modes
- Dividers/borders visible in both themes
- Modal scrim 40-60% black for foreground legibility
- Test BOTH themes before delivery

### Layout & Spacing
- Respect safe areas (notch, Dynamic Island, gesture bar)
- Use 4/8dp spacing rhythm consistently
- Mobile body text minimum 16px (avoids iOS auto-zoom)
- No horizontal scroll on mobile
- Define z-index scale (0/10/20/40/100/1000)

---

## 🔧 How to Use This Skill

### Workflow for Any UI Task

**Step 1: Analyze Requirements**
Extract from user request:
- Product type (SaaS, e-commerce, portfolio, service, etc.)
- Target audience (C-end, B-end, age group, context)
- Style keywords (minimal, vibrant, dark mode, etc.)
- Tech stack (React, Next.js, Vue, etc.)

**Step 2: Apply Design System Rules**
Use the priority table above (1→10) to decide which rules to focus on first.

**Step 3: Search for Specific Guidance**
Ask me to search the data files for specific domains:
- `product` - Product type recommendations
- `style` - UI styles with CSS keywords and AI prompts
- `typography` - Font pairings with Google Fonts
- `color` - Color palettes by product type
- `landing` - Page structure and CTA strategies
- `chart` - Chart types and library recommendations
- `ux` - Best practices and anti-patterns

**Step 4: Apply Stack Best Practices**
Get implementation-specific guidance for your stack.

---

## 📊 Available Data Files

Located in: `.qwen/skills/ui-ux-pro-max-skill-main/src/ui-ux-pro-max/data/`

| File | Content |
|------|---------|
| `products.csv` | 161 product types with style/color/typography recommendations |
| `styles.csv` | 50+ UI styles (glassmorphism, brutalism, minimalism, etc.) |
| `colors.csv` | 161 color palettes organized by product type |
| `typography.csv` | 57 font pairings with Google Fonts imports |
| `ux-guidelines.csv` | 99 UX best practices and anti-patterns |
| `charts.csv` | 25 chart types with use cases and libraries |
| `landing.csv` | Landing page structures and CTA strategies |
| `ui-reasoning.csv` | Reasoning rules for design decisions |
| `app-interface.csv` | App-specific UI guidelines |
| `react-performance.csv` | React/Next.js performance patterns |
| `google-fonts.csv` | Individual Google Fonts metadata |

### Stack-Specific Guidelines
Located in: `.qwen/skills/ui-ux-pro-max-skill-main/src/ui-ux-pro-max/data/stacks/`

---

## 🎨 Example Usage

### Example 1: Building a Landing Page
```
User: "Build a landing page for a beauty spa"

Qwen (with UI/UX Pro Max loaded):
1. Analyze: Product type = Service (Beauty/Wellness), Style = Calm, Elegant
2. Search products.csv for "beauty spa wellness"
3. Get style recommendations (likely minimalism, soft colors)
4. Get color palette (soft greens, warm neutrals)
5. Get typography (elegant serif headings, clean sans-serif body)
6. Apply landing page structure from landing.csv
7. Apply accessibility and responsive rules
8. Generate code with all rules applied
```

### Example 2: Reviewing Existing UI
```
User: "Review this dashboard for UX issues"

Qwen (with UI/UX Pro Max loaded):
1. Check Accessibility (Priority 1): Contrast, focus states, alt text
2. Check Touch Targets (Priority 2): Min 44×44px
3. Check Performance (Priority 3): Image optimization, lazy loading
4. Check Navigation (Priority 9): Clear hierarchy, back behavior
5. Check Forms & Feedback (Priority 8): Labels, error placement
6. Provide specific fixes with rule references
```

### Example 3: Choosing Colors
```
User: "What colors work for a fintech app?"

Qwen (with UI/UX Pro Max loaded):
1. Search colors.csv for "fintech finance"
2. Get palettes: Blues (trust), Greens (growth), Grays (professional)
3. Check accessibility contrast ratios
4. Provide semantic tokens (primary, secondary, error, success)
5. Include dark mode variants
```

---

## 📝 Pre-Delivery Checklist

Before delivering any UI code, verify:

### Visual Quality
- [ ] No emojis used as icons (SVG only)
- [ ] Icons from consistent family/style
- [ ] Official brand assets used correctly
- [ ] Pressed states don't shift layout
- [ ] Semantic theme tokens used (no hardcoded colors)

### Interaction
- [ ] All tappable elements have clear pressed feedback
- [ ] Touch targets ≥44×44pt (iOS) / ≥48×48dp (Android)
- [ ] Micro-interactions 150-300ms with native easing
- [ ] Disabled states visually clear and non-interactive
- [ ] Screen reader focus order matches visual order

### Light/Dark Mode
- [ ] Primary text contrast ≥4.5:1 in both modes
- [ ] Secondary text contrast ≥3:1 in both modes
- [ ] Dividers visible in both themes
- [ ] Modal scrim 40-60% black
- [ ] Both themes tested

### Layout
- [ ] Safe areas respected (notch, gesture bar)
- [ ] Scroll content not hidden behind fixed bars
- [ ] Tested on small phone, large phone, tablet
- [ ] 4/8dp spacing rhythm maintained
- [ ] Long-form text readable (not edge-to-edge on tablets)

### Accessibility
- [ ] All images have alt text
- [ ] Form fields have labels and hints
- [ ] Color not the only indicator
- [ ] Reduced motion supported
- [ ] Dynamic text size supported

---

## 🚀 Commands & Actions

When I have this skill loaded, use these action words:
- **Plan** - Plan UI structure with design system reasoning
- **Build/Create** - Generate new components/pages with all rules applied
- **Design** - Apply visual design rules from the database
- **Implement** - Code with stack-specific best practices
- **Review** - Audit existing UI against the 10 priority categories
- **Fix/Improve** - Address specific UX issues with rule references
- **Optimize/Enhance** - Pre-launch quality optimization
- **Check** - Verify against accessibility and interaction standards

---

**Skill Version:** 1.0  
**Last Updated:** 2026-03-19  
**Source:** UI/UX Pro Max Skill (GitHub: ui-ux-pro-max-skill-main)  
**Adapted for:** Qwen Code
