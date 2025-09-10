#!/usr/bin/env node

const { program } = require('commander');
const { generateSchema } = require('../src/generate');
const { validateEnv } = require('../src/validate');
const chalk = require('chalk');
const fs = require('fs');
const path = require('path');

program
  .name('dotenv-guard')
  .description('Auto-generate .env schema and validate environment variables')
  .version(require('../package.json').version);

program
  .command('generate')
  .description('Generate .env.schema.json and .env.example from .env file')
  .option('-e, --env <path>', 'Path to .env file', '.env')
  .option('-s, --schema <path>', 'Output path for schema file', '.env.schema.json')
  .option('-x, --example <path>', 'Output path for example file', '.env.example')
  .option('--no-detect', 'Skip auto-detection of required variables from code')
  .option('--merge', 'Merge with existing schema (preserve manual edits)')
  .option('--cwd <path>', 'Working directory to scan for code files', process.cwd())
  .action(async (options) => {
    try {
      const envPath = path.resolve(options.env);
      const schemaPath = path.resolve(options.schema);
      const examplePath = path.resolve(options.example);

      if (!fs.existsSync(envPath)) {
        console.error(chalk.red(`Error: .env file not found at ${envPath}`));
        process.exit(1);
      }

      console.log(chalk.blue('🔍 Generating schema from'), chalk.cyan(envPath));
      
      const result = await generateSchema({
        envPath,
        schemaPath,
        examplePath,
        detectRequired: options.detect,
        merge: options.merge,
        cwd: options.cwd
      });

      console.log(chalk.green('✅ Schema generated successfully!'));
      console.log(chalk.gray(`📋 Schema: ${schemaPath}`));
      console.log(chalk.gray(`📄 Example: ${examplePath}`));
      console.log(chalk.gray(`🔑 Found ${result.totalVars} variables, ${result.requiredVars} required`));

    } catch (error) {
      console.error(chalk.red('Error generating schema:'), error.message);
      process.exit(1);
    }
  });

program
  .command('validate')
  .description('Validate environment variables against schema')
  .option('-s, --schema <path>', 'Path to schema file', '.env.schema.json')
  .option('-e, --env <path>', 'Path to .env file to load (optional)')
  .option('--ci', 'CI mode - stricter validation')
  .option('--quiet', 'Suppress success messages')
  .option('--json', 'Output JSON result to stdout')
  .action(async (options) => {
    try {
      const schemaPath = path.resolve(options.schema);

      if (!fs.existsSync(schemaPath)) {
        console.error(chalk.red(`Error: Schema file not found at ${schemaPath}`));
        console.error(chalk.gray('Run "dotenv-guard generate" first to create a schema.'));
        process.exit(1);
      }

      // Load .env file if specified
      if (options.env) {
        const envPath = path.resolve(options.env);
        if (fs.existsSync(envPath)) {
          require('dotenv').config({ path: envPath });
        }
      }

      if (!options.quiet && !options.json) {
        console.log(chalk.blue('🔍 Validating environment variables...'));
      }

      const result = await validateEnv({
        schemaPath,
        ciMode: options.ci,
        quiet: options.quiet
      });

      if (options.json) {
        const output = {
          success: result.success,
          errors: result.errors,
          warnings: result.warnings,
          validatedCount: result.validatedCount,
          totalVariables: result.totalVariables
        };
        console.log(JSON.stringify(output));
        process.exit(result.success ? 0 : 1);
      } else {
        if (result.success) {
          if (!options.quiet) {
            console.log(chalk.green('✅ All environment variables are valid!'));
            console.log(chalk.gray(`✓ Validated ${result.validatedCount} variables`));
          }
        } else {
          console.log(chalk.red('❌ Environment validation failed:'));
          result.errors.forEach(error => {
            console.log(chalk.red(`  • ${error}`));
          });
          process.exit(1);
        }
      }

    } catch (error) {
      console.error(chalk.red('Error validating environment:'), error.message);
      process.exit(1);
    }
  });

program
  .command('check')
  .description('Quick check - validate without detailed output')
  .option('-s, --schema <path>', 'Path to schema file', '.env.schema.json')
  .action(async (options) => {
    try {
      const result = await validateEnv({
        schemaPath: path.resolve(options.schema),
        quiet: true
      });

      process.exit(result.success ? 0 : 1);
    } catch (error) {
      process.exit(1);
    }
  });

// Handle unrecognized commands
program.on('command:*', (operands) => {
  console.error(chalk.red(`Unknown command: ${operands[0]}`));
  console.log(chalk.gray('Available commands: generate, validate, check'));
  process.exit(1);
});

// Show help if no command provided
if (!process.argv.slice(2).length) {
  program.outputHelp();
}

program.parse();