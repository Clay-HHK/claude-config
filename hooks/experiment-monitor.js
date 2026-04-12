#!/usr/bin/env node
/**
 * SessionStart Hook: Experiment monitor
 *
 * Event: SessionStart
 * Function: Detect running tmux experiment sessions and show progress summary
 */

const { execSync } = require('child_process');

// Read stdin input
let input = {};
try {
  const stdinData = require('fs').readFileSync(0, 'utf8');
  if (stdinData.trim()) {
    input = JSON.parse(stdinData);
  }
} catch {
  // Use default empty object
}

// Check if tmux is available
let tmuxSessions = [];
try {
  const tmuxOutput = execSync('tmux ls 2>/dev/null', {
    encoding: 'utf8',
    timeout: 5000,
    stdio: 'pipe'
  });

  tmuxSessions = tmuxOutput.trim().split('\n').filter(Boolean);
} catch {
  // tmux not running or not available
  console.log(JSON.stringify({ continue: true }));
  process.exit(0);
}

if (tmuxSessions.length === 0) {
  console.log(JSON.stringify({ continue: true }));
  process.exit(0);
}

let output = 'Running tmux sessions detected:\n';

for (const session of tmuxSessions) {
  const sessionName = session.split(':')[0].trim();
  output += `  - ${session}\n`;

  // Try to capture last few lines of output
  try {
    const lastLines = execSync(
      `tmux capture-pane -t "${sessionName}" -p 2>/dev/null | tail -5`,
      { encoding: 'utf8', timeout: 3000, stdio: 'pipe' }
    ).trim();

    if (lastLines) {
      // Check for progress indicators
      const progressMatch = lastLines.match(/(\d+)[\/|of](\d+)/);
      const percentMatch = lastLines.match(/(\d+(?:\.\d+)?)\s*%/);
      const epochMatch = lastLines.match(/[Ee]poch\s*(\d+)/);

      if (progressMatch) {
        output += `    Progress: ${progressMatch[1]}/${progressMatch[2]}\n`;
      } else if (percentMatch) {
        output += `    Progress: ${percentMatch[1]}%\n`;
      } else if (epochMatch) {
        output += `    Epoch: ${epochMatch[1]}\n`;
      }

      // Show last meaningful line
      const meaningfulLines = lastLines.split('\n').filter(l => l.trim().length > 0);
      if (meaningfulLines.length > 0) {
        const lastLine = meaningfulLines[meaningfulLines.length - 1].trim();
        if (lastLine.length > 80) {
          output += `    Last: ${lastLine.substring(0, 80)}...\n`;
        } else {
          output += `    Last: ${lastLine}\n`;
        }
      }
    }
  } catch {
    // Can't capture pane output
  }
}

output += '\nUse `/check-experiments` for detailed status.\n';

const result = {
  continue: true,
  systemMessage: output
};

console.log(JSON.stringify(result));
process.exit(0);
