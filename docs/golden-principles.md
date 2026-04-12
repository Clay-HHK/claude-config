# Golden Principles

Opinionated, mechanical rules that keep the codebase legible and consistent.
These are enforced by `harness-auditor` agent and `/harness-health` command.

Inspired by OpenAI's harness engineering: "Human taste is captured once,
then enforced continuously on every line of code."

---

## 1. Shared utilities over hand-rolled helpers

Prefer reusing functions in `utils/` or shared packages over reimplementing
the same logic in each module. This keeps invariants centralized.

**Check**: grep for duplicate function signatures across modules.

## 2. Validate at boundaries, not everywhere

Parse and validate data shapes at entry points (API handlers, data loaders,
config parsing). Internal functions trust typed inputs.

**Check**: validation logic should appear in boundary layers, not scattered
throughout internal functions.

## 3. Config-driven, not hardcoded

Hyperparameters, paths, thresholds, and magic numbers come from Hydra config.
Never hardcode values that might change between experiments.

**Check**: grep for bare numeric literals assigned to model/training parameters.

## 4. Documentation tracks code

Every public module has a docstring. `docs/` descriptions reflect actual
code behavior. Stale documentation is worse than no documentation.

**Check**: doc-gardening scan via `harness-auditor` agent.

## 5. One pattern per problem class

The same category of problem uses the same solution pattern. All Dataset
classes use Factory/Registry. All models accept a single `cfg` parameter.

**Check**: `harness-auditor` scans for pattern violations in model/data modules.

## 6. Boring technology preference

Favor composable, API-stable libraries with good training set representation.
When an upstream library is opaque or unstable, consider reimplementing the
subset you need with full test coverage.

**Check**: review new dependencies for API stability and debuggability.
