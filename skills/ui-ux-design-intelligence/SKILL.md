---
name: ui-ux-design-intelligence
description: UI/UX design intelligence with searchable database of 50 styles, 21 palettes, 50 font pairings, 20 charts, and 8 stacks. Use for planning, building, creating, designing, implementing, reviewing, fixing, improving, optimizing, or enhancing UI/UX. Covers websites, landing pages, dashboards, admin panels, e-commerce, SaaS, portfolios, blogs, mobile apps, and all UI elements.
---

# UI/UX Design Intelligence

Searchable database of UI styles, color palettes, font pairings, chart types, product recommendations, UX guidelines, and stack-specific best practices.

## When to use this skill
- Planning, building, creating, or designing UI/UX
- Implementing, reviewing, fixing, or improving UI code
- Working on: websites, landing pages, dashboards, admin panels, e-commerce, SaaS, portfolios, blogs, mobile apps
- Styling elements: buttons, modals, navbars, sidebars, cards, tables, forms, charts
- Applying styles: glassmorphism, minimalism, brutalism, neumorphism, dark mode, etc.
- Choosing: color palettes, typography, font pairings, animations, layouts

## Prerequisites

Verify Python is installed:

```bash
python3 --version || python --version
```

If not installed, see [resources/setup.md](resources/setup.md) for installation instructions.

## Workflow

### 1. Analyze User Requirements

Extract from user request:
- **Product type**: SaaS, e-commerce, portfolio, dashboard, landing page
- **Style keywords**: minimal, playful, professional, elegant, dark mode
- **Industry**: healthcare, fintech, gaming, education
- **Stack**: React, Vue, Next.js, or default to `html-tailwind`

### 2. Search Relevant Domains

Use `scripts/search.py` to gather comprehensive information:

```bash
python3 scripts/search.py "<keyword>" --domain <domain> [-n <max_results>]
```

**Recommended search order:**
1. **Product** - Style recommendations for product type
2. **Style** - Detailed style guide (colors, effects, frameworks)
3. **Typography** - Font pairings with Google Fonts imports
4. **Color** - Color palette (Primary, Secondary, CTA, Background, Text, Border)
5. **Landing** - Page structure (if landing page)
6. **Chart** - Chart recommendations (if dashboard/analytics)
7. **UX** - Best practices and anti-patterns
8. **Stack** - Stack-specific guidelines (default: html-tailwind)

See [resources/search-reference.md](resources/search-reference.md) for complete domain and stack details.

### 3. Implement Design

Synthesize search results and implement following:
- [resources/professional-ui-rules.md](resources/professional-ui-rules.md) - Common quality issues
- [resources/pre-delivery-checklist.md](resources/pre-delivery-checklist.md) - Final verification

## Instructions

### Example Workflow

**User request:** "Create landing page for professional skincare service"

```bash
# 1. Product type
python3 scripts/search.py "beauty spa wellness service" --domain product

# 2. Style (beauty industry: elegant)
python3 scripts/search.py "elegant minimal soft" --domain style

# 3. Typography
python3 scripts/search.py "elegant luxury" --domain typography

# 4. Color palette
python3 scripts/search.py "beauty spa wellness" --domain color

# 5. Landing page structure
python3 scripts/search.py "hero-centric social-proof" --domain landing

# 6. UX guidelines
python3 scripts/search.py "animation" --domain ux
python3 scripts/search.py "accessibility" --domain ux

# 7. Stack guidelines (default: html-tailwind)
python3 scripts/search.py "layout responsive" --stack html-tailwind
```

Then synthesize results and implement.

### Tips for Better Results

1. **Be specific** - "healthcare SaaS dashboard" > "app"
2. **Search multiple times** - Different keywords reveal different insights
3. **Combine domains** - Style + Typography + Color = Complete design system
4. **Always check UX** - Search "animation", "z-index", "accessibility"
5. **Use stack flag** - Get implementation-specific best practices
6. **Iterate** - Try different keywords if first search doesn't match

## Resources

- [resources/search-reference.md](resources/search-reference.md) - Complete domain and stack reference
- [resources/professional-ui-rules.md](resources/professional-ui-rules.md) - Common quality issues to avoid
- [resources/pre-delivery-checklist.md](resources/pre-delivery-checklist.md) - Final verification checklist
- [resources/setup.md](resources/setup.md) - Python installation instructions
