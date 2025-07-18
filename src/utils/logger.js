class Logger {
  constructor(debugMode = false) {
    this.debugMode = debugMode;
    
    // Miami theme colors
    this.miami = {
      blue: '\x1b[38;5;81m',     // Miami blue (bright cyan)
      pink: '\x1b[38;5;198m',    // Miami pink (hot pink)
      purple: '\x1b[38;5;141m',  // Miami purple (medium orchid)
      reset: '\x1b[0m',          // Reset color
      bold: '\x1b[1m',           // Bold text
      dim: '\x1b[2m'             // Dim text
    };
  }

  log(message, color = 'blue') {
    if (this.debugMode) {
      console.log(`${this.miami[color]}${message}${this.miami.reset}`);
    }
  }

  info(message) {
    console.log(`${this.miami.blue}${message}${this.miami.reset}`);
  }

  success(message) {
    console.log(`${this.miami.pink}${message}${this.miami.reset}`);
  }

  warning(message) {
    console.log(`${this.miami.purple}${message}${this.miami.reset}`);
  }

  error(message) {
    console.log(`${this.miami.pink}❌ ${message}${this.miami.reset}`);
  }

  debug(message) {
    if (this.debugMode) {
      console.log(`${this.miami.dim}[DEBUG] ${message}${this.miami.reset}`);
    }
  }
}

module.exports = Logger;