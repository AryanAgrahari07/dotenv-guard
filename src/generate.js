const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
const {
  inferType,
  isSecretKey,
  generateExampleValue,
  detectEnvUsage,
  parseSchemaMarkers,
  createBackup
} = require('./utils');

/**
 * Generate schema and example files from .env
 */
async function generateSchema({
  envPath = '.env',
  schemaPath = '.env.schema.json',
  examplePath = '.env.example',
  detectRequired = true,
  merge = false,
  cwd = process.cwd()
} = {}) {
  
  // Parse the .env file
  const envContent = fs.readFileSync(envPath, 'utf-8');
  const envConfig = dotenv.parse(envContent);
  
  if (Object.keys(envConfig).length === 0) {
    throw new Error('No environment variables found in .env file');
  }

  // Detect required variables from code if enabled
  let detectedVars = [];
  if (detectRequired) {
    console.log('🔍 Scanning code for environment variable usage...');
    detectedVars = await detectEnvUsage(cwd);
    console.log(`📋 Found ${detectedVars.length} variables used in code`);
  }

  // Load existing schema if merging
  let existingSchema = {};
  if (merge && fs.existsSync(schemaPath)) {
    try {
      const existingContent = fs.readFileSync(schemaPath, 'utf-8');
      const markers = parseSchemaMarkers(existingContent);
      
      if (markers) {
        // Parse the JSON between markers
        const jsonContent = existingContent.substring(
          markers.startIndex + '// dotenv-guard:start'.length,
          markers.endIndex - '// dotenv-guard:end'.length
        ).trim();
        
        if (jsonContent) {
          existingSchema = JSON.parse(jsonContent);
        }
      } else {
        existingSchema = JSON.parse(existingContent);
      }
    } catch (error) {
      console.warn('Warning: Could not parse existing schema, creating new one');
    }
  }

  // Build the schema
  const schema = {
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    title: 'Environment Variables Schema',
    description: 'Auto-generated schema for environment variables',
    type: 'object',
    properties: {},
    required: [],
    additionalProperties: false,
    _meta: {
      generated: new Date().toISOString(),
      generator: 'dotenv-guard',
      version: '1.0.0'
    }
  };

  const exampleEnv = {};
  const processedVars = new Set();
  let secretVarsCount = 0;

  // Process variables from .env file
  for (const [key, value] of Object.entries(envConfig)) {
    const type = inferType(value);
    const isSecret = isSecretKey(key);
    let isRequired = detectedVars.includes(key);
    
    // Merge with existing schema if available
    const existingProp = existingSchema.properties?.[key] || {};
    
    schema.properties[key] = {
      type: getJsonSchemaType(type),
      description: existingProp.description || `${key} environment variable`,
      ...getTypeSpecificConstraints(type, value),
      _meta: {
        inferred: true,
        originalType: type,
        isSecret,
        detectedInCode: isRequired,
        ...existingProp._meta
      }
    };

    // Override with existing schema values if they exist
    if (existingProp.type) {
      schema.properties[key].type = existingProp.type;
    }
    if (existingProp.required !== undefined) {
      isRequired = existingProp.required;
    }

    if (isRequired || existingSchema.required?.includes(key)) {
      schema.required.push(key);
    }

    exampleEnv[key] = generateExampleValue(key, value, type);
    processedVars.add(key);

    if (isSecret) {
      secretVarsCount += 1;
    }
  }

  // Add variables from existing schema that weren't in .env
  if (merge && existingSchema.properties) {
    for (const [key, prop] of Object.entries(existingSchema.properties)) {
      if (!processedVars.has(key)) {
        schema.properties[key] = prop;
        if (existingSchema.required?.includes(key)) {
          schema.required.push(key);
        }
        // Add to example with a placeholder
        exampleEnv[key] = prop._meta?.isSecret ? 'your-secret-here' : `your-${key.toLowerCase()}`;
      }
    }
  }

  // Remove duplicates from required array
  schema.required = [...new Set(schema.required)];

  // Create backup if merging
  if (merge && fs.existsSync(schemaPath)) {
    createBackup(schemaPath);
  }

  // Write schema file
  const schemaJson = JSON.stringify(schema, null, 2);
  
  if (merge) {
    // Try to preserve manual edits by using markers
    let finalContent;
    if (fs.existsSync(schemaPath)) {
      const existingContent = fs.readFileSync(schemaPath, 'utf-8');
      const markers = parseSchemaMarkers(existingContent);
      
      if (markers) {
        finalContent = markers.before + 
          '// dotenv-guard:start\n' +
          schemaJson + '\n' +
          '// dotenv-guard:end' +
          markers.after;
      } else {
        // Add markers for future merges
        finalContent = '// dotenv-guard:start\n' + 
          schemaJson + '\n' +
          '// dotenv-guard:end';
      }
    } else {
      finalContent = '// dotenv-guard:start\n' + 
        schemaJson + '\n' +
        '// dotenv-guard:end';
    }
    
    fs.writeFileSync(schemaPath, finalContent);
  } else {
    fs.writeFileSync(schemaPath, schemaJson);
  }

  // Generate .env.example
  const exampleContent = Object.entries(exampleEnv)
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');
  
  const exampleHeader = `# Example environment variables
# Copy this file to .env and fill in your actual values
# Generated by dotenv-guard on ${new Date().toISOString()}

`;

  fs.writeFileSync(examplePath, exampleHeader + exampleContent + '\n');

  return {
    totalVars: Object.keys(envConfig).length,
    requiredVars: schema.required.length,
    detectedVars: detectedVars.length,
    secretVars: secretVarsCount,
    schemaPath,
    examplePath
  };
}

/**
 * Convert our internal types to JSON Schema types
 */
function getJsonSchemaType(type) {
  switch (type) {
    case 'boolean':
      return 'boolean';
    case 'integer':
    case 'port':
      return 'integer';
    case 'number':
      return 'number';
    case 'json':
      return ['object', 'array'];
    case 'url':
    case 'email':
    case 'string':
    default:
      return 'string';
  }
}

/**
 * Get type-specific JSON Schema constraints
 */
function getTypeSpecificConstraints(type, value) {
  const constraints = {};

  switch (type) {
    case 'port':
      constraints.minimum = 1;
      constraints.maximum = 65535;
      break;
    
    case 'url':
      constraints.format = 'uri';
      break;
    
    case 'email':
      constraints.format = 'email';
      break;
    
    case 'string':
      if (value && value.length > 0) {
        constraints.minLength = 1;
      }
      break;
    
    case 'integer':
      if (value) {
        const intVal = parseInt(value, 10);
        if (!isNaN(intVal) && intVal >= 0) {
          constraints.minimum = 0;
        }
      }
      break;
  }

  return constraints;
}

module.exports = {
  generateSchema
};