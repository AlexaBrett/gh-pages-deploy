# GitHub Enterprise Server Pages Auto Deploy

🏢 Automatically build and deploy your project to GitHub Enterprise Server Pages with a single command.

## About

A CLI tool that builds your project, pushes it to a branch in your GitHub Enterprise Server, and enables GitHub Pages for easy preview sharing within your organization. Works with Next.js, Vite, React, and most build tools.

**Enterprise Only** - Does not work with GitHub.com.

## Installation

### Prerequisites

- **GitHub Enterprise Server 2.20+** (will NOT work with GitHub.com)
- **GitHub CLI** installed and authenticated with your enterprise server
- **Node.js project** with a `package.json` containing a `build` script

### Install GitHub CLI

```bash
# macOS
brew install gh

# Windows  
winget install GitHub.cli

# Linux
sudo apt install gh

# Authenticate with your enterprise server
gh auth login --hostname your-enterprise-server.com
```

### Install the Package

```bash
# Install globally
npm install -g gh-enterprise-pages-deploy

# Or use directly
npx gh-enterprise-pages-deploy
```

## Usage

```bash
# First run - sets up deployment repository
github-pages-poc-deploy

# Subsequent runs - deploy current project
github-pages-poc-deploy

# Short form
ghpd
```

### First Time Setup
```
🔧 First time setup - configuring deployment repository...
Repository name (default: gh-pages-previews): [Enter]
🚀 Creating repository...
💾 Configuration saved
```

### Regular Deployment
```
📦 Detected Next.js project
🔨 Building project...
📤 Deploying to branch: my-app-20250718-1423-a1b2c3
🎉 Deployment complete!
🔗 https://your-server.com/pages/username/gh-pages-previews/my-app-20250718-1423-a1b2c3/
```

## Configuration

```bash
github-pages-poc-deploy --config          # Reconfigure or update project name
github-pages-poc-deploy --config --show   # View config
github-pages-poc-deploy --config --reset  # Reset config
github-pages-poc-deploy --cleanup         # Remove branches older than 1 week

# Short form
ghpd --config          # Reconfigure or update project name
ghpd --config --show   # View config
ghpd --config --reset  # Reset config
ghpd --cleanup         # Remove branches older than 1 week
```

Configuration stored in `~/.ghd-config.json`

### Project Names
The tool now asks for and stores a project name for each repository. This name is used in branch naming instead of the package.json name, giving you more control over branch naming. Project names are stored per directory, so different projects can have different names.

### Cleanup
To prevent the deployment repository from growing too large, old deployment branches are automatically cleaned up:

```bash
github-pages-poc-deploy --cleanup                    # Manual cleanup with confirmation
github-pages-poc-deploy --cleanup --auto-cleanup    # Automatic cleanup without confirmation

# Short form
ghpd --cleanup                    # Manual cleanup with confirmation
ghpd --cleanup --auto-cleanup    # Automatic cleanup without confirmation
```

**Manual Cleanup:**
- Find all deployment branches older than 1 week
- Show you a list of branches to be deleted
- Ask for confirmation before deleting
- Remove the old branches from your deployment repository

**Automatic Cleanup (Enabled by Default):**
- **During Setup**: Auto-cleanup is enabled by default (can be disabled)
- **After Each Deployment**: Automatically removes branches older than 1 week after successful deployments
- **Command Line**: Use `--auto-cleanup` flag for unattended cleanup
- **Configuration**: Toggle auto-cleanup on/off using `ghpd --config`

## Troubleshooting

**"This tool only works with GitHub Enterprise Server"**
```bash
gh auth login --hostname your-enterprise-server.com
```

**Build fails**
- Ensure `npm run build` exists in package.json
- Run `npm install` first
- Test build locally: `npm run build`

**Pages URL doesn't work**
- Check with admin about GitHub Pages configuration
- May need manual Pages enablement in repo settings

**Repository creation fails**
```bash
gh repo list  # Check permissions
```

## How It Works

1. **Detects** your project type and build configuration
2. **Temporarily modifies** config files for correct asset paths  
3. **Builds** your project with `npm run build`
4. **Restores** original config files
5. **Creates** a new branch with only build files
6. **Enables GitHub Pages** and sets the source to the new branch
7. **Provides** direct link to your live preview

Each deployment gets a unique branch name. Your working repository is never modified.

## Supported Projects

- Next.js, Vite, Create React App
- Any project with `npm run build`

Automatically finds build output directory from your config files.

## Development

The codebase is organized into modules for better maintainability:

- `src/cli.js` - Main CLI entry point
- `src/config/` - Configuration management
- `src/cleanup/` - Branch cleanup functionality  
- `src/build/` - Build system detection and configuration
- `src/deploy/` - Git and GitHub Pages deployment
- `src/utils/` - Shared utilities

See `src/README.md` for detailed module documentation.