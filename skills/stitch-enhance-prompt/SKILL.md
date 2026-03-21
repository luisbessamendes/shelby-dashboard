---
name: enhancing-prompts
description: Transforms vague UI ideas into polished, Stitch-optimized prompts. Enhances specificity, adds UI/UX keywords, injects design system context, and structures output for better generation results. Use when the user's prompt is too short or lacks design detail.
---

# Enhancing Prompts for Stitch

## When to use this skill

- When the user says something like "make a button" or "design a chat app".
- When an initial Stitch generation lacks the desired "premium" feel.
- When you want to ensure the agent follows specific UI/UX trends (Glassmorphism, Bento grids, etc.).

## Workflow

1. **Analyze Input**: Identify the core intent (e.g., "Login", "Dashboard").
2. **Inject Context**: Add keywords about lighting, depth, typography, and color theory.
3. **Structure Output**: Organize the prompt into sections (Layout, Style, Interactivity).
4. **Validate**: Present the enhanced prompt to the user before calling the generation tool.

## Instructions

- **Add specificity**: Instead of "blue background", use "deep indigo gradient (HSL: 240, 60%, 20% to 260, 50%, 40%)".
- **Focus on Hierarchy**: Mention what should be prominent (e.g., "The 'Get Started' button should be the primary focal point with a glow effect").
- **Design Systems**: Mention frameworks or styles (e.g., "Follow Vercel-style minimalism").

## Resources

- [Keyword Bank](resources/keyword-bank.md)
