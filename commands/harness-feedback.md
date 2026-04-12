---
description: "Log agent failure signals for systematic harness improvement"
---

# Harness Feedback

Capture agent failure signals to systematically improve the harness.

When an agent struggles or gives poor output, use this command to record the signal.

## Usage

The user describes what went wrong. You should:

1. **Categorize** the issue:
   - `missing-context`: Agent lacked necessary context (update docs/ or add project docs)
   - `missing-tool`: Agent lacked a necessary tool or skill
   - `wrong-skill-match`: skill-forced-eval matched the wrong skill
   - `rule-violation`: Agent violated a rule but wasn't caught by a hook
   - `timeout`: Agent ran too long
   - `other`: Other issues

2. **Identify** which harness file to update:
   - Agent prompt (agents/*.md)
   - Skill content (skills/*/skill.md)
   - Rule (rules/*.md)
   - CLAUDE.md
   - docs/ knowledge base
   - Hook logic (hooks/*.js)

3. **Log** the feedback to `~/.claude/logs/harness-feedback.jsonl`:
   ```bash
   echo '{"timestamp":"TIMESTAMP","category":"CATEGORY","description":"DESCRIPTION","target_file":"FILE","resolved":false}' >> ~/.claude/logs/harness-feedback.jsonl
   ```

4. **Suggest** the specific fix and offer to implement it.

## Principle

From OpenAI's harness engineering:
> "When the agent struggles, we treat it as a signal: identify what is missing
> -- tools, guardrails, documentation -- and feed it back into the repository,
> always by having Codex itself write the fix."
