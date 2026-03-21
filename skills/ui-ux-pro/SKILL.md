---
name: designing-ui-ux-pro
description: Provides comprehensive UI/UX design intelligence using a structured design system approach. Features 67+ styles, 96+ palettes, and professional UX guidelines. Use when the user requests UI/UX design, review, or implementation for any tech stack.
---

# Designing with UI/UX Pro Max

## When to use this skill

- When requested to design, build, review, or improve a UI/UX for a web or mobile app.
- When you need a "premium" design system for a specific product type (SaaS, Dashboard, E-commerce).
- When you need implementation-specific guidelines for a specific stack (React, Next.js, Flutter, etc.).

## Workflow

1. **Analyze Requirements**: Extract Product Type, Style keywords, Industry, and Tech Stack.
2. **Generate Design System**:
    - Define Patterns, Styling (Colors/Typography), and Effects.
    - Identify common Anti-patterns for the specific product type.
3. **Persist System**: Use a "Master + Overrides" pattern.
    - `design-system/MASTER.md`: Global design rules.
    - `design-system/pages/<page-name>.md`: Page-specific deviations.
4. **Implementation**: Use the design system as a contract when writing code or generating Stitch screens.
5. **Validation**: Check against the "Professional UI Rules" and "Pre-Delivery Checklist".

## Instructions

### Domain Search Logic

| Domain | Use For |
|--------|---------|
| `product` | Core architecture and feature sets for specific industries. |
| `style` | Specific visual languages (Glassmorphism, Minimalism, Bento). |
| `typography`| Hierarchy and Google Font pairings. |
| `color` | HSL palettes tailored to the industry. |
| `ux` | Interaction best practices and accessibility. |

### Design System Contract

Always provide a structured design system before coding:

- **Visual Pattern**: Define the layout (e.g., Side-nav centered cards).
- **Core Tokens**: Colors (HSL), Typography, Spacing, Shadow.
- **Micro-interactions**: Hover states, transitions, cursors.

### Professional UI Rules

- **No Emoji Icons**: Use Lucide/Heroicons SVG paths.
- **Glass Contrast**: Light mode cards need `bg-white/80` or higher.
- **Stable Hover**: Change color/opacity, never scale or shift layout.
- **Space Control**: Use consistent padding (e.g., `8px` increments).

## Resources

- [Professional UI Rules](resources/ui-rules.md)
- [Example: SaaS Dashboard](examples/saas-dashboard.md)
