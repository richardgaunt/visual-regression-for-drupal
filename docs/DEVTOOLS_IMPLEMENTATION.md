Implementation Plan for CivicTheme Development Tools (Issue #2)

Based on the GitHub issue #2, here's the detailed implementation plan:

Phase 1: Setup Development Tool Infrastructure

1. Create NPM Script
- Add ct-release-analyse script to package.json
- Script will launch the analyse tool with interactive prompts

2. Create Command Structure
- Create /src/commands/analyse-civictheme.mjs for the main command logic
- Create /src/lib/civictheme/ directory for CivicTheme-specific utilities

Phase 2: Git Integration and Tag Management

3. Fetch Available Tags
- Create utility to fetch tags from https://git.drupalcode.org/project/civictheme.git
- Parse and process the tag list from the git repository

4. Filter Tags by Date
- Filter tags to only show releases after version 1.5 (August 6, 2023)
- Sort tags by release date for easy selection

5. Interactive Tag Selection
- Use @inquirer/prompts to present filtered tags
- Allow user to select a tag for analysis
- Display tag information (name, date) in the selector

Phase 3: Repository Management

6. Clone Selected Tag
- Clone the selected tag to civictheme-data/tags/<tag_number>/repository
- Create directory structure if it doesn't exist
- Handle git authentication and network errors

7. Version Extraction
- Read composer.json and package.json from cloned repository
- Extract version numbers from both files
- Create version data structure:
  {
  "release": "<tag_number>",
  "version_identifiers": {
  "composer_version": "<composer_version>",
  "package_version": "<package_version>"
  }
  }

8. Save Version Data
- Create civictheme-data/tags/<tag_number>/data/ directory
- Save version information to version.json

Phase 4: Configuration Analysis

9. Extract Entity Configuration
- Parse content types and their fields
- Extract vocabulary definitions and fields
- Analyze media types and their fields
- Field data should include:
    - Name, ID, type, cardinality
    - Target types for entity references

10. Component Analysis
- Scan component directories
- Extract component namespaces (directory paths)
- Get component names (twig file basenames)
- Save component registry

Phase 5: Version Detection

11. Installed Theme Detection
- Create utility to detect CivicTheme version from theme files
- Check multiple sources:
    - theme.info.yml
    - composer.json
    - package.json
- Return detected version with confidence level

Phase 6: Error Handling and UX

12. Error Handling
- Network connectivity errors
- Git authentication issues
- Invalid tag selection
- File parsing errors
- Directory permission issues

13. User Experience
- Progress indicators during clone/analysis
- Clear success/error messages
- Logging of analysis process
- Option to re-analyze existing tags

Technical Implementation Details

Key Files Structure:
/src/commands/analyse-civictheme.mjs    # Main command entry
/src/lib/civictheme/
├── git-manager.mjs                   # Git operations
├── tag-filter.mjs                    # Tag filtering logic
├── version-extractor.mjs             # Version extraction
├── config-analyzer.mjs               # Configuration analysis
└── component-scanner.mjs             # Component scanning

Dependencies:
- simple-git for git operations
- @inquirer/prompts for interactive UI
- fs-extra for file operations
- js-yaml for YAML parsing

Data Storage:
/civictheme-data/
└── tags/
└── <tag_number>/
├── repository/               # Cloned CivicTheme code
└── data/
├── version.json          # Version information
├── entities.json         # Entity configuration
└── components.json       # Component registry

This implementation plan addresses all requirements from issue #2 and provides a solid
foundation for the CivicTheme analysis tools.
