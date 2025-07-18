const { execSync } = require('child_process');

class GitHubUtil {
  static async checkGitHubCLI() {
    try {
      execSync('gh --version', { stdio: 'ignore' });
      return true;
    } catch (error) {
      console.error('❌ GitHub CLI (gh) is required but not installed.');
      console.log('📋 Install it from: https://cli.github.com/');
      return false;
    }
  }

  static async checkAuthentication() {
    try {
      // Check if authenticated with any GitHub instance
      const result = execSync('gh auth status', { encoding: 'utf8', stdio: 'pipe' });
      
      // Extract hostname from auth status - must be enterprise (not github.com)
      const hostnameMatch = result.match(/Logged in to ([^\s]+)/);
      if (!hostnameMatch) {
        throw new Error('Could not determine GitHub hostname from authentication');
      }
      
      const hostname = hostnameMatch[1];
      if (hostname === 'github.com') {
        console.error('❌ This tool only works with GitHub Enterprise Server.');
        console.log('🏢 Please authenticate with your GitHub Enterprise Server instance:');
        console.log('   gh auth login --hostname your-enterprise-server.com');
        return null;
      }
      
      return hostname;
    } catch (error) {
      console.error('❌ Not authenticated with GitHub Enterprise Server.');
      console.log('🔑 Please authenticate with your GitHub Enterprise Server instance:');
      console.log('   gh auth login --hostname your-enterprise-server.com');
      return null;
    }
  }

  static getGitHubUsername(hostname) {
    try {
      const env = hostname ? { ...process.env, GH_HOST: hostname } : process.env;
      const result = execSync('gh api user --jq .login', { encoding: 'utf8', env }).trim();
      return result;
    } catch (error) {
      throw new Error('Could not get GitHub username. Make sure you are authenticated with GitHub CLI.');
    }
  }

  static async checkRepoExists(hostname, username, repoName) {
    try {
      if (!hostname) {
        throw new Error('No enterprise hostname configured');
      }
      
      // Use GH_HOST environment variable for enterprise operations
      const env = { ...process.env, GH_HOST: hostname };
      execSync(`gh repo view ${username}/${repoName}`, { stdio: 'ignore', env });
      return true;
    } catch (error) {
      return false;
    }
  }
}

module.exports = GitHubUtil;