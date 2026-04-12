---
description: "Check harness configuration integrity and code quality"
---

# Harness Health Check

Run a comprehensive health check on the Claude Scholar harness configuration.

## Steps

1. Run the mechanical health check script:
   ```bash
   node ~/.claude/scripts/harness-health-check.js
   ```

2. Review the PASS/WARN/FAIL report.

3. If any FAIL items exist, fix them:
   - Stale CLAUDE.md counts: update the Inventory table in `~/.claude/CLAUDE.md`
   - Missing hook files: check `~/.claude/hooks/hooks.json` references
   - Stale indexes: run `node ~/.claude/scripts/generate-indexes.js`

4. For deeper code quality scanning, invoke the `harness-auditor` agent on the current project directory.

5. Update `~/.claude/docs/QUALITY_SCORE.md` with results.
