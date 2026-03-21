---
name: generating-stitch-loop
description: Generates a complete multi-page website from a single prompt using Stitch, with automated file organization and validation. Use when the user asks for a "full website" or "multi-page app".
---

# Generating Stitch Loops

## When to use this skill

- When requested to build a small multi-page website from scratch.
- When generating a series of related screens that share a design system.
- When the user provides a high-level requirement that implies multiple views (e.g., "build an e-commerce site").

## Workflow

1. **Define Sitemap**: Map out all required pages (Home, About, Pricing, etc.).
2. **Setup Project**: Call `mcp_StitchMCP_create_project`.
3. **Sequential Generation**:
    - Generate the Home page first to establish the design language.
    - Reference the Home page's `screenId` when generating subsequent pages for consistency.
4. **Link Optimization**: Ensure links between pages use the correct `screenId` or descriptive names.
5. **Review**: Present the full project to the user for feedback.

## Instructions

- Use a **master design prompt** for all pages to ensure visual cohesion.
- Pass the **project ID** to every call.
- If a screen fails, retry or adjust the prompt based on common Stitch errors.
- Always check `mcp_StitchMCP_list_screens` to track progress.

## Resources

- [Sitemap Template](resources/sitemap-template.md)
