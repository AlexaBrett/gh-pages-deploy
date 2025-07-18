const fs = require('fs');
const path = require('path');
const ConfigParser = require('../utils/configParser');

class BuildConfigurer {
  constructor(cwd, buildConfig, debugMode = false) {
    this.cwd = cwd;
    this.buildConfig = buildConfig;
    this.debugMode = debugMode;
    this.originalConfigs = {};
    this.configParser = new ConfigParser(debugMode);
  }

  log(message) {
    if (this.debugMode) {
      console.log(message);
    }
  }

  async configureBasePath(basePath) {
    // For enterprise with single Pages per repo, base path is just the repo name
    const repoBasePath = basePath;
    this.log(`🔧 Configuring base path: ${repoBasePath}`);
    
    switch (this.buildConfig.framework) {
      case 'next':
        await this.configureNextJsBasePath(repoBasePath);
        break;
      case 'vite':
        await this.configureViteBasePath(repoBasePath);
        break;
      case 'react':
        await this.configureReactBasePath(repoBasePath);
        break;
      default:
        this.log('ℹ️  Generic project - you may need to manually configure asset paths');
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
      
      // Generate deployment config
      const deploymentConfig = this.configParser.generateNextConfig(basePath, originalContent);
      
      fs.writeFileSync(configPath, deploymentConfig);
      this.log(`📝 Temporarily replaced ${configFile} with deployment config`);
    } else {
      // Create temporary config
      const deploymentConfig = this.configParser.generateNextConfig(basePath);
      fs.writeFileSync(path.join(this.cwd, 'next.config.js'), deploymentConfig);
      this.originalConfigs['next.config.js'] = null; // Mark for deletion
      this.log('📝 Created temporary next.config.js for deployment');
    }
  }

  async configureViteBasePath(basePath) {
    const configFiles = ['vite.config.js', 'vite.config.ts'];
    let configFile = configFiles.find(file => fs.existsSync(path.join(this.cwd, file)));
    
    if (configFile) {
      // Read original config and replace with deployment config
      const configPath = path.join(this.cwd, configFile);
      const originalContent = fs.readFileSync(configPath, 'utf8');
      this.originalConfigs[configFile] = originalContent;
      
      // Generate deployment config
      const isTypeScript = configFile.endsWith('.ts');
      const deploymentConfig = this.configParser.generateViteConfig(basePath, isTypeScript, originalContent);
      fs.writeFileSync(configPath, deploymentConfig);
      this.log(`📝 Temporarily replaced ${configFile} with deployment config`);
    } else {
      // Create temporary config
      const isTypeScript = fs.existsSync(path.join(this.cwd, 'tsconfig.json'));
      configFile = isTypeScript ? 'vite.config.ts' : 'vite.config.js';
      
      const deploymentConfig = this.configParser.generateViteConfig(basePath, isTypeScript);
      fs.writeFileSync(path.join(this.cwd, configFile), deploymentConfig);
      this.originalConfigs[configFile] = null; // Mark for deletion
      this.log(`📝 Created temporary ${configFile} for deployment`);
    }
  }

  async configureReactBasePath(basePath) {
    // For Create React App, we use the PUBLIC_URL environment variable
    const envPath = path.join(this.cwd, '.env.local');
    const envExists = fs.existsSync(envPath);
    
    let originalContent = '';
    if (envExists) {
      originalContent = fs.readFileSync(envPath, 'utf8');
      this.originalConfigs['.env.local'] = originalContent;
    } else {
      this.originalConfigs['.env.local'] = null; // Mark for deletion
    }
    
    // Generate deployment env config
    const deploymentConfig = this.configParser.generateReactEnvConfig(basePath, originalContent);
    fs.writeFileSync(envPath, deploymentConfig);
    this.log('📝 Temporarily set PUBLIC_URL for Create React App deployment');
  }

  async restoreOriginalConfig() {
    if (!this.originalConfigs) return;
    
    this.log('🔄 Restoring original configuration files...');
    
    for (const [filename, originalContent] of Object.entries(this.originalConfigs)) {
      const filePath = path.join(this.cwd, filename);
      
      if (originalContent === null) {
        // File was created temporarily, delete it
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
          this.log(`🗑️  Removed temporary ${filename}`);
        }
      } else {
        // File was modified, restore original
        fs.writeFileSync(filePath, originalContent);
        this.log(`↩️  Restored ${filename}`);
      }
    }
    
    this.originalConfigs = {};
  }
}

module.exports = BuildConfigurer;