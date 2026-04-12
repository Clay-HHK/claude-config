# Research Lifecycle Workflows

## 7-Stage Research Lifecycle

```
Ideation -> ML Development -> Experiment Analysis -> Paper Writing -> Self-Review -> Submission/Rebuttal -> Post-Acceptance
```

| Stage | Core Tools | Commands |
|-------|-----------|----------|
| 1. Research Ideation | `research-ideation` skill + `literature-reviewer` agent + Zotero MCP | `/research-init`, `/zotero-review`, `/zotero-notes` |
| 2. ML Project Dev | `architecture-design` skill + `code-reviewer` agent | `/plan`, `/commit`, `/tdd` |
| 3. Experiment Analysis | `results-analysis` skill + `data-analyst` agent | `/analyze-results` |
| 4. Paper Writing | `ml-paper-writing` skill + `paper-miner` agent | - |
| 5. Self-Review | `paper-self-review` skill | - |
| 6. Submission & Rebuttal | `review-response` skill + `rebuttal-writer` agent | `/rebuttal` |
| 7. Post-Acceptance | `post-acceptance` skill | `/presentation`, `/poster`, `/promote` |

## Supporting Workflows

- **Automation**: Hooks auto-trigger at session lifecycle stages (skill evaluation, env init, work summary, security check)
- **Zotero Integration**: Automated paper import, collection management, full-text reading, and citation export via Zotero MCP
- **Knowledge Extraction**: `paper-miner` and `kaggle-miner` agents extract knowledge from papers and competitions
- **Skill Evolution**: `skill-development` -> `skill-quality-reviewer` -> `skill-improver` three-step improvement loop
