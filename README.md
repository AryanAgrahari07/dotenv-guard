# dotenv-shield

[![npm version](https://badge.fury.io/js/dotenv-shield.svg)](https://www.npmjs.com/package/dotenv-shield)
[![CI](https://github.com/AryanAgrahari07/dotenv-shield/workflows/CI/badge.svg)](https://github.com/AryanAgrahari07/dotenv-shield/actions)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

**Prevent environment-related crashes in one line.** 

Auto-generate `.env` schema, infer types, and validate environment variables at build-time & runtime with clear, human-friendly errors.

## Quick Start

```bash
# Generate schema from your .env file
npx dotenv-shield generate

# Validate environment variables
npx dotenv-shield validate

# Add to your package.json
npm install --save-dev dotenv-shield
```

## Why dotenv-shield?

```javascript
// Before: Your app crashes in production 💥
const port = process.env.PORT * 1000; // PORT="abc" 
// TypeError: Cannot multiply string by number

// After: Catch errors before deployment ✅
// dotenv-shield validates PORT must be an integer
```

## The Problem

Environment variable misconfigurations cause **avoidable runtime crashes**:

- Missing required variables (`DATABASE_URL` not set)
- Wrong types (`PORT="abc"` instead of `PORT="3000"`)
- Malformed JSON configs
- Invalid URLs or email addresses

## The Solution

**dotenv-shield** automatically:

1. **Generates** `.env.schema.json` by inferring types from your `.env`
2. **Detects** which variables your code actually uses  
3. **Validates** environment variables with clear error messages
4. **Prevents** crashes before they reach production

## Installation

```bash
npm install --save-dev dotenv-shield
# or
yarn add --dev dotenv-shield
# or
pnpm add --save-dev dotenv-shield
```

## Usage

### 1. Generate Schema

```bash
npx dotenv-shield generate
```

**Input** (`.env`):
```bash
PORT=3000
DEBUG=true
DATABASE_URL=postgres://localhost/myapp
API_KEY=sk_test_123
MAX_CONNECTIONS=10
CONFIG={"timeout": 30, "retries": 3}
ADMIN_EMAIL=admin@example.com
```

**Output** (`.env.schema.json`):
```json
{
  "type": "object",
  "properties": {
    "PORT": {
      "type": "integer",
      "minimum": 1,
      "maximum": 65535
    },
    "DEBUG": {
      "type": "boolean"
    },
    "DATABASE_URL": {
      "type": "string",
      "format": "uri"
    },
    "API_KEY": {
      "type": "string",
      "minLength": 1,
      "_meta": { "isSecret": true }
    },
    "MAX_CONNECTIONS": {
      "type": "integer",
      "minimum": 1
    },
    "CONFIG": {
      "type": ["object", "array"]
    },
    "ADMIN_EMAIL": {
      "type": "string",
      "format": "email"
    }
  },
  "required": ["PORT", "DATABASE_URL", "API_KEY"]
}
```

**Also creates** (`.env.example`):
```bash
PORT=3000
DEBUG=true
DATABASE_URL=postgres://localhost/myapp
API_KEY=your-secret-here
MAX_CONNECTIONS=10
CONFIG={"timeout": 30, "retries": 3}
ADMIN_EMAIL=admin@example.com
```

### 2. Validate Environment

```bash
npx dotenv-shield validate
```

**Success:**
```
✅ All environment variables are valid!
✓ Validated 7 variables
✓ Found 3 required variables
```

**Failure:**
```
❌ Environment validation failed:

Required Variables:
  • Missing required environment variable: DATABASE_URL

Type Errors:
  • PORT: Expected integer, received "abc"
  • CONFIG: Cannot parse as JSON - "invalid-json}"

Exit code: 1
```

## CLI Commands

### `generate`

Generate `.env.schema.json` and `.env.example` from your `.env` file.

```bash
npx dotenv-shield generate [options]

Options:
  -e, --env <path>      Path to .env file (default: ".env")
  -s, --schema <path>   Output schema file (default: ".env.schema.json")  
  -x, --example <path>  Output example file (default: ".env.example")
  --no-detect           Skip auto-detection of required variables
  --merge               Merge with existing schema (preserve manual edits)
  --cwd <path>          Working directory to scan for code files
  -h, --help            Show help
```

**Examples:**
```bash
# Basic generation
npx dotenv-shield generate

# Custom paths
npx dotenv-shield generate --env .env.production --schema prod.schema.json

# Skip code detection
npx dotenv-shield generate --no-detect

# Preserve manual edits
npx dotenv-shield generate --merge
```

### `validate`

Validate current environment variables against schema.

```bash
npx dotenv-shield validate [options]

Options:
  -s, --schema <path>   Path to schema file (default: ".env.schema.json")
  -e, --env <path>      Path to .env file to load (optional)
  --ci                  CI mode - stricter validation
  --quiet               Suppress success messages
  --json                Output JSON result
  -h, --help            Show help
```

**Examples:**
```bash
# Basic validation
npx dotenv-shield validate

# Load specific .env file first
npx dotenv-shield validate --env .env.testing

# CI mode (stricter)
npx dotenv-shield validate --ci

# Quiet mode
npx dotenv-shield validate --quiet
```

### `check`

Quick validation with minimal output - perfect for scripts and CI.

```bash
npx dotenv-shield check [options]

# Returns exit code 0 (success) or 1 (failure)
# No console output unless errors found
```

## Integration

### Add to package.json

```json
{
  "scripts": {
    "env:generate": "dotenv-shield generate",
    "env:validate": "dotenv-shield validate",
    "prestart": "dotenv-shield validate --quiet",
    "prebuild": "dotenv-shield validate --ci",
    "pretest": "dotenv-shield check",
    "test": "vitest"
  }
}
```

### GitHub Actions

Create `.github/workflows/ci.yml`:

```yaml
name: CI
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - uses: actions/setup-node@v4
        with: 
          node-version: 18
          
      - name: Install dependencies
        run: npm ci
        
      - name: Generate env schema
        run: npx dotenv-shield generate
        
      - name: Validate environment
        run: npx dotenv-shield validate --ci --json
        # The command above outputs JSON; parse it if you need machine checks
        
      - name: Run tests
        run: npm test
```

### Docker Integration

```dockerfile
FROM node:18-alpine

# Copy package files
COPY package*.json ./
RUN npm ci --only=production

# Copy source code
COPY . .

# Validate environment before starting
RUN npx dotenv-shield validate --ci || echo "Warning: Environment validation failed"

# Start application
CMD ["npm", "start"]
```

### Next.js Integration

```javascript
// next.config.js
const { validateEnv } = require('dotenv-shield');

// Validate environment at build time
(async () => {
  const result = await validateEnv();
  if (!result.success) {
    console.error('Environment validation failed:', result.errors);
    process.exit(1);
  }
})();

module.exports = {
  // ... your Next.js config
};
```

## Programmatic API

```javascript
const { generateSchema, validateEnv } = require('dotenv-shield');

// Generate schema
async function generateEnvSchema() {
  const result = await generateSchema({
    envPath: '.env',
    schemaPath: '.env.schema.json',
    examplePath: '.env.example',
    detectRequired: true,
    cwd: process.cwd()
  });

  console.log(`Generated schema with ${result.totalVars} variables`);
  console.log(`Found ${result.requiredVars} required variables`);
  console.log(`Detected ${result.secretVars} secret variables`);
  
  return result;
}

// Validate environment
async function validateEnvironment() {
  const validation = await validateEnv({
    schemaPath: '.env.schema.json',
    envVars: process.env,
    strict: false
  });

  if (validation.success) {
    console.log('✅ Environment is valid');
    console.log(`Validated ${validation.validatedCount} variables`);
  } else {
    console.error('❌ Environment validation failed:');
    validation.errors.forEach(error => {
      console.error(`  • ${error.path}: ${error.message}`);
    });
    
    if (validation.missing.length > 0) {
      console.error('Missing required variables:', validation.missing.join(', '));
    }
  }

  return validation;
}

// Usage
generateEnvSchema().then(() => validateEnvironment());
```

## Type Inference

dotenv-shield automatically infers types from your `.env` values:

| Value | Inferred Type | JSON Schema | Validation Rules |
|-------|---------------|-------------|-----------------|
| `3000` | `integer` | `"type": "integer"` | Must be whole number |
| `3.14` | `number` | `"type": "number"` | Must be numeric |
| `true`, `false` | `boolean` | `"type": "boolean"` | Must be true/false/1/0 |
| `{"key":"val"}` | `json` | `"type": ["object","array"]` | Must be valid JSON |
| `https://api.com` | `url` | `"type": "string", "format": "uri"` | Must be valid URL |
| `user@site.com` | `email` | `"type": "string", "format": "email"` | Must be valid email |
| `postgres://...` | `database_url` | `"type": "string", "pattern": "..."` | Must be valid DB URL |
| `anything else` | `string` | `"type": "string"` | Any string value |

### Special Integer Handling

For common port and numeric variables:

```bash
PORT=3000           # type: "integer", minimum: 1, maximum: 65535
WORKERS=4           # type: "integer", minimum: 1
TIMEOUT=30          # type: "integer", minimum: 0
MAX_CONNECTIONS=100 # type: "integer", minimum: 1
```

## Secret Detection

dotenv-shield automatically detects and redacts secrets in `.env.example`:

**Detected as secrets (case-insensitive):**
- Variables containing: `PASSWORD`, `SECRET`, `TOKEN`, `KEY`, `AUTH`
- Variables starting with: `JWT`, `BEARER`, `PRIVATE`, `CREDENTIAL`
- Common patterns: `*_KEY`, `*_SECRET`, `*_TOKEN`, `*_PASSWORD`

**Examples:**
```bash
# Original .env
API_KEY=sk_live_1234567890
DATABASE_PASSWORD=super-secret-pwd
JWT_SECRET=my-jwt-secret-key
WEBHOOK_TOKEN=whsec_abc123

# Generated .env.example
API_KEY=your-secret-here
DATABASE_PASSWORD=your-secret-here
JWT_SECRET=your-secret-here
WEBHOOK_TOKEN=your-secret-here
```

## Advanced Features

### Merge Mode

Preserve manual schema edits when regenerating:

```bash
npx dotenv-shield generate --merge
```

This preserves:
- Custom descriptions
- Additional validation rules
- Custom type overrides
- Manual field additions

**Example merge behavior:**
```json
{
  "properties": {
    "PORT": {
      "type": "integer",
      "description": "Server port number",
      "minimum": 3000,
      "maximum": 4000
    }
  }
}
```

After `--merge`, your custom description and constraints are preserved while updating other detected variables.

### Code Detection

dotenv-shield scans your JavaScript/TypeScript files for `process.env` usage to automatically mark variables as required:

```javascript
// Detected in your code:
const port = process.env.PORT;                    // PORT marked as required
const debug = process.env.DEBUG || false;        // DEBUG marked as required  
const optional = process.env.OPTIONAL_FEATURE;   // OPTIONAL_FEATURE not required (unused)

// Dynamic usage (also detected):
const dbUrl = process.env[`${type}_DATABASE_URL`]; // *_DATABASE_URL patterns detected
```

**Scanning includes:**
- `.js`, `.ts`, `.jsx`, `.tsx` files
- `process.env.VAR_NAME` patterns
- `process.env['VAR_NAME']` patterns
- Template literal patterns when detectable

**Disable with:**
```bash
npx dotenv-shield generate --no-detect
```

### CI Mode

Stricter validation for production environments:

```bash
npx dotenv-shield validate --ci
```

**CI mode differences:**
- Fails on unexpected variables not in schema
- Stricter type checking (no automatic coercion)
- No development-mode warnings or suggestions
- Faster execution (fewer checks)
- Machine-readable error format

## Configuration

Config file support will be added in a future version. For now, use CLI flags as shown above.

## Troubleshooting

### Common Issues

**❌ "Schema file not found"**
```bash
# Generate schema first
npx dotenv-shield generate
```

**❌ "Missing required environment variable: DATABASE_URL"**
```bash
# Add the variable to your .env file
echo "DATABASE_URL=your-database-url" >> .env

# Or mark as optional in schema
# Edit .env.schema.json and remove from "required" array
```

**❌ "Cannot convert 'abc' to integer"**
```bash
# Fix the value in your .env
PORT=3000  # ✅ Valid integer
PORT=abc   # ❌ Invalid - must be a number
```

**❌ "JSON parse error"**
```bash
# Check JSON syntax in your .env
CONFIG={"valid": "json"}     # ✅ Valid JSON
CONFIG={invalid-json}        # ❌ Invalid JSON syntax
```

**❌ "Code detection found no variables"**
```bash
# Make sure you're using process.env in your code
const port = process.env.PORT;

# Or disable detection if not needed
npx dotenv-shield generate --no-detect
```

### Override Type Detection

Edit `.env.schema.json` manually to override inferred types:

```json
{
  "properties": {
    "CUSTOM_VAR": {
      "type": "string",
      "description": "Custom variable with specific validation",
      "pattern": "^[A-Z]+$",
      "minLength": 5,
      "maxLength": 20
    },
    "ANOTHER_VAR": {
      "type": "integer",
      "minimum": 0,
      "maximum": 100,
      "description": "Percentage value"
    }
  }
}
```

### Environment-Specific Schemas

For different environments, use multiple schema files:

```bash
# Generate for different environments
npx dotenv-shield generate --env .env.development --schema .env.development.schema.json
npx dotenv-shield generate --env .env.production --schema .env.production.schema.json

# Validate against specific environment
npx dotenv-shield validate --schema .env.production.schema.json
```

### Debug Mode

Enable verbose output for troubleshooting:

```bash
DEBUG=dotenv-shield npx dotenv-shield generate
DEBUG=dotenv-shield npx dotenv-shield validate
```

This shows:
- File paths being scanned
- Variables detected in code
- Type inference decisions
- Validation steps

## Examples

### Basic Node.js App

```javascript
// server.js
require('dotenv').config();

const port = process.env.PORT || 3000;
const dbUrl = process.env.DATABASE_URL;

if (!dbUrl) {
  console.error('DATABASE_URL is required');
  process.exit(1);
}

// Start server...
```

**Package.json:**
```json
{
  "scripts": {
    "start": "dotenv-shield validate && node server.js",
    "dev": "dotenv-shield validate && nodemon server.js"
  }
}
```

### Express.js with Validation

```javascript
// app.js
const express = require('express');
const { validateEnv } = require('dotenv-shield');

async function startServer() {
  // Validate environment at startup
  const validation = await validateEnv();
  if (!validation.success) {
    console.error('Environment validation failed:');
    validation.errors.forEach(err => console.error(`  ${err}`));
    process.exit(1);
  }
  
  const app = express();
  const port = process.env.PORT;
  
  app.listen(port, () => {
    console.log(`Server running on port ${port}`);
  });
}

startServer();
```

### React/Vite Integration

```javascript
// vite.config.js
import { defineConfig } from 'vite';
import { validateEnv } from 'dotenv-shield';

export default defineConfig(async ({ command, mode }) => {
  // Validate environment variables
  if (command === 'build') {
    const result = await validateEnv({ schemaPath: '.env.schema.json' });
    
    if (!result.success) {
      throw new Error(`Environment validation failed: ${result.errors.join(', ')}`);
    }
  }

  return {
    // Your Vite config...
  };
});
```

## Migration from Other Tools

### From dotenv-safe

```bash
# Replace dotenv-safe
npm uninstall dotenv-safe
npm install --save-dev dotenv-shield

# Generate schema from existing .env.example
npx dotenv-shield generate --env .env.example --schema .env.schema.json
```

### From envalid

```javascript
// Before (envalid)
const env = require('envalid');

const config = env.cleanEnv(process.env, {
  PORT: env.port(),
  DATABASE_URL: env.url(),
  DEBUG: env.bool({ default: false })
});

// After (dotenv-shield)
// 1. Generate schema: npx dotenv-shield generate
// 2. Validate in code:
const { validateEnv } = require('dotenv-shield');
await validateEnv(); // Validates against .env.schema.json
```

## FAQ

**Q: Does dotenv-shield load my .env file?**
A: No, dotenv-shield only validates `process.env`. Use `dotenv` or your framework's env loading mechanism separately.

**Q: Can I use dotenv-shield in production?**
A: Yes! Use `dotenv-shield validate --ci` in production builds to catch configuration issues before deployment.

**Q: What happens if I have extra variables not in the schema?**
A: By default, extra variables are allowed. Use `--ci` mode or `strict: true` in config to disallow them.

**Q: Can I validate environment variables from a specific file?**
A: Yes, use `npx dotenv-shield validate --env .env.production` to load and validate a specific env file.

**Q: How do I handle dynamic environment variable names?**
A: dotenv-shield has limited support for patterns like `${type}_DATABASE_URL`. For complex dynamic cases, consider manual schema editing.

**Q: Is there TypeScript support?**
A: Yes! dotenv-shield scans TypeScript files for `process.env` usage. TypeScript type generation is planned for v2.

**Q: Can I use this with monorepos?**
A: Yes, run dotenv-shield in each package directory, or use `--cwd` to specify the working directory.

## Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

### Development Setup

```bash
git clone https://github.com/AryanAgrahari07/dotenv-shield.git
cd dotenv-shield
npm install

# Run tests
npm test

# Run CLI locally
node bin/dotenv-shield.js generate
```

### Running Tests

```bash
# Run all tests
npm test

# Watch mode
npm run test:watch

# Coverage
npm run test:coverage
```

## Roadmap

### v1.1 (Current)
- ✅ Basic schema generation and validation
- ✅ Type inference (string, integer, number, boolean, JSON, URL, email)
- ✅ Secret detection and redaction
- ✅ Code scanning for required variables
- ✅ CLI with generate/validate commands
- ✅ Programmatic API

### v1.2 (Next)
- [ ] AST-based code analysis (better detection)
- [ ] Multiple environment file support
- [ ] GitHub Action/Marketplace action
- [ ] Configuration file support
- [ ] Custom validation rules

### v2.0 (Future)
- [ ] TypeScript type generation
- [ ] VS Code extension
- [ ] Interactive CLI prompts
- [ ] Monorepo support
- [ ] Web dashboard for teams

## License

MIT © [Aryan Agrahari](https://github.com/AryanAgrahari07)

---

**Made with ❤️ for developers who are tired of environment variable bugs.**

[Report Issues](https://github.com/AryanAgrahari07/dotenv-shield/issues) • [Request Features](https://github.com/AryanAgrahari07/dotenv-shield/discussions) • [View Changelog](CHANGELOG.md)