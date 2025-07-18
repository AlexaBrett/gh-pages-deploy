#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const GitHubPagesDeployer = require('./GitHubPagesDeployer');
const ConfigManager = require('./config/ConfigManager');
const CleanupManager = require('./cleanup/CleanupManager');

function showHelp() {
  console.log(`
GitHub Enterprise Pages Auto Deploy

Usage:
  github-pages-poc-deploy                Deploy current project
  github-pages-poc-deploy --debug        Deploy with detailed output
  github-pages-poc-deploy --config       Set up or update configuration
  github-pages-poc-deploy --config --show   Show current configuration
  github-pages-poc-deploy --config --reset  Reset configuration
  github-pages-poc-deploy --cleanup      Remove deployment branches older than 1 week
  github-pages-poc-deploy --cleanup --auto-cleanup  Remove old branches without confirmation
  github-pages-poc-deploy --help         Show this help

  ghpd                     Short form of github-pages-poc-deploy
  ghpd --debug             Short form with debug mode
  ghpd --config            Short form config management
  ghpd --cleanup           Short form cleanup

Configuration is stored in: ~/.ghd-config.json

Debug mode (--debug or -d) shows detailed output and error information.
Normal mode shows minimal Miami-themed logging for a cleaner experience.

First run will automatically prompt for configuration setup.
Project names are stored per directory for consistent branch naming.

Auto-cleanup is enabled by default to automatically remove branches older than 1 week
after each deployment. This can be disabled during setup or via --config.
`);
}

async function handleConfigCommand(args) {
  const configManager = new ConfigManager();
  
  if (args.includes('--show')) {
    configManager.showConfig();
  } else if (args.includes('--reset')) {
    configManager.resetConfig();
  } else {
    // Allow updating project name if already configured
    if (configManager.config) {
      try {
        const GitHubPagesDeployer = require('./GitHubPagesDeployer');
        const deployer = new GitHubPagesDeployer();
        await configManager.updateConfig(deployer.packageJson, deployer.cwd);
      } catch (error) {
        console.error('❌ Configuration update failed:', error.message);
        process.exit(1);
      }
    } else {
      try {
        const GitHubPagesDeployer = require('./GitHubPagesDeployer');
        const deployer = new GitHubPagesDeployer();
        await configManager.setupConfig(deployer.enterpriseHostname, deployer.packageJson, deployer.cwd);
        console.log('✅ Configuration updated successfully!');
      } catch (error) {
        console.error('❌ Configuration setup failed:', error.message);
        process.exit(1);
      }
    }
  }
}

async function handleCleanupCommand(args) {
  const configManager = new ConfigManager();
  const cleanupManager = new CleanupManager(configManager.config);
  const autoMode = args.includes('--auto-cleanup');
  
  try {
    await cleanupManager.cleanupOldBranches(autoMode);
  } catch (error) {
    console.error('❌ Cleanup failed:', error.message);
    process.exit(1);
  }
}

async function main() {
  const args = process.argv.slice(2);
  
  if (args.includes('--cleanup')) {
    await handleCleanupCommand(args);
  } else if (args.includes('--config') || args.includes('-c')) {
    await handleConfigCommand(args);
  } else if (args.includes('--help') || args.includes('-h')) {
    showHelp();
  } else {
    // Normal deployment
    const deployer = new GitHubPagesDeployer();
    await deployer.deploy();
  }
}

// Run the main function when this module is loaded
main().catch(error => {
  console.error('❌ Command failed:', error.message);
  process.exit(1);
});

module.exports = { main, showHelp, handleConfigCommand, handleCleanupCommand };