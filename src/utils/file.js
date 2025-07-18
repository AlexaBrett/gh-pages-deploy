const fs = require('fs');
const path = require('path');

class FileUtil {
  static copyDirectory(src, dest) {
    const items = fs.readdirSync(src);
    
    items.forEach(item => {
      const srcPath = path.join(src, item);
      const destPath = path.join(dest, item);
      const stat = fs.statSync(srcPath);
      
      if (stat.isDirectory()) {
        if (!fs.existsSync(destPath)) {
          fs.mkdirSync(destPath, { recursive: true });
        }
        FileUtil.copyDirectory(srcPath, destPath);
      } else {
        fs.copyFileSync(srcPath, destPath);
      }
    });
  }

  static loadPackageJson(cwd) {
    try {
      return JSON.parse(fs.readFileSync(path.join(cwd, 'package.json'), 'utf8'));
    } catch (error) {
      throw new Error('No package.json found. Are you in an npm project?');
    }
  }
}

module.exports = FileUtil;