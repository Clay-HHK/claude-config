#!/usr/bin/env node
/**
 * PreToolUse Hook: Code Quality Guard
 *
 * Event: PreToolUse (Write | Edit)
 * Mechanically enforces coding-style.md rules on Python files.
 *
 * Harness Engineering principle:
 *   "When documentation falls short, we promote the rule into code."
 *   "Because the lints are custom, we write the error messages to
 *    inject remediation instructions into agent context."
 *
 * Two-tier enforcement (same pattern as security-guard.js):
 *   - BLOCK (exit 2): file > 800 lines, bare except
 *   - WARN (exit 0 + systemMessage): file 400-800 lines, print(), mutable defaults, missing type hints
 */

const fs = require('fs');
const path = require('path');

// Read stdin input
let input = {};
try {
  const stdinData = fs.readFileSync(0, 'utf8');
  if (stdinData.trim()) {
    input = JSON.parse(stdinData);
  }
} catch {
  process.exit(0); // Fail open on parse error
}

const toolName = input.tool_name || '';
const filePath = input.tool_input?.file_path || '';

// Only check Python files on Write/Edit
if (!['Write', 'Edit'].includes(toolName) || !filePath.endsWith('.py')) {
  console.log(JSON.stringify({ continue: true }));
  process.exit(0);
}

// Determine if this is a test file (relaxed rules)
const basename = path.basename(filePath);
const isTestFile = /^test_|_test\.py$|^conftest\.py$/.test(basename) ||
                   /[\/\\]tests?[\/\\]/.test(filePath);

// Get content to check
let content = '';

if (toolName === 'Write') {
  content = input.tool_input?.content || '';
} else if (toolName === 'Edit') {
  // For Edit, read the existing file and apply the edit mentally
  // We check the new_string for violations
  const newString = input.tool_input?.new_string || '';
  const oldString = input.tool_input?.old_string || '';

  // Also check the full file if it exists
  try {
    if (fs.existsSync(filePath)) {
      const existing = fs.readFileSync(filePath, 'utf8');
      // Simulate the edit to get approximate final content
      content = existing.replace(oldString, newString);
    } else {
      content = newString;
    }
  } catch {
    content = newString;
  }
}

if (!content) {
  console.log(JSON.stringify({ continue: true }));
  process.exit(0);
}

const lines = content.split('\n');
const lineCount = lines.length;

const blocks = [];  // exit 2
const warns = [];   // systemMessage

// ─── Check 1: File length ─────────────────────────────────────

if (lineCount > 800) {
  blocks.push(
    `File has ${lineCount} lines (limit: 800).\n` +
    `REMEDIATION: Split into multiple modules, each 200-400 lines.\n` +
    `Reference: rules/coding-style.md "Small File Principle".\n` +
    `Example structure:\n` +
    `  module/\n` +
    `    __init__.py    # Factory & Registry (~50 lines)\n` +
    `    base.py        # Base class (~200 lines)\n` +
    `    impl_a.py      # Implementation A (~300 lines)\n` +
    `    impl_b.py      # Implementation B (~250 lines)`
  );
} else if (lineCount > 400) {
  warns.push(
    `File has ${lineCount} lines (recommended: 200-400).\n` +
    `Consider splitting at logical boundaries before it grows further.`
  );
}

// ─── Check 2: Bare except ─────────────────────────────────────

const bareExceptRegex = /^\s*except\s*:\s*$/;
for (let i = 0; i < lines.length; i++) {
  if (bareExceptRegex.test(lines[i])) {
    blocks.push(
      `Line ${i + 1}: bare \`except:\` found.\n` +
      `REMEDIATION: Catch a specific exception type.\n` +
      `  BAD:  except:\n` +
      `  GOOD: except ValueError as e:\n` +
      `  GOOD: except (TypeError, KeyError) as e:\n` +
      `Reference: rules/coding-style.md "Catch specific exception types".`
    );
    break; // One report is enough
  }
}

