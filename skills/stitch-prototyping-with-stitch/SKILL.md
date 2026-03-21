---
name: prototyping-with-stitch
description: Expertly uses the StitchMCP server to create, edit, and iterate on UI designs. Use when the user wants to "brainstorm", "mock up", "prototype", or "generate a screen" for a web or mobile application.
---

# Prototyping with Stitch

## When to use this skill

- When the user asks to "mock up a design" or "create a UI prototype".
- When iterative design changes are needed for existing Stitch screens.
- When generating multiple design variants for A/B testing or visual exploration.

## Workflow

1. **Initialize Project**: Create a new Stitch project using `mcp_StitchMCP_create_project` if one doesn't exist.
2. **Generate Initial Screen**: Use `mcp_StitchMCP_generate_screen_from_text` to create the first screen from the user's requirements.
3. **Iterate & Refine**:
    - Use `mcp_StitchMCP_edit_screens` to modify specific elements or layout.
    - Use `mcp_StitchMCP_generate_variants` to explore different visual directions.
4. **Export & Document**:
    - Document the design system in the codebase if required.
    - Use the `react-components` skill (if available) to convert designs to React.

## Instructions

### High-Quality Prompting

Stitch works best with descriptive, design-focused prompts.

- **BAD**: "Make a login page."
- **GOOD**: "Create a modern, minimalistic login page with glassmorphism effects, a subtle gradient background, and a prominent 'Sign In with Google' button. Use 'Ant Design' inspired typography."

### Tool Handling

- **Create Project**: Always get the `projectId` from the response and store it for subsequent calls.
- **Get Screen**: Before editing, use `mcp_StitchMCP_list_screens` to identify the correct `screenId`.
- **Edit Screens**: Focus the prompt on what to *change* or *add*, rather than re-describing the whole screen.

## Resources

- [Prompt Templates](resources/prompt-templates.md)
- [Iteration Example](examples/iteration-loop.md)
