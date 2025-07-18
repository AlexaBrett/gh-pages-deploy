class ProgressUtil {
  constructor(debugMode = false) {
    this.debugMode = debugMode;
    this.currentStep = 0;
    this.totalSteps = 0;
    this.steps = [];
    this.spinner = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
    this.spinnerIndex = 0;
    this.interval = null;
    this.originalConsole = null;
  }

  startProgress(steps) {
    if (this.debugMode) return;
    
    this.steps = steps;
    this.totalSteps = steps.length;
    this.currentStep = 0;
    
    console.log('🚀 Starting GitHub Pages deployment...\n');
    this.updateProgress();
  }

  async step(description, asyncFn) {
    if (this.debugMode) {
      console.log(`${this.currentStep + 1}/${this.totalSteps} ${description}...`);
      return await asyncFn();
    }
    
    this.currentStep++;
    this.updateProgress(description);
    
    try {
      const result = await asyncFn();
      this.completeStep(description);
      return result;
    } catch (error) {
      this.failStep(description, error);
      throw error;
    }
  }

  updateProgress(currentDescription = null) {
    if (this.debugMode) return;
    
    if (this.interval) {
      clearInterval(this.interval);
    }
    
    const description = currentDescription || (this.steps[this.currentStep - 1] || 'Processing');
    
    this.interval = setInterval(() => {
      process.stdout.write(`\r${this.spinner[this.spinnerIndex]} ${this.currentStep}/${this.totalSteps} ${description}...`);
      this.spinnerIndex = (this.spinnerIndex + 1) % this.spinner.length;
    }, 100);
  }

  completeStep(description) {
    if (this.debugMode) return;
    
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
    
    process.stdout.write(`\r✅ ${this.currentStep}/${this.totalSteps} ${description}\n`);
  }

  failStep(description, error) {
    if (this.debugMode) return;
    
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
    
    process.stdout.write(`\r❌ ${this.currentStep}/${this.totalSteps} ${description} - Failed\n`);
    console.error(`Error: ${error.message}`);
  }

  complete() {
    if (this.debugMode) return;
    
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
    
    console.log('\n🎉 Deployment complete!');
  }

  silentConsole() {
    if (this.debugMode) return () => {};
    
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
    
    return () => {
      if (this.originalConsole) {
        console.log = this.originalConsole.log;
        console.error = this.originalConsole.error;
        console.warn = this.originalConsole.warn;
        console.info = this.originalConsole.info;
        this.originalConsole = null;
      }
    };
  }

  log(message) {
    if (this.debugMode) {
      console.log(message);
    }
  }
}

module.exports = ProgressUtil;