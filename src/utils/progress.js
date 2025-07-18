const colors = require('colors');

class ProgressUtil {
  constructor(debugMode = false) {
    this.debugMode = debugMode;
    this.currentStep = 0;
    this.totalSteps = 0;
    this.steps = [];
    this.originalConsole = null;
    
    // Miami theme colors using ANSI escape codes
    this.miami = {
      blue: '\x1b[38;5;81m',     // Miami blue (bright cyan)
      pink: '\x1b[38;5;198m',    // Miami pink (hot pink)
      purple: '\x1b[38;5;141m',  // Miami purple (medium orchid)
      reset: '\x1b[0m',          // Reset color
      bold: '\x1b[1m',           // Bold text
      dim: '\x1b[2m'             // Dim text
    };
  }

  startProgress(steps) {
    if (this.debugMode) return;
    
    this.steps = steps;
    this.totalSteps = steps.length;
    this.currentStep = 0;
    
    console.log(`${this.miami.blue}🚀 Starting GitHub Pages deployment...${this.miami.reset}\n`);
  }

  async step(description, asyncFn) {
    if (this.debugMode) {
      console.log(`${this.currentStep + 1}/${this.totalSteps} ${description}...`);
      return await asyncFn();
    }
    
    this.currentStep++;
    
    // Show step start
    console.log(`${this.miami.purple}⏳ ${this.currentStep}/${this.totalSteps} ${description}...${this.miami.reset}`);
    
    try {
      const result = await asyncFn();
      
      // Show step completion
      console.log(`${this.miami.pink}✅ ${this.currentStep}/${this.totalSteps} ${description}${this.miami.reset}`);
      
      return result;
    } catch (error) {
      // Show step failure
      console.log(`${colors.red}❌ ${this.currentStep}/${this.totalSteps} ${description} - Failed${this.miami.reset}`);
      console.log(`${colors.red}   Error: ${error.message}${this.miami.reset}`);
      throw error;
    }
  }

  complete() {
    if (this.debugMode) return;
    
    console.log(`${this.miami.pink}${this.miami.bold}\n🎉 Deployment completed successfully!${this.miami.reset}\n`);
  }

  silentConsole() {
    if (this.debugMode) return () => {};
    
    // Only silence if not already silenced
    if (!this.originalConsole) {
      this.originalConsole = {
        log: console.log,
        error: console.error,
        warn: console.warn,
        info: console.info
      };
      
      console.log = () => {};
      console.error = () => {};
      console.warn = () => {};
      console.info = () => {};
    }
    
    return () => {
      this.restoreConsole();
    };
  }

  restoreConsole() {
    if (this.debugMode) return;
    
    if (this.originalConsole) {
      console.log = this.originalConsole.log;
      console.error = this.originalConsole.error;
      console.warn = this.originalConsole.warn;
      console.info = this.originalConsole.info;
      this.originalConsole = null;
    }
  }

  log(message) {
    if (this.debugMode) {
      console.log(message);
    }
  }
}

module.exports = ProgressUtil;