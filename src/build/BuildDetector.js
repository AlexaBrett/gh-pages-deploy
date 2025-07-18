const fs = require('fs');
const path = require('path');

class BuildDetector {
  constructor(cwd, packageJson, debugMode = false) {
    this.cwd = cwd;
    this.packageJson = packageJson;
    this.debugMode = debugMode;
  }

  log(message) {
    if (this.debugMode) {
      console.log(message);
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
          this.log(`📦 Detected generic project with inferred output: ${dir}`);
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
      this.log(`📦 Detected generic project, found existing directory: ${existingDirs[0]}`);
      return {
        framework: 'generic',
        buildCommand: 'npm run build',
        outputDir: existingDirs[0]
      };
    }
    
    this.log(`📦 Detected generic project`);
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
      this.log(`📦 Detected Next.js project (${configFile})`);
      
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
        this.log(`📁 Found custom distDir: ${distDirMatch[1]}`);
        return distDirMatch[1];
      }
      
      // Check if output is 'export' (static export)
      const outputMatch = configContent.match(/output\s*:\s*['"`]export['"`]/);
      if (outputMatch) {
        // For static export, check for custom outDir or default to 'out'
        const outDirMatch = configContent.match(/outDir\s*:\s*['"`]([^'"`]+)['"`]/);
        if (outDirMatch) {
          this.log(`📁 Found custom outDir for export: ${outDirMatch[1]}`);
          return outDirMatch[1];
        }
        return 'out'; // Default for Next.js static export
      }
      
      // If no static export, default build goes to .next
      return '.next';
    } catch (error) {
      this.log(`⚠️  Could not parse ${configFile}, using default output directory`);
      return 'out';
    }
  }

  findViteConfig() {
    const configFiles = ['vite.config.js', 'vite.config.ts', 'vitest.config.js', 'vitest.config.ts'];
    const configFile = configFiles.find(file => fs.existsSync(path.join(this.cwd, file)));
    
    if (configFile || this.packageJson.devDependencies?.vite) {
      this.log(`⚡ Detected Vite project${configFile ? ` (${configFile})` : ''}`);
      
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
        this.log(`📁 Found custom outDir: ${outDirMatch[1]}`);
        return outDirMatch[1];
      }
      
      return 'dist'; // Vite default
    } catch (error) {
      this.log(`⚠️  Could not parse ${configFile}, using default output directory`);
      return 'dist';
    }
  }

  findReactConfig() {
    if (this.packageJson.dependencies?.['react-scripts']) {
      this.log(`⚛️  Detected Create React App project`);
      
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
          this.log(`📁 Found custom BUILD_PATH: ${buildPathMatch[1]}`);
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
            this.log(`📁 Found BUILD_PATH in ${envFile}: ${buildPathMatch[1]}`);
            return buildPathMatch[1];
          }
        }
      }
      
      return 'build'; // Create React App default
    } catch (error) {
      this.log(`⚠️  Could not parse React configuration, using default output directory`);
      return 'build';
    }
  }
}

module.exports = BuildDetector;