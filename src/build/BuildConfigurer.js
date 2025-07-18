const fs = require('fs');
const path = require('path');

class BuildConfigurer {
  constructor(cwd, buildConfig, debugMode = false) {
    this.cwd = cwd;
    this.buildConfig = buildConfig;
    this.debugMode = debugMode;
    this.originalEnv = {};
  }

  log(message) {
    if (this.debugMode) {
      console.log(message);
    }
  }

  async configureBasePath(basePath) {
    // Store original environment variables
    this.originalEnv = { ...process.env };
    
    // For enterprise with single Pages per repo, base path is just the repo name
    const repoBasePath = basePath;
    this.log(`🔧 Setting base path via environment: ${repoBasePath}`);
    
    switch (this.buildConfig.framework) {
      case 'next':
        this.configureNextJsEnv(repoBasePath);
        break;
      case 'vite':
        this.configureViteEnv(repoBasePath);
        break;
      case 'react':
        this.configureReactEnv(repoBasePath);
        break;
      default:
        this.log('ℹ️  Generic project - you may need to manually configure asset paths');
    }
  }

  configureNextJsEnv(basePath) {
    // Next.js respects these environment variables during build
    process.env.NEXT_PUBLIC_BASE_PATH = basePath;
    process.env.NEXT_BASE_PATH = basePath;
    process.env.NEXT_ASSET_PREFIX = basePath;
    
    // Check if they have a config that might need static export
    const configFiles = ['next.config.js', 'next.config.ts', 'next.config.mjs'];
    const hasConfig = configFiles.some(file => fs.existsSync(path.join(this.cwd, file)));
    
    if (hasConfig) {
      this.log('⚠️  Next.js config detected. Ensure your config includes:');
      this.log('   - output: "export" for static export');
      this.log('   - basePath: process.env.NEXT_BASE_PATH');
      this.log('   - assetPrefix: process.env.NEXT_ASSET_PREFIX');
      this.log('   - images: { unoptimized: true }');
    } else {
      this.log('📝 Using environment variables for Next.js base path');
    }
  }

  configureViteEnv(basePath) {
    // Vite respects the --base CLI option and VITE_BASE environment variable
    process.env.VITE_BASE = basePath;
    
    // Modify the build command to include base path
    if (this.buildConfig.buildCommand.includes('vite build')) {
      this.buildConfig.buildCommand = this.buildConfig.buildCommand.replace(
        'vite build',
        `vite build --base="${basePath}"`
      );
    }
    
    const configFiles = ['vite.config.js', 'vite.config.ts'];
    const hasConfig = configFiles.some(file => fs.existsSync(path.join(this.cwd, file)));
    
    if (hasConfig) {
      this.log('⚠️  Vite config detected. Ensure your config respects process.env.VITE_BASE for base path');
    } else {
      this.log('📝 Using --base CLI argument for Vite base path');
    }
  }

  configureReactEnv(basePath) {
    // Create React App respects the PUBLIC_URL environment variable
    process.env.PUBLIC_URL = basePath;
    this.log('📝 Set PUBLIC_URL environment variable for Create React App');
  }

  async restoreOriginalConfig() {
    this.log('🔄 Restoring original environment variables...');
    
    // Restore original environment
    for (const key in process.env) {
      if (!(key in this.originalEnv)) {
        delete process.env[key];
      }
    }
    
    for (const [key, value] of Object.entries(this.originalEnv)) {
      process.env[key] = value;
    }
    
    this.originalEnv = {};
  }
}

module.exports = BuildConfigurer;