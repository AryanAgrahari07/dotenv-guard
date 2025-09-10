const fs = require('fs');
const { z } = require('zod');
const { convertValue, parseSchemaMarkers } = require('./utils');

/**
 * Validate environment variables against schema
 */
async function validateEnv({
  schemaPath = '.env.schema.json',
  envVars = process.env,
  ciMode = false,
  quiet = false
} = {}) {
  
  // Load and parse schema
  const schema = loadSchema(schemaPath);
  
  if (!schema.properties) {
    throw new Error('Invalid schema: missing properties');
  }

  const errors = [];
  const warnings = [];
  let validatedCount = 0;

  // Check required variables
  const required = schema.required || [];
  for (const key of required) {
    if (!(key in envVars) || envVars[key] === '' || envVars[key] === undefined) {
      errors.push(`Missing required environment variable: ${key}`);
    }
  }

  // Validate each defined variable
  for (const [key, propSchema] of Object.entries(schema.properties)) {
    const value = envVars[key];
    
    // Skip validation if variable is not set and not required
    if (value === undefined || value === '') {
      if (required.includes(key)) {
        // Already handled above
        continue;
      }
      continue;
    }

    try {
      // Convert and validate the value
      const zodSchema = createZodSchema(propSchema, key);
      const convertedValue = convertValueForValidation(value, propSchema);
      
      zodSchema.parse(convertedValue);
      validatedCount++;
      
    } catch (error) {
      const errorMsg = formatValidationError(key, value, propSchema, error);
      
      if (ciMode || propSchema._meta?.isSecret) {
        errors.push(errorMsg);
      } else {
        // In development mode, some errors might be warnings
        if (isWarningOnly(propSchema, error)) {
          warnings.push(errorMsg);
        } else {
          errors.push(errorMsg);
        }
      }
    }
  }

  // Check for unexpected variables if schema doesn't allow additional properties
  if (schema.additionalProperties === false) {
    const definedKeys = Object.keys(schema.properties);
    const unexpectedKeys = Object.keys(envVars).filter(key => 
      !definedKeys.includes(key) && 
      !key.startsWith('_') && // Ignore system variables
      !isSystemEnvVar(key)
    );

    if (unexpectedKeys.length > 0 && ciMode) {
      unexpectedKeys.forEach(key => {
        warnings.push(`Unexpected environment variable: ${key} (not defined in schema)`);
      });
    }
  }

  const success = errors.length === 0;

  if (!quiet && warnings.length > 0) {
    console.warn('Warnings:', warnings.join('\n  '));
  }

  return {
    success,
    errors,
    warnings,
    validatedCount,
    totalVariables: Object.keys(schema.properties).length
  };
}

/**
 * Load schema from file, handling merge markers
 */
function loadSchema(schemaPath) {
  if (!fs.existsSync(schemaPath)) {
    throw new Error(`Schema file not found: ${schemaPath}`);
  }

  const content = fs.readFileSync(schemaPath, 'utf-8');
  
  // Try to parse with markers first
  const markers = parseSchemaMarkers(content);
  let jsonContent;
  
  if (markers) {
    jsonContent = content.substring(
      markers.startIndex + '// dotenv-shield:start'.length,
      markers.endIndex - '// dotenv-shield:end'.length
    ).trim();
  } else {
    jsonContent = content;
  }

  try {
    return JSON.parse(jsonContent);
  } catch (error) {
    throw new Error(`Invalid JSON in schema file: ${error.message}`);
  }
}

/**
 * Create Zod schema from JSON schema property
 */
