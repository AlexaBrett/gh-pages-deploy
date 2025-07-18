#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync, spawn } = require('child_process');
const crypto = require('crypto');

class GitHubPagesDeployer {
  constructor() {
    this.cwd = process.cwd();
    this.configPath = path.join(os.homedir(), '.ghd-config.json');
    this.packageJson = this.loadPackageJson();
    this.buildConfig = this.detectBuildConfig();
    this.config = this.loadConfig();
    this.branchName = this.generateBranchName();
  }

  loadPackageJson() {
    try {
      return JSON.parse(fs.readFileSync(path.join(this.cwd, 'package.json'), 'utf8'));
    } catch (error) {
      throw new Error('No package.json found. Are you in an npm project?');
    }
  }

  detectBuildConfig() {
    const configs = {
      next: this.findNextConfig(),
      vite: this.findViteConfig(),
      react: this.findReactConfig(),
      generic: this.findGenericConfig()
    };

    // Priority: Next.js > Vite > Create React App > Generic
    if (configs.next) return configs.next;
    if (configs.vite) return configs.vite;
    if (configs.react) return configs.react;
    return configs.generic;
  }

  findGenericConfig() {
    // Try to infer from common build directories and package.json scripts
    const commonDirs = ['dist', 'build', 'public', 'out', '_site', 'docs'];
    const buildScript = this.packageJson.scripts?.build;
    
    // Check if build script specifies an output directory
    if (buildScript) {
      for (const dir of commonDirs) {
        if (buildScript.includes(dir)) {
          console.log(`📦 Detected generic project with inferred output: ${dir}`);
          return {
            framework: 'generic',
            buildCommand: 'npm run build',
            outputDir: dir
          };
        }
      }
    }
    
    // Check which common directories exist after a potential build
    const existingDirs = commonDirs.filter(dir => fs.existsSync(path.join(this.cwd, dir)));
    if (existingDirs.length > 0) {
      console.log(`📦 Detected generic project, found existing directory: ${existingDirs[0]}`);
      return {
        framework: 'generic',
        buildCommand: 'npm run build',
        outputDir: existingDirs[0]
      };
    }
    
    console.log(`📦 Detected generic project`);
    return {
      framework: 'generic',
      buildCommand: 'npm run build',
      outputDir: 'dist' // Final fallback
    };
  }

  findNextConfig() {
    const configFiles = ['next.config.js', 'next.config.ts', 'next.config.mjs'];
    const configFile = configFiles.find(file => fs.existsSync(path.join(this.cwd, file)));
    
    if (configFile) {
      console.log(`📦 Detected Next.js project (${configFile})`);
      
      // Try to parse the config to find output directory
      const outputDir = this.parseNextConfig(configFile);
      
      return {
        framework: 'next',
        buildCommand: 'npm run build',
        outputDir: outputDir || 'out', // fallback to 'out'
        requiresExport: true,
        configFile: configFile
      };
    }
    return null;
  }

  parseNextConfig(configFile) {
    try {
      const configPath = path.join(this.cwd, configFile);
      const configContent = fs.readFileSync(configPath, 'utf8');
      
      // Look for distDir configuration
      const distDirMatch = configContent.match(/distDir\s*:\s*['"`]([^'"`]+)['"`]/);
      if (distDirMatch) {
        console.log(`📁 Found custom distDir: ${distDirMatch[1]}`);
        return distDirMatch[1];
      }
      
      // Check if output is 'export' (static export)
      const outputMatch = configContent.match(/output\s*:\s*['"`]export['"`]/);
      if (outputMatch) {
        // For static export, check for custom outDir or default to 'out'
        const outDirMatch = configContent.match(/outDir\s*:\s*['"`]([^'"`]+)['"`]/);
        if (outDirMatch) {
          console.log(`📁 Found custom outDir for export: ${outDirMatch[1]}`);
          return outDirMatch[1];
        }
        return 'out'; // Default for Next.js static export
      }
      
      // If no static export, default build goes to .next
      return '.next';
    } catch (error) {
      console.log(`⚠️  Could not parse ${configFile}, using default output directory`);
      return 'out';
    }
  }

  findViteConfig() {
    const configFiles = ['vite.config.js', 'vite.config.ts', 'vitest.config.js', 'vitest.config.ts'];
    const configFile = configFiles.find(file => fs.existsSync(path.join(this.cwd, file)));
    
    if (configFile || this.packageJson.devDependencies?.vite) {
      console.log(`⚡ Detected Vite project${configFile ? ` (${configFile})` : ''}`);
      
      // Try to parse the config to find output directory
      const outputDir = configFile ? this.parseViteConfig(configFile) : 'dist';
      
      return {
        framework: 'vite',
        buildCommand: 'npm run build',
        outputDir: outputDir || 'dist',
        configFile: configFile
      };
    }
    return null;
  }

  parseViteConfig(configFile) {
    try {
      const configPath = path.join(this.cwd, configFile);
      const configContent = fs.readFileSync(configPath, 'utf8');
      
      // Look for build.outDir configuration
      const outDirMatch = configContent.match(/build\s*:\s*{[^}]*outDir\s*:\s*['"`]([^'"`]+)['"`]/s) ||
                         configContent.match(/outDir\s*:\s*['"`]([^'"`]+)['"`]/);
      
      if (outDirMatch) {
        console.log(`📁 Found custom outDir: ${outDirMatch[1]}`);
        return outDirMatch[1];
      }
      
      return 'dist'; // Vite default
    } catch (error) {
      console.log(`⚠️  Could not parse ${configFile}, using default output directory`);
      return 'dist';
    }
  }

  findReactConfig() {
    if (this.packageJson.dependencies?.['react-scripts']) {
      console.log(`⚛️  Detected Create React App project`);
      
      // Check for custom build directory in package.json
      const outputDir = this.parseReactConfig();
      
      return {
        framework: 'react',
        buildCommand: 'npm run build',
        outputDir: outputDir || 'build'
      };
    }
    return null;
  }

  parseReactConfig() {
    try {
      // Check package.json for BUILD_PATH environment variable or custom scripts
      const buildScript = this.packageJson.scripts?.build;
      
      if (buildScript) {
        // Look for BUILD_PATH=customdir in build script
        const buildPathMatch = buildScript.match(/BUILD_PATH=([^\s]+)/);
        if (buildPathMatch) {
          console.log(`📁 Found custom BUILD_PATH: ${buildPathMatch[1]}`);
          return buildPathMatch[1];
        }
      }
      
      // Check for .env files that might contain BUILD_PATH
      const envFiles = ['.env', '.env.local', '.env.production', '.env.production.local'];
      for (const envFile of envFiles) {
        const envPath = path.join(this.cwd, envFile);
        if (fs.existsSync(envPath)) {
          const envContent = fs.readFileSync(envPath, 'utf8');
          const buildPathMatch = envContent.match(/BUILD_PATH=([^\s\n]+)/);
          if (buildPathMatch) {
            console.log(`📁 Found BUILD_PATH in ${envFile}: ${buildPathMatch[1]}`);
            return buildPathMatch[1];
          }
        }
      }
      
      return 'build'; // Create React App default
    } catch (error) {
      console.log(`⚠️  Could not parse React configuration, using default output directory`);
      return 'build';
    }
  }

  loadConfig() {
    try {
      if (fs.existsSync(this.configPath)) {
        const config = JSON.parse(fs.readFileSync(this.configPath, 'utf8'));
        return config;
      }
    } catch (error) {
      console.log('⚠️  Config file corrupted, will recreate');
    }
    return null;
  }

  saveConfig(config) {
    try {
      fs.writeFileSync(this.configPath, JSON.stringify(config, null, 2));
      return true;
    } catch (error) {
      console.error('❌ Failed to save config:', error.message);
      return false;
    }
  }

  getProjectKey() {
    // Create a unique key for this project based on the directory path
    // This allows us to store environment preferences per project
    return path.resolve(this.cwd);
  }

  getLastEnvironment() {
    const projectKey = this.getProjectKey();
    return this.config.projectEnvironments?.[projectKey];
  }

  saveLastEnvironment(environment) {
    const projectKey = this.getProjectKey();
    
    // Initialize projectEnvironments if it doesn't exist
    if (!this.config.projectEnvironments) {
      this.config.projectEnvironments = {};
    }
    
    // Save the environment for this specific project
    this.config.projectEnvironments[projectKey] = environment;
    
    // Save the updated config
    this.saveConfig(this.config);
  }

  async setupConfig() {
    console.log('🔧 First time setup - configuring deployment repository...\n');
    
    const username = this.getGitHubUsername();
    const defaultRepoName = 'gh-pages-previews';
    
    console.log(`We'll create a repository to store all your preview deployments.`);
    console.log(`Each deployment will be a separate branch in this repository.`);
    console.log(`🏢 GitHub Enterprise Server: ${this.enterpriseHostname}\n`);
    
    // Ask for repository name
    const repoName = await this.promptUser(
      `Repository name (default: ${defaultRepoName}): `,
      defaultRepoName
    );
    
    // Check if repo already exists
    const repoExists = await this.checkRepoExists(username, repoName);
    
    if (repoExists) {
      console.log(`✅ Repository ${username}/${repoName} already exists, will use it.`);
    } else {
      console.log(`🚀 Creating repository ${username}/${repoName}...`);
      await this.createDeploymentRepo(repoName);
    }
    
    const config = {
      username,
      repository: repoName,
      hostname: this.enterpriseHostname,
      createdAt: new Date().toISOString()
    };
    
    this.saveConfig(config);
    console.log(`💾 Configuration saved to ${this.configPath}\n`);
    
    return config;
  }

  async promptUser(question, defaultValue = '') {
    const readline = require('readline');
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    
    return new Promise((resolve) => {
      rl.question(question, (answer) => {
        rl.close();
        const trimmedAnswer = answer.trim();
        resolve(trimmedAnswer || defaultValue);
      });
    });
  }

  async checkRepoExists(username, repoName) {
    try {
      const hostname = this.enterpriseHostname || this.config?.hostname;
      if (!hostname) {
        throw new Error('No enterprise hostname configured');
      }
      
      // Use GH_HOST environment variable for enterprise operations
      const env = { ...process.env, GH_HOST: hostname };
      execSync(`gh repo view ${username}/${repoName}`, { stdio: 'ignore', env });
      return true;
    } catch (error) {
      return false;
    }
  }

  async createDeploymentRepo(repoName) {
    try {
      const hostname = this.enterpriseHostname || this.config?.hostname;
      if (!hostname) {
        throw new Error('No enterprise hostname configured');
      }
      
      // Use GH_HOST environment variable for enterprise operations
      const env = { ...process.env, GH_HOST: hostname };
      
      // Create the repository
      execSync(`gh repo create ${repoName} --public --description "Auto-deployed previews from gh-pages-auto-deploy"`, { 
        stdio: 'inherit',
        env
      });
      
      // Clone it to set up initial structure
      const tempDir = path.join(os.tmpdir(), `setup-${Date.now()}`);
      const username = this.getGitHubUsername();
      const repoUrl = `https://${hostname}/${username}/${repoName}.git`;
      
      execSync(`git clone ${repoUrl} ${tempDir}`);
      
      // Create initial README
      const pagesBaseUrl = `https://${hostname}/pages/${username}/${repoName}`;
        
      const readmeContent = `# Preview Deployments

This repository contains auto-deployed previews created with \`gh-pages-auto-deploy\`.

Each branch represents a different deployment:
- Branch names follow the pattern: \`{project-name}-{timestamp}-{hash}\`
- Each branch is automatically deployed to GitHub Pages
- View deployments at: ${pagesBaseUrl}/

## Branches
This will be updated automatically as you create new deployments.

## GitHub Enterprise Server
This repository is configured for GitHub Enterprise Server: ${hostname}
`;
      
      fs.writeFileSync(path.join(tempDir, 'README.md'), readmeContent);
      
      execSync('git add README.md', { cwd: tempDir });
      execSync('git commit -m "Initial setup for preview deployments"', { cwd: tempDir });
      execSync('git push origin main', { cwd: tempDir });
      
      // Cleanup
      fs.rmSync(tempDir, { recursive: true, force: true });
      
    } catch (error) {
      throw new Error(`Failed to create deployment repository: ${error.message}`);
    }
  }

  generateBranchName() {
    const baseName = this.packageJson.name || path.basename(this.cwd) || 'project';
    const timestamp = new Date().toISOString().slice(0, 16).replace(/[-:]/g, '').replace('T', '-');
    const randomId = crypto.randomBytes(3).toString('hex');
    
    // Clean the base name (remove npm scope, special chars)
    const cleanBaseName = baseName.replace(/^@[^/]+\//, '').replace(/[^a-zA-Z0-9-]/g, '-');
    
    return `${cleanBaseName}-${timestamp}-${randomId}`;
  }

  async checkGitHubCLI() {
    try {
      execSync('gh --version', { stdio: 'ignore' });
      return true;
    } catch (error) {
      console.error('❌ GitHub CLI (gh) is required but not installed.');
      console.log('📋 Install it from: https://cli.github.com/');
      return false;
    }
  }

  async checkAuthentication() {
    try {
      // Check if authenticated with any GitHub instance
      const result = execSync('gh auth status', { encoding: 'utf8', stdio: 'pipe' });
      
      // Extract hostname from auth status - must be enterprise (not github.com)
      const hostnameMatch = result.match(/Logged in to ([^\s]+)/);
      if (!hostnameMatch) {
        throw new Error('Could not determine GitHub hostname from authentication');
      }
      
      const hostname = hostnameMatch[1];
      if (hostname === 'github.com') {
        console.error('❌ This tool only works with GitHub Enterprise Server.');
        console.log('🏢 Please authenticate with your GitHub Enterprise Server instance:');
        console.log('   gh auth login --hostname your-enterprise-server.com');
        return false;
      }
      
      this.enterpriseHostname = hostname;
      console.log(`🏢 Connected to GitHub Enterprise Server: ${this.enterpriseHostname}`);
      
      return true;
    } catch (error) {
      console.error('❌ Not authenticated with GitHub Enterprise Server.');
      console.log('🔑 Please authenticate with your GitHub Enterprise Server instance:');
      console.log('   gh auth login --hostname your-enterprise-server.com');
      return false;
    }
  }

  async ensureGitRepo() {
    // We'll create a temporary git repo just for deployment
    this.tempDir = path.join(os.tmpdir(), `gh-deploy-${Date.now()}`);
    fs.mkdirSync(this.tempDir, { recursive: true });
    
    console.log('🔧 Setting up temporary deployment repository...');
    execSync('git init', { cwd: this.tempDir });
    
    // Set up git config in temp directory
    execSync('git config user.name "GitHub Deploy Bot"', { cwd: this.tempDir });
    execSync('git config user.email "deploy@github.local"', { cwd: this.tempDir });
    
    // Add the remote to our temp directory - always enterprise
    const hostname = this.config.hostname;
    if (!hostname) {
      throw new Error('No enterprise hostname configured');
    }
    
    const repoUrl = `https://${hostname}/${this.config.username}/${this.config.repository}.git`;
    execSync(`git remote add origin ${repoUrl}`, { cwd: this.tempDir });
  }

  getGitHubUsername() {
    try {
      const hostname = this.enterpriseHostname || this.config?.hostname;
      const env = hostname ? { ...process.env, GH_HOST: hostname } : process.env;
      
      const result = execSync('gh api user --jq .login', { encoding: 'utf8', env }).trim();
      return result;
    } catch (error) {
      throw new Error('Could not get GitHub username. Make sure you are authenticated with GitHub CLI.');
    }
  }

  async buildProject() {
    console.log(`🔨 Building project using: ${this.buildConfig.buildCommand}`);
    
    // Calculate the base path for GitHub Pages
    const basePath = `/${this.config.repository}/${this.branchName}`;
    
    // Handle framework-specific base path configuration
    await this.configureBasePath(basePath);
    
    try {
      execSync(this.buildConfig.buildCommand, { 
        cwd: this.cwd, 
        stdio: 'inherit' 
      });
    } catch (error) {
      throw new Error(`Build failed: ${error.message}`);
    } finally {
      // Restore original configuration
      await this.restoreOriginalConfig();
    }

    // Verify build output exists
    const outputPath = path.join(this.cwd, this.buildConfig.outputDir);
    if (!fs.existsSync(outputPath)) {
      throw new Error(`Build output directory '${this.buildConfig.outputDir}' not found`);
    }

    console.log(`✅ Build completed. Output in: ${this.buildConfig.outputDir}`);
  }

  async configureBasePath(basePath) {
    this.originalConfigs = {}; // Store original configs for restoration
    
    console.log(`🔧 Configuring base path: ${basePath}`);
    
    switch (this.buildConfig.framework) {
      case 'next':
        await this.configureNextJsBasePath(basePath);
        break;
      case 'vite':
        await this.configureViteBasePath(basePath);
        break;
      case 'react':
        await this.configureReactBasePath(basePath);
        break;
      default:
        console.log('ℹ️  Generic project - you may need to manually configure asset paths');
    }
  }

  async configureNextJsBasePath(basePath) {
    const configFiles = ['next.config.js', 'next.config.ts', 'next.config.mjs'];
    const configFile = configFiles.find(file => fs.existsSync(path.join(this.cwd, file)));
    
    if (configFile) {
      // Read original config
      const configPath = path.join(this.cwd, configFile);
      const originalContent = fs.readFileSync(configPath, 'utf8');
      this.originalConfigs[configFile] = originalContent;
      
      // Create modified config
      const tempConfig = `/** @type {import('next').NextConfig} */
const originalConfig = (() => {
${originalContent.replace(/module\.exports\s*=/, 'return').replace(/export\s+default/, 'return')}
})();

const modifiedConfig = {
  ...originalConfig,
  output: 'export',
  basePath: '${basePath}',
  assetPrefix: '${basePath}',
  trailingSlash: true,
  images: {
    ...originalConfig.images,
    unoptimized: true
  }
};

module.exports = modifiedConfig;`;
      
      fs.writeFileSync(configPath, tempConfig);
      console.log(`📝 Temporarily modified ${configFile} for deployment`);
    } else {
      // Create temporary config
      const tempConfig = `/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  basePath: '${basePath}',
  assetPrefix: '${basePath}',
  trailingSlash: true,
  images: {
    unoptimized: true
  }
};

module.exports = nextConfig;`;
      
      fs.writeFileSync(path.join(this.cwd, 'next.config.js'), tempConfig);
      this.originalConfigs['next.config.js'] = null; // Mark for deletion
      console.log('📝 Created temporary next.config.js for deployment');
    }
  }

  async configureViteBasePath(basePath) {
    const configFiles = ['vite.config.js', 'vite.config.ts'];
    let configFile = configFiles.find(file => fs.existsSync(path.join(this.cwd, file)));
    
    if (configFile) {
      // Read original config
      const configPath = path.join(this.cwd, configFile);
      const originalContent = fs.readFileSync(configPath, 'utf8');
      this.originalConfigs[configFile] = originalContent;
      
      // Modify existing config to add base path
      let modifiedContent = originalContent;
      
      // Try to add base to existing config object
      if (modifiedContent.includes('export default')) {
        // Handle ES modules export
        modifiedContent = modifiedContent.replace(
          /export default\s+(?:defineConfig\s*\()?(\{[\s\S]*?\})(?:\))?/,
          `export default defineConfig({
  base: '${basePath}',
  ...$1
})`
        );
      } else {
        // Handle CommonJS or other formats - inject base at the beginning
        modifiedContent = modifiedContent.replace(
          /(defineConfig\s*\(\s*\{)/,
          `$1\n  base: '${basePath}',`
        );
      }
      
      // Ensure defineConfig is imported
      if (!modifiedContent.includes('defineConfig')) {
        modifiedContent = `import { defineConfig } from 'vite';\n${modifiedContent}`;
      }
      
      fs.writeFileSync(configPath, modifiedContent);
      console.log(`📝 Temporarily modified ${configFile} for deployment`);
    } else {
      // Create temporary config
      const isTypeScript = fs.existsSync(path.join(this.cwd, 'tsconfig.json'));
      configFile = isTypeScript ? 'vite.config.ts' : 'vite.config.js';
      
      const tempConfig = `import { defineConfig } from 'vite';

export default defineConfig({
  base: '${basePath}',
  build: {
    outDir: 'dist'
  }
});`;
      
      fs.writeFileSync(path.join(this.cwd, configFile), tempConfig);
      this.originalConfigs[configFile] = null; // Mark for deletion
      console.log(`📝 Created temporary ${configFile} for deployment`);
    }
  }

  async configureReactBasePath(basePath) {
    // For Create React App, we use the PUBLIC_URL environment variable
    const envPath = path.join(this.cwd, '.env.local');
    const envExists = fs.existsSync(envPath);
    
    if (envExists) {
      const originalContent = fs.readFileSync(envPath, 'utf8');
      this.originalConfigs['.env.local'] = originalContent;
      
      // Add or update PUBLIC_URL
      let modifiedContent = originalContent;
      if (modifiedContent.includes('PUBLIC_URL=')) {
        modifiedContent = modifiedContent.replace(/PUBLIC_URL=.*$/m, `PUBLIC_URL=${basePath}`);
      } else {
        modifiedContent += `\nPUBLIC_URL=${basePath}\n`;
      }
      
      fs.writeFileSync(envPath, modifiedContent);
    } else {
      // Create temporary .env.local
      fs.writeFileSync(envPath, `PUBLIC_URL=${basePath}\n`);
      this.originalConfigs['.env.local'] = null; // Mark for deletion
    }
    
    console.log('📝 Temporarily set PUBLIC_URL for Create React App deployment');
  }

  async restoreOriginalConfig() {
    if (!this.originalConfigs) return;
    
    console.log('🔄 Restoring original configuration files...');
    
    for (const [filename, originalContent] of Object.entries(this.originalConfigs)) {
      const filePath = path.join(this.cwd, filename);
      
      if (originalContent === null) {
        // File was created temporarily, delete it
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
          console.log(`🗑️  Removed temporary ${filename}`);
        }
      } else {
        // File was modified, restore original
        fs.writeFileSync(filePath, originalContent);
        console.log(`↩️  Restored ${filename}`);
      }
    }
    
    this.originalConfigs = {};
  }

  async deployToGitHub() {
    const outputPath = path.join(this.cwd, this.buildConfig.outputDir);
    
    console.log(`📦 Preparing deployment to branch: ${this.branchName}`);
    
    // Create orphan branch for this deployment
    execSync(`git checkout --orphan ${this.branchName}`, { cwd: this.tempDir });
    
    // Copy build output to temp directory
    this.copyDirectory(outputPath, this.tempDir);
    
    // Handle environment config replacement
    await this.handleEnvironmentConfig();
    
    // Create .nojekyll for GitHub Pages
    fs.writeFileSync(path.join(this.tempDir, '.nojekyll'), '');
    
    // Create a simple index redirect if no index.html exists
    if (!fs.existsSync(path.join(this.tempDir, 'index.html'))) {
      console.log('📄 No index.html found, creating redirect...');
      const indexFiles = fs.readdirSync(this.tempDir).filter(f => f.endsWith('.html'));
      if (indexFiles.length > 0) {
        const redirectHtml = `<!DOCTYPE html>
<html>
<head>
  <meta http-equiv="refresh" content="0; url=${indexFiles[0]}">
  <title>Redirecting...</title>
</head>
<body>
  <p>Redirecting to <a href="${indexFiles[0]}">${indexFiles[0]}</a>...</p>
</body>
</html>`;
        fs.writeFileSync(path.join(this.tempDir, 'index.html'), redirectHtml);
      }
    }
    
    // Add deployment info
    const deployInfo = {
      project: this.packageJson.name || 'Unknown',
      deployedAt: new Date().toISOString(),
      branch: this.branchName,
      buildConfig: this.buildConfig.framework || 'generic'
    };
    fs.writeFileSync(path.join(this.tempDir, 'deploy-info.json'), JSON.stringify(deployInfo, null, 2));
    
    // Add and commit
    execSync('git add .', { cwd: this.tempDir });
    execSync(`git commit -m "Deploy ${this.packageJson.name || 'project'} - ${this.branchName}"`, { cwd: this.tempDir });
    
    console.log('📤 Pushing to GitHub...');
    execSync(`git push -u origin ${this.branchName}`, { cwd: this.tempDir });
  }

  async handleEnvironmentConfig() {
    console.log('🔧 Checking for environment configuration...');
    
    // Check if env-content-* folders exist
    const envDirs = fs.readdirSync(this.cwd).filter(dir => 
      dir.startsWith('env-content-') && 
      fs.statSync(path.join(this.cwd, dir)).isDirectory()
    );
    
    if (envDirs.length === 0) {
      console.log('ℹ️  No env-content-* directories found, skipping config replacement');
      return;
    }
    
    console.log(`📁 Found environment directories: ${envDirs.join(', ')}`);
    
    // Get the previously used environment for this project
    const lastUsedEnv = this.getLastEnvironment();
    let promptText = '[PLACEHOLDER: Replace with your custom prompt text]\n';
    
    if (lastUsedEnv && envDirs.includes(lastUsedEnv)) {
      promptText += `Environment directory name (default: ${lastUsedEnv}): `;
    } else {
      promptText += 'Environment directory name: ';
    }
    
    // Prompt user for environment selection
    const userInput = await this.promptUser(promptText);
    const selectedEnv = userInput.trim() || lastUsedEnv;
    
    if (!selectedEnv) {
      console.log('ℹ️  No environment selected, skipping config replacement');
      return;
    }
    
    // Validate the selected directory exists
    const envPath = path.join(this.cwd, selectedEnv);
    if (!fs.existsSync(envPath) || !fs.statSync(envPath).isDirectory()) {
      throw new Error(`Environment directory '${selectedEnv}' does not exist`);
    }
    
    // Check if config.js exists in the selected directory
    const configSourcePath = path.join(envPath, 'config.js');
    if (!fs.existsSync(configSourcePath)) {
      throw new Error(`config.js not found in '${selectedEnv}' directory`);
    }
    
    // Check if config.js exists in the build output
    const configDestPath = path.join(this.tempDir, 'config.js');
    if (!fs.existsSync(configDestPath)) {
      console.log('⚠️  config.js not found in build output, copying anyway...');
    }
    
    // Replace the config.js file
    fs.copyFileSync(configSourcePath, configDestPath);
    console.log(`✅ Replaced config.js with version from '${selectedEnv}'`);
    
    // Save the selected environment for future use in this project
    this.saveLastEnvironment(selectedEnv);
  }

  copyDirectory(src, dest) {
    const items = fs.readdirSync(src);
    
    items.forEach(item => {
      const srcPath = path.join(src, item);
      const destPath = path.join(dest, item);
      const stat = fs.statSync(srcPath);
      
      if (stat.isDirectory()) {
        if (!fs.existsSync(destPath)) {
          fs.mkdirSync(destPath, { recursive: true });
        }
        this.copyDirectory(srcPath, destPath);
      } else {
        fs.copyFileSync(srcPath, destPath);
      }
    });
  }

  async enableGitHubPages() {
    console.log('📄 Setting up GitHub Enterprise Pages deployment...');
    
    try {
      const hostname = this.config.hostname;
      if (!hostname) {
        throw new Error('No enterprise hostname configured');
      }
      
      // Use GH_HOST environment variable for enterprise operations
      const env = { ...process.env, GH_HOST: hostname };
      
      // Try to enable GitHub Pages for the specific branch
      try {
        // First, try to enable pages with the specific branch as source
        execSync(`gh api repos/${this.config.username}/${this.config.repository}/pages -X POST -f source.branch=${this.branchName} -f source.path=/`, {
          cwd: this.tempDir,
          stdio: 'ignore',
          env
        });
        console.log(`✅ GitHub Pages enabled with source branch: ${this.branchName}`);
      } catch (error) {
        // If that fails, try to update existing pages configuration
        try {
          execSync(`gh api repos/${this.config.username}/${this.config.repository}/pages -X PUT -f source.branch=${this.branchName} -f source.path=/`, {
            cwd: this.tempDir,
            stdio: 'ignore',
            env
          });
          console.log(`✅ GitHub Pages source updated to branch: ${this.branchName}`);
        } catch (updateError) {
          console.log(`⚠️  Could not automatically configure GitHub Pages source branch`);
          console.log(`🔧 Please manually set Pages source to branch: ${this.branchName}`);
        }
      }
      
      // Generate enterprise-specific URLs
      const pagesUrl = `https://${hostname}/pages/${this.config.username}/${this.config.repository}/${this.branchName}/`;
      const repoUrl = `https://${hostname}/${this.config.username}/${this.config.repository}/tree/${this.branchName}`;
      
      console.log('\n🎉 Deployment to GitHub Enterprise Server complete!');
      console.log(`🏢 Enterprise Server: ${hostname}`);
      console.log(`🔗 Your preview site: ${pagesUrl}`);
      console.log(`🌿 Branch: ${this.branchName}`);
      console.log(`📦 GitHub branch: ${repoUrl}`);
      
      console.log('\n📋 GitHub Enterprise Server Notes:');
      console.log('• GitHub Pages URL structure may vary based on your enterprise configuration');
      console.log('• Check with your administrator if the preview URL doesn\'t work');
      console.log('• You may need to manually enable GitHub Pages in repository settings');
      console.log('• Some enterprise instances have custom Pages domains');
      
      console.log('\n💡 Tip: Share the branch URL with colleagues who can access your enterprise server!');
      
      // Update local config with last deployment info
      this.config.lastDeployment = {
        branch: this.branchName,
        url: pagesUrl,
        deployedAt: new Date().toISOString(),
        project: this.packageJson.name || 'Unknown',
        hostname: hostname
      };
      this.saveConfig(this.config);
      
    } catch (error) {
      const hostname = this.config.hostname;
      const repoUrl = `https://${hostname}/${this.config.username}/${this.config.repository}/tree/${this.branchName}`;
      
      console.log('\n⚠️  GitHub Pages setup failed, but branch was created successfully');
      console.log(`🏢 Enterprise Server: ${hostname}`);
      console.log(`🌿 Branch: ${this.branchName}`);
      console.log(`📦 GitHub branch: ${repoUrl}`);
      console.log('🔧 Manually enable GitHub Pages in your enterprise repository settings');
      console.log(`🔧 Set Pages source to branch: ${this.branchName}`);
    }
  }

  async cleanup() {
    // Clean up temporary directory
    if (this.tempDir && fs.existsSync(this.tempDir)) {
      try {
        fs.rmSync(this.tempDir, { recursive: true, force: true });
      } catch (error) {
        console.log('⚠️  Could not clean up temporary files');
      }
    }
  }

  async deploy() {
    try {
      console.log('🚀 Starting GitHub Pages deployment...\n');
      
      // Pre-flight checks
      if (!(await this.checkGitHubCLI())) return;
      if (!(await this.checkAuthentication())) return;
      
      // Check/setup configuration
      if (!this.config) {
        this.config = await this.setupConfig();
      } else {
        console.log(`📂 Using deployment repository: ${this.config.username}/${this.config.repository}`);
      }
      
      // Setup
      await this.ensureGitRepo();
      
      // Build and deploy
      await this.buildProject();
      await this.deployToGitHub();
      await this.enableGitHubPages();
      
    } catch (error) {
      console.error('❌ Deployment failed:', error.message);
      process.exit(1);
    } finally {
      await this.cleanup();
    }
  }
}

// CLI interface
if (require.main === module) {
  const args = process.argv.slice(2);
  
  if (args.includes('--config') || args.includes('-c')) {
    // Configuration management
    const deployer = new GitHubPagesDeployer();
    
    if (args.includes('--show')) {
      console.log('📋 Current configuration:');
      if (deployer.config) {
        console.log(JSON.stringify(deployer.config, null, 2));
      } else {
        console.log('No configuration found. Run without --config to set up.');
      }
    } else if (args.includes('--reset')) {
      if (fs.existsSync(deployer.configPath)) {
        fs.unlinkSync(deployer.configPath);
        console.log('🗑️  Configuration reset. Run the command again to set up a new configuration.');
      } else {
        console.log('No configuration file found.');
      }
    } else {
      deployer.setupConfig().then(() => {
        console.log('✅ Configuration updated successfully!');
      }).catch(error => {
        console.error('❌ Configuration setup failed:', error.message);
        process.exit(1);
      });
    }
  } else if (args.includes('--help') || args.includes('-h')) {
    console.log(`
GitHub Pages Auto Deploy

Usage:
  gh-deploy                Deploy current project
  gh-deploy --config       Set up or update configuration
  gh-deploy --config --show   Show current configuration
  gh-deploy --config --reset  Reset configuration
  gh-deploy --help         Show this help

Configuration is stored in: ~/.ghd-config.json

First run will automatically prompt for configuration setup.
`);
  } else {
    // Normal deployment
    const deployer = new GitHubPagesDeployer();
    deployer.deploy();
  }
}

module.exports = GitHubPagesDeployer;