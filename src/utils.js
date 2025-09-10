
const fs = require('fs');
const glob = require('fast-glob');

/**
 * Infer the type of a value from a string
 */
function inferType(value) {
  if (!value || typeof value !== 'string') {
    return 'string';
  }

  // Boolean
  if (/^(true|false)$/i.test(value.trim())) {
    return 'boolean';
  }

  // Integer
  if (/^-?\d+$/.test(value.trim())) {
    return 'integer';
  }

  // Number (float)
  if (/^-?\d+\.\d+$/.test(value.trim())) {
    return 'number';
  }

  // URL
  try {
    new URL(value);
    if (value.startsWith('http://') || value.startsWith('https://') || value.startsWith('ftp://')) {
      return 'url';
    }
  } catch {}

  // JSON
  if ((value.startsWith('{') && value.endsWith('}')) || 
      (value.startsWith('[') && value.endsWith(']'))) {
    try {
      JSON.parse(value);
      return 'json';
    } catch {}
  }

  // Email
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
    return 'email';
  }

  // Port
  if (/^\d+$/.test(value)) {
    const num = parseInt(value, 10);
    if (num > 0 && num <= 65535) {
      return 'port';
    }
  }

  // Default to string
  return 'string';
}

/**
 * Check if a key name suggests it contains a secret
 */
function isSecretKey(key) {
  const secretPatterns = [
    /password/i,
    /secret/i,
    /token/i,
    /key$/i,
    /^api_key/i,
    /auth/i,
    /private/i,
    /credential/i,
    /_key$/i,
    /_secret$/i,
    /_token$/i,
    /jwt/i,
    /bearer/i
  ];

  return secretPatterns.some(pattern => pattern.test(key));
}

/**
 * Generate a redacted example value based on the original value and type
 */
function generateExampleValue(key, value, type) {
  if (isSecretKey(key)) {
    switch (type) {
      case 'string':
        return 'your-secret-here';
      case 'integer':
      case 'number':
      case 'port':
        return '***';
      case 'boolean':
        return 'true';
      case 'url':
        return 'https://your-secret-url.com';
      case 'email':
        return 'your-email@example.com';
      case 'json':
        return '{"secret": "value"}';
      default:
        return 'your-secret-here';
    }
  }

  // Non-secret values - provide realistic examples
  switch (type) {
    case 'boolean':
      return value.toLowerCase() === 'true' ? 'true' : 'false';
    case 'integer':
      return value;
    case 'number':
      return value;
    case 'port':
      return value === '3000' ? '3000' : value;
    case 'url':
      // Preserve original non-secret URL value
      return value;
    case 'email':
      // Preserve original non-secret email value
      return value;
    case 'json':
      try {
        return JSON.stringify(JSON.parse(value), null, 2);
      } catch {
        return value;
      }
    default:
      return value.length > 20 ? value.substring(0, 20) + '...' : value;
  }
}

/**
 * Scan code files for process.env usage to detect required variables
 */
async function detectEnvUsage(cwd = process.cwd()) {
  const patterns = [
    '**/*.{js,ts,jsx,tsx,mjs,cjs}',
    '!node_modules/**',
    '!dist/**',
    '!build/**',
    '!coverage/**',
    '!.git/**'
  ];

  try {
    const files = await glob(patterns, { cwd, absolute: true });
    const envVars = new Set();
    
    // Regex patterns to match process.env usage
    const envPatterns = [
      /process\.env\.([A-Z_][A-Z0-9_]*)/g,
      /process\.env\['([A-Z_][A-Z0-9_]*)'\]/g,
      /process\.env\["([A-Z_][A-Z0-9_]*)"\]/g
    ];

    for (const file of files) {
      try {
        const content = fs.readFileSync(file, 'utf-8');
        
        for (const pattern of envPatterns) {
          let match;
          while ((match = pattern.exec(content)) !== null) {
            envVars.add(match[1]);
          }
        }
      } catch (error) {
        // Skip files that can't be read
        continue;
      }
    }

    return Array.from(envVars);
  } catch (error) {
    console.warn('Warning: Could not scan code files for env usage:', error.message);
    return [];
  }
}

/**
 * Parse markers in schema file for merge mode
 */
function parseSchemaMarkers(content) {
  const startMarker = '// dotenv-shield:start';
  const endMarker = '// dotenv-shield:end';
  
  const startIndex = content.indexOf(startMarker);
  const endIndex = content.indexOf(endMarker);

  if (startIndex === -1 || endIndex === -1) {
    return null;
  }

  return {
    before: content.substring(0, startIndex),
    after: content.substring(endIndex + endMarker.length),
    startIndex,
    endIndex: endIndex + endMarker.length
  };
}

/**
 * Create a backup of a file
 */
function createBackup(filePath) {
  if (!fs.existsSync(filePath)) {
    return null;
  }

  const backupPath = `${filePath}.backup.${Date.now()}`;
  fs.copyFileSync(filePath, backupPath);
  return backupPath;
}

/**
 * Validate that required environment variables exist
 */
function validateRequiredEnvVars(envVars, requiredVars) {
  const missing = requiredVars.filter(key => !(key in envVars));
  return {
    valid: missing.length === 0,
    missing
  };
}

/**
 * Convert string value to the appropriate type
 */
function convertValue(value, type) {
  if (value === undefined || value === null) {
    return value;
  }

  switch (type) {
    case 'boolean':
      if (typeof value === 'boolean') return value;
      return value.toString().toLowerCase() === 'true';
    
    case 'integer':
      if (typeof value === 'number') return Math.floor(value);
      const intVal = parseInt(value.toString(), 10);
      if (isNaN(intVal)) throw new Error(`Cannot convert "${value}" to integer`);
      return intVal;
    
    case 'number':
    case 'port':
      if (typeof value === 'number') return value;
      const numVal = parseFloat(value.toString());
      if (isNaN(numVal)) throw new Error(`Cannot convert "${value}" to number`);
      return numVal;
    
    case 'json':
      if (typeof value === 'object') return value;
      try {
        return JSON.parse(value.toString());
      } catch {
        throw new Error(`Cannot parse "${value}" as JSON`);
      }
    
    case 'url':
      const urlStr = value.toString();
      try {
        new URL(urlStr);
        return urlStr;
      } catch {
        throw new Error(`"${value}" is not a valid URL`);
      }
    
    case 'email':
      const emailStr = value.toString();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailStr)) {
        throw new Error(`"${value}" is not a valid email`);
      }
      return emailStr;
    
    default:
      return value.toString();
  }
}

module.exports = {
  inferType,
  isSecretKey,
  generateExampleValue,
  detectEnvUsage,
  parseSchemaMarkers,
  createBackup,
  validateRequiredEnvVars,
  convertValue
};