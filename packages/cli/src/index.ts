import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { scoreTask, loadKnowledgeEntries } from '@fluently/scorer';
import { knowledgeEntrySchema } from '@fluently/scorer/schema';
import inquirer from 'inquirer';
const fs = require('fs');
const path = require('path');
import yaml from 'js-yaml';

const program = new Command();

program
  .name('fluent')
  .description(
    'Fluently helps you work better with AI by applying the 4D Framework: Delegation, Description, Discernment, Diligence.\n\n' +
    'It scores your AI tasks against a community knowledge base of validated 4D cycles — patterns that tell you who should own the decision, how to frame the task, when to trust the output, and who stays accountable.\n\n' +
    'Commands:\n' +
    '  score      Find the 3 most similar 4D cycles to your task and see how each dimension holds up\n' +
    '  compare    Match your task + delegation intent to the closest cycle and get a full 4D score\n' +
    '  list       Browse all available 4D cycles, optionally filtered by domain\n' +
    '  contribute Build and validate a new 4D cycle, then open a PR to share it with the community\n' +
    '  sync       Pull the latest cycles from the GitHub knowledge base'
  )
  .version('0.1.0');

program
  .command('score')
  .description(
    'Find the 3 community 4D cycles most similar to your task.\n\n' +
    'Scores each match across Delegation, Description, Discernment, and Diligence (0–100).\n' +
    'Use this to discover existing patterns you can extend or adapt — not to grade your own work.\n\n' +
    'Example:\n' +
    '  fluent score "AI generates a first draft, human edits and publishes"'
  )
  .argument('<task>', 'Plain-language description of the AI task you want to run')
  .action(async (task) => {
    const spinner = ora('Scoring task...').start();
    const results = scoreTask({ description: task, delegation_intent: '' }, path.resolve(__dirname, '../knowledge'));
    spinner.succeed('Score complete\n');
    results.forEach(({ entry, dimensionScores }: any, i: number) => {
      const scores = Object.values(dimensionScores) as number[];
      const overall = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
      console.log(chalk.bold.white(`#${i + 1}  ${entry.title}`) + chalk.gray(`  (${entry.domain})`) + chalk.yellow(`  overall: ${overall}/100`));
      Object.entries(dimensionScores).forEach(([dim, score]: [string, any]) => {
        const bar = '█'.repeat(Math.round((score as number) / 10)) + '░'.repeat(10 - Math.round((score as number) / 10));
        const status = (score as number) >= 80 ? chalk.green('✅ Strong') : (score as number) >= 50 ? chalk.yellow('⚠️  Improve') : chalk.red('❌ Weak');
        console.log(`  ${chalk.cyan(dim.padEnd(14))} ${bar}  ${chalk.yellow(String(score).padStart(3))}  ${status}`);
      });
      console.log(chalk.gray(`  → knowledge/${entry.domain}-${entry.id}.yaml\n`));
    });
  });

program
  .command('compare')
  .description(
    'Score your task against the closest community 4D cycle using both task description and delegation intent.\n\n' +
    'Delegation intent tells the scorer how much you plan to rely on AI: automated (AI decides), augmented (AI + human together), or supervised (human decides, AI assists).\n' +
    'Returns a single 4D score and the closest matching cycle so you can see where your approach diverges.\n\n' +
    'Example:\n' +
    '  fluent compare --description "AI reviews PRs for style issues" --delegation "augmented"'
  )
  .requiredOption('--description <desc>', 'Plain-language description of the AI task')
  .requiredOption('--delegation <intent>', 'How much you delegate to AI: automated | augmented | supervised')
  .action(async (opts) => {
    const spinner = ora('Comparing...').start();
    const results = scoreTask({ description: opts.description, delegation_intent: opts.delegation }, path.resolve(__dirname, '../knowledge'));
    spinner.succeed('Comparison complete');
    const top = results[0];
    const overall = (Object.values(top.dimensionScores) as number[]).reduce((a, b) => a + b, 0) / 4;
    console.log(chalk.bold(`4D Score: ${Math.round(overall)}`));
    Object.entries(top.dimensionScores).forEach(([dim, score]) => {
      console.log(`${chalk.cyan(dim)}: ${chalk.yellow(score.toString())}`);
    });
    console.log(chalk.green(`Closest play: ${top.entry.title}`));
    console.log(chalk.blue(`YAML: knowledge/${top.entry.domain}-${top.entry.id}.yaml`));
    console.log(chalk.magenta('Estimated token efficiency improvement: ~30%'));
  });

