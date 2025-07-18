# GitHub Enterprise Server Pages Auto Deploy

🏢 Automatically build and deploy your project to GitHub Enterprise Server Pages with a single command.

## About

A CLI tool that builds your project, pushes it to a branch in your GitHub Enterprise Server, and enables GitHub Pages for easy preview sharing within your organization. Works with Next.js, Vite, React, Webpack, and most build tools.

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
gh-deploy

# Subsequent runs - deploy current project
gh-deploy
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
gh-deploy --config          # Reconfigure
gh-deploy --config --show   # View config
gh-deploy --config --reset  # Reset config
```

Configuration stored in `~/.ghd-config.json`

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
6. **Enables** GitHub Pages on your enterprise server

Each deployment gets a unique branch name. Your working repository is never modified.

## Supported Projects

- Next.js, Vite, Create React App
- Webpack, Parcel, Rollup
- Any project with `npm run build`

Automatically finds build output directory from your config files.