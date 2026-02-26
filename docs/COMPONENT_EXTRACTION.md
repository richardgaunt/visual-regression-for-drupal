# Component Extraction

Component extraction is part of the CivicTheme analysis workflow. It automatically extracts and catalogs all Twig template components from a CivicTheme version during the analysis process.

## Overview

When analyzing a CivicTheme release using the `npm run devtools` command, the component extraction functionality:

1. Copies all components from the repository to a data directory
2. Scans for all `.twig` files in the components directory
3. Extracts component metadata (namespace and name)
4. Saves the component list to `components.json`

## Integration with Analysis Workflow

Component extraction is automatically performed as part of the CivicTheme analysis process:

```bash
npm run devtools
```

When you select and analyze a CivicTheme version, the tool will:
1. Clone the repository
2. Extract version information
3. Copy configuration data
4. Extract entity information
5. **Extract component information** (automatically)

## Output

The extracted component data is saved to:
```
civictheme-data/tags/<tag_name>/data/components.json
```

### Example components.json:
```json
[
  "00-base/grid/grid.twig",
  "01-atoms/button/button.twig",
  "02-molecules/accordion/accordion.twig",
  "03-organisms/header/header.twig",
  "04-templates/page/page.twig"
]
```

## Component Data Structure

Each component path follows the pattern:
```
<namespace>/<component>/<component>.twig
```

Where namespace maps to:
- `00-base` → base
- `01-atoms` → atoms
- `02-molecules` → molecules
- `03-organisms` → organisms
- `04-templates` → templates

## Implementation Details

The component extraction functionality is implemented in:
- `src/lib/civictheme/component-extractor.mjs` - Core extraction logic
- `src/commands/analyse-civictheme.mjs` - Integration with analysis workflow

### Key Functions

#### copyComponentsToData(tagName)
Copies components from the repository to the data directory for processing.

#### extractComponentsData(tagName)
Extracts all component paths and saves them to `components.json`.

#### extractComponentData(componentPath)
Extracts namespace and name from a component path.

## Error Handling

If component extraction fails (e.g., no components directory found), the analysis will continue with a warning message:
```
Warning: Could not extract components: [error message]
```

This ensures that the overall analysis process is not interrupted by component extraction issues.

## Testing

Component extraction is tested through:
- Unit tests: `tests/unit/component-extractor.test.mjs`
- Integration tests: `tests/component-extractor.integration.test.mjs`

Run tests with:
```bash
npm test
```