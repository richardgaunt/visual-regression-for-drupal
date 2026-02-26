/**
 * Template renderer for GitHub Actions workflow generation
 * Loads YAML templates and replaces {{VARIABLE}} placeholders
 */
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const TEMPLATES_DIR = join(__dirname, 'templates');

/**
 * Replace {{VAR}} placeholders in a template string
 * @param {string} template - Template string with {{VAR}} placeholders
 * @param {Object} variables - Map of variable names to values
 * @returns {string} - Rendered template
 */
export function renderTemplate(template, variables) {
  let rendered = template;
  for (const [key, value] of Object.entries(variables)) {
    rendered = rendered.replaceAll(`{{${key}}}`, value);
  }
  return rendered;
}

/**
 * Load a template file from the bundled templates directory
 * @param {string} templateName - Template filename (e.g., 'visual-regression-baseline.yml')
 * @returns {string} - Template content
 */
export function loadTemplate(templateName) {
  const templatePath = join(TEMPLATES_DIR, templateName);
  return readFileSync(templatePath, 'utf8');
}

/**
 * Format a comma-separated branch string into YAML array indentation
 * @param {string} branchesStr - Comma-separated branches (e.g., "main,develop")
 * @returns {string} - YAML-formatted branch list with correct indentation
 */
export function formatBranchList(branchesStr) {
  const branches = branchesStr.split(',').map(b => b.trim()).filter(Boolean);
  return branches.map(b => `      - ${b}`).join('\n');
}

/**
 * Build template variables from CLI options
 * @param {Object} options - CLI options
 * @param {string} options.projectDir - Project directory path
 * @param {string} options.baselineBranches - Comma-separated baseline branches
 * @param {string} options.nodeVersion - Node.js version
 * @param {boolean} options.withAuth - Include auth config sections
 * @returns {Object} - Map of template variable names to values
 */
export function buildTemplateVariables(options) {
  const baselineBranches = options.baselineBranches || 'main';
  const prBranches = options.baselineBranches || 'main';

  const authSectionBaseline = options.withAuth
    ? `      - name: Configure authentication
        run: |
          # Add your authentication setup here.
          # Examples:
          #   echo "AUTH_COOKIES=\${{ secrets.VR_AUTH_COOKIES }}" >> $GITHUB_ENV
          #   echo "AUTH_USER=\${{ secrets.VR_AUTH_USER }}" >> $GITHUB_ENV
          #   echo "AUTH_PASS=\${{ secrets.VR_AUTH_PASS }}" >> $GITHUB_ENV
          echo "Configure authentication secrets in your repository settings"

`
    : '';

  const authSectionCompare = options.withAuth
    ? `      - name: Configure authentication
        run: |
          # Add your authentication setup here.
          # Examples:
          #   echo "AUTH_COOKIES=\${{ secrets.VR_AUTH_COOKIES }}" >> $GITHUB_ENV
          #   echo "AUTH_USER=\${{ secrets.VR_AUTH_USER }}" >> $GITHUB_ENV
          #   echo "AUTH_PASS=\${{ secrets.VR_AUTH_PASS }}" >> $GITHUB_ENV
          echo "Configure authentication secrets in your repository settings"

`
    : '';

  const needsSection = options.needs
    ? `    needs: [${options.needs}]\n`
    : '';

  return {
    BASELINE_BRANCHES: formatBranchList(baselineBranches),
    PR_BRANCHES: formatBranchList(prBranches),
    NODE_VERSION: options.nodeVersion || '22',
    PROJECT_DIR: options.projectDir || '.visual-regression',
    INSTALL_COMMAND: options.installCommand || 'npm install',
    VR_DRUPAL_CMD: options.vrDrupalCmd || 'npx vr-drupal',
    ARTIFACT_RETENTION: '90',
    REPORT_RETENTION: '14',
    NEEDS_SECTION: needsSection,
    AUTH_SECTION_BASELINE: authSectionBaseline,
    AUTH_SECTION_COMPARE: authSectionCompare,
  };
}