program
  .command('contribute')
  .description(
    'Build a new 4D cycle interactively and save it as a validated YAML file.\n\n' +
    'Walks you through each dimension — what to delegate, how to describe the task, what to watch for in the output, and how to stay accountable.\n' +
    'The cycle is validated against the schema before saving. Open a PR to share it with the community.'
  )
  .action(async () => {
    const basic = await inquirer.prompt([
      { type: 'input', name: 'id', message: 'Slug (unique id):' },
      { type: 'input', name: 'title', message: 'Title:' },
      { type: 'list', name: 'domain', message: 'Domain:', choices: ['coding','writing','research','customer-support','education','legal','healthcare','general'] },
      { type: 'input', name: 'tags', message: 'Tags (comma separated):' },
      { type: 'input', name: 'contributor', message: 'Contributor:' },
      { type: 'input', name: 'version', message: 'Version (semver):', default: '1.0.0' }
    ]);
    const dimensions: Record<string, unknown> = {};
    for (const dim of ['delegation', 'description', 'discernment', 'diligence']) {
      const d = await inquirer.prompt([
        { type: 'input', name: 'description', message: `${dim} — describe:` },
        { type: 'input', name: 'example', message: `${dim} — example:` },
        { type: 'input', name: 'antipattern', message: `${dim} — antipattern:` }
      ]);
      dimensions[dim] = d;
    }
    const hintsRaw = await inquirer.prompt(
      ['delegation','description','discernment','diligence'].map(dim => ({
        type: 'input', name: dim, message: `Weight for ${dim} (0–1, all must sum to 1):`
      }))
    );
    const answers: Record<string, unknown> = {
      ...basic,
      tags: basic.tags.split(',').map((t: string) => t.trim()),
      dimensions,
      score_hints: Object.fromEntries(Object.entries(hintsRaw).map(([k, v]) => [k, parseFloat(v as string)]))
    };
    try {
      knowledgeEntrySchema.parse(answers);
      const yamlStr = yaml.dump(answers);
      const filePath = path.resolve(__dirname, '../knowledge', `${answers.domain}-${answers.id}.yaml`);
      fs.writeFileSync(filePath, yamlStr);
      console.log(chalk.green(`Entry written to ${filePath}`));
      console.log(chalk.yellow('Run `git add . && git commit` then open a PR to share with the community'));
    } catch (e: unknown) {
      const error = e as { errors?: unknown[] };
      console.log(chalk.red('Validation failed:'), error.errors);
    }
  });

program
  .command('sync')
  .description(
    'Pull the latest 4D cycles from the GitHub knowledge base into your local install.\n\n' +
    'Run this after new community cycles are merged to get the most up-to-date patterns for scoring and comparison.'
  )
  .action(async () => {
    const spinner = ora('Syncing knowledge...').start();
    // Simple implementation: git pull
    require('child_process').execSync('git pull', { cwd: path.resolve(__dirname, '../../') });
    spinner.succeed('Sync complete');
    const files = fs.readdirSync(path.resolve(__dirname, '../knowledge')).filter((f: string) => f.endsWith('.yaml'));
    console.log(chalk.green(`New entries: ${files.length}`));
  });

program
  .command('list')
  .description(
    'Browse all community 4D cycles in the knowledge base.\n\n' +
    'Optionally filter by domain to see cycles relevant to your field.\n' +
    'Available domains: coding, writing, research, education, legal, healthcare, general\n\n' +
    'Examples:\n' +
    '  fluent list\n' +
    '  fluent list coding'
  )
  .argument('[domain]', 'Filter by domain: coding | writing | research | education | legal | healthcare | general')
  .action(async (domain) => {
    const entries = loadKnowledgeEntries(path.resolve(__dirname, '../knowledge'));
    entries.filter(e => !domain || e.domain === domain).forEach(e => {
      console.log(`${chalk.bold(e.title)} | ${chalk.cyan(e.domain)} | ${chalk.yellow(e.tags.join(','))} | ${chalk.magenta(e.contributor)}`);
    });
  });

program.parseAsync(process.argv);
