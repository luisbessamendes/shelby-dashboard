---
name: planning-work
description: Generates detailed implementation plans from a design or requirements. Use when the user has a clear design and needs a step-by-step modification plan.
---

# Writing Implementation Plans

## When to use this skill
- When a design document exists or requirements are clear.
- Before writing code for complex features.
- When the user asks for an "implementation plan".

## Workflow

1.  **Contextualize**
    - Read the design document or requirements.
    - Understand the codebase state.
2.  **Create Plan Header**
    - Define goal, architecture, and tech stack.
3.  **Break Down Tasks**
    - Create bite-sized tasks (2-5 mins execution each).
    - Follow TDD: Test -> Fail -> Code -> Pass -> Commit.
4.  **Save Plan**
    - Save to `docs/plans/YYYY-MM-DD-<feature-name>.md`.
5.  **Present Execution Options**
    - Offer to execute the plan step-by-step.

## Instructions

### Plan Document Guidelines

**File Location:** `docs/plans/YYYY-MM-DD-<feature-name>.md`

**Header Format:**
```markdown
# [Feature Name] Implementation Plan

**Goal:** [One sentence describing what this builds]

**Architecture:** [2-3 sentences about approach]

**Tech Stack:** [Key technologies/libraries]

---
```

### Task Structure (Bite-Sized)

Each task should follow this structure strictly:

````markdown
### Task N: [Component Name]

**Files:**
- Create: `exact/path/to/file.py`
- Modify: `exact/path/to/existing.py:123-145`
- Test: `tests/exact/path/to/test.py`

**Step 1: Write the failing test**
```python
# Code for the test
```

**Step 2: Run test to verify it fails**
Run: `pytest tests/path/test.py::test_name -v`
Expected: FAIL

**Step 3: Write minimal implementation**
```python
# Code for implementation
```

**Step 4: Run test to verify it passes**
Run: `pytest tests/path/test.py::test_name -v`
Expected: PASS

**Step 5: Commit**
```bash
git add ...
git commit -m "feat: ..."
```
````

### Key Principles
- **Exact file paths always.**
- **Complete code in plan** (not "add validation").
- **Exact commands with expected output.**
- **DRY, YAGNI, TDD, frequent commits.**

## Execution Handoff
After saving the plan, ask the user if they would like you to proceed with executing the tasks.
