const readline = require('readline');

class PromptUtil {
  static async promptUser(question, defaultValue = '') {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    
    return new Promise((resolve) => {
      rl.question(question, (answer) => {
        rl.close();
        const trimmedAnswer = answer.trim();
        resolve(trimmedAnswer || defaultValue);
      });
    });
  }
}

module.exports = PromptUtil;