function createZodSchema(propSchema, key) {
  let zodSchema;

  // Handle different JSON Schema types
  if (Array.isArray(propSchema.type)) {
    // Union type (e.g., object | array for JSON)
    if (propSchema.type.includes('object') && propSchema.type.includes('array')) {
      zodSchema = z.union([z.object({}).passthrough(), z.array(z.any())]);
    } else {
      zodSchema = z.string(); // Fallback
    }
  } else {
    switch (propSchema.type) {
      case 'string':
        zodSchema = z.string();
        if (propSchema.minLength !== undefined) {
          zodSchema = zodSchema.min(propSchema.minLength);
        }
        if (propSchema.format === 'uri') {
          zodSchema = zodSchema.url(`${key} must be a valid URL`);
        } else if (propSchema.format === 'email') {
          zodSchema = zodSchema.email(`${key} must be a valid email`);
        }
        break;

      case 'integer':
        zodSchema = z.number().int(`${key} must be an integer`);
        if (propSchema.minimum !== undefined) {
          zodSchema = zodSchema.min(propSchema.minimum);
        }
        if (propSchema.maximum !== undefined) {
          zodSchema = zodSchema.max(propSchema.maximum);
        }
        break;

      case 'number':
        zodSchema = z.number();
        if (propSchema.minimum !== undefined) {
          zodSchema = zodSchema.min(propSchema.minimum);
        }
        if (propSchema.maximum !== undefined) {
          zodSchema = zodSchema.max(propSchema.maximum);
        }
        break;

      case 'boolean':
        zodSchema = z.boolean();
        break;

      case 'object':
        zodSchema = z.object({}).passthrough();
        break;

      case 'array':
        zodSchema = z.array(z.any());
        break;

      default:
        zodSchema = z.string();
    }
  }

  return zodSchema;
}

/**
 * Convert value for validation based on the expected type
 */
function convertValueForValidation(value, propSchema) {
  if (value === undefined || value === null) {
    return value;
  }

  const originalType = propSchema._meta?.originalType;
  
  try {
    return convertValue(value, originalType || inferTypeFromSchema(propSchema));
  } catch (error) {
    // If conversion fails, return original value to let Zod handle the error
    return value;
  }
}

/**
 * Infer our internal type from JSON Schema
 */
function inferTypeFromSchema(propSchema) {
  if (propSchema.format === 'uri') return 'url';
  if (propSchema.format === 'email') return 'email';
  if (propSchema.type === 'boolean') return 'boolean';
  if (propSchema.type === 'integer') return 'integer';
  if (propSchema.type === 'number') return 'number';
  if (Array.isArray(propSchema.type) && propSchema.type.includes('object')) return 'json';
  return 'string';
}

/**
 * Format validation error message
 */
function formatValidationError(key, value, propSchema, error) {
  const isSecret = propSchema._meta?.isSecret;
  const displayValue = isSecret ? '[REDACTED]' : value;
  
  if (error instanceof z.ZodError) {
    const issue = error.issues[0];
    return `${key}=${displayValue}: ${issue.message}`;
  }
  
  return `${key}=${displayValue}: ${error.message}`;
}

/**
 * Check if this should be a warning only (in non-CI mode)
 */
function isWarningOnly(_propSchema, _error) {
  // In development, type coercion failures might be warnings
  // But required field violations are always errors
  return false; // For now, all validation failures are errors
}

/**
 * Check if a variable is a system environment variable
 */
function isSystemEnvVar(key) {
  const systemVars = [
    'PATH', 'HOME', 'USER', 'SHELL', 'TERM', 'PWD', 'OLDPWD',
    'NODE_ENV', 'NODE_PATH', 'NODE_OPTIONS',
    'npm_package_name', 'npm_package_version', 'npm_config_',
    'CI', 'GITHUB_', 'TRAVIS_', 'CIRCLE_', 'JENKINS_'
  ];
  
  return systemVars.some(sysVar => 
    key === sysVar || key.startsWith(sysVar)
  );
}

/**
 * Validate a single environment variable
 */
function validateSingleVar(key, value, schema) {
  const propSchema = schema.properties[key];
  if (!propSchema) {
    return { valid: true, error: null };
  }

  try {
    const zodSchema = createZodSchema(propSchema, key);
    const convertedValue = convertValueForValidation(value, propSchema);
    zodSchema.parse(convertedValue);
    
    return { valid: true, error: null };
  } catch (error) {
    return { 
      valid: false, 
      error: formatValidationError(key, value, propSchema, error)
    };
  }
}

/**
 * Quick validation without detailed error reporting
 */
async function quickValidate(schemaPath = '.env.schema.json', envVars = process.env) {
  try {
    const result = await validateEnv({ schemaPath, envVars, quiet: true });
    return result.success;
  } catch {
    return false;
  }
}

module.exports = {
  validateEnv,
  validateSingleVar,
  quickValidate,
  loadSchema
};