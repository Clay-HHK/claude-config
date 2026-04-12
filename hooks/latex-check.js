#!/usr/bin/env node
/**
 * PostToolUse Hook: LaTeX compilation check
 *
 * Event: PostToolUse
 * Matcher: Write|Edit
 * Function: Auto-check LaTeX compilation after .tex file edits
 */

const path = require('path');
const { execSync } = require('child_process');

// Read stdin input
let input = {};
try {
  const stdinData = require('fs').readFileSync(0, 'utf8');
  if (stdinData.trim()) {
    input = JSON.parse(stdinData);
  }
} catch {
  process.exit(0);
}

const toolName = input.tool_name || '';
const filePath = input.tool_input?.file_path || '';

// Only check .tex files
if (!filePath.endsWith('.tex')) {
  console.log(JSON.stringify({ continue: true }));
  process.exit(0);
}

const cwd = input.cwd || process.cwd();
const texDir = path.dirname(filePath);
const texFile = path.basename(filePath);

// Try to find the main .tex file (look for \documentclass)
const fs = require('fs');
let mainTexFile = texFile;

try {
  const content = fs.readFileSync(filePath, 'utf8');
  // If this file doesn't have \documentclass, try to find the main file
  if (!content.includes('\\documentclass')) {
    const texFiles = fs.readdirSync(texDir).filter(f => f.endsWith('.tex'));
    for (const tf of texFiles) {
      const tfContent = fs.readFileSync(path.join(texDir, tf), 'utf8');
      if (tfContent.includes('\\documentclass')) {
        mainTexFile = tf;
        break;
      }
    }
  }
} catch {
  // Fall back to edited file
}

// Run pdflatex in nonstopmode to check for errors
let compileOutput = '';
let hasErrors = false;

try {
  compileOutput = execSync(
    `cd "${texDir}" && pdflatex -interaction=nonstopmode -halt-on-error "${mainTexFile}" 2>&1 | tail -20`,
    { encoding: 'utf8', timeout: 30000, stdio: 'pipe' }
  );
} catch (err) {
  hasErrors = true;
  compileOutput = err.stdout || err.stderr || 'LaTeX compilation failed';
  // Extract only error lines
  const lines = compileOutput.split('\n');
  const errorLines = lines.filter(l => l.startsWith('!') || l.includes('Error') || l.includes('Undefined'));
  if (errorLines.length > 0) {
    compileOutput = errorLines.slice(0, 5).join('\n');
  } else {
    compileOutput = lines.slice(-10).join('\n');
  }
}

if (hasErrors) {
  const result = {
    continue: true,
    systemMessage: `LaTeX compilation error in ${mainTexFile}:\n\`\`\`\n${compileOutput}\n\`\`\`\nPlease fix the LaTeX errors before continuing.`
  };
  console.log(JSON.stringify(result));
} else {
  console.log(JSON.stringify({ continue: true }));
}

process.exit(0);
