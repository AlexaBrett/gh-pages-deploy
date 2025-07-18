const { execSync } = require('child_process');

class PagesDeployer {
  constructor(config, packageJson, branchName, debugMode = false) {
    this.config = config;
    this.packageJson = packageJson;
    this.branchName = branchName;
    this.debugMode = debugMode;
  }

  async enableGitHubPages() {
    if (!this.debugMode) {
      await this.showProgress('Setting up GitHub Pages', 2000);
    } else {
      console.log('📄 Setting up GitHub Enterprise Pages deployment...');
    }
    
    try {
      const hostname = this.config.hostname;
      if (!hostname) {
        throw new Error('No enterprise hostname configured');
      }
      
      // Use GH_HOST environment variable for enterprise operations
      const env = { ...process.env, GH_HOST: hostname };
      
      // Try multiple approaches to update GitHub Pages configuration
      let pagesConfigured = false;
      
      // First, try to get current pages configuration
      try {
        const currentPages = execSync(`gh api repos/${this.config.username}/${this.config.repository}/pages`, {
          encoding: 'utf8',
          env
        });
        const pagesData = JSON.parse(currentPages);
        this.log(`📋 Current pages source: ${pagesData.source?.branch || 'unknown'}`);
        
        // Pages exists, update it
        try {
          execSync(`gh api repos/${this.config.username}/${this.config.repository}/pages -X PUT -f source.branch=${this.branchName} -f source.path=/`, {
            stdio: this.debugMode ? 'inherit' : 'ignore',
            env
          });
          this.log(`✅ GitHub Pages source updated to branch: ${this.branchName}`);
          pagesConfigured = true;
        } catch (updateError) {
          this.log(`⚠️  PUT request failed: ${updateError.message}`);
        }
      } catch (getCurrentError) {
        this.log(`📋 No existing pages configuration found`);
        
        // No existing pages, try to create new configuration
        try {
          execSync(`gh api repos/${this.config.username}/${this.config.repository}/pages -X POST -f source.branch=${this.branchName} -f source.path=/`, {
            stdio: this.debugMode ? 'inherit' : 'ignore',
            env
          });
          this.log(`✅ GitHub Pages enabled with source branch: ${this.branchName}`);
          pagesConfigured = true;
        } catch (createError) {
          this.log(`⚠️  POST request failed: ${createError.message}`);
        }
      }
      
      // If API methods failed, try using the graphql API as a fallback
      if (!pagesConfigured) {
        this.log(`🔧 Attempting alternative pages configuration...`);
        try {
          // Try to use the graphql API as a fallback
          const graphqlMutation = `
            mutation {
              updateRepository(input: {
                repositoryId: "${this.config.username}/${this.config.repository}"
                pagesConfig: {
                  source: {
                    branch: "${this.branchName}"
                    path: "/"
                  }
                }
              }) {
                repository {
                  id
                }
              }
            }
          `;
          
          execSync(`gh api graphql -f query='${graphqlMutation}'`, {
            stdio: this.debugMode ? 'inherit' : 'ignore',
            env
          });
          this.log(`✅ GitHub Pages configured via GraphQL`);
          pagesConfigured = true;
        } catch (graphqlError) {
          this.log(`⚠️  GraphQL approach failed: ${graphqlError.message}`);
        }
      }
      
      // Generate enterprise-specific URLs (no branch name in URL for single-pages setup)
      const pagesUrl = `https://${hostname}/pages/${this.config.username}/${this.config.repository}/`;
      const repoUrl = `https://${hostname}/${this.config.username}/${this.config.repository}/tree/${this.branchName}`;
      
      // In normal mode, final output will be handled by the progress system
      if (this.debugMode) {
        console.log('\n🎉 Deployment complete!');
        console.log(`🔗 Preview: ${pagesUrl}`);
        console.log(`🌿 Branch: ${this.branchName}`);
        
        if (!pagesConfigured) {
          console.log('\n⚠️  Pages configuration may need manual setup:');
          console.log(`   1. Go to: ${repoUrl.replace('/tree/', '/settings/pages')}`);
          console.log(`   2. Set source to branch: ${this.branchName}`);
        }
        
        console.log(`\n📦 Repository: ${repoUrl}`);
        console.log(`🏢 Enterprise: ${hostname}`);
      }
      
      // Store URLs for progress system to display
      this.pagesUrl = pagesUrl;
      this.repoUrl = repoUrl;
      this.pagesConfigured = pagesConfigured;
      
      // Update local config with last deployment info
      this.config.lastDeployment = {
        branch: this.branchName,
        url: pagesUrl,
        deployedAt: new Date().toISOString(),
        project: this.packageJson.name || 'Unknown',
        hostname: hostname
      };
      
      const ConfigManager = require('../config/ConfigManager');
      const configManager = new ConfigManager();
      configManager.saveConfig(this.config);
      
    } catch (error) {
      const hostname = this.config.hostname;
      const repoUrl = `https://${hostname}/${this.config.username}/${this.config.repository}/tree/${this.branchName}`;
      
      console.log('\n⚠️  GitHub Pages setup failed, but deployment succeeded');
      console.log(`🌿 Branch: ${this.branchName}`);
      console.log(`🔧 Manual setup: ${repoUrl.replace('/tree/', '/settings/pages')}`);
      
      if (this.debugMode) {
        console.log(`❌ Error details: ${error.message}`);
      }
    }
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
}

module.exports = PagesDeployer;