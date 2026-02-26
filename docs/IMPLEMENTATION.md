Project Analysis

The CivicTheme Update Helper is a CLI tool that serves two primary purposes:

1. Configuration Analysis: Compare site configurations against different CivicTheme versions to identify changes in fields, components, and customizations
2. Visual Regression Testing: Capture and compare screenshots before and after upgrades to identify visual changes

Step-by-Step Implementation Plan

Step 1: Project Management Foundation

User Stories:
- As a developer, I want to create a new project to track my CivicTheme update process
- As a developer, I want to load existing projects to continue my work
- As a developer, I want my project configurations to be saved persistently

Acceptance Criteria:
- Main menu displays "Start new project" and "Load existing project" options
- Projects are saved in the projects directory with unique names
- Project names are converted to valid directory names
- System prevents duplicate project names
- Configuration is saved as configuration.json in project directory

Step 1: Development Tools

User Stories:
- As a maintainer, I want to analyze different CivicTheme versions
- As a maintainer, I want to extract configuration data from CivicTheme releases
- As a developer, I want to automatically detect which version of CivicTheme is installed
- As a developer, I want to see the detected version clearly displayed

Acceptance Criteria:
- Command npm run analyse-civictheme <tag> downloads specified version
- Extract field and component data from CivicTheme version
- Save extracted data in civictheme/<tag>/ directory
- Support multiple version analysis
- System accurately identifies CivicTheme version from theme files
- Version information is displayed and saved in project configuration
- Error handling for cases where version cannot be determined


Step 2: Setup of flow in application and mock up steps and feedback
User Stories:
- As a developer, i want to start the application and be able to see the following:
```
CivicTheme Update Helper"
version: 1.0

- Start new project
- Load existing project
```
- As a developer, I should be able to load existing project and see a list of projects
- As a developer, I should be able to start a new project
  - As a developer if I ask to start a new project then I am asked the following questions:
      - What is the name of the project?
      - What is the directory of CivicTheme?
      - What is the sub-theme directory?
      - What is the configuration directory for your site?
Acceptance Criteria:
  - I can navigate around application with the choices of the application setup but no functionality yet.

Step 2: Project Configuration Setup

User Stories:
- As a developer, I want to configure my CivicTheme directory location
- As a developer, I want to configure my sub-theme directory location
- As a developer, I want to configure my site's configuration directory

Acceptance Criteria:
- File system navigation with autocomplete for directory selection
- Validation that selected directories exist
- Configuration saved to project's configuration.json
- User prompted to "Gather information about CivicTheme and Sub-Theme Installation" after save

Step 3: Site Configuration Analysis

User Stories:
- As a developer, I want to analyze my site's content types and their fields
- As a developer, I want to analyze my site's vocabularies and their fields
- As a developer, I want to analyze my site's media types and their fields

Acceptance Criteria:
- Extract field information including: name, ID, type, cardinality, target_types (for entity references)
- Build comprehensive data structure of site configuration
- Save analysis results in project directory
- Display summary of findings to user

Step 4: Field Comparison

User Stories:
- As a developer, I want to see which fields are new in my site compared to a CivicTheme version
- As a developer, I want to see which fields are missing from my site
- As a developer, I want to see which fields have been customized (changed type or cardinality)

Acceptance Criteria:
- Compare site fields against specific CivicTheme version
- Generate report showing new, missing, and customized fields
- Display clear categorization of field differences
- Export comparison results to file

Step 5: Component Analysis

User Stories:
- As a developer, I want to identify new custom components in my implementation
- As a developer, I want to identify which CivicTheme components I've overridden

Acceptance Criteria:
- Scan component directories to identify custom components
- Compare against base CivicTheme components
- Generate report of custom and overridden components
- Track component namespace and name

Step 6: Visual Regression Tool Configuration

User Stories:
- As a developer, I want to configure which website URL to snapshot
- As a developer, I want to configure specific paths to capture
- As a developer, I want to configure different viewport sizes

Acceptance Criteria:
- URL validation and storage
- Path configuration with ability to add multiple paths
- Viewport configuration (mobile, tablet, desktop presets + custom)
- Configuration saved to project

Step 7: Screenshot Capture

User Stories:
- As a developer, I want to capture screenshots of my site
- As a developer, I want to configure masking for dynamic elements

Acceptance Criteria:
- Capture screenshots for all configured paths and viewports
- Apply masking to dynamic elements (dates, user info, etc.)
- Save screenshots with organized naming convention
- Display progress during capture process

Step 8: Visual Comparison

User Stories:
- As a developer, I want to compare screenshots before and after upgrades
- As a developer, I want to see visual differences highlighted

Acceptance Criteria:
- Load and compare saved screenshot sets
- Highlight visual differences between versions
- Generate comparison report
- Allow navigation through differences



Step 9: Testing and Quality Assurance

User Stories:
- As a developer, I want comprehensive test coverage
- As a developer, I want code to follow established standards

Acceptance Criteria:
- Jest tests for all major functions
- ESLint configuration and passing checks
- Feature branch workflow with clean commits
- Run tests and linting before commits

Step 12: Error Handling and User Experience

User Stories:
- As a developer, I want clear error messages when something goes wrong
- As a developer, I want helpful guidance throughout the process

Acceptance Criteria:
- Graceful error handling for all operations
- Informative error messages with recovery suggestions
- Progress indicators for long-running operations
- Help documentation available

Implementation Notes

The project should:
- Use the existing CLI structure with commander for commands
- Leverage @inquirer/prompts for interactive features
- Store data in JSON format for easy manipulation
- Use modular architecture with commands in src/commands and utilities in src/lib
- Maintain clear separation between user-facing features and development tools

This plan provides a roadmap for implementing the CivicTheme Update Helper while maintaining flexibility for solution details to be determined during each step's implementation.
