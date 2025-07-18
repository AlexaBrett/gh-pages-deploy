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
const ProgressUtil = require('./utils/progress');

class GitHubPagesDeployer {
  constructor() {
    this.cwd = process.cwd();
    this.debugMode = process.argv.includes('--debug') || process.argv.includes('-d');
    this.progress = new ProgressUtil(this.debugMode);
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
    this.progress.log(`🔨 Building project: ${this.buildConfig.buildCommand}`);
    
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
    let restoreConsole = null;
    
    try {
      // Pre-flight checks (these still need to show output)
      if (!(await GitHubUtil.checkGitHubCLI())) return;
      
      this.enterpriseHostname = await GitHubUtil.checkAuthentication();
      if (!this.enterpriseHostname) return;
      
      this.progress.log(`🏢 Connected to GitHub Enterprise Server: ${this.enterpriseHostname}`);
      
      // Check/setup configuration (these still need to show output for user interaction)
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
        console.log(`📛 Project name "${projectName}" saved for this repository\n`);
      }
      
      // Now start silencing console for the main deployment process
      restoreConsole = this.progress.silentConsole();
      
      // Create deployers
      gitDeployer = new GitDeployer(this.configManager.config, this.packageJson, this.cwd, this.branchName, this.buildConfig, this.debugMode);
      const pagesDeployer = new PagesDeployer(this.configManager.config, this.packageJson, this.branchName, this.debugMode);
      
      // Start progress tracking
      const steps = [
        'Detecting build configuration',
        'Setting up deployment repository',
        'Building project',
        'Deploying to GitHub',
        'Configuring GitHub Pages'
      ];
      
      if (this.configManager.config.autoCleanup) {
        steps.push('Cleaning up old branches');
      }
      
      this.progress.startProgress(steps);
      
      // Execute deployment steps with progress
      await this.progress.step('Detecting build configuration', async () => {
        // Build config already detected in constructor, just a brief delay
        await new Promise(resolve => setTimeout(resolve, 500));
      });
      
      await this.progress.step('Setting up deployment repository', async () => {
        await gitDeployer.ensureGitRepo();
      });
      
      await this.progress.step('Building project', async () => {
        await this.buildProject();
      });
      
      await this.progress.step('Deploying to GitHub', async () => {
        await gitDeployer.deployToGitHub();
      });
      
      await this.progress.step('Configuring GitHub Pages', async () => {
        await pagesDeployer.enableGitHubPages();
      });
      
      // Auto-cleanup if enabled
      if (this.configManager.config.autoCleanup) {
        await this.progress.step('Cleaning up old branches', async () => {
          const cleanupManager = new CleanupManager(this.configManager.config);
          await cleanupManager.cleanupOldBranches(true);
        });
      }
      
      // Complete progress and ensure console is restored
      this.progress.complete();
      if (restoreConsole) {
        restoreConsole();
      }
      
      // Show final deployment info with Miami theme
      if (pagesDeployer.pagesUrl) {
        const miami = {
          blue: '\x1b[38;5;81m',
          pink: '\x1b[38;5;198m', 
          purple: '\x1b[38;5;141m',
          reset: '\x1b[0m',
          bold: '\x1b[1m'
        };
        
        console.log(`${miami.blue}🔗 Preview URL: ${pagesDeployer.pagesUrl}${miami.reset}`);
        console.log(`${miami.purple}🌿 Branch: ${this.branchName}${miami.reset}`);
        console.log(`${miami.pink}📊 Project: ${this.configManager.getProjectName(this.cwd)}${miami.reset}`);
        
        if (!pagesDeployer.pagesConfigured) {
          console.log(`\n${miami.purple}⚠️  Pages configuration may need manual setup:${miami.reset}`);
          console.log(`   1. Go to: ${pagesDeployer.repoUrl.replace('/tree/', '/settings/pages')}`);
          console.log(`   2. Set source to branch: ${this.branchName}`);
        }
        
        console.log(`\n${miami.pink}${miami.bold}✅ Your site should be live within a few minutes!${miami.reset}`);
        console.log(`${miami.blue}📝 Check the repository's Actions tab for deployment status.${miami.reset}`);
      }
      
    } catch (error) {
      // Ensure console is restored on error
      this.progress.restoreConsole();
      if (restoreConsole) {
        restoreConsole();
      }
      console.error('❌ Deployment failed:', error.message);
      if (this.debugMode) {
        console.error(error.stack);
      }
      process.exit(1);
    } finally {
      // Ensure console is always restored
      this.progress.restoreConsole();
      if (restoreConsole) {
        restoreConsole();
      }
      if (gitDeployer) {
        gitDeployer.cleanup();
      }
    }
  }
}

module.exports = GitHubPagesDeployer;