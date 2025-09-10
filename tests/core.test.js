// Vitest globals are enabled via vitest.config.cjs (globals: true)
const fs = require('fs');
const path = require('path');
const { generateSchema } = require('../src/generate');
const { validateEnv } = require('../src/validate');
const { inferType, isSecretKey, convertValue } = require('../src/utils');

// Test directory setup
const testDir = path.join(__dirname, 'temp');

beforeEach(() => {
  if (!fs.existsSync(testDir)) {
    fs.mkdirSync(testDir, { recursive: true });
  }
});

afterEach(() => {
  if (fs.existsSync(testDir)) {
    fs.rmSync(testDir, { recursive: true, force: true });
  }
});

describe('Type Inference', () => {
  it('should infer boolean types correctly', () => {
    expect(inferType('true')).toBe('boolean');
    expect(inferType('false')).toBe('boolean');
    expect(inferType('TRUE')).toBe('boolean');
    expect(inferType('False')).toBe('boolean');
  });

  it('should infer integer types correctly', () => {
    expect(inferType('123')).toBe('integer');
    expect(inferType('-456')).toBe('integer');
    expect(inferType('0')).toBe('integer');
  });

  it('should infer number types correctly', () => {
    expect(inferType('123.45')).toBe('number');
    expect(inferType('-456.78')).toBe('number');
    expect(inferType('0.0')).toBe('number');
  });

  it('should infer URL types correctly', () => {
    expect(inferType('https://example.com')).toBe('url');
    expect(inferType('http://localhost:3000')).toBe('url');
    expect(inferType('ftp://files.example.com')).toBe('url');
  });

  it('should infer JSON types correctly', () => {
    expect(inferType('{"key": "value"}')).toBe('json');
    expect(inferType('[1, 2, 3]')).toBe('json');
    expect(inferType('{"nested": {"key": true}}')).toBe('json');
  });

  it('should infer email types correctly', () => {
    expect(inferType('user@example.com')).toBe('email');
    expect(inferType('admin@test.co.uk')).toBe('email');
  });

  it('should default to string type', () => {
    expect(inferType('some random text')).toBe('string');
    expect(inferType('')).toBe('string');
    expect(inferType('not-a-url')).toBe('string');
  });
});

describe('Secret Detection', () => {
  it('should detect secret keys', () => {
    expect(isSecretKey('API_KEY')).toBe(true);
    expect(isSecretKey('DATABASE_PASSWORD')).toBe(true);
    expect(isSecretKey('JWT_SECRET')).toBe(true);
    expect(isSecretKey('AUTH_TOKEN')).toBe(true);
    expect(isSecretKey('PRIVATE_KEY')).toBe(true);
  });

  it('should not flag non-secret keys', () => {
    expect(isSecretKey('DATABASE_URL')).toBe(false);
    expect(isSecretKey('PORT')).toBe(false);
    expect(isSecretKey('NODE_ENV')).toBe(false);
    expect(isSecretKey('DEBUG')).toBe(false);
  });
});

describe('Value Conversion', () => {
  it('should convert boolean values', () => {
    expect(convertValue('true', 'boolean')).toBe(true);
    expect(convertValue('false', 'boolean')).toBe(false);
    expect(convertValue('TRUE', 'boolean')).toBe(true);
  });

  it('should convert integer values', () => {
    expect(convertValue('123', 'integer')).toBe(123);
    expect(convertValue('-456', 'integer')).toBe(-456);
  });

  it('should convert number values', () => {
    expect(convertValue('123.45', 'number')).toBe(123.45);
    expect(convertValue('-456.78', 'number')).toBe(-456.78);
  });

  it('should convert JSON values', () => {
    expect(convertValue('{"key": "value"}', 'json')).toEqual({ key: 'value' });
    expect(convertValue('[1, 2, 3]', 'json')).toEqual([1, 2, 3]);
  });

  it('should throw on invalid conversions', () => {
    expect(() => convertValue('not-a-number', 'integer')).toThrow();
    expect(() => convertValue('invalid-json}', 'json')).toThrow();
    expect(() => convertValue('not-a-url', 'url')).toThrow();
  });
});

describe('Schema Generation', () => {
  it('should generate schema from .env file', async () => {
    const envPath = path.join(testDir, '.env');
    const schemaPath = path.join(testDir, '.env.schema.json');
    const examplePath = path.join(testDir, '.env.example');

    // Create test .env file
    fs.writeFileSync(envPath, `
PORT=3000
DEBUG=true
DATABASE_URL=postgres://localhost/test
API_KEY=secret123
MAX_CONNECTIONS=10
CONFIG={"timeout": 30}
ADMIN_EMAIL=admin@example.com
    `.trim());

    const result = await generateSchema({
      envPath,
      schemaPath,
      examplePath,
      detectRequired: false
    });

    expect(result.totalVars).toBe(7);
    expect(fs.existsSync(schemaPath)).toBe(true);
    expect(fs.existsSync(examplePath)).toBe(true);

    const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf-8'));
    expect(schema.properties.PORT.type).toBe('integer');
    expect(schema.properties.DEBUG.type).toBe('boolean');
    expect(schema.properties.DATABASE_URL.type).toBe('string');
    expect(schema.properties.API_KEY._meta.isSecret).toBe(true);
    expect(schema.properties.CONFIG.type).toEqual(['object', 'array']);
  });

  it('should generate .env.example with redacted secrets', async () => {
    const envPath = path.join(testDir, '.env');
    const examplePath = path.join(testDir, '.env.example');

    fs.writeFileSync(envPath, `
PORT=3000
API_KEY=secret123
DATABASE_PASSWORD=supersecret
PUBLIC_URL=https://example.com
    `.trim());

    await generateSchema({
      envPath,
      examplePath,
      detectRequired: false
    });

    const example = fs.readFileSync(examplePath, 'utf-8');
    expect(example).toContain('PORT=3000');
    expect(example).toContain('API_KEY=your-secret-here');
    expect(example).toContain('DATABASE_PASSWORD=your-secret-here');
    expect(example).toContain('PUBLIC_URL=https://example.com');
  });
});

