---
name: generating-react-components
description: Converts Stitch screens to React component systems with automated validation and design token consistency. Use when the user asks to "export to React" or "convert Stitch to components".
---

# Generating React Components

## When to use this skill

- When moving from a Stitch prototype to a production React codebase.
- When the user wants to see how a Stitch screen would look as functional React code.
- When maintaining a component library based on Stitch designs.

## Workflow

1. **Select Screen**: Use `mcp_StitchMCP_list_screens` to identify the screen to convert.
2. **Read HTML/CSS**: Retrieve the screen content via `mcp_StitchMCP_get_screen`.
3. **Map Tokens**: Cross-reference styles with the local `DESIGN.md` or design system.
4. **Generate Component**: Create a functional React component (typically using Tailwind or inline CSS as requested).
5. **Validate**: Ensure the component is syntactically valid and matches the visual layout.

## Instructions

- Prefer **functional components** and **React Hooks**.
- Use **props** for dynamic content (titles, images, button text).
- Ensure **responsive behavior** is preserved from the Stitch prototype.
- Extract common layout patterns into reusable "Layout" components.

## Resources

- [Mapping Guide](resources/mapping-guide.md)