// ─── Check 3: print() in non-test files ───────────────────────

if (!isTestFile) {
  const printRegex = /^\s*print\s*\(/;
  let printCount = 0;
  for (const line of lines) {
    if (printRegex.test(line)) printCount++;
  }
  if (printCount > 0) {
    warns.push(
      `Found ${printCount} print() statement(s) in non-test file.\n` +
      `REMEDIATION: Use logger instead of print().\n` +
      `  import logging\n` +
      `  logger = logging.getLogger(__name__)\n` +
      `  logger.info("message")  # instead of print("message")\n` +
      `Reference: rules/coding-style.md "Use logger, not print()".`
    );
  }
}

// ─── Check 4: Mutable default arguments ───────────────────────

const mutableDefaultRegex = /def\s+\w+\s*\([^)]*(?:=\s*\[|=\s*\{|=\s*set\s*\()/;
for (let i = 0; i < lines.length; i++) {
  if (mutableDefaultRegex.test(lines[i])) {
    warns.push(
      `Line ${i + 1}: mutable default argument detected.\n` +
      `REMEDIATION: Use None as default, initialize in function body.\n` +
      `  BAD:  def foo(items=[]):\n` +
      `  GOOD: def foo(items=None):\n` +
      `            items = items or []\n` +
      `Reference: rules/coding-style.md "No mutable default arguments".`
    );
    break;
  }
}

// ─── Check 5: Missing type hints on function defs ─────────────

if (!isTestFile) {
  const funcDefRegex = /^\s*def\s+\w+\s*\(/;
  const hasReturnType = /\)\s*->\s*\S+/;
  let missingCount = 0;

  for (const line of lines) {
    if (funcDefRegex.test(line) && !hasReturnType.test(line)) {
      // Skip __init__, __str__, etc. for return type (they implicitly return None)
      if (!/def\s+__\w+__/.test(line)) {
        missingCount++;
      }
    }
  }

  if (missingCount > 2) {
    warns.push(
      `${missingCount} function(s) missing return type annotations.\n` +
      `REMEDIATION: Add type hints to all functions.\n` +
      `  def process(data: List[Dict]) -> Optional[DataFrame]:\n` +
      `Reference: rules/coding-style.md "All functions must have type hints".`
    );
  }
}

// ─── Auto-log to harness-feedback.jsonl (self-evolution) ──────

function autoLogFeedback(issues, severity) {
  try {
    const os = require('os');
    const logDir = path.join(os.homedir(), '.claude', 'logs');
    fs.mkdirSync(logDir, { recursive: true });
    const logFile = path.join(logDir, 'harness-feedback.jsonl');

    const entry = {
      timestamp: new Date().toISOString(),
      category: 'rule-violation',
      source: 'code-quality-guard',
      severity,
      file: filePath,
      issues: issues.map(i => i.split('\n')[0]), // first line of each
      resolved: true // auto-detected = auto-resolved by agent fixing it
    };

    fs.appendFileSync(logFile, JSON.stringify(entry) + '\n', 'utf8');
  } catch { /* never block writes */ }
}

// ─── Build output ─────────────────────────────────────────────

if (blocks.length > 0) {
  autoLogFeedback(blocks, 'block');
  const msg = `Code Quality BLOCK:\n\n${blocks.join('\n\n')}`;
  const errorOutput = {
    hookSpecificOutput: { permissionDecision: 'deny' },
    systemMessage: msg
  };
  console.error(JSON.stringify(errorOutput));
  process.exit(2);
}

if (warns.length > 0) {
  autoLogFeedback(warns, 'warn');
  const msg = `Code Quality Warnings:\n\n${warns.join('\n\n')}\n\nPlease fix these issues in your output.`;
  console.log(JSON.stringify({
    continue: true,
    systemMessage: msg
  }));
  process.exit(0);
}

// All clear
console.log(JSON.stringify({ continue: true }));
process.exit(0);
