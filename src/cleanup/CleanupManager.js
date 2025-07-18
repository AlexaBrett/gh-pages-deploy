const { execSync } = require('child_process');
const PromptUtil = require('../utils/prompt');

class CleanupManager {
  constructor(config) {
    this.config = config;
  }

  async cleanupOldBranches(autoMode = false) {
    if (!this.config) {
      console.log('❌ No configuration found. Please run setup first.');
      return;
    }

    if (!autoMode) {
      console.log('🧹 Cleaning up old deployment branches...\n');
    }
    
    try {
      const hostname = this.config.hostname;
      const env = { ...process.env, GH_HOST: hostname };
      
      // Get all branches from the deployment repository
      const branchesOutput = execSync(`gh api repos/${this.config.username}/${this.config.repository}/branches --paginate`, {
        encoding: 'utf8',
        env
      });
      
      const branches = JSON.parse(branchesOutput);
      const fourMonthsAgo = new Date();
      fourMonthsAgo.setMonth(fourMonthsAgo.getMonth() - 4);
      
      let branchesToDelete = [];
      
      // Parse branch names to find ones with timestamps
      branches.forEach(branch => {
        const branchName = branch.name;
        
        // Skip main/master branches
        if (branchName === 'main' || branchName === 'master') {
          return;
        }
        
        // Extract timestamp from branch name pattern: {project}-{timestamp}-{hash}
        const timestampMatch = branchName.match(/-(\d{8}-\d{4})-[a-f0-9]{6}$/);
        if (timestampMatch) {
          const timestampStr = timestampMatch[1];
          // Convert timestamp format: YYYYMMDD-HHMM to Date
          const year = parseInt(timestampStr.slice(0, 4));
          const month = parseInt(timestampStr.slice(4, 6)) - 1; // Month is 0-indexed
          const day = parseInt(timestampStr.slice(6, 8));
          const hour = parseInt(timestampStr.slice(9, 11));
          const minute = parseInt(timestampStr.slice(11, 13));
          
          const branchDate = new Date(year, month, day, hour, minute);
          
          if (branchDate < fourMonthsAgo) {
            branchesToDelete.push({
              name: branchName,
              date: branchDate
            });
          }
        }
      });
      
      if (branchesToDelete.length === 0) {
        if (!autoMode) {
          console.log('✅ No branches older than 4 months found.');
        }
        return;
      }
      
      if (!autoMode) {
        console.log(`📋 Found ${branchesToDelete.length} branches older than 4 months:`);
        branchesToDelete.forEach(branch => {
          console.log(`   - ${branch.name} (${branch.date.toLocaleDateString()})`);
        });
      }
      
      let shouldDelete = autoMode;
      
      if (!autoMode) {
        const confirm = await PromptUtil.promptUser(
          `\nDelete these ${branchesToDelete.length} old branches? (y/N): `,
          'N'
        );
        shouldDelete = confirm.toLowerCase() === 'y' || confirm.toLowerCase() === 'yes';
      }
      
      if (shouldDelete) {
        if (autoMode) {
          console.log(`🧹 Auto-cleanup: Deleting ${branchesToDelete.length} old branches...`);
        } else {
          console.log('\n🗑️  Deleting old branches...');
        }
        
        let deletedCount = 0;
        for (const branch of branchesToDelete) {
          try {
            execSync(`gh api repos/${this.config.username}/${this.config.repository}/git/refs/heads/${branch.name} -X DELETE`, {
              stdio: 'ignore',
              env
            });
            deletedCount++;
            if (!autoMode) {
              console.log(`   ✅ Deleted: ${branch.name}`);
            }
          } catch (error) {
            if (!autoMode) {
              console.log(`   ❌ Failed to delete: ${branch.name}`);
            }
          }
        }
        
        if (autoMode) {
          console.log(`🎉 Auto-cleanup complete! Deleted ${deletedCount} old branches.`);
        } else {
          console.log(`\n🎉 Cleanup complete! Deleted ${deletedCount} old branches.`);
        }
      } else {
        console.log('🚫 Cleanup cancelled.');
      }
      
    } catch (error) {
      console.error('❌ Cleanup failed:', error.message);
    }
  }
}

module.exports = CleanupManager;