/**
 * Test suite for project configuration validation
 */
import { validateProjectConfiguration, formatValidationErrors } from '../src/utils/validator.mjs';

describe('Project Configuration Validation', () => {
  describe('validateProjectConfiguration', () => {
    it('should validate a minimal valid configuration', () => {
      const config = {
        name: 'Test Project',
        directoryName: 'test-project'
      };

      const result = validateProjectConfiguration(config);
      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('should validate a complete configuration with all fields', () => {
      const config = {
        name: 'CivicTheme',
        directoryName: 'civictheme',
        'visual-diff': {
          base_path: 'http://example.com/',
          paths: ['/', '/about'],
          viewports: [
            {
              name: 'Mobile',
              windowWidth: 375,
              windowHeight: 667
            }
          ],
          advanced: {
            masking_selectors: ['.dynamic-content'],
            disable_css_transitions: true,
            hide_mask_selectors: false,
            replace_images_with_solid_color: true,
            settle_delay_ms: 1000
          }
        },
        createdAt: '2025-01-01T00:00:00.000Z',
        updatedAt: '2025-01-02T00:00:00.000Z',
        snapshots: {
          'snapshot-20250101': {
            directory: 'screenshots/snapshot-20250101',
            date: '2025-01-01T12:00:00.000Z',
            count: 5
          }
        }
      };

      const result = validateProjectConfiguration(config);
      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('should reject configuration missing required fields', () => {
      const config = {
        name: 'Test Project'
      };

      const result = validateProjectConfiguration(config);
      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].message).toContain("must have required property 'directoryName'");
    });

    it('should reject invalid directoryName format', () => {
      const config = {
        name: 'Test Project',
        directoryName: 'Test Project!' // Invalid characters
      };

      const result = validateProjectConfiguration(config);
      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].path).toContain('directoryName');
    });

    it('should reject invalid URL format', () => {
      const config = {
        name: 'Test',
        directoryName: 'test',
        'visual-diff': {
          base_path: 'not-a-url'
        }
      };

      const result = validateProjectConfiguration(config);
      expect(result.valid).toBe(false);
      expect(result.errors[0].path).toContain('visual-diff/base_path');
    });

    it('should reject viewports with invalid dimensions', () => {
      const config = {
        name: 'Test',
        directoryName: 'test',
        'visual-diff': {
          base_path: 'http://example.com/',
          viewports: [
            {
              name: 'Invalid',
              windowWidth: 100, // Below minimum
              windowHeight: 500
            }
          ]
        }
      };

      const result = validateProjectConfiguration(config);
      expect(result.valid).toBe(false);
      expect(result.errors[0].path).toContain('windowWidth');
    });

    it('should reject invalid date-time format', () => {
      const config = {
        name: 'Test',
        directoryName: 'test',
        createdAt: 'not-a-date'
      };

      const result = validateProjectConfiguration(config);
      expect(result.valid).toBe(false);
      expect(result.errors[0].path).toContain('createdAt');
    });

    it('should validate snapshots with any key name', () => {
      const config = {
        name: 'Test',
        directoryName: 'test',
        snapshots: {
          'snapshot-20250101': {
            directory: 'dir',
            date: '2025-01-01T00:00:00.000Z',
            count: 1
          },
          'custom-snapshot': {
            directory: 'dir2',
            date: '2025-01-02T00:00:00.000Z',
            count: 2
          }
        }
      };

      const result = validateProjectConfiguration(config);
      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('should reject snapshots missing required fields', () => {
      const config = {
        name: 'Test',
        directoryName: 'test',
        snapshots: {
          'snapshot-001': {
            directory: 'dir'
            // Missing date and count
          }
        }
      };

      const result = validateProjectConfiguration(config);
      expect(result.valid).toBe(false);
      expect(result.errors[0].message).toContain('must have required property');
    });
  });

  describe('formatValidationErrors', () => {
    it('should format single error message', () => {
      const errors = [{
        path: '/name',
        message: 'must be string',
        keyword: 'type',
        params: {}
      }];

      const formatted = formatValidationErrors(errors);
      expect(formatted).toContain("Field '/name': must be string");
    });

    it('should format multiple error messages', () => {
      const errors = [
        {
          path: '/name',
          message: 'must be string',
          keyword: 'type',
          params: {}
        },
        {
          path: 'root',
          message: "must have required property 'directoryName'",
          keyword: 'required',
          params: {}
        }
      ];

      const formatted = formatValidationErrors(errors);
      expect(formatted).toContain("Field '/name': must be string");
      expect(formatted).toContain("Project configuration: must have required property 'directoryName'");
    });

    it('should return empty string for no errors', () => {
      const formatted = formatValidationErrors([]);
      expect(formatted).toBe('');
    });
  });
});
