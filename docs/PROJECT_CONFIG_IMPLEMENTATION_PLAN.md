# Project Configuration Implementation Plan

## Overview
Implement the foundation for project management in the CivicTheme Update Helper as per GitHub issue #1.

## User Stories
- As a developer, I want to create a new project to track my CivicTheme update process
- As a developer, I want to load existing projects to continue my work
- As a developer, I want my project configurations to be saved persistently

## Implementation Steps

### 1. Project Structure Setup
- Create `projects/` directory to store all project configurations
- Set up utility functions for project management in `src/utils/project-manager.mjs`

### 2. Dependencies
- Install `inquirer-file-selector` for directory selection prompts
- Update package.json with new dependency

### 3. Project Name Utilities
Create functions for project name management:
- `convertProjectNameToDirectory(name)` - Convert human-readable names to valid directory names
- `isProjectNameUnique(directoryName)` - Check if project already exists
- `ensureProjectsDirectory()` - Create projects directory if it doesn't exist

### 4. Update Start New Project Flow
Update `src/commands/start-new-project.mjs`:
- Replace input prompts with file selector for directory selection
- Implement duplicate name checking
- Add project saving functionality
- Use the following flow:
  1. Get project name from user
  2. Convert to directory name
  3. Check if directory exists
  4. If exists, ask for new name
  5. Use file selector for CivicTheme and other directories
  6. Save project configuration to `projects/<directory_name>/project.json`

### 5. Configuration Format
Project configuration JSON structure:
```json
{
  "name": "Human Readable Project Name",
  "directoryName": "human-readable-project-name",
  "basePath": "/path/to/project/root",
  "civicThemePath": "/path/to/civictheme",
  "subThemePath": "/path/to/subtheme",
  "configPath": "/path/to/config",
  "createdAt": "2024-01-20T10:00:00Z",
  "updatedAt": "2024-01-20T10:00:00Z"
}
```

### 6. Update Load Existing Project
Update `src/commands/load-existing-project.mjs`:
- Read actual projects from the `projects/` directory
- Display real project names instead of mock data
- Load project configuration when selected

### 7. Error Handling
- Handle file system errors gracefully
- Provide clear error messages to users
- Validate directory selections

### 8. Testing
Create tests for:
- Project name conversion
- Duplicate detection
- Project saving and loading
- Directory selection integration

## Technical Implementation Details

### Directory Structure
```
civictheme-update-helper/
├── projects/                    # All project configurations
│   ├── my-first-project/
│   │   └── project.json
│   └── another-project/
│       └── project.json
├── src/
│   ├── commands/
│   │   ├── start-new-project.mjs
│   │   └── load-existing-project.mjs
│   └── utils/
│       └── project-manager.mjs  # Project management utilities
```

### File Selector Integration
```javascript
import fileSelector from 'inquirer-file-selector';

const basePath = await fileSelector({
  message: 'Select Project root directory:',
  type: 'directory',
  basePath: '../../'
});

const civicThemePath = await fileSelector({
  message: 'Select CivicTheme directory:',
  type: 'directory',
  basePath: basePath
});
```

### Project Manager API
```javascript
// src/utils/project-manager.mjs
export function convertProjectNameToDirectory(name);
export function isProjectNameUnique(directoryName);
export function ensureProjectsDirectory();
export function saveProjectConfiguration(config);
export function loadProjectConfiguration(directoryName);
export function getAllProjects();
```

## Success Criteria
- [x] Main menu displays "Start new project" and "Load existing project" options
- [ ] Projects are saved in the projects directory with unique names
- [ ] Project names are converted to valid directory names
- [ ] System prevents duplicate project names
- [ ] Configuration is saved as project.json in project directory
- [ ] Directory selection uses file selector prompts
- [ ] Load existing projects shows real saved projects

## Next Steps
1. Install dependencies
2. Create project manager utilities
3. Update start new project flow
4. Update load existing project flow
5. Add comprehensive testing
6. Document the project management system