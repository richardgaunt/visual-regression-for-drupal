# Concurrent Screenshot Capture Implementation

This document describes the implementation of concurrent screenshot capturing in the visual regression testing feature of the CivicTheme Update Helper tool.

## Overview

We've enhanced the screenshot capturing functionality to use parallel processing with `puppeteer-cluster`, which allows for multiple browser instances to capture screenshots simultaneously. This significantly improves performance when capturing multiple screenshots across different URLs and viewports.

## Implementation Details

### Dependencies

- Added `puppeteer-cluster` package for managing concurrent browser instances

### Key Components

1. **Concurrency Optimization**
   - Used `determineOptimalConcurrency()` function to calculate the optimal number of concurrent browser instances based on:
     - CPU count
     - Available memory
     - Safety limits to prevent system overload

2. **Cluster Configuration**
   - Configured `puppeteer-cluster` to:
     - Use `CONCURRENCY_CONTEXT` mode for efficient resource usage
     - Set maxConcurrency based on system resources
     - Enable retry logic for failed screenshot captures
     - Provide monitoring for better visibility

3. **Task Queue Processing**
   - Implemented a task queue approach where:
     - Task objects contain URL, viewport, and output path information
     - Tasks are queued for parallel processing
     - Screenshots are captured concurrently across different URLs and viewports

## Benefits

1. **Performance Improvements**
   - Significantly faster screenshot capture, especially for sites with many pages and viewports
   - Reduced overall capture time through parallel processing

2. **Resource Optimization**
   - Dynamic determination of concurrency based on available system resources
   - Prevention of memory exhaustion by setting appropriate limits

3. **Error Handling**
   - Built-in retry mechanism for handling transient failures
   - Isolated browser contexts to prevent issues from propagating

## Code Structure

### Screenshot Module (`screenshot.mjs`)
- `determineOptimalConcurrency()`: Calculates optimal number of concurrent instances
- `captureUrlScreenshots()`: Manages concurrent screenshot capture

### Snapshot Manager (`snapshot-manager.mjs`)
- Integrated with the concurrency framework by passing optimal concurrency to the screenshot module

## Usage

The implementation is transparent to end users. The system automatically:
1. Determines the optimal concurrency level for the user's hardware
2. Creates and manages browser instances
3. Distributes screenshot capturing tasks across these instances
4. Collects and organizes the results

## Testing

Unit tests verify that:
- The `determineOptimalConcurrency()` function returns reasonable values based on system resources
- The concurrency is properly bounded by CPU count and memory limits

## Future Enhancements

Potential future improvements include:
1. User control over concurrency limits
2. Progress reporting during capture
3. More sophisticated retry and error handling logic