---
description: Edit paper with style constraints (no AI tone, no em-dashes, clean figures)
---

Activate the `paper-edit` skill and apply it to the current paper.

$ARGUMENTS

If no specific section is given, scan the entire paper directory for .tex files.

Apply all style rules:
- Remove em-dashes, replace with commas/periods/parentheses
- Remove AI-style phrases (notably, leveraging, comprehensive, crucial, etc.)
- Shorten captions to under 2 lines
- Fix \cite formatting (no spaces after commas)
- Verify LaTeX compilation after changes

Report a summary of all changes made.
