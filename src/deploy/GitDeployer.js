const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');
const FileUtil = require('../utils/file');
const PromptUtil = require('../utils/prompt');

class GitDeployer {
  constructor(config, packageJson, cwd, branchName, buildConfig, debugMode = false) {
    this.config = config;
    this.packageJson = packageJson;
    this.cwd = cwd;
    this.branchName = branchName;
    this.buildConfig = buildConfig;
    this.debugMode = debugMode;
    this.tempDir = null;
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

  async deployToGitHub() {
    if (!this.debugMode) {
      await this.showProgress('Deploying to GitHub', 2000);
    } else {
      console.log(`📦 Preparing deployment to branch: ${this.branchName}`);
    }
    
    const outputPath = path.join(this.cwd, this.buildConfig.outputDir);
    
    // Create orphan branch for this deployment
    execSync(`git checkout --orphan ${this.branchName}`, { 
      cwd: this.tempDir,
      stdio: this.debugMode ? 'inherit' : 'ignore'
    });
    
    // Copy build output to temp directory
    FileUtil.copyDirectory(outputPath, this.tempDir);
    
    // Handle environment config replacement
    await this.handleEnvironmentConfig();
    
    // Create .nojekyll for GitHub Pages
    fs.writeFileSync(path.join(this.tempDir, '.nojekyll'), '');
    
    // Create a simple index redirect if no index.html exists
    if (!fs.existsSync(path.join(this.tempDir, 'index.html'))) {
      this.log('📄 No index.html found, creating redirect...');
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
    execSync('git add .', { 
      cwd: this.tempDir,
      stdio: this.debugMode ? 'inherit' : 'ignore'
    });
    execSync(`git commit -m "Deploy ${this.packageJson.name || 'project'} - ${this.branchName}"`, { 
      cwd: this.tempDir,
      stdio: this.debugMode ? 'inherit' : 'ignore'
    });
    
    this.log('📤 Pushing to GitHub...');
    execSync(`git push -u origin ${this.branchName}`, { 
      cwd: this.tempDir,
      stdio: this.debugMode ? 'inherit' : 'ignore'
    });
  }

  async handleEnvironmentConfig() {
    console.log('🔧 Checking for environment configuration...');
    
    // Check if env folder exists
    const envBasePath = path.join(this.cwd, 'env');
    if (!fs.existsSync(envBasePath) || !fs.statSync(envBasePath).isDirectory()) {
      console.log('ℹ️  No env directory found, skipping config replacement');
      return;
    }
    
    // Check what folders are in the env directory
    const envDirs = fs.readdirSync(envBasePath).filter(dir => 
      fs.statSync(path.join(envBasePath, dir)).isDirectory()
    );
    
    if (envDirs.length === 0) {
      console.log('ℹ️  No directories found in env folder, skipping config replacement');
      return;
    }
    
    console.log(`📁 Found environment directories in env/: ${envDirs.join(', ')}`);
    
    // Get the previously used environment for this project
    const ConfigManager = require('../config/ConfigManager');
    const configManager = new ConfigManager();
    const lastUsedEnv = configManager.getLastEnvironment(this.cwd);
    let promptText = '[PLACEHOLDER: Replace with your custom prompt text]\n';
    
    if (lastUsedEnv && envDirs.includes(lastUsedEnv)) {
      promptText += `Environment directory name (default: ${lastUsedEnv}): `;
    } else {
      promptText += 'Environment directory name: ';
    }
    
    // Prompt user for environment selection
    const userInput = await PromptUtil.promptUser(promptText);
    const selectedEnv = userInput.trim() || lastUsedEnv;
    
    if (!selectedEnv) {
      console.log('ℹ️  No environment selected, skipping config replacement');
      return;
    }
    
    // Validate the selected directory exists in env/
    const envPath = path.join(envBasePath, selectedEnv);
    if (!fs.existsSync(envPath) || !fs.statSync(envPath).isDirectory()) {
      throw new Error(`Environment directory 'env/${selectedEnv}' does not exist`);
    }
    
    // Check if config.js exists in the selected directory
    const configSourcePath = path.join(envPath, 'config.js');
    if (!fs.existsSync(configSourcePath)) {
      throw new Error(`config.js not found in 'env/${selectedEnv}' directory`);
    }
    
    // Check if config.js exists in the build output
    const configDestPath = path.join(this.tempDir, 'config.js');
    if (!fs.existsSync(configDestPath)) {
      console.log('⚠️  config.js not found in build output, copying anyway...');
    }
    
    // Replace the config.js file
    fs.copyFileSync(configSourcePath, configDestPath);
    console.log(`✅ Replaced config.js with version from 'env/${selectedEnv}'`);
    
    // Save the selected environment for future use in this project
    configManager.saveLastEnvironment(this.cwd, selectedEnv);
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

  cleanup() {
    // Clean up temporary directory
    if (this.tempDir && fs.existsSync(this.tempDir)) {
      try {
        fs.rmSync(this.tempDir, { recursive: true, force: true });
      } catch (error) {
        console.log('⚠️  Could not clean up temporary files');
      }
    }
  }
}

module.exports = GitDeployer;