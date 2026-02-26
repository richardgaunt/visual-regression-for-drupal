# Project Configuration Implementation Plan

## Based on GitHub Issue #1: Step 1a: Project Management Foundation

### Phase 1: Setup and Dependencies

1. **Install Required Dependencies**
   ```bash
   npm install inquirer-file-selector
   ```

2. **Create Project Directory Structure**
   ```
   civictheme-update-helper/
   ├── projects/                    # Store all project configurations
   ├── src/
   │   ├── commands/
   │   │   ├── start-new-project.mjs    # Update with new functionality
   │   │   └── load-existing-project.mjs # Update to load real projects
   │   └── utils/
   │       └── project-manager.mjs      # New utility functions
   ```

### Phase 2: Create Utility Functions

Create `src/utils/project-manager.mjs` with the following functions:

1. **convertProjectNameToDirectory(name)**
   - Convert human-readable names to valid directory names
   - Remove special characters
   - Replace spaces with hyphens
   - Convert to lowercase
   - Example: "My Project Name" → "my-project-name"

2. **checkProjectExists(directoryName)**
   - Check if `projects/<directoryName>` exists
   - Return boolean

3. **ensureProjectsDirectory()**
   - Create `projects/` directory if it doesn't exist
   - Handle permissions errors

4. **saveProjectConfiguration(projectData)**
   - Create project directory
   - Save `project.json` file
   - Handle file system errors

5. **loadProjectConfiguration(directoryName)**
   - Read `project.json` from project directory
   - Parse JSON and return configuration
   - Handle missing/corrupt files

6. **getAllProjects()**
   - List all directories in `projects/`
   - Return array of project configurations

### Phase 3: Update Start New Project Flow

Update `src/commands/start-new-project.mjs`:

```javascript
import fileSelector from 'inquirer-file-selector';
import { 
  convertProjectNameToDirectory,
  checkProjectExists,
  saveProjectConfiguration 
} from '../utils/project-manager.mjs';

// 1. Get project name (existing)
const projectName = await input({
  message: 'What is the name of the project?',
});

// 2. Convert to directory name and check uniqueness
let directoryName = convertProjectNameToDirectory(projectName);
while (checkProjectExists(directoryName)) {
  const newName = await input({
    message: 'Project already exists. Please enter a different name:',
  });
  directoryName = convertProjectNameToDirectory(newName);
}

// 3. Select directories using file selector
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

const subThemePath = await fileSelector({
  message: 'Select Sub-theme directory:',
  type: 'directory',
  basePath: basePath
});

const configPath = await fileSelector({
  message: 'Select Configuration sync directory:',
  type: 'directory',
  basePath: basePath
});

// 4. Save project configuration
const projectConfig = {
  name: projectName,
  directoryName: directoryName,
  basePath: basePath,
  civicThemePath: civicThemePath,
  subThemePath: subThemePath,
  configPath: configPath,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString()
};

await saveProjectConfiguration(projectConfig);
```

### Phase 4: Update Load Existing Project

Update `src/commands/load-existing-project.mjs`:

```javascript
import { getAllProjects } from '../utils/project-manager.mjs';

// Get all saved projects
const projects = await getAllProjects();

if (projects.length === 0) {
  console.log('No projects found. Please create a new project first.');
  return showMainMenu();
}

// Create choices for select prompt
const choices = projects.map(project => ({
  name: project.name,
  value: project.directoryName
}));
choices.push({ name: 'Return to main menu', value: 'return' });

// Show project selection
const selectedProject = await select({
  message: 'Select a project:',
  choices: choices
});

if (selectedProject !== 'return') {
  const projectConfig = await loadProjectConfiguration(selectedProject);
  // Display project details or continue with project workflow
}
```

### Phase 5: Testing

Create comprehensive tests for:
1. Project name conversion
2. Duplicate detection
3. File system operations
4. Configuration saving/loading
5. Error handling scenarios

### Phase 6: Error Handling

Implement robust error handling for:
- File system permissions
- Invalid directory selections
- Corrupted configuration files
- Missing project directories

## Success Criteria Checklist

- [x] Main menu displays "Start new project" and "Load existing project" options (already implemented)
- [ ] Install inquirer-file-selector dependency
- [ ] Create convertProjectNameToDirectory function
- [ ] Implement project existence checking
- [ ] Use file selector for directory selection
- [ ] Save project.json in projects/<directory_name>
- [ ] Load real projects in "Load existing project"
- [ ] Prevent duplicate project names
- [ ] Add comprehensive error handling
- [ ] Write unit and integration tests

## Next Steps

1. Start with Phase 1: Install dependencies and create directory structure
2. Implement utility functions in Phase 2
3. Update the command files in Phases 3 and 4
4. Add tests and error handling in Phases 5 and 6

This plan follows the solution direction from the GitHub issue exactly, using the file selector for directory selection and saving configurations as specified.