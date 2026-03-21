---
name: integrating-shadcn-ui
description: Expert guidance for integrating and building applications with shadcn/ui components. Helps discover, install, customize, and optimize shadcn/ui components with best practices for React applications. Use when the user mentions "shadcn" or asks for "UI components".
---

# Integrating shadcn/ui

## When to use this skill

- When building a React application that needs a consistent, high-quality component library.
- When the user wants to implement complex UI patterns (Datatables, Command menus, etc.) easily.
- When customizing shadcn/ui themes to match a specific brand identity.

## Workflow

1. **Setup**: Initialize shadcn/ui in the project using `npx shadcn-ui@latest init`.
2. **Select Components**: Identify which components are needed (e.g., Button, Input, Dialog).
3. **Install**: Run the installation commands for the selected components.
4. **Customize**: Edit the `tailwind.config.js` or CSS variables to match the project's `DESIGN.md`.
5. **Implementation**: provide code snippets for using the components in the application.

## Instructions

- Always use the **CLI** for installing components to ensure all dependencies are met.
- Prefer **composition** over monolithic components.
- Document any **custom overrides** made to the default shadcn/ui styles.
- Reference the official [shadcn/ui documentation](https://ui.shadcn.com/) for API details.

## Resources

- [Customization Guide](resources/custom-themes.md)
