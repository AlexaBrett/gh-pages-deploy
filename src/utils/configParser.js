const fs = require('fs');
const path = require('path');

class ConfigParser {
  constructor(debugMode = false) {
    this.debugMode = debugMode;
  }

  log(message) {
    if (this.debugMode) {
      console.log(message);
    }
  }

  /**
   * Parse and modify Next.js config files
   */
  generateNextConfig(basePath, originalContent = null) {
    if (originalContent) {
      // Parse existing config and merge with deployment settings
      return this.modifyNextConfig(originalContent, basePath);
    }
    
    // Create new config from scratch
    return `/** @type {import('next').NextConfig} */
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
  }

  /**
   * Modify existing Next.js config by parsing and merging
   */
  modifyNextConfig(originalContent, basePath) {
    try {
      // Create a safe evaluation context
      const moduleExports = {};
      const module = { exports: moduleExports };
      
      // Create a sandbox for safe evaluation
      const sandbox = {
        module,
        exports: moduleExports,
        require: () => ({}), // Mock require for safety
        __dirname: '',
        __filename: '',
        console: { log: () => {} }, // Silent console
        process: { env: {} }
      };

      // Try to evaluate the config in a controlled way
      let configFunction;
      try {
        // Handle different export patterns
        if (originalContent.includes('module.exports')) {
          // CommonJS: module.exports = config
          const wrappedContent = originalContent.replace(
            /module\.exports\s*=\s*(.+)/s,
            'return $1'
          );
          configFunction = new Function('module', 'exports', 'require', 'console', 'process', '__dirname', '__filename', wrappedContent);
        } else if (originalContent.includes('export default')) {
          // ES modules: export default config
          const wrappedContent = originalContent.replace(
            /export\s+default\s+(.+)/s,
            'return $1'
          );
          configFunction = new Function('module', 'exports', 'require', 'console', 'process', '__dirname', '__filename', wrappedContent);
        } else {
          // Fallback: assume it's a direct object
          configFunction = new Function('module', 'exports', 'require', 'console', 'process', '__dirname', '__filename', `return (${originalContent})`);
        }

        const originalConfig = configFunction(sandbox.module, sandbox.exports, sandbox.require, sandbox.console, sandbox.process, sandbox.__dirname, sandbox.__filename);
        
        // Merge with deployment settings
        const deploymentConfig = this.mergeNextConfig(originalConfig, basePath);
        
        // Generate the new config content
        return this.generateNextConfigContent(deploymentConfig);
        
      } catch (evalError) {
        this.log(`Could not parse config safely: ${evalError.message}`);
        // Fall back to string-based approach for complex configs
        return this.fallbackNextConfig(originalContent, basePath);
      }
    } catch (error) {
      this.log(`Error parsing Next.js config: ${error.message}`);
      // Return a safe default config
      return this.generateNextConfig(basePath);
    }
  }

  /**
   * Merge original Next.js config with deployment settings
   */
  mergeNextConfig(originalConfig, basePath) {
    // Handle function configs
    if (typeof originalConfig === 'function') {
      // For function configs, we need to call it and then merge
      try {
        const resolvedConfig = originalConfig({}, {});
        return this.mergeNextConfigObject(resolvedConfig, basePath);
      } catch (error) {
        this.log(`Error resolving function config: ${error.message}`);
        return this.createDefaultNextConfig(basePath);
      }
    }
    
    // Handle object configs
    if (typeof originalConfig === 'object' && originalConfig !== null) {
      return this.mergeNextConfigObject(originalConfig, basePath);
    }
    
    // Fallback to default
    return this.createDefaultNextConfig(basePath);
  }

  /**
   * Merge Next.js config object with deployment settings
   */
  mergeNextConfigObject(config, basePath) {
    return {
      ...config,
      output: 'export',
      basePath: basePath,
      assetPrefix: basePath,
      trailingSlash: true,
      images: {
        ...(config.images || {}),
        unoptimized: true
      }
    };
  }

  /**
   * Create default Next.js config
   */
  createDefaultNextConfig(basePath) {
    return {
      output: 'export',
      basePath: basePath,
      assetPrefix: basePath,
      trailingSlash: true,
      images: {
        unoptimized: true
      }
    };
  }

  /**
   * Generate Next.js config file content from config object
   */
  generateNextConfigContent(config) {
    const configString = JSON.stringify(config, null, 2)
      .replace(/"([^"]+)":/g, '$1:') // Remove quotes from keys
      .replace(/"/g, "'"); // Use single quotes
    
    return `/** @type {import('next').NextConfig} */
const nextConfig = ${configString};

module.exports = nextConfig;`;
  }

  /**
   * Fallback Next.js config modification using string replacement
   */
  fallbackNextConfig(originalContent, basePath) {
    // This is a safer string-based approach for complex configs
    let modifiedContent = originalContent;
    
    // Look for existing basePath and replace it
    if (modifiedContent.includes('basePath:')) {
      modifiedContent = modifiedContent.replace(
        /basePath:\s*['"`][^'"`]*['"`]/g,
        `basePath: '${basePath}'`
      );
    } else {
      // Try to inject basePath into the config object
      modifiedContent = modifiedContent.replace(
        /(\{[^}]*?)(})/s,
        `$1  basePath: '${basePath}',\n  assetPrefix: '${basePath}',\n  output: 'export',\n  trailingSlash: true,\n  images: {\n    unoptimized: true\n  },\n$2`
      );
    }
    
    return modifiedContent;
  }

  /**
   * Parse and modify Vite config files
   */
  generateViteConfig(basePath, isTypeScript = false, originalContent = null) {
    if (originalContent) {
      return this.modifyViteConfig(originalContent, basePath, isTypeScript);
    }
    
    // Create new config from scratch
    const importStatement = isTypeScript ? 
      "import { defineConfig } from 'vite';" : 
      "import { defineConfig } from 'vite';";
    
    return `${importStatement}

export default defineConfig({
  base: '${basePath}',
  build: {
    outDir: 'dist'
  }
});`;
  }

  /**
   * Modify existing Vite config
   */
  modifyViteConfig(originalContent, basePath, isTypeScript) {
    try {
      // For Vite configs, we'll use a more conservative approach
      // since they often contain complex webpack/rollup configurations
      
      let modifiedContent = originalContent;
      
      // Ensure defineConfig is imported
      if (!modifiedContent.includes('defineConfig')) {
        const importStatement = isTypeScript ? 
          "import { defineConfig } from 'vite';\n" : 
          "import { defineConfig } from 'vite';\n";
        modifiedContent = importStatement + modifiedContent;
      }
      
      // Look for existing base configuration and replace it
      if (modifiedContent.includes('base:')) {
        modifiedContent = modifiedContent.replace(
          /base:\s*['"`][^'"`]*['"`]/g,
          `base: '${basePath}'`
        );
      } else {
        // Try to inject base into the config object
        // Look for defineConfig({ pattern
        if (modifiedContent.includes('defineConfig({')) {
          modifiedContent = modifiedContent.replace(
            /defineConfig\(\s*\{/,
            `defineConfig({\n  base: '${basePath}',`
          );
        } else if (modifiedContent.includes('export default {')) {
          modifiedContent = modifiedContent.replace(
            /export default\s*\{/,
            `export default defineConfig({\n  base: '${basePath}',`
          );
          // Add closing parenthesis
          modifiedContent = modifiedContent.replace(/\}\s*;?\s*$/, '});');
        }
      }
      
      return modifiedContent;
    } catch (error) {
      this.log(`Error parsing Vite config: ${error.message}`);
      return this.generateViteConfig(basePath, isTypeScript);
    }
  }

  /**
   * Generate React environment config
   */
  generateReactEnvConfig(basePath, originalContent = '') {
    let modifiedContent = originalContent;
    
    // Add or update PUBLIC_URL
    if (modifiedContent.includes('PUBLIC_URL=')) {
      modifiedContent = modifiedContent.replace(/PUBLIC_URL=.*$/m, `PUBLIC_URL=${basePath}`);
    } else {
      modifiedContent += `\nPUBLIC_URL=${basePath}\n`;
    }
    
    return modifiedContent;
  }
}

module.exports = ConfigParser;