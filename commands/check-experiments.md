---
description: Check all running tmux experiment sessions, parse progress, and report status
---

Activate the `check-experiments` skill and execute the full experiment monitoring workflow:

1. List all tmux sessions with `tmux ls`
2. For each session, capture the last 30 lines of output
3. Parse progress indicators (epochs, steps, percentages, metrics)
4. Check for errors (CUDA OOM, RuntimeError, Traceback)
5. Generate a structured status table
6. If `experiments.md` exists in the project, update it with current status and timestamp

Report only. Do NOT restart, modify, or stop any experiments.
