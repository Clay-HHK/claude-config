---
description: "Generate monthly harness metrics summary from JSONL logs"
---

# Harness Report

Generate a summary report from harness metrics and feedback logs.

## Steps

1. **Read metrics** from `~/.claude/logs/harness-metrics.jsonl`:
   ```bash
   cat ~/.claude/logs/harness-metrics.jsonl 2>/dev/null | tail -30
   ```

2. **Read feedback** from `~/.claude/logs/harness-feedback.jsonl`:
   ```bash
   cat ~/.claude/logs/harness-feedback.jsonl 2>/dev/null
   ```

3. **Summarize**:
   - Total sessions and approximate total duration
   - Most-used skills (by activation frequency)
   - Most-used agents (by invocation frequency)
   - Hook block/warn frequency
   - Unresolved feedback items (resolved: false)
   - Feedback category distribution

4. **Run health check**:
   ```bash
   node ~/.claude/scripts/harness-health-check.js
   ```

5. **Present** a concise report with trends and recommendations.

6. **Update** `docs/QUALITY_SCORE.md` with latest scores.
