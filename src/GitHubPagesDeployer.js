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
const Logger = require('./utils/logger');

class GitHubPagesDeployer {
  constructor() {
    this.cwd = process.cwd();
    this.debugMode = process.argv.includes('--debug') || process.argv.includes('-d');
    this.logger = new Logger(this.debugMode);
    this.packageJson = FileUtil.loadPackageJson(this.cwd);
    this.buildDetector = new BuildDetector(this.cwd, this.packageJson, this.debugMode);
    this.buildConfig = this.buildDetector.detectBuildConfig();
    this.configManager = new ConfigManager();
    this.branchName = this.generateBranchName();
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
    this.logger.debug(`🔨 Building project: ${this.buildConfig.buildCommand}`);
    
    // Calculate the base path for GitHub Pages (just repository name, no branch)
    const basePath = `/${this.configManager.config.repository}`;
    
    // Handle framework-specific base path configuration
    const buildConfigurer = new BuildConfigurer(this.cwd, this.buildConfig, this.debugMode);
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

    this.logger.debug(`✅ Build completed. Output in: ${this.buildConfig.outputDir}`);
  }


  async deploy() {
    let gitDeployer = null;
    
    try {
      // Pre-flight checks and all prompts at the beginning
      if (!(await GitHubUtil.checkGitHubCLI())) return;
      
      this.enterpriseHostname = await GitHubUtil.checkAuthentication();
      if (!this.enterpriseHostname) return;
      
      this.logger.info(`🏢 Connected to GitHub Enterprise Server: ${this.enterpriseHostname}`);
      
      // Check/setup configuration with all prompts
      if (!this.configManager.config) {
        this.configManager.config = await this.configManager.setupConfig(this.enterpriseHostname, this.packageJson, this.cwd);
      } else {
        // Always prompt for project name
        const currentProjectName = this.configManager.getProjectName(this.cwd);
        // Default to directory name for first time, or previous value for subsequent runs
        const defaultProjectName = currentProjectName || this.packageJson.name || path.basename(this.cwd);
        
        const projectName = await PromptUtil.promptUser(
          `Project name for branch naming (default: ${defaultProjectName}): `,
          defaultProjectName
        );
        
        this.configManager.saveProjectName(this.cwd, projectName);
        this.logger.success(`📛 Project name "${projectName}" saved for this repository\n`);
      }
      
      // Regenerate branch name with new project name
      this.branchName = this.generateBranchName();
      
      // Create deployers
      gitDeployer = new GitDeployer(this.configManager.config, this.packageJson, this.cwd, this.branchName, this.buildConfig, this.debugMode);
      const pagesDeployer = new PagesDeployer(this.configManager.config, this.packageJson, this.branchName, this.debugMode);
      
      // Start deployment with minimal logging
      this.logger.info('🚀 Starting deployment...');
      
      // Execute deployment steps
      this.logger.debug('📋 Detecting build configuration');
      // Build config already detected in constructor
      
      this.logger.debug('⚙️  Setting up deployment repository');
      await gitDeployer.ensureGitRepo();
      
      this.logger.debug('🔨 Building project');
      await this.buildProject();
      
      this.logger.debug('📤 Deploying to GitHub');
      await gitDeployer.deployToGitHub();
      
      this.logger.debug('📑 Configuring GitHub Pages');
      await pagesDeployer.enableGitHubPages();
      
      // Auto-cleanup if enabled
      if (this.configManager.config.autoCleanup) {
        this.logger.debug('🧹 Cleaning up old branches');
        const cleanupManager = new CleanupManager(this.configManager.config);
        await cleanupManager.cleanupOldBranches(true);
      }
      
      // Show final deployment info with Miami theme
      if (pagesDeployer.pagesUrl) {
        this.logger.info(`🔗 Preview URL: ${pagesDeployer.pagesUrl}`);
        this.logger.warning(`🌿 Branch: ${this.branchName}`);
        this.logger.success(`📊 Project: ${this.configManager.getProjectName(this.cwd)}`);
        
        if (!pagesDeployer.pagesConfigured) {
          this.logger.warning(`⚠️  Pages configuration may need manual setup:`);
          console.log(`   1. Go to: ${pagesDeployer.repoUrl.replace('/tree/', '/settings/pages')}`);
          console.log(`   2. Set source to branch: ${this.branchName}`);
        }
        
        this.logger.success(`\n✅ Your site should be live within a few minutes!`);
        this.logger.info(`📝 Check the repository's Actions tab for deployment status.`);
      }
      
    } catch (error) {
      this.logger.error(`Deployment failed: ${error.message}`);
      if (this.debugMode) {
        console.error(error.stack);
      }
      process.exit(1);
    } finally {
      if (gitDeployer) {
        gitDeployer.cleanup();
      }
    }
  }
}

module.exports = GitHubPagesDeployer;