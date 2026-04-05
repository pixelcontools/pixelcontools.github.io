---
name: knowledge-keeper
description: "Update project knowledge base after significant code changes. Use when: adding new components, hooks, or utilities; making architectural decisions; fixing non-trivial bugs; changing state management patterns; modifying the build pipeline; adding new features. Maintains ADRs, copilot-instructions.md, and file-specific instructions."
argument-hint: "Describe what changed or was added"
---

# Knowledge Keeper

Maintain the AI knowledge base so future sessions understand the codebase without re-exploration.

## When to Run

After any session that involved:
- Adding or removing components, hooks, utilities, or workers
- Changing the Zustand store structure or adding new store methods
- Making an architectural decision (new pattern, library choice, data flow change)
- Fixing a non-trivial bug (especially rendering, color, or state bugs)
- Adding a new feature or modal
- Changing build/deploy configuration

## Procedure

### Step 1: Assess What Changed

Review the changes made in this session. Identify:
- New files added
- Existing files significantly modified
- Patterns introduced or changed
- Decisions made and their rationale

### Step 2: Update Workspace Instructions

If the change affects the **overall architecture** (new component folder, new utility, new hook, changed tech stack, new convention), update `.github/copilot-instructions.md`:
- Update the Architecture tree if new folders/files were added
- Update Critical Invariants if new rules were established
- Update Key Patterns if new patterns were introduced
- Keep it concise — link to details rather than embedding

### Step 3: Update File-Specific Instructions

If the change affects a **specific domain area**, update the matching instruction file in `.github/instructions/`:

| Domain | File |
|--------|------|
| Canvas rendering, viewport, grid | `canvas-rendering.instructions.md` |
| Zustand store, state, history | `store-patterns.instructions.md` |
| Image processing, export, workers | `image-processing.instructions.md` |

If a new domain emerges that doesn't fit existing files, create a new `.instructions.md` with appropriate `applyTo` globs and a keyword-rich `description`.

### Step 4: Create ADR (if architectural decision was made)

If a decision was made about **how** or **why** something is built a certain way, create an ADR in `docs/decisions/`:

File naming: `NNNN-short-title.md` (sequential number, e.g., `0001-use-zustand.md`)

Template:
```markdown
# NNNN: Short Title

**Date**: YYYY-MM-DD
**Status**: Accepted

## Context
What problem or question prompted this decision?

## Decision
What was decided and why?

## Consequences
What are the trade-offs? What does this enable or prevent?
```

Check existing ADRs in `docs/decisions/` first to determine the next sequence number. If the directory doesn't exist, create it.

### Step 5: Update CHANGELOG

If a user-facing feature was added or a bug was fixed, add an entry to the top of `CHANGELOG.md` under the current version or an `[Unreleased]` section.

## What NOT to Update

- Don't update docs for trivial changes (typo fixes, style tweaks, comment changes)
- Don't duplicate information — if it's already documented in `ai-logs/`, just reference it
- Don't add speculative documentation for planned-but-not-built features
- Don't modify `ai-logs/` files — those are historical records

## Quality Checks

Before finishing:
- [ ] Workspace instructions stay under ~100 lines (link to details instead of embedding)
- [ ] File instructions have accurate `applyTo` globs
- [ ] ADR has clear Context → Decision → Consequences structure
- [ ] No duplicated information across files
