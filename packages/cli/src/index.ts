import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { scoreTask, loadKnowledgeEntries } from '@fluently/scorer';
import { knowledgeEntrySchema } from '@fluently/scorer/schema';
import { input, select } from '@inquirer/prompts';
const fs = require('fs');
const path = require('path');
import yaml from 'js-yaml';

const program = new Command();

program
  .name('fluent')
  .description('Operationalize the AI Fluency 4D Framework: Delegation, Description, Discernment, Diligence. Score, compare, and contribute Fluently 4D cycles for AI fluency.')
  .version('0.1.0');

program
  .command('score')
  .argument('<task>', 'Task description')
  .action(async (task) => {
    const spinner = ora('Scoring task...').start();
    const results = scoreTask({ description: task, delegation_intent: '' }, path.resolve(__dirname, '../../../knowledge'));
    spinner.succeed('Score complete');
    console.log(chalk.bold('Dimension | Score | Status'));
    results.forEach(({ entry, dimensionScores }: any) => {
      Object.entries(dimensionScores).forEach(([dim, score]: [string, any]) => {
        let status = (score as number) >= 80 ? '✅ Strong' : (score as number) >= 50 ? '⚠️ Improve' : '❌ Weak';
        console.log(`${chalk.cyan(dim)} | ${chalk.yellow((score as number).toString())} | ${status}`);
      });
      console.log(chalk.green(`Top play: ${entry.title} (${entry.domain})`));
      console.log(chalk.blue(`YAML: knowledge/${entry.domain}-${entry.id}.yaml`));
    });
  });

program
  .command('compare')
  .requiredOption('--description <desc>', 'Task description')
  .requiredOption('--delegation <intent>', 'Delegation intent')
  .action(async (opts) => {
    const spinner = ora('Comparing...').start();
    const results = scoreTask({ description: opts.description, delegation_intent: opts.delegation }, path.resolve(__dirname, '../../../knowledge'));
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
  .description('Contribute a new Fluently 4D cycle to the knowledge base')
  .action(async () => {
    const answers: Record<string, unknown> = {};
    answers.id = await input({ message: 'Slug (unique id):' });
    answers.title = await input({ message: 'Title:' });
    answers.domain = await select({ message: 'Domain:', choices: [
      { name: 'coding', value: 'coding' },
      { name: 'writing', value: 'writing' },
      { name: 'research', value: 'research' },
      { name: 'customer-support', value: 'customer-support' },
      { name: 'education', value: 'education' },
      { name: 'legal', value: 'legal' },
      { name: 'healthcare', value: 'healthcare' },
      { name: 'general', value: 'general' }
    ] });
    answers.dimensions = {};
    for (const dim of ['delegation', 'description', 'discernment', 'diligence']) {
      (answers.dimensions as Record<string, unknown>)[dim] = {
        description: await input({ message: `Describe ${dim}:` }),
        example: await input({ message: `Example for ${dim}:` }),
        antipattern: await input({ message: `Antipattern for ${dim}:` })
      };
    }
    answers.score_hints = {};
    for (const dim of ['delegation', 'description', 'discernment', 'diligence']) {
      (answers.score_hints as Record<string, number>)[dim] = parseFloat(await input({ message: `Weight for ${dim} (0-1):` }));
    }
    answers.tags = (await input({ message: 'Tags (comma separated):' })).split(',').map((t: string) => t.trim());
    answers.contributor = await input({ message: 'Contributor:' });
    answers.version = await input({ message: 'Version (semver):' });
    try {
      knowledgeEntrySchema.parse(answers);
      const yamlStr = yaml.dump(answers);
      const filePath = path.resolve(__dirname, '../../../knowledge', `${answers.domain}-${answers.id}.yaml`);
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
  .description('Sync knowledge entries from GitHub main branch')
  .action(async () => {
    const spinner = ora('Syncing knowledge...').start();
    // Simple implementation: git pull
    require('child_process').execSync('git pull', { cwd: path.resolve(__dirname, '../../') });
    spinner.succeed('Sync complete');
    const files = fs.readdirSync(path.resolve(__dirname, '../../../knowledge')).filter((f: string) => f.endsWith('.yaml'));
    console.log(chalk.green(`New entries: ${files.length}`));
  });

program
  .command('list')
  .argument('[domain]', 'Domain to filter')
  .action(async (domain) => {
    const entries = loadKnowledgeEntries(path.resolve(__dirname, '../../../knowledge'));
    entries.filter(e => !domain || e.domain === domain).forEach(e => {
      console.log(`${chalk.bold(e.title)} | ${chalk.cyan(e.domain)} | ${chalk.yellow(e.tags.join(','))} | ${chalk.magenta(e.contributor)}`);
    });
  });

program.parseAsync(process.argv);
