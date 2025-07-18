const path = require('path');
const crypto = require('crypto');
const { execSync } = require('child_process');

const ConfigManager = require('./config/ConfigManager');
const CleanupManager = require('./cleanup/CleanupManager');
const BuildDetector = require('./build/BuildDetector');
const BuildConfigurer = require('./build/BuildConfigurer');
const GitDeployer = require('./deploy/GitDeployer');
const PagesDeployer = require('./deploy/PagesDeployer');

const GitHubUtil = require('./utils/github');
const FileUtil = require('./utils/file');
const PromptUtil = require('./utils/prompt');

class GitHubPagesDeployer {
  constructor() {
    this.cwd = process.cwd();
    this.packageJson = FileUtil.loadPackageJson(this.cwd);
    this.buildDetector = new BuildDetector(this.cwd, this.packageJson);
    this.buildConfig = this.buildDetector.detectBuildConfig();
    this.configManager = new ConfigManager();
    this.branchName = this.generateBranchName();
    this.debugMode = process.argv.includes('--debug') || process.argv.includes('-d');
    this.enterpriseHostname = null;
  }

  generateBranchName() {
    // Use stored project name, fallback to package.json name or directory name
    const baseName = this.configManager.getProjectName(this.cwd) || this.packageJson.name || path.basename(this.cwd) || 'project';
    const timestamp = new Date().toISOString().slice(0, 16).replace(/[-:]/g, '').replace('T', '-');
    const randomId = crypto.randomBytes(3).toString('hex');
    
    // Clean the base name (remove npm scope, special chars)
    const cleanBaseName = baseName.replace(/^@[^/]+\//, '').replace(/[^a-zA-Z0-9-]/g, '-');
    
    return `${cleanBaseName}-${timestamp}-${randomId}`;
  }

  async buildProject() {
    if (!this.debugMode) {
      await this.showProgress('Building project', 1000);
    } else {
      console.log(`🔨 Building project using: ${this.buildConfig.buildCommand}`);
    }
    
    // Calculate the base path for GitHub Pages (just repository name, no branch)
    const basePath = `/${this.configManager.config.repository}`;
    
    // Handle framework-specific base path configuration
    const buildConfigurer = new BuildConfigurer(this.cwd, this.buildConfig);
    await buildConfigurer.configureBasePath(basePath);
    
    try {
      const stdio = this.debugMode ? 'inherit' : 'ignore';
      execSync(this.buildConfig.buildCommand, { 
        cwd: this.cwd, 
        stdio 
      });
    } catch (error) {
      throw new Error(`Build failed: ${error.message}`);
    } finally {
      // Restore original configuration
      await buildConfigurer.restoreOriginalConfig();
    }

    // Verify build output exists
    const outputPath = path.join(this.cwd, this.buildConfig.outputDir);
    const fs = require('fs');
    if (!fs.existsSync(outputPath)) {
      throw new Error(`Build output directory '${this.buildConfig.outputDir}' not found`);
    }

    this.log(`✅ Build completed. Output in: ${this.buildConfig.outputDir}`);
  }

  async showProgress(message, duration = 1000) {
    if (!this.debugMode) {
      process.stdout.write(`${message}... `);
      return new Promise(resolve => {
        const spinner = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
        let i = 0;
        const interval = setInterval(() => {
          process.stdout.write(`\r${message}... ${spinner[i++ % spinner.length]}`);
        }, 100);
        
        setTimeout(() => {
          clearInterval(interval);
          process.stdout.write(`\r${message}... ✅\n`);
          resolve();
        }, duration);
      });
    }
  }

  log(message) {
    if (this.debugMode) {
      console.log(message);
    }
  }

  async deploy() {
    let gitDeployer = null;
    
    try {
      console.log('🚀 Starting GitHub Pages deployment...\n');
      
      // Pre-flight checks
      if (!(await GitHubUtil.checkGitHubCLI())) return;
      
      this.enterpriseHostname = await GitHubUtil.checkAuthentication();
      if (!this.enterpriseHostname) return;
      
      this.log(`🏢 Connected to GitHub Enterprise Server: ${this.enterpriseHostname}`);
      
      // Check/setup configuration
      if (!this.configManager.config) {
        this.configManager.config = await this.configManager.setupConfig(this.enterpriseHostname, this.packageJson, this.cwd);
      } else {
        console.log(`📂 Using deployment repository: ${this.configManager.config.username}/${this.configManager.config.repository}`);
        
        // Check if project name is set for this project
        const currentProjectName = this.configManager.getProjectName(this.cwd);
        if (!currentProjectName) {
          console.log('📛 No project name set for this repository.');
          const defaultProjectName = this.packageJson.name || path.basename(this.cwd);
          const projectName = await PromptUtil.promptUser(
            `Project name for branch naming (default: ${defaultProjectName}): `,
            defaultProjectName
          );
          this.configManager.saveProjectName(this.cwd, projectName);
          console.log(`📛 Project name "${projectName}" saved for this repository\n`);
        } else {
          console.log(`📛 Using project name: ${currentProjectName}`);
        }
      }
      
      // Create deployers
      gitDeployer = new GitDeployer(this.configManager.config, this.packageJson, this.cwd, this.branchName, this.buildConfig, this.debugMode);
      const pagesDeployer = new PagesDeployer(this.configManager.config, this.packageJson, this.branchName, this.debugMode);
      
      // Setup
      await gitDeployer.ensureGitRepo();
      
      // Build and deploy
      await this.buildProject();
      await gitDeployer.deployToGitHub();
      await pagesDeployer.enableGitHubPages();
      
      // Auto-cleanup if enabled
      if (this.configManager.config.autoCleanup) {
        console.log('');
        const cleanupManager = new CleanupManager(this.configManager.config);
        await cleanupManager.cleanupOldBranches(true);
      }
      
    } catch (error) {
      console.error('❌ Deployment failed:', error.message);
      process.exit(1);
    } finally {
      if (gitDeployer) {
        gitDeployer.cleanup();
      }
    }
  }
}

module.exports = GitHubPagesDeployer;