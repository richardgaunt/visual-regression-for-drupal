# Action Plan: Project Configuration Implementation

## Immediate Actions

### 1. Install Dependencies
```bash
npm install inquirer-file-selector
```

### 2. Create Project Manager Utility
Create `src/utils/project-manager.mjs`:
- `convertProjectNameToDirectory(name)` - Convert "My Project" → "my-project"
- `checkProjectExists(directoryName)` - Check if project directory exists
- `saveProjectConfiguration(config)` - Save project.json to projects/<dir>
- `loadProjectConfiguration(dirName)` - Load project.json from projects/<dir>
- `getAllProjects()` - List all saved projects

### 3. Update Start New Project
Modify `src/commands/start-new-project.mjs`:
1. Get project name (keep existing)
2. Convert to directory name
3. Check for duplicates (loop until unique)
4. Replace text inputs with file selectors:
   - Project root directory
   - CivicTheme directory
   - Sub-theme directory
   - Config directory
5. Save configuration to `projects/<directory_name>/project.json`

### 4. Update Load Existing Project
Modify `src/commands/load-existing-project.mjs`:
1. Replace mock data with `getAllProjects()`
2. Show real project names in selection
3. Load selected project configuration
4. Display project details

### 5. Create Projects Directory
Ensure `projects/` directory exists in the application root.

## Code Implementation Order

1. **First**: Create utility functions (project-manager.mjs)
2. **Second**: Update start-new-project.mjs with file selectors
3. **Third**: Update load-existing-project.mjs with real data
4. **Fourth**: Add error handling
5. **Fifth**: Write tests

## Configuration Format
```json
{
  "name": "My Project Name",
  "directoryName": "my-project-name",
  "basePath": "/path/to/project/root",
  "civicThemePath": "/path/to/civictheme",
  "subThemePath": "/path/to/subtheme",
  "configPath": "/path/to/config",
  "createdAt": "2024-01-20T10:00:00Z",
  "updatedAt": "2024-01-20T10:00:00Z"
}
```

## Key Implementation Points

1. **File Selector Usage** (from issue):
```javascript
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

2. **Duplicate Prevention**:
- Check if directory exists
- If exists, ask for new name
- Repeat until unique

3. **Save Location**:
- All projects in `projects/` directory
- Each project has its own subdirectory
- Configuration in `project.json`

## Success Metrics
- User can create new projects with file selectors
- Projects are saved persistently
- Duplicate names are prevented
- Existing projects can be loaded
- All mock data is replaced with real functionality