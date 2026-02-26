/**
 * JSON Schema validation utilities for project configurations
 */
import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const projectSchemaPath = join(__dirname, '..', 'schemas', 'project.schema.json');
const projectSchema = JSON.parse(readFileSync(projectSchemaPath, 'utf8'));

const ajv = new Ajv({ allErrors: true });
addFormats(ajv);

const validateProject = ajv.compile(projectSchema);

/**
 * Validate a project configuration against the schema
 * @param {Object} config - The project configuration to validate
 * @returns {Object} - Validation result with 'valid' boolean and 'errors' array
 */
export function validateProjectConfiguration(config) {
  const valid = validateProject(config);

  if (!valid) {
    return {
      valid: false,
      errors: validateProject.errors.map(error => ({
        path: error.instancePath || 'root',
        message: error.message,
        keyword: error.keyword,
        params: error.params
      }))
    };
  }

  return {
    valid: true,
    errors: []
  };
}

/**
 * Format validation errors for display
 * @param {Array} errors - Array of validation errors
 * @returns {string} - Formatted error message
 */
export function formatValidationErrors(errors) {
  if (!errors || errors.length === 0) {
    return '';
  }

  const messages = errors.map(error => {
    const path = error.path === 'root' ? 'Project configuration' : `Field '${error.path}'`;
    return `  - ${path}: ${error.message}`;
  });

  return `Validation errors found:\n${messages.join('\n')}`;
}
