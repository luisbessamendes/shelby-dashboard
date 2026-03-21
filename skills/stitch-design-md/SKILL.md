---
name: documenting-designs-md
description: Analyzes Stitch projects and generates comprehensive DESIGN.md files documenting design systems in natural, semantic language optimized for Stitch screen generation. Use when the user mentions documenting their design or creating a DESIGN.md file.
---

# Documenting Designs with DESIGN.md

## When to use this skill

- When starting a new Stitch project to establish design rules.
- When an existing Stitch project needs its design system codified for future consistency.
- When the agent needs a source of truth for design tokens, typography, and spacing.

## Workflow

1. **Analyze Project**: Review existing Stitch screens for consistent patterns, colors, and components.
2. **Draft Design System**: Create a `DESIGN.md` file in the project root.
3. **Define Tokens**: Document HSL color values, font families, and spacing scales.
4. **Define Components**: Describe the "Gold Standard" for common components (Buttons, Cards, Modals).
5. **Update**: Keep `DESIGN.md` in sync as the design evolves.

## Instructions

- Use **semantic labels** for colors (e.g., `brand-primary`, `surface-muted`).
- Specify **HSL values** for precise control during Stitch generation.
- Document **motion principles** (e.g., "All transitions should be 200ms ease-in-out").
- The goal is to provide a "context anchor" that the agent can read before calling `edit_screens`.

## Resources

- [Example DESIGN.md](resources/example-design-md.md)
