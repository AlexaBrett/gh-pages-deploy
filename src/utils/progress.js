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
    this.isProgressActive = false;
  }

  startProgress(steps) {
    if (this.debugMode) return;
    
    this.steps = steps;
    this.totalSteps = steps.length;
    this.currentStep = 0;
    this.isProgressActive = true;
    
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
      // Stop progress animation and restore console for this step
      this.pauseProgress();
      
      const result = await asyncFn();
      
      this.completeStep(description);
      return result;
    } catch (error) {
      this.failStep(description, error);
      throw error;
    }
  }

  updateProgress(currentDescription = null) {
    if (this.debugMode || !this.isProgressActive) return;
    
    this.stopSpinner();
    
    const description = currentDescription || (this.steps[this.currentStep - 1] || 'Processing');
    
    this.interval = setInterval(() => {
      process.stdout.write(`\r${this.spinner[this.spinnerIndex]} ${this.currentStep}/${this.totalSteps} ${description}...`);
      this.spinnerIndex = (this.spinnerIndex + 1) % this.spinner.length;
    }, 100);
  }

  completeStep(description) {
    if (this.debugMode) return;
    
    this.stopSpinner();
    process.stdout.write(`\r✅ ${this.currentStep}/${this.totalSteps} ${description}\n`);
  }

  failStep(description, error) {
    if (this.debugMode) return;
    
    this.stopSpinner();
    process.stdout.write(`\r❌ ${this.currentStep}/${this.totalSteps} ${description} - Failed\n`);
    console.error(`Error: ${error.message}`);
  }

  complete() {
    if (this.debugMode) return;
    
    this.stopSpinner();
    this.isProgressActive = false;
    
    // Clear the current line and show success message
    process.stdout.write('\r' + ' '.repeat(80) + '\r');
    console.log('🎉 Deployment completed successfully!\n');
  }

  stopSpinner() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }

  pauseProgress() {
    if (this.debugMode) return;
    this.stopSpinner();
    // Clear the current progress line
    process.stdout.write('\r' + ' '.repeat(80) + '\r');
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
    
    // Always stop the spinner first to prevent interference
    this.stopSpinner();
    
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