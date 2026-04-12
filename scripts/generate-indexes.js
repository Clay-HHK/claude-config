#!/usr/bin/env node
/**
 * Generate Index Files for Claude Scholar Harness
 *
 * Scans ALL skill sources (local + plugins), commands/, agents/
 * and generates structured index files in docs/.
 *
 * Skill sources:
 *   1. ~/.claude/skills/              (local skills)
 *   2. ~/.claude/plugins/cache/       (plugin skills: superpowers, scientific-skills, etc.)
 *
 * Usage: node generate-indexes.js
 */

const fs = require('fs');
const path = require('path');

const HOME = process.env.HOME || require('os').homedir();
const CLAUDE_DIR = path.join(HOME, '.claude');
const DOCS_DIR = path.join(CLAUDE_DIR, 'docs');

fs.mkdirSync(DOCS_DIR, { recursive: true });

const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);

// ─── Skill Categories ───────────────────────────────────────────

const categoryPatterns = [
  // Research & Literature
  { pattern: /research|citation|daily-paper|literature|paper-analyze|paper-search|scientific-(?:brainstorming|critical)|hypothesis|scholar-eval|openalex|semantic-scholar/, category: 'Research & Literature' },
  // Paper Writing & Publication
  { pattern: /paper-|writing|ml-paper|review-response|post-acceptance|doc-co|latex-|rebuttal|humanizer|peer-review|venue-template|scientific-writing|markdown-mermaid/, category: 'Paper Writing & Publication' },
  // Bioinformatics & Life Sciences
  { pattern: /bio|alphafold|anndata|scanpy|scvi|cellxgene|ensembl|gene-|uniprot|pdb-|cosmic|clinvar|clinpgx|drugbank|kegg|reactome|string-|hmdb|pubchem|pubmed|brenda|ena-|gwas|pyhealth|pathml|histolab|flowio|pysam|pydeseq|scikit-bio|cobrapy|gget|esm|diffdock|torchdrug|rdkit|datamol|molfeat|medchem|treatment|clinical|iso-13485|etetoolkit|geniml|pytdc|deepchem|pyopenms|metabolomics|opentargets|adaptyv/, category: 'Bioinformatics & Life Sciences' },
  // Chemistry & Materials
  { pattern: /pymatgen|zinc-database|chembl/, category: 'Chemistry & Materials' },
  // Physics & Quantum
  { pattern: /astropy|qiskit|pennylane|qutip|cirq/, category: 'Physics & Quantum Computing' },
  // Development Workflows
  { pattern: /coding|git-|code-review|bug-|architecture|verification|tdd|test-driven|systematic-debug|finishing-a-dev|receiving-code|requesting-code|subagent|using-git|using-superpowers|verification-before|writing-plans|writing-skills|executing-plans|dispatching|brainstorming/, category: 'Development Workflows' },
  // Plugin Development
  { pattern: /skill-|command-|hook-|mcp-|agent-identifier|plugin|skill-creator/, category: 'Plugin Development' },
  // Web Design & UI
  { pattern: /frontend|ui-ux|web-design|canvas|web-artifact|infographic|slack-gif|brand-guideline|theme-factory|algorithmic-art|paper-2-web/, category: 'Web Design & Visualization' },
  // Data Science & ML
  { pattern: /scikit-learn|torch|umap|dask|polars|statsmodel|seaborn|plotly|matplotlib|scientific-vis|shap|networkx|stable-baselines|pufferlib|pytorch-lightning|transformers|vaex|pymc|pymoo|simpy|aeon|arboreto|hypogenic|modal/, category: 'Data Science & ML' },
  // Geospatial & Economics
  { pattern: /geopandas|datacommons|fred-economic|market-research|fluidsim/, category: 'Geospatial & Economics' },
  // Tools & Utilities
  { pattern: /uv-|webapp|kaggle|check-exp|planning|xlsx|pdf|pptx|docx|pyzotero|arxiv|exploratory|markitdown|zarr|perplexity|generate-image|get-available|offer-k-dense|benchling|lamindb|latchbio|dnanexus|opentrons|labarchive|protocolsio|imaging-data|omero|rowan|neuropixel|neurokit|pydicom|deeptools|gtars|anndata/, category: 'Tools & Integrations' },
  // Scientific Presentations
  { pattern: /scientific-slide|scientific-schematic|pptx-poster|canvas-design/, category: 'Scientific Presentations' },
  // Internal & Communication
  { pattern: /internal-comms|document-skill|research-grant|research-lookup/, category: 'Communication & Documents' },
  // Data analysis
  { pattern: /statistical-analysis|exploratory-data|results-analysis/, category: 'Data Analysis' },
];

