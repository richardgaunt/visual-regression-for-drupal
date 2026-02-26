# Snapshot Overwrite Feature

This document describes the implementation of the snapshot overwrite feature in the visual regression testing functionality of the CivicTheme Update Helper tool.

## Overview

The snapshot overwrite feature allows users to replace existing screenshot sets with new captures. This is useful when:

- Screenshots need to be refreshed after website changes
- Errors occurred during previous capture
- Different viewport configurations are required

## Implementation Details

### Core Components

1. **Snapshot Manager** (`snapshot-manager.mjs`)
   - Added overwrite parameter to `createSnapshot()` function
   - Implemented logic to delete existing snapshot directory when overwrite is enabled
   - Added checks to handle existing snapshots properly

2. **Take Snapshot Command** (`take-snapshot.mjs`)
   - Removed validation that prevented using existing snapshot IDs
   - Added detection for existing snapshots
   - Implemented user confirmation before overwriting
   - Passes overwrite flag to snapshot manager when confirmed

## User Flow

1. User initiates snapshot capture and enters an existing snapshot ID
2. System detects existing snapshot and prompts for confirmation:
   ```
   Snapshot "snapshot-20250521" already exists.
   ? Do you want to overwrite the existing snapshot? (y/N)
   ```
3. If user confirms:
   - Existing snapshot directory is deleted
   - New screenshots are captured
   - Project configuration is updated with new snapshot metadata
4. If user declines:
   - Process is cancelled
   - User is returned to the main menu

## Technical Implementation

### Overwrite Detection and Handling

```javascript
// Check if snapshot already exists
let overwrite = false;
if (snapshots[snapshotId]) {
  console.log(chalk.yellow(`Snapshot "${snapshotId}" already exists.`));
  overwrite = await confirm({
    message: 'Do you want to overwrite the existing snapshot?',
    default: false
  });
  
  if (!overwrite) {
    console.log(chalk.yellow('Snapshot capture cancelled.'));
    return;
  }
  
  console.log(chalk.yellow(`Existing snapshot "${snapshotId}" will be overwritten.`));
}
```

### Directory Clean-up and Recreation

```javascript
// If overwrite is enabled and snapshot exists, remove existing directory
if (snapshotExists && overwrite) {
  console.log(`Removing existing snapshot "${snapshotId}"...`);
  fs.rmSync(snapshotDir, { recursive: true, force: true });
}

// Create snapshot directory
fs.mkdirSync(snapshotDir, { recursive: true });
```

## Benefits

1. **User Convenience**: Users don't need to remember snapshot IDs or create unique names each time
2. **Updated Comparisons**: Makes it easy to refresh baseline screenshots after intentional changes
3. **Error Recovery**: Provides a way to recover from failed or incomplete captures

## Safety Measures

1. **Confirmation Required**: Overwrite requires explicit user confirmation
2. **Default No**: Confirmation prompt defaults to "No" to prevent accidental overwrites
3. **Clear Warnings**: System clearly indicates when overwrite is about to occur