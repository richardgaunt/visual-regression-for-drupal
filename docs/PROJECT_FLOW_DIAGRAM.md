# Project Configuration Flow Diagram

## Start New Project Flow

```mermaid
flowchart TD
    A[Main Menu] --> B[Start New Project]
    B --> C[Enter Project Name]
    C --> D{Convert to Directory Name}
    D --> E{Check if Exists}
    E -->|Exists| F[Ask for New Name]
    F --> C
    E -->|Unique| G[Select Project Root Directory]
    G --> H[Select CivicTheme Directory]
    H --> I[Select Sub-theme Directory]
    I --> J[Select Config Directory]
    J --> K[Create Project Directory]
    K --> L[Save project.json]
    L --> M[Return to Main Menu]
```

## Load Existing Project Flow

```mermaid
flowchart TD
    A[Main Menu] --> B[Load Existing Project]
    B --> C[Read projects/ Directory]
    C --> D[List Available Projects]
    D --> E[User Selects Project]
    E --> F[Load project.json]
    F --> G[Display Project Details]
    G --> H[Continue with Project]
```

## Project Structure

```
projects/
├── my-civic-project/
│   └── project.json
├── client-website-update/
│   └── project.json
└── test-project/
    └── project.json
```

## Configuration File Format

```json
{
  "name": "My Civic Project",
  "directoryName": "my-civic-project",
  "basePath": "/home/user/projects/my-site",
  "civicThemePath": "/home/user/projects/my-site/themes/contrib/civictheme",
  "subThemePath": "/home/user/projects/my-site/themes/custom/my_theme",
  "configPath": "/home/user/projects/my-site/config/sync",
  "createdAt": "2024-01-20T10:00:00Z",
  "updatedAt": "2024-01-20T10:00:00Z"
}
```

## Error Handling States

```mermaid
stateDiagram-v2
    [*] --> EnterProjectName
    EnterProjectName --> CheckDuplicate
    CheckDuplicate --> DuplicateError: Name Exists
    CheckDuplicate --> SelectDirectories: Name Unique
    DuplicateError --> EnterProjectName: Try Again
    SelectDirectories --> SaveProject
    SaveProject --> Success
    SaveProject --> SaveError: File System Error
    SaveError --> [*]: Exit with Error
    Success --> [*]: Return to Menu
```