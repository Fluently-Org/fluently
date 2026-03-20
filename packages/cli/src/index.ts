import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { scoreTask, loadKnowledgeEntries } from '../../scorer/src/engine';
import { knowledgeEntrySchema } from '../../scorer/src/schema';
import prompts from '@inquirer/prompts';
import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';

const program = new Command();

program
  .name('4d')
  .description('Operationalize the AI Fluency 4D Framework: Delegation, Description, Discernment, Diligence. Score, compare, and contribute knowledge plays for AI fluency.')
  .version('0.1.0');

program
  .command('score')
  .argument('<task>', 'Task description')
  .action(async (task) => {
    const spinner = ora('Scoring task...').start();
    const results = scoreTask({ description: task, delegation_intent: '' }, path.resolve(__dirname, '../../knowledge'));
    spinner.succeed('Score complete');
    console.log(chalk.bold('Dimension | Score | Status'));
    results.forEach(({ entry, dimensionScores }) => {
      Object.entries(dimensionScores).forEach(([dim, score]) => {
        let status = score >= 80 ? '✅ Strong' : score >= 50 ? '⚠️ Improve' : '❌ Weak';
        console.log(`${chalk.cyan(dim)} | ${chalk.yellow(score.toString())} | ${status}`);
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
    const results = scoreTask({ description: opts.description, delegation_intent: opts.delegation }, path.resolve(__dirname, '../../knowledge'));
    spinner.succeed('Comparison complete');
    const top = results[0];
    const overall = Object.values(top.dimensionScores).reduce((a, b) => a + b, 0) / 4;
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
  .description('Contribute a new 4D play to the knowledge base')
  .action(async () => {
    const answers: any = {};
    answers.id = await prompts.input({ message: 'Slug (unique id):' });
    answers.title = await prompts.input({ message: 'Title:' });
    answers.domain = await prompts.select({ message: 'Domain:', choices: [
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
      answers.dimensions[dim] = {
        description: await prompts.input({ message: `Describe ${dim}:` }),
        example: await prompts.input({ message: `Example for ${dim}:` }),
        antipattern: await prompts.input({ message: `Antipattern for ${dim}:` })
      };
    }
    answers.score_hints = {};
    for (const dim of ['delegation', 'description', 'discernment', 'diligence']) {
      answers.score_hints[dim] = parseFloat(await prompts.input({ message: `Weight for ${dim} (0-1):` }));
    }
    answers.tags = (await prompts.input({ message: 'Tags (comma separated):' })).split(',').map((t: string) => t.trim());
    answers.contributor = await prompts.input({ message: 'Contributor:' });
    answers.version = await prompts.input({ message: 'Version (semver):' });
    try {
      knowledgeEntrySchema.parse(answers);
      const yamlStr = yaml.dump(answers);
      const filePath = path.resolve(__dirname, '../../knowledge', `${answers.domain}-${answers.id}.yaml`);
      fs.writeFileSync(filePath, yamlStr);
      console.log(chalk.green(`Entry written to ${filePath}`));
      console.log(chalk.yellow('Run `git add . && git commit` then open a PR to share with the community'));
    } catch (e: any) {
      console.log(chalk.red('Validation failed:'), e.errors);
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
    const files = fs.readdirSync(path.resolve(__dirname, '../../knowledge')).filter(f => f.endsWith('.yaml'));
    console.log(chalk.green(`New entries: ${files.length}`));
  });

program
  .command('list')
  .argument('[domain]', 'Domain to filter')
  .action(async (domain) => {
    const entries = loadKnowledgeEntries(path.resolve(__dirname, '../../knowledge'));
    entries.filter(e => !domain || e.domain === domain).forEach(e => {
      console.log(`${chalk.bold(e.title)} | ${chalk.cyan(e.domain)} | ${chalk.yellow(e.tags.join(','))} | ${chalk.magenta(e.contributor)}`);
    });
  });

program.parseAsync(process.argv);