function categorizeSkill(name) {
  for (const { pattern, category } of categoryPatterns) {
    if (pattern.test(name)) return category;
  }
  return 'Other';
}

// ─── Collect ALL Skills ─────────────────────────────────────────

function collectAllSkills() {
  const allSkills = [];

  // 1. Local skills
  const localDir = path.join(CLAUDE_DIR, 'skills');
  if (fs.existsSync(localDir)) {
    const dirs = fs.readdirSync(localDir, { withFileTypes: true })
      .filter(d => d.isDirectory()).map(d => d.name);
    for (const name of dirs) {
      const skillFile = path.join(localDir, name, 'skill.md');
      const desc = readDescription(skillFile);
      allSkills.push({ name, description: desc, source: 'local' });
    }
  }

  // 2. Plugin skills
  const pluginsCache = path.join(CLAUDE_DIR, 'plugins', 'cache');
  if (fs.existsSync(pluginsCache)) {
    const marketplaces = safeReadDir(pluginsCache);
    for (const marketplace of marketplaces) {
      const mPath = path.join(pluginsCache, marketplace);
      if (!isDir(mPath)) continue;
      const plugins = safeReadDir(mPath);
      for (const plugin of plugins) {
        if (plugin.startsWith('.')) continue;
        const pPath = path.join(mPath, plugin);
        if (!isDir(pPath)) continue;

        // Get latest version
        const versions = safeReadDir(pPath).filter(v => isDir(path.join(pPath, v))).sort().reverse();
        if (versions.length === 0) continue;
        const latestPath = path.join(pPath, versions[0]);

        // Find skills directory (could be skills/ or <plugin-name>/)
        const candidates = ['skills', plugin];
        for (const candidate of candidates) {
          const skillsRoot = path.join(latestPath, candidate);
          if (!fs.existsSync(skillsRoot) || !isDir(skillsRoot)) continue;

          const skillDirs = safeReadDir(skillsRoot).filter(d => isDir(path.join(skillsRoot, d)));
          for (const skillName of skillDirs) {
            // Skip non-skill directories
            if (['docs', '.github', '.claude-plugin', 'node_modules', 'lib'].includes(skillName)) continue;

            const skillFile = path.join(skillsRoot, skillName, 'skill.md');
            const desc = readDescription(skillFile);
            const sourceName = `${marketplace}/${plugin}`;
            allSkills.push({ name: skillName, description: desc, source: sourceName });
          }
        }
      }
    }
  }

  return allSkills;
}

