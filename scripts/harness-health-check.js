#!/usr/bin/env node
/**
 * Harness Health Check Script
 *
 * Mechanical checks for harness configuration integrity.
 * Called by /harness-health command and harness-auditor agent.
 *
 * Checks:
 * 1. CLAUDE.md inventory vs disk reality
 * 2. hooks.json references valid files
 * 3. docs/ index freshness
 * 4. Orphaned/dead references
 */

const fs = require('fs');
const path = require('path');

const HOME = process.env.HOME || require('os').homedir();
const CLAUDE_DIR = path.join(HOME, '.claude');

const results = [];
let passCount = 0;
let warnCount = 0;
let failCount = 0;

function report(status, check, detail) {
  results.push({ status, check, detail });
  if (status === 'PASS') passCount++;
  else if (status === 'WARN') warnCount++;
  else failCount++;
}

// ─── Check 1: Disk Counts ──────────────────────────────────────

function countDir(dirPath, filter) {
  if (!fs.existsSync(dirPath)) return 0;
  const items = fs.readdirSync(dirPath, { withFileTypes: true });
  if (filter === 'dirs') return items.filter(d => d.isDirectory()).length;
  if (filter === 'md') return items.filter(f => f.name.endsWith('.md')).length;
  return items.length;
}

const skillCount = countDir(path.join(CLAUDE_DIR, 'skills'), 'dirs');
const agentCount = countDir(path.join(CLAUDE_DIR, 'agents'), 'md');
const commandCount = countDir(path.join(CLAUDE_DIR, 'commands'), 'md');

// Count subdirectory commands too
const commandsDir = path.join(CLAUDE_DIR, 'commands');
let totalCommands = commandCount;
if (fs.existsSync(commandsDir)) {
  const subdirs = fs.readdirSync(commandsDir, { withFileTypes: true })
    .filter(d => d.isDirectory());
  for (const subdir of subdirs) {
    totalCommands += fs.readdirSync(path.join(commandsDir, subdir.name))
      .filter(f => f.endsWith('.md')).length;
  }
}

// ─── Check 2: CLAUDE.md Inventory Accuracy ──────────────────────

const claudeMdPath = path.join(CLAUDE_DIR, 'CLAUDE.md');
if (fs.existsSync(claudeMdPath)) {
  const content = fs.readFileSync(claudeMdPath, 'utf8');

  // Check skill count (CLAUDE.md may say "215 (85 local + 130 plugin)" or just "215")
  const skillMatch = content.match(/Skills\s*\|\s*(\d+)/);
  if (skillMatch) {
    const claimed = parseInt(skillMatch[1]);
    // Read the index meta for total count (includes plugin skills)
    const metaPath = path.join(CLAUDE_DIR, 'docs', '.index-meta.json');
    let totalSkills = skillCount; // fallback to local only
    if (fs.existsSync(metaPath)) {
      try {
        const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
        totalSkills = meta.counts.skills_total || skillCount;
      } catch { /* ignore */ }
    }
    if (claimed === totalSkills) {
      report('PASS', 'CLAUDE.md skill count', `${claimed} matches (local + plugin)`);
    } else {
      report('WARN', 'CLAUDE.md skill count', `Claims ${claimed}, index says ${totalSkills}. Run: node ~/.claude/scripts/generate-indexes.js`);
    }
  }

  // Check command count
  const cmdMatch = content.match(/Commands\s*\|\s*(\d+)/);
  if (cmdMatch) {
    const claimed = parseInt(cmdMatch[1]);
    if (claimed === totalCommands) {
      report('PASS', 'CLAUDE.md command count', `${claimed} matches disk`);
    } else {
      report('WARN', 'CLAUDE.md command count', `Claims ${claimed}, actual ${totalCommands}`);
    }
  }

  // Check agent count
  const agentMatch = content.match(/Agents\s*\|\s*(\d+)/);
  if (agentMatch) {
    const claimed = parseInt(agentMatch[1]);
    if (claimed === agentCount) {
      report('PASS', 'CLAUDE.md agent count', `${claimed} matches disk`);
    } else {
      report('FAIL', 'CLAUDE.md agent count', `Claims ${claimed}, actual ${agentCount}`);
    }
  }
} else {
  report('FAIL', 'CLAUDE.md exists', 'File not found');
}

