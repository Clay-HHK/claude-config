# Claude Scholar Configuration

Personal Claude Code configuration for academic research and software development.

---

## User Background

- **Degree**: Computer Science PhD
- **Target Venues**: NeurIPS, ICML, ICLR, KDD | Nature, Science, Cell, PNAS
- **Focus**: Academic writing quality, logical coherence, natural expression
- **Python**: `uv` package manager, Hydra + OmegaConf, Transformers Trainer
- **Git**: Conventional Commits (feat/fix/docs/style/refactor/perf/test/chore), rebase + merge --no-ff

---

## Operating Principles

- **Respond in English** to the user. Keep technical terms in English.
- **Plan before doing**: discuss approach before writing code. Wait for user approval. Two-step: propose -> approve -> implement.
- **Scope discipline**: match changes to what the task requires. No over-engineering, no unrequested extras.
- **Writing style**: no em-dashes, no AI-sounding phrases. Banned words in `docs/conventions.md`.
- **Figures**: clean, minimal, publication-ready. Max 4 colors. No decorative elements.
- **Long experiments**: always use tmux sessions. Structured CSV logging. Update `experiments.md`.
- **Code style**: PEP 8, type hints, Factory/Registry patterns. Details in `rules/coding-style.md`.
- **Working dirs**: plans in `/plan`, temp files in `/temp`. Auto-create if missing.

---

## Core Workflow

```
Ideation -> ML Dev -> Experiment Analysis -> Paper Writing -> Self-Review -> Rebuttal -> Post-Acceptance
```

Full workflow details with tools and commands: `docs/workflows.md`

---

## Inventory

| Component | Count | Index |
|-----------|-------|-------|
| Skills | 217 (87 local + 130 plugin) | `docs/skills-index.md` |
| Commands | 58 | `docs/commands-index.md` |
| Agents | 15 | `docs/agents-index.md` |
| Rules | 4 | `rules/coding-style.md`, `agents.md`, `security.md`, `experiment-reproducibility.md` |
| Hooks | 7+ | See `hooks/hooks.json` |

---

## Rules (Always Active)

| Rule | Purpose |
|------|---------|
| `coding-style.md` | 200-400 line files, immutable config, type hints, Factory/Registry, no bare except |
| `agents.md` | Auto-invocation triggers, parallel execution, feedback loop principle |
| `security.md` | No hardcoded secrets, sensitive file protection, instruction integrity |
| `experiment-reproducibility.md` | Random seeds, config recording, environment recording, checkpoints |

---

## Hooks

| Hook | Trigger | Purpose |
|------|---------|---------|
| `security-guard.js` | PreToolUse | Block dangerous commands, confirm risky operations |
| `code-quality-guard.js` | PreToolUse | Enforce coding-style rules mechanically on Python files |
| `skill-forced-eval.js` | UserPromptSubmit | Match user input to relevant skills |
| `session-start.js` | SessionStart | Show git status, todos, available commands |
| `experiment-monitor.js` | SessionStart | Detect running tmux experiments |
| `session-summary.js` | SessionEnd | Work log, metrics, index freshness check |
| `stop-summary.js` | Stop | Quick status, temp file detection |
| `latex-check.js` | PostToolUse | Validate LaTeX compilation after .tex edits |

---

## Harness Self-Evolution

The harness auto-evolves without manual intervention:
- **SessionStart**: auto-detects stale indexes, regenerates them, syncs CLAUDE.md inventory numbers
- **SessionEnd**: auto-regenerates indexes if sources changed, collects session metrics to JSONL
- **code-quality-guard**: auto-logs all BLOCK/WARN events to `harness-feedback.jsonl`
- Manual: `/harness-health` for full diagnostic, `/harness-feedback` for manual feedback, `/harness-report` for monthly summary
- Golden principles: `docs/golden-principles.md` | Quality scores: `docs/QUALITY_SCORE.md`

---

## Merge Philosophy

- Ship working code quickly; corrections are cheaper than delays
- Prefer small, focused, revertable commits
- When an agent struggles, the problem is in the harness, not the agent
- Diagnose what's missing (tools? guardrails? documentation?) and feed it back

---

## Task Completion Summary

After each task, provide a brief summary:

```
Operation Review
1. [Main operation]
2. [Modified files]

Current Status
- [Git/filesystem/runtime status]

Next Steps
1. [Targeted suggestions]
```
