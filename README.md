## GitHub Enterprise Server Specifics

### Supported Versions
- **Pages URL doesn't work**
- Check with your administrator about Pages configuration
- Some enterprises use different URL patterns
- Pages may need manual enablement in repository settings
- Verify GitHub Pages is enabled on your enterprise instance

**Repository creation fails**
```bash
# Check permissions
gh repo list --hostname your-enterprise-server.com
# Verify you can create repositories in your enterprise
```GitHub Enterprise Server 2.20+** (including 3.11.20)
- **GitHub CLI** with enterprise authentication

### Enterprise-Specific Features
- ✅ **Hostname Detection**: Automatically detects your enterprise server from GitHub CLI auth
- ✅ **Enterprise URLs**: Generates correct repository and Pages URLs for your instance
- ✅ **Enterprise API**: Uses enterprise-specific GitHub API endpoints
- ✅ **Access Control**: Respects your enterprise server's permissions and access controls

### GitHub Pages on Enterprise Server
- Pages URL structure varies by enterprise configuration
- Some instances use custom domains for Pages
- Contact your administrator if Pages URLs don't work as expected
- Manual Pages enablement may be required in repository settings

### Troubleshooting Enterprise Issues

**"This tool only works with GitHub Enterprise Server"**
```bash
# Make sure you're authenticated with enterprise, not GitHub.com
gh auth status
gh auth login --hostname your-enterprise-server.com
```

**"Could not get GitHub username"**
```bash
# Verify enterprise authentication
gh api user --hostname your-enterprise-server.com
```

**## Example Output

### First Time Setup
```
🚀 Starting GitHub Pages deployment...

🔧 First time setup - configuring deployment repository...

We'll create a repository to store all your preview deployments.
Each deployment will be a separate branch in this repository.

Repository name (default: gh-pages-previews): 
🚀 Creating repository username/gh-pages-previews...
✅ Repository username/gh-pages-previews already exists, will use it.
💾 Configuration saved to ~/.ghd-config.json
```

### Regular Deployment
```
🏢 Connected to GitHub Enterprise Server: your-enterprise-server.com
🚀 Starting GitHub Pages deployment...

📂 Using deployment repository: username/gh-pages-previews
📦 Detected Next.js project (next.config.js)
🔧 Setting up temporary deployment repository...
🔧 Configuring base path: /gh-pages-previews/my-nextjs-app-20250718-1423-a1b2c3
📝 Temporarily modified next.config.js for deployment
🔨 Building project using: npm run build
✅ Build completed. Output in: out
🔄 Restoring original configuration files...
↩️  Restored next.config.js
📦 Preparing deployment to branch: my-nextjs-app-20250718-1423-a1b2c3
📤 Pushing to GitHub...
📄 Setting up GitHub Enterprise Pages deployment...

🎉 Deployment to GitHub Enterprise Server complete!
🏢 Enterprise Server: your-enterprise-server.com
🔗 Your preview site: https://your-enterprise-server.com/pages/username/gh-pages-previews/my-nextjs-app-20250718-1423-a1b2c3/
🌿 Branch: my-nextjs-app-20250718-1423-a1b2c3
📦 GitHub branch: https://your-enterprise-server.com/username/gh-pages-previews/tree/my-nextjs-app-20250718-1423-a1b2c3

📋 GitHub Enterprise Server Notes:
• GitHub Pages URL structure may vary based on your enterprise configuration
• Check with your administrator if the preview URL doesn't work
• You may need to manually enable GitHub Pages in repository settings
• Some enterprise instances have custom Pages domains

💡 Tip: Share the branch URL with colleagues who can access your enterprise server!
```# GitHub Enterprise Server Pages Auto Deploy

🏢 Automatically build your project and deploy it to GitHub Enterprise Server with GitHub Pages enabled for easy sharing within your organization.

## Features

