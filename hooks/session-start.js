#!/usr/bin/env node
/**
 * SessionStart Hook: Display project status (cross-platform version)
 *
 * Event: SessionStart
 * Function: Display project status, Git info, todos, plugins, and commands at session start
 */

const path = require('path');
const os = require('os');
const fs = require('fs');

// Import shared utility library
const common = require('./hook-common');

// Import package manager detection
const { getPackageManager, getSelectionPrompt } = require('../scripts/lib/package-manager');

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

const cwd = input.cwd || process.cwd();
const projectName = path.basename(cwd);
const homeDir = os.homedir();

// Build output
let output = '';

// Session start info
output += `🚀 ${projectName} Session started\n`;
output += `▸ Time: ${common.formatDateTime()}\n`;
output += `▸ Directory: ${cwd}\n\n`;

// Git status
const gitInfo = common.getGitInfo(cwd);

if (gitInfo.is_repo) {
  output += `▸ Git branch: ${gitInfo.branch}\n\n`;

  if (gitInfo.has_changes) {
    output += `⚠️  Uncommitted changes (${gitInfo.changes_count} files):\n`;

    // Show change list (up to 10)
    const statusIcons = {
      'M': '📝',  // Modified
      'A': '➕',  // Added
      'D': '❌',  // Deleted
      'R': '🔄',  // Renamed
      '??': '❓'  // Untracked
    };

    for (let i = 0; i < Math.min(gitInfo.changes.length, 10); i++) {
      const change = gitInfo.changes[i];
      const status = change.substring(0, 2).trim();
      const file = change.substring(3).trim();

      const icon = statusIcons[status] || '•';
      output += `  ${icon} ${file}\n`;
    }

    if (gitInfo.changes_count > 10) {
      output += `  ... (${gitInfo.changes_count - 10} more files)\n`;
    }
  } else {
    output += `✅ Working directory clean\n`;
  }
  output += '\n';
} else {
  output += `▸ Git: Not a repository\n\n`;
}

// Package manager detection
try {
  const pm = getPackageManager();
  output += `📦 Package manager: ${pm.name} (${pm.source})\n`;

  // If detected via fallback, suggest setup
  if (pm.source === 'fallback' || pm.source === 'default') {
    output += `💡 Run /setup-pm to configure preferred package manager\n`;
  }
} catch (err) {
  // Package manager detection failed, silently ignore
}

output += '\n';

// Todos
output += `📋 Todos:\n`;
const todoInfo = common.getTodoInfo(cwd);

if (todoInfo.found) {
  output += `  - ${todoInfo.pending} pending / ${todoInfo.done} completed\n`;

  // Show top 5 pending items
  if (fs.existsSync(todoInfo.path)) {
    try {
      const content = fs.readFileSync(todoInfo.path, 'utf8');
      const pendingItems = content.match(/^[\-\*] \[ \].+$/gm) || [];

      if (pendingItems.length > 0) {
        output += `\n  Recent todos:\n`;
        for (let i = 0; i < Math.min(5, pendingItems.length); i++) {
          const item = pendingItems[i].replace(/^[\-\*] \[ \]\s*/, '').substring(0, 60);
          output += `  - ${item}\n`;
        }
      }
    } catch {
      // Ignore errors
    }
  }
} else {
  output += `  No todo file found (TODO.md, docs/todo.md etc)\n`;
}

output += '\n';

// Enabled plugins
output += `🔌 Enabled plugins:\n`;
const enabledPlugins = common.getEnabledPlugins(homeDir);

if (enabledPlugins.length > 0) {
  for (let i = 0; i < Math.min(5, enabledPlugins.length); i++) {
    output += `  - ${enabledPlugins[i].name}\n`;
  }
  if (enabledPlugins.length > 5) {
    output += `  ... and ${enabledPlugins.length - 5} more plugins\n`;
  }
} else {
  output += `  None\n`;
}

output += '\n';

// Available commands
output += `💡 Available commands:\n`;
const availableCommands = common.getAvailableCommands(homeDir);

if (availableCommands.length > 0) {
  for (const cmd of availableCommands.slice(0, 5)) {
    const description = common.getCommandDescription(cmd.path) || `${cmd.plugin} command`;
    const truncatedDesc = description.length > 40 ? description.substring(0, 40) + '...' : description;
    output += `  /${cmd.name.padEnd(20)} ${truncatedDesc}\n`;
  }

  if (availableCommands.length > 5) {
    output += `  ... and ${availableCommands.length - 5} more commands, use /help to list all\n`;
  }
} else {
  output += `  No commands found\n`;
}

// ─── Harness Self-Evolution: auto-regenerate indexes if stale ───
try {
  const metaPath = path.join(homeDir, '.claude', 'docs', '.index-meta.json');
  const genScript = path.join(homeDir, '.claude', 'scripts', 'generate-indexes.js');
  let needsRegen = false;
  let healthIssues = [];

  if (!fs.existsSync(metaPath)) {
    needsRegen = true;
  } else {
    const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
    const metaMtime = fs.statSync(metaPath).mtimeMs;

    // Check if any source directory has files newer than the index
    const sourceDirs = [
      path.join(homeDir, '.claude', 'skills'),
      path.join(homeDir, '.claude', 'commands'),
      path.join(homeDir, '.claude', 'agents')
    ];

    for (const dir of sourceDirs) {
      if (!fs.existsSync(dir)) continue;
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        try {
          const entryPath = path.join(dir, entry.name);
          const stat = fs.statSync(entryPath);
          if (stat.mtimeMs > metaMtime) {
            needsRegen = true;
            break;
          }
        } catch { /* ignore */ }
      }
      if (needsRegen) break;
    }
  }

  if (needsRegen && fs.existsSync(genScript)) {
    const { execSync } = require('child_process');
    const genOutput = execSync(`node "${genScript}"`, {
      encoding: 'utf8', timeout: 10000, stdio: 'pipe'
    }).trim();
    output += `\n🔄 Harness auto-evolved: ${genOutput}\n`;

    // Auto-sync CLAUDE.md inventory numbers
    const claudeMdPath = path.join(homeDir, '.claude', 'CLAUDE.md');
    const newMeta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
    if (fs.existsSync(claudeMdPath)) {
      let claudeContent = fs.readFileSync(claudeMdPath, 'utf8');
      const totalSkills = newMeta.counts.skills_total;
      const localSkills = newMeta.counts.skills_local;
      const pluginSkills = newMeta.counts.skills_plugin;
      const commands = newMeta.counts.commands;
      const agents = newMeta.counts.agents;

      // Update skill line
      claudeContent = claudeContent.replace(
        /\| Skills \| .+? \|/,
        `| Skills | ${totalSkills} (${localSkills} local + ${pluginSkills} plugin) |`
      );
      // Update command line
      claudeContent = claudeContent.replace(
        /\| Commands \| \d+ \|/,
        `| Commands | ${commands} |`
      );
      // Update agent line
      claudeContent = claudeContent.replace(
        /\| Agents \| \d+ \|/,
        `| Agents | ${agents} |`
      );

      fs.writeFileSync(claudeMdPath, claudeContent, 'utf8');
    }
  }

  // Lightweight health check: verify hooks.json completeness
  const hooksJsonPath = path.join(homeDir, '.claude', 'hooks', 'hooks.json');
  if (fs.existsSync(hooksJsonPath)) {
    const hooksConfig = JSON.parse(fs.readFileSync(hooksJsonPath, 'utf8'));
    const hooks = hooksConfig.hooks || {};
    for (const [event, matchers] of Object.entries(hooks)) {
      for (const matcher of matchers) {
        for (const hook of (matcher.hooks || [])) {
          const cmd = hook.command || '';
          const fileMatch = cmd.match(/hooks\/([^"'\s]+\.js)/);
          if (fileMatch) {
            const hookFile = path.join(homeDir, '.claude', 'hooks', fileMatch[1]);
            if (!fs.existsSync(hookFile)) {
              healthIssues.push(`Missing hook: ${fileMatch[1]}`);
            }
          }
        }
      }
    }
  }

  if (healthIssues.length > 0) {
    output += `\n⚠️ Harness issues detected:\n`;
    for (const issue of healthIssues) {
      output += `  - ${issue}\n`;
    }
    output += `  Run /harness-health for details\n`;
  }
} catch {
  // Harness evolution should never block session start
}

// Output JSON
const result = {
  continue: true,
  systemMessage: output
};

console.log(JSON.stringify(result));

process.exit(0);