function readDescription(skillFile) {
  if (!fs.existsSync(skillFile)) return '';
  try {
    const content = fs.readFileSync(skillFile, 'utf8');
    const match = content.match(/description:\s*["']?(.+?)["']?\s*$/im);
    return match ? match[1].trim().substring(0, 100) : '';
  } catch { return ''; }
}

function safeReadDir(p) {
  try { return fs.readdirSync(p); } catch { return []; }
}

function isDir(p) {
  try { return fs.statSync(p).isDirectory(); } catch { return false; }
}

// ─── Generate Skills Index ──────────────────────────────────────

function generateSkillsIndex() {
  const allSkills = collectAllSkills();

  // Deduplicate: if same skill name exists in local and plugin, prefer local
  const seen = new Map();
  for (const skill of allSkills) {
    if (!seen.has(skill.name) || skill.source === 'local') {
      seen.set(skill.name, skill);
    }
  }

  const uniqueSkills = Array.from(seen.values()).sort((a, b) => a.name.localeCompare(b.name));

  // Group by category
  const categories = {};
  for (const skill of uniqueSkills) {
    const cat = categorizeSkill(skill.name);
    if (!categories[cat]) categories[cat] = [];
    categories[cat].push(skill);
  }

  // Count by source
  const localCount = uniqueSkills.filter(s => s.source === 'local').length;
  const pluginCount = uniqueSkills.filter(s => s.source !== 'local').length;

  let content = `# Skills Index\n\n`;
  content += `> Auto-generated by generate-indexes.js | ${timestamp}\n`;
  content += `> Total: ${uniqueSkills.length} unique skills (${localCount} local + ${pluginCount} plugin)\n\n`;

  // Source summary
  const sources = {};
  for (const s of allSkills) {
    sources[s.source] = (sources[s.source] || 0) + 1;
  }
  content += `### Sources\n`;
  content += `| Source | Count |\n|--------|-------|\n`;
  for (const [src, count] of Object.entries(sources).sort()) {
    content += `| ${src} | ${count} |\n`;
  }
  content += '\n---\n\n';

  // Category sections
  const catOrder = [
    'Research & Literature', 'Paper Writing & Publication', 'Data Analysis',
    'Data Science & ML', 'Bioinformatics & Life Sciences', 'Chemistry & Materials',
    'Physics & Quantum Computing', 'Development Workflows', 'Plugin Development',
    'Web Design & Visualization', 'Scientific Presentations',
    'Communication & Documents', 'Geospatial & Economics', 'Tools & Integrations', 'Other'
  ];

  for (const cat of catOrder) {
    const skills = categories[cat];
    if (!skills || skills.length === 0) continue;
    content += `## ${cat} (${skills.length})\n\n`;
    for (const { name, description, source } of skills) {
      const tag = source === 'local' ? '' : ` [${source.split('/').pop()}]`;
      content += `- **${name}**${tag}${description ? `: ${description}` : ''}\n`;
    }
    content += '\n';
  }

  fs.writeFileSync(path.join(DOCS_DIR, 'skills-index.md'), content, 'utf8');
  return { total: uniqueSkills.length, local: localCount, plugin: pluginCount };
}

// ─── Commands Index (unchanged logic) ───────────────────────────

function generateCommandsIndex() {
  const commandsDir = path.join(CLAUDE_DIR, 'commands');
  if (!fs.existsSync(commandsDir)) return 0;

  const commandFiles = [];

  const files = fs.readdirSync(commandsDir).filter(f => f.endsWith('.md')).sort();
  for (const file of files) {
    const name = file.replace('.md', '');
    const filePath = path.join(commandsDir, file);
    const description = getDescription(filePath);
    commandFiles.push({ name: `/${name}`, description, type: 'regular' });
  }

  const subdirs = fs.readdirSync(commandsDir, { withFileTypes: true })
    .filter(d => d.isDirectory()).map(d => d.name);

  for (const subdir of subdirs) {
    const subdirPath = path.join(commandsDir, subdir);
    const subFiles = fs.readdirSync(subdirPath).filter(f => f.endsWith('.md')).sort();
    for (const file of subFiles) {
      const name = file.replace('.md', '');
      const filePath = path.join(subdirPath, file);
      const description = getDescription(filePath);
      commandFiles.push({ name: `/${subdir}:${name}`, description, type: 'suite' });
    }
  }

  let content = `# Commands Index\n\n`;
  content += `> Auto-generated by generate-indexes.js | ${timestamp}\n`;
  content += `> Total: ${commandFiles.length} commands\n\n`;

  const regular = commandFiles.filter(c => c.type === 'regular');
  if (regular.length > 0) {
    content += `## Regular Commands (${regular.length})\n\n`;
    content += `| Command | Description |\n|---------|-------------|\n`;
    for (const { name, description } of regular) {
      content += `| \`${name}\` | ${description} |\n`;
    }
    content += '\n';
  }

  const suiteGroups = {};
  for (const cmd of commandFiles.filter(c => c.type === 'suite')) {
    const prefix = cmd.name.split(':')[0];
    if (!suiteGroups[prefix]) suiteGroups[prefix] = [];
    suiteGroups[prefix].push(cmd);
  }

  for (const [prefix, cmds] of Object.entries(suiteGroups)) {
    content += `## ${prefix} Suite (${cmds.length})\n\n`;
    content += `| Command | Description |\n|---------|-------------|\n`;
    for (const { name, description } of cmds) {
      content += `| \`${name}\` | ${description} |\n`;
    }
    content += '\n';
  }

  fs.writeFileSync(path.join(DOCS_DIR, 'commands-index.md'), content, 'utf8');
  return commandFiles.length;
}

// ─── Agents Index (unchanged logic) ─────────────────────────────

function generateAgentsIndex() {
  const agentsDir = path.join(CLAUDE_DIR, 'agents');
  if (!fs.existsSync(agentsDir)) return 0;

  const agentFiles = fs.readdirSync(agentsDir).filter(f => f.endsWith('.md')).sort();
  const agents = [];
  for (const file of agentFiles) {
    const name = file.replace('.md', '');
    const filePath = path.join(agentsDir, file);
    let description = '', model = '';
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      const descMatch = content.match(/description:\s*["']?(.+?)["']?\s*$/im);
      if (descMatch) description = descMatch[1].trim().substring(0, 120);
      const modelMatch = content.match(/model:\s*(\S+)/im);
      if (modelMatch) model = modelMatch[1].trim();
    } catch { /* ignore */ }
    agents.push({ name, description, model });
  }

  const autoTriggers = {
    'code-reviewer': 'Code written/modified',
    'build-error-resolver': 'Build failure',
    'dev-planner': 'Complex feature request',
    'architect': 'After dev-planner',
    'bug-analyzer': 'Bug report',
    'tdd-guide': 'New feature with tests',
    'harness-auditor': 'Periodic / /harness-health'
  };

  let content = `# Agents Index\n\n`;
  content += `> Auto-generated by generate-indexes.js | ${timestamp}\n`;
  content += `> Total: ${agents.length} agents\n\n`;
  content += `| Agent | Description | Model | Auto-trigger |\n`;
  content += `|-------|-------------|-------|--------------|\n`;
  for (const { name, description, model } of agents) {
    const trigger = autoTriggers[name] || '-';
    content += `| **${name}** | ${description.substring(0, 80)} | ${model || '-'} | ${trigger} |\n`;
  }
  content += '\n';

  fs.writeFileSync(path.join(DOCS_DIR, 'agents-index.md'), content, 'utf8');
  return agents.length;
}

// ─── Helper ─────────────────────────────────────────────────────

function getDescription(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');
    let inFrontmatter = false;
    for (const line of lines) {
      if (line.trim() === '---') { if (!inFrontmatter) { inFrontmatter = true; continue; } else break; }
      if (inFrontmatter) {
        const match = line.match(/description:\s*["']?(.+?)["']?\s*$/);
        if (match) return match[1].trim().substring(0, 80);
      }
    }
    for (const line of lines) {
      const match = line.match(/^#+\s*(.+)$/);
      if (match) return match[1].trim().substring(0, 80);
    }
    return '';
  } catch { return ''; }
}

// ─── Main ───────────────────────────────────────────────────────

const skillResult = generateSkillsIndex();
const commandCount = generateCommandsIndex() || 0;
const agentCount = generateAgentsIndex() || 0;

const meta = {
  generated_at: timestamp,
  counts: {
    skills_total: skillResult.total,
    skills_local: skillResult.local,
    skills_plugin: skillResult.plugin,
    commands: commandCount,
    agents: agentCount
  }
};

fs.writeFileSync(path.join(DOCS_DIR, '.index-meta.json'), JSON.stringify(meta, null, 2), 'utf8');

console.log(`Generated indexes: ${skillResult.total} skills (${skillResult.local} local + ${skillResult.plugin} plugin), ${commandCount} commands, ${agentCount} agents`);