// ─── Check 3: hooks.json Validity ───────────────────────────────

const hooksJsonPath = path.join(CLAUDE_DIR, 'hooks', 'hooks.json');
if (fs.existsSync(hooksJsonPath)) {
  try {
    const hooksConfig = JSON.parse(fs.readFileSync(hooksJsonPath, 'utf8'));
    const hooks = hooksConfig.hooks || {};

    let allValid = true;
    const checkedFiles = new Set();

    for (const [event, matchers] of Object.entries(hooks)) {
      for (const matcher of matchers) {
        for (const hook of (matcher.hooks || [])) {
          const cmd = hook.command || '';
          // Extract the JS file from the command
          const fileMatch = cmd.match(/hooks\/([^"'\s]+\.js)/);
          if (fileMatch) {
            const hookFile = path.join(CLAUDE_DIR, 'hooks', fileMatch[1]);
            checkedFiles.add(fileMatch[1]);
            if (!fs.existsSync(hookFile)) {
              report('FAIL', `Hook file exists: ${fileMatch[1]}`, `Referenced in ${event} but file missing`);
              allValid = false;
            }
          }
        }
      }
    }

    if (allValid) {
      report('PASS', 'hooks.json references', `All ${checkedFiles.size} hook files exist`);
    }

    // Check for hook files on disk not in hooks.json
    const hookFiles = fs.readdirSync(path.join(CLAUDE_DIR, 'hooks'))
      .filter(f => f.endsWith('.js') && f !== 'hook-common.js');

    for (const file of hookFiles) {
      if (!checkedFiles.has(file)) {
        report('WARN', `Orphaned hook: ${file}`, 'Hook file exists but not registered in hooks.json');
      }
    }
  } catch (e) {
    report('FAIL', 'hooks.json valid JSON', e.message);
  }
} else {
  report('FAIL', 'hooks.json exists', 'File not found');
}

// ─── Check 4: docs/ Index Freshness ─────────────────────────────

const metaPath = path.join(CLAUDE_DIR, 'docs', '.index-meta.json');
if (fs.existsSync(metaPath)) {
  try {
    const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
    const metaMtime = fs.statSync(metaPath).mtimeMs;
    const age = Date.now() - metaMtime;
    const ageHours = Math.round(age / (1000 * 60 * 60));

    // Check if local counts still match (plugin counts may change less frequently)
    const metaLocal = meta.counts.skills_local || meta.counts.skills || 0;
    const metaAgents = meta.counts.agents || 0;
    if (metaLocal === skillCount && metaAgents === agentCount) {
      report('PASS', 'docs/ index freshness', `Generated ${ageHours}h ago, counts match (${meta.counts.skills_total || metaLocal} total skills)`);
    } else {
      report('WARN', 'docs/ index freshness',
        `Stale: local skills ${metaLocal} -> ${skillCount}, agents ${metaAgents} -> ${agentCount}. Run: node ~/.claude/scripts/generate-indexes.js`);
    }
  } catch {
    report('WARN', 'docs/ index meta', 'Cannot parse .index-meta.json');
  }
} else {
  report('WARN', 'docs/ indexes', 'No .index-meta.json found. Run: node ~/.claude/scripts/generate-indexes.js');
}

// ─── Output ─────────────────────────────────────────────────────

console.log('\n=== HARNESS HEALTH REPORT ===\n');
console.log(`Generated: ${new Date().toISOString()}`);
console.log(`Disk: ${skillCount} skills, ${totalCommands} commands, ${agentCount} agents\n`);

for (const { status, check, detail } of results) {
  const icon = status === 'PASS' ? 'PASS' : status === 'WARN' ? 'WARN' : 'FAIL';
  console.log(`  [${icon}] ${check}`);
  if (detail) console.log(`         ${detail}`);
}

console.log(`\nSummary: ${passCount} passed, ${warnCount} warnings, ${failCount} failures`);

if (failCount > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