describe('Environment Validation', () => {
  it('should validate correct environment variables', async () => {
    const schemaPath = path.join(testDir, '.env.schema.json');

    // Create test schema
    const schema = {
      type: 'object',
      properties: {
        PORT: { type: 'integer', _meta: { originalType: 'integer' } },
        DEBUG: { type: 'boolean', _meta: { originalType: 'boolean' } },
        API_URL: { type: 'string', format: 'uri', _meta: { originalType: 'url' } }
      },
      required: ['PORT', 'API_URL'],
      additionalProperties: false
    };

    fs.writeFileSync(schemaPath, JSON.stringify(schema, null, 2));

    const result = await validateEnv({
      schemaPath,
      envVars: {
        PORT: '3000',
        DEBUG: 'true',
        API_URL: 'https://api.example.com'
      }
    });

    expect(result.success).toBe(true);
    expect(result.errors).toHaveLength(0);
    expect(result.validatedCount).toBe(3);
  });

  it('should fail validation for missing required variables', async () => {
    const schemaPath = path.join(testDir, '.env.schema.json');

    const schema = {
      type: 'object',
      properties: {
        REQUIRED_VAR: { type: 'string' }
      },
      required: ['REQUIRED_VAR']
    };

    fs.writeFileSync(schemaPath, JSON.stringify(schema, null, 2));

    const result = await validateEnv({
      schemaPath,
      envVars: {}
    });

    expect(result.success).toBe(false);
    expect(result.errors).toContain('Missing required environment variable: REQUIRED_VAR');
  });

  it('should fail validation for incorrect types', async () => {
    const schemaPath = path.join(testDir, '.env.schema.json');

    const schema = {
      type: 'object',
      properties: {
        PORT: { type: 'integer', _meta: { originalType: 'integer' } },
        DEBUG: { type: 'boolean', _meta: { originalType: 'boolean' } }
      },
      required: ['PORT']
    };

    fs.writeFileSync(schemaPath, JSON.stringify(schema, null, 2));

    const result = await validateEnv({
      schemaPath,
      envVars: {
        PORT: 'not-a-number',
        DEBUG: 'not-a-boolean'
      }
    });

    expect(result.success).toBe(false);
    expect(result.errors.some(err => err.includes('PORT=not-a-number'))).toBe(true);
  });

  it('should validate JSON environment variables', async () => {
    const schemaPath = path.join(testDir, '.env.schema.json');

    const schema = {
      type: 'object',
      properties: {
        CONFIG: { type: ['object', 'array'], _meta: { originalType: 'json' } }
      }
    };

    fs.writeFileSync(schemaPath, JSON.stringify(schema, null, 2));

    const validResult = await validateEnv({
      schemaPath,
      envVars: {
        CONFIG: '{"timeout": 30, "retries": 3}'
      }
    });

    expect(validResult.success).toBe(true);

    const invalidResult = await validateEnv({
      schemaPath,
      envVars: {
        CONFIG: 'invalid-json}'
      }
    });

    expect(invalidResult.success).toBe(false);
  });

  it('should validate URL environment variables', async () => {
    const schemaPath = path.join(testDir, '.env.schema.json');

    const schema = {
      type: 'object',
      properties: {
        API_URL: { type: 'string', format: 'uri', _meta: { originalType: 'url' } }
      }
    };

    fs.writeFileSync(schemaPath, JSON.stringify(schema, null, 2));

    const validResult = await validateEnv({
      schemaPath,
      envVars: {
        API_URL: 'https://api.example.com'
      }
    });

    expect(validResult.success).toBe(true);

    const invalidResult = await validateEnv({
      schemaPath,
      envVars: {
        API_URL: 'not-a-url'
      }
    });

    expect(invalidResult.success).toBe(false);
  });
});

describe('Edge Cases', () => {
  it('should handle empty .env file', async () => {
    const envPath = path.join(testDir, '.env');
    fs.writeFileSync(envPath, '');

    await expect(generateSchema({ envPath })).rejects.toThrow('No environment variables found');
  });

  it('should handle missing schema file', async () => {
    await expect(validateEnv({ schemaPath: 'non-existent.json' })).rejects.toThrow('Schema file not found');
  });

  it('should handle malformed JSON in schema', async () => {
    const schemaPath = path.join(testDir, '.env.schema.json');
    fs.writeFileSync(schemaPath, '{ invalid json }');

    await expect(validateEnv({ schemaPath })).rejects.toThrow('Invalid JSON in schema file');
  });
});