- **GitHub Enterprise Server Only** - Designed specifically for enterprise environments
- **Auto-detection** of project type (Next.js, Vite, Create React App, or generic)
- **Smart build configuration** detection from config files
- **Automatic base path configuration** for correct asset loading
- **Single repository setup** - all deployments go to branches in one repo
- **Configurable deployment target** - set up once, deploy many times
- **Unique branch naming** for each deployment
- **GitHub Pages auto-setup** with proper configuration
- **Zero impact** on your working repository

## Installation

```bash
# Install globally
npm install -g gh-pages-auto-deploy

# Or use with npx (no installation needed)
npx gh-pages-auto-deploy
```

## Prerequisites

**This tool requires GitHub Enterprise Server 2.20 or higher and will NOT work with GitHub.com**

1. **GitHub CLI** must be installed and authenticated with your enterprise server:
   ```bash
   # Install GitHub CLI
   # macOS
   brew install gh
   
   # Windows
   winget install GitHub.cli
   
   # Linux
   sudo apt install gh
   
   # Authenticate with your GitHub Enterprise Server
   gh auth login --hostname your-enterprise-server.com
   ```

2. **Node.js** project with a `package.json`

3. **GitHub Enterprise Server** with GitHub Pages enabled (check with your administrator)

## Usage

Navigate to your project directory and run:

```bash
# Using global installation
gh-deploy

# Or the short alias
ghd

# Using npx
npx gh-pages-auto-deploy
```

### First Run Setup

On your first run, you'll be prompted to configure your deployment repository:

```bash
$ gh-deploy
🏢 Connected to GitHub Enterprise Server: your-enterprise-server.com
🔧 First time setup - configuring deployment repository...

We'll create a repository to store all your preview deployments.
Each deployment will be a separate branch in this repository.
🏢 GitHub Enterprise Server: your-enterprise-server.com

Repository name (default: gh-pages-previews): my-previews
🚀 Creating repository username/my-previews...
💾 Configuration saved to ~/.ghd-config.json
```

**Important**: If you see an error about GitHub.com authentication, make sure you're authenticated with your enterprise server:

```bash
gh auth login --hostname your-enterprise-server.com
```

### Configuration Management

```bash
# View current configuration
gh-deploy --config --show

# Reset and reconfigure
gh-deploy --config --reset
gh-deploy --config

# Get help
gh-deploy --help
```

## What it does

1. **One-time setup**:
   - Prompts for deployment repository name (e.g., `gh-pages-previews`)
   - Creates the repository in your personal GitHub space
   - Saves configuration to `~/.ghd-config.json`

2. **For each deployment**:
   - Detects your project type (Next.js, Vite, CRA, generic)
   - **Automatically configures base path** for correct asset loading
   - Handles build configuration automatically
   - Creates unique branch name (e.g., `my-app-20250718-1423-a1b2c3`)
   - Builds your project locally with correct paths
   - Pushes only build files to the new branch
   - **Restores original configuration** after build
   - Enables GitHub Pages automatically

3. **Result**:
   - All your deployments organized in one repository
   - Each deployment accessible via branch-specific URL
   - Clean, shareable preview links
   - No impact on your working repository

## Example Output

```
🚀 Starting GitHub Pages deployment...

📦 Detected Next.js project (next.config.js)
🔧 Setting up temporary deployment repository...
🚀 Creating new GitHub repository: my-nextjs-app-preview-20250718-1423-a1b2c3
✅ Repository created: https://github.com/username/my-nextjs-app-preview-20250718-1423-a1b2c3
🔨 Building project using: npm run build
✅ Build completed. Output in: out
📦 Preparing deployment files...
📤 Pushing to GitHub...
📄 Enabling GitHub Pages...

🎉 Deployment complete!
🔗 Your preview site: https://username.github.io/my-nextjs-app-preview-20250718-1423-a1b2c3
📦 GitHub repository: https://github.com/username/my-nextjs-app-preview-20250718-1423-a1b2c3
⏱️  Note: It may take a few minutes for GitHub Pages to update

💡 Tip: You can share the preview URL with others to showcase your work!
```

## Supported Project Types

## Automatic Base Path Configuration

The tool automatically handles base path configuration for different frameworks to ensure assets load correctly in the subdirectory deployment:

### Next.js
- Temporarily modifies `next.config.js/ts` to add `basePath` and `assetPrefix`
- Sets up static export configuration
- Restores original config after build

### Vite
- Temporarily modifies `vite.config.js/ts` to set the `base` option
- Creates temporary config if none exists
- Restores original config after build

### Create React App
- Temporarily sets `PUBLIC_URL` environment variable in `.env.local`
- Restores original environment after build

### Generic Projects
- Provides informational message about manual asset path configuration
- Works with any project that generates static files

**Important**: All configuration changes are temporary and automatically restored after the build completes, ensuring your working repository remains unchanged.

## Configuration

The tool stores configuration in `~/.ghd-config.json` and automatically handles enterprise-specific settings:

- **Build command**: Uses `npm run build` (ensure this script exists in your `package.json`)
- **Output directory**: Auto-detected based on project type
- **Repository naming**: `{project-name}-{timestamp}-{random}`
- **Repository type**: Public repository in your enterprise server
- **Enterprise hostname**: Automatically detected and stored
- **No impact**: Your working repository remains completely untouched

## Troubleshooting

### GitHub CLI not found
```bash
# Install GitHub CLI first
brew install gh  # macOS
# or visit https://cli.github.com/
```

### Not authenticated with enterprise server
```bash
gh auth login --hostname your-enterprise-server.com
```

### Wrong GitHub instance
If you see "This tool only works with GitHub Enterprise Server":
```bash
# Check current authentication
gh auth status

# Switch to enterprise if needed
gh auth login --hostname your-enterprise-server.com
```

### Build fails
- Ensure `npm run build` script exists in your `package.json`
- Check that all dependencies are installed (`npm install`)
- Verify your project builds locally

### GitHub Pages not working
- Check repository settings → Pages in your enterprise server
- Contact your administrator about Pages configuration
- Some enterprise instances have custom Pages setups
- Manual enablement may be required

## Advanced Usage

### Custom Build Commands
If your project uses a different build command, update your `package.json`:

```json
{
  "scripts": {
    "build": "your-custom-build-command"
  }
}
```

### Next.js Configuration
For Next.js projects on enterprise server, ensure your `next.config.js` works with static export:

```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  trailingSlash: true,
  images: {
    unoptimized: true
  }
  // The tool will automatically add basePath and assetPrefix during deployment
}

module.exports = nextConfig
```

## Enterprise Security Considerations

- All deployments respect your enterprise server's access controls
- Repository creation follows your organization's policies
- Branch access is governed by your enterprise permissions
- Pages visibility depends on your enterprise Pages configuration

## Limitations

- **GitHub.com not supported** - Enterprise Server only
- **Pages URL structure** varies by enterprise configuration
- **Manual Pages setup** may be required on some enterprise instances
- **Custom domains** for Pages not automatically configured

## Enterprise GitHub

This tool is designed exclusively for GitHub Enterprise Server environments and will not work with GitHub.com.

### Authentication Management

```bash
# Check current authentication status
gh auth status

# Authenticate with your enterprise server
gh auth login --hostname your-enterprise-server.com

# Verify enterprise authentication
gh api user --hostname your-enterprise-server.com
```

### Enterprise-Specific Benefits

- **Secure internal sharing** within your organization
- **Respects enterprise policies** and access controls
- **Integration with enterprise SSO** and authentication
- **Private preview sharing** with enterprise colleagues
- **Compliance** with enterprise security requirements

## License

MIT License - see LICENSE file for details.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## Support

- 🐛 [Report bugs](https://github.com/yourusername/gh-pages-auto-deploy/issues)
- 💡 [Request features](https://github.com/yourusername/gh-pages-auto-deploy/issues)
- 📖 [Documentation](https://github.com/yourusername/gh-pages-auto-deploy#readme)