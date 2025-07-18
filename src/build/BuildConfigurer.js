const fs = require('fs');
const path = require('path');

class BuildConfigurer {
  constructor(cwd, buildConfig) {
    this.cwd = cwd;
    this.buildConfig = buildConfig;
    this.originalConfigs = {};
  }

  async configureBasePath(basePath) {
    // For enterprise with single Pages per repo, base path is just the repo name
    const repoBasePath = basePath;
    console.log(`🔧 Configuring base path: ${repoBasePath}`);
    
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
}

module.exports = BuildConfigurer;