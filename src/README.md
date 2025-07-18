# Source Code Structure

This directory contains the modular source code for the GitHub Enterprise Pages Auto Deploy tool.

## Directory Structure

```
src/
├── cli.js                    # Main CLI entry point
├── GitHubPagesDeployer.js    # Main orchestrator class
├── config/
│   └── ConfigManager.js      # Configuration management
├── cleanup/
│   └── CleanupManager.js     # Branch cleanup functionality
├── build/
│   ├── BuildDetector.js      # Build system detection
│   └── BuildConfigurer.js    # Build configuration modification
├── deploy/
│   ├── GitDeployer.js        # Git deployment handling
│   └── PagesDeployer.js      # GitHub Pages setup
└── utils/
    ├── prompt.js             # User prompt utilities
    ├── github.js             # GitHub API utilities
    └── file.js               # File system utilities
```

## Module Responsibilities

### `cli.js`
- Main entry point for the CLI
- Handles command-line argument parsing
- Coordinates different command modes (deploy, config, cleanup, help)

### `GitHubPagesDeployer.js`
- Main orchestrator class
- Coordinates the deployment process
- Handles the overall flow from setup to deployment

### `config/ConfigManager.js`
- Manages configuration file operations
- Handles project name storage per directory
- Manages deployment repository setup
- Handles auto-cleanup preferences

### `cleanup/CleanupManager.js`
- Handles cleanup of old deployment branches
- Supports both manual and automatic cleanup modes
- Parses branch timestamps to identify old branches

### `build/BuildDetector.js`
- Detects the build system being used (Next.js, Vite, React, etc.)
- Determines build output directories
- Parses configuration files to extract build settings

### `build/BuildConfigurer.js`
- Temporarily modifies build configurations for deployment
- Handles base path configuration for different frameworks
- Restores original configurations after build

### `deploy/GitDeployer.js`
- Handles Git repository operations
- Creates deployment branches
- Handles environment-specific configuration replacement
- Manages temporary Git repository setup

### `deploy/PagesDeployer.js`
- Handles GitHub Pages configuration
- Manages Pages API interactions
- Provides fallback configuration methods

### `utils/`
- **`prompt.js`**: User input handling
- **`github.js`**: GitHub CLI operations and authentication
- **`file.js`**: File system operations and utilities

## Benefits of This Structure

1. **Separation of Concerns**: Each module has a single responsibility
2. **Testability**: Individual modules can be tested in isolation
3. **Maintainability**: Changes to one feature don't affect others
4. **Reusability**: Utilities can be shared across modules
5. **Readability**: Code is organized by functionality making it easier to understand

## Usage

The main entry point is `index.js` in the root directory, which simply requires `src/cli.js` to start the application.