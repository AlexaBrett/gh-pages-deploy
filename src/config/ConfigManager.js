const fs = require('fs');
const path = require('path');
const os = require('os');
const PromptUtil = require('../utils/prompt');
const GitHubUtil = require('../utils/github');
const { execSync } = require('child_process');

class ConfigManager {
  constructor() {
    this.configPath = path.join(os.homedir(), '.ghd-config.json');
    this.config = this.loadConfig();
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

  getProjectKey(cwd) {
    // Create a unique key for this project based on the directory path
    return path.resolve(cwd);
  }

  getLastEnvironment(cwd) {
    const projectKey = this.getProjectKey(cwd);
    return this.config?.projectEnvironments?.[projectKey];
  }

  saveLastEnvironment(cwd, environment) {
    const projectKey = this.getProjectKey(cwd);
    
    if (!this.config.projectEnvironments) {
      this.config.projectEnvironments = {};
    }
    
    this.config.projectEnvironments[projectKey] = environment;
    this.saveConfig(this.config);
  }

  getProjectName(cwd) {
    const projectKey = this.getProjectKey(cwd);
    return this.config?.projectNames?.[projectKey];
  }

  saveProjectName(cwd, projectName) {
    const projectKey = this.getProjectKey(cwd);
    
    if (!this.config.projectNames) {
      this.config.projectNames = {};
    }
    
    this.config.projectNames[projectKey] = projectName;
    this.saveConfig(this.config);
  }

  async setupConfig(hostname, packageJson, cwd) {
    console.log('🔧 First time setup - configuring deployment repository...\n');
    
    const username = GitHubUtil.getGitHubUsername(hostname);
    const defaultRepoName = 'gh-pages-previews';
    
    console.log(`We'll create a repository to store all your preview deployments.`);
    console.log(`Each deployment will be a separate branch in this repository.`);
    console.log(`🏢 GitHub Enterprise Server: ${hostname}\n`);
    
    // Ask for project name
    const currentProjectName = packageJson.name || path.basename(cwd);
    const projectName = await PromptUtil.promptUser(
      `Project name for branch naming (default: ${currentProjectName}): `,
      currentProjectName
    );
    
    // Ask for repository name
    const repoName = await PromptUtil.promptUser(
      `Repository name (default: ${defaultRepoName}): `,
      defaultRepoName
    );
    
    // Ask for auto-cleanup preference
    const autoCleanup = await PromptUtil.promptUser(
      `Enable automatic cleanup of branches older than 4 months? (y/N): `,
      'N'
    );
    
    // Check if repo already exists
    const repoExists = await GitHubUtil.checkRepoExists(hostname, username, repoName);
    
    if (repoExists) {
      console.log(`✅ Repository ${username}/${repoName} already exists, will use it.`);
    } else {
      console.log(`🚀 Creating repository ${username}/${repoName}...`);
      await this.createDeploymentRepo(hostname, username, repoName);
    }
    
    const config = {
      username,
      repository: repoName,
      hostname: hostname,
      createdAt: new Date().toISOString(),
      projectNames: {},
      autoCleanup: autoCleanup.toLowerCase() === 'y' || autoCleanup.toLowerCase() === 'yes'
    };
    
    // Store project name for this specific project
    const projectKey = this.getProjectKey(cwd);
    config.projectNames[projectKey] = projectName;
    
    this.saveConfig(config);
    this.config = config;
    
    console.log(`💾 Configuration saved to ${this.configPath}`);
    console.log(`📛 Project name "${projectName}" saved for this repository\n`);
    
    return config;
  }

  async createDeploymentRepo(hostname, username, repoName) {
    try {
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

  async updateConfig(packageJson, cwd) {
    console.log('🔧 Updating configuration...\n');
    console.log(`Current project name: ${this.getProjectName(cwd) || 'Not set'}`);
    console.log(`Auto-cleanup enabled: ${this.config.autoCleanup ? 'Yes' : 'No'}`);
    
    const defaultProjectName = this.getProjectName(cwd) || packageJson.name || path.basename(cwd);
    const projectName = await PromptUtil.promptUser(
      `Project name for branch naming (default: ${defaultProjectName}): `,
      defaultProjectName
    );
    
    const currentAutoCleanup = this.config.autoCleanup ? 'y' : 'N';
    const autoCleanup = await PromptUtil.promptUser(
      `Enable automatic cleanup of branches older than 4 months? (y/N): `,
      currentAutoCleanup
    );
    
    this.saveProjectName(cwd, projectName);
    this.config.autoCleanup = autoCleanup.toLowerCase() === 'y' || autoCleanup.toLowerCase() === 'yes';
    this.saveConfig(this.config);
    
    console.log(`📛 Project name "${projectName}" updated for this repository`);
    console.log(`🧹 Auto-cleanup ${this.config.autoCleanup ? 'enabled' : 'disabled'}`);
    console.log('✅ Configuration updated successfully!');
  }

  showConfig() {
    console.log('📋 Current configuration:');
    if (this.config) {
      const config = { ...this.config };
      
      console.log(`🏢 Repository: ${config.username}/${config.repository}`);
      console.log(`🌐 Enterprise Server: ${config.hostname}`);
      console.log(`🧹 Auto-cleanup: ${config.autoCleanup ? 'Enabled' : 'Disabled'}`);
      console.log(`📅 Created: ${new Date(config.createdAt).toLocaleDateString()}`);
      
      if (config.projectNames && Object.keys(config.projectNames).length > 0) {
        console.log('\n🏷️  Project names per directory:');
        Object.entries(config.projectNames).forEach(([dir, name]) => {
          console.log(`   ${path.basename(dir)}: ${name}`);
        });
      }
      
      console.log('\n📄 Full configuration:');
      console.log(JSON.stringify(config, null, 2));
    } else {
      console.log('No configuration found. Run without --config to set up.');
    }
  }

  resetConfig() {
    if (fs.existsSync(this.configPath)) {
      fs.unlinkSync(this.configPath);
      console.log('🗑️  Configuration reset. Run the command again to set up a new configuration.');
    } else {
      console.log('No configuration file found.');
    }
  }
}

module.exports = ConfigManager;