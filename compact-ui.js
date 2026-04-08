const fs = require('fs');
const path = require('path');

function walkDir(dir, callback) {
  fs.readdirSync(dir).forEach(f => {
    let dirPath = path.join(dir, f);
    let isDirectory = fs.statSync(dirPath).isDirectory();
    isDirectory ? walkDir(dirPath, callback) : callback(path.join(dir, f));
  });
}

walkDir('frontend/src', function(filePath) {
  if (filePath.endsWith('.jsx') || filePath.endsWith('.js')) {
    let content = fs.readFileSync(filePath, 'utf8');
    let original = content;
    
    // Global Spacing Control
    content = content.replace(/\bgap-8\b/g, 'gap-5');
    content = content.replace(/\bgap-6\b/g, 'gap-4');
    content = content.replace(/\bgap-4\b/g, 'gap-3');
    
    content = content.replace(/\bpy-20\b/g, 'py-12');
    content = content.replace(/\bpy-16\b/g, 'py-10');
    content = content.replace(/\bpy-12\b/g, 'py-8');
    
    // Cards & Padding
    content = content.replace(/\bp-6\b/g, 'p-4');
    content = content.replace(/\bp-4\b/g, 'p-3');
    
    // Image Heights
    content = content.replace(/\bh-64\b/g, 'h-48');
    
    // Text Sizing
    content = content.replace(/\btext-lg\b/g, 'text-base');
    content = content.replace(/\btext-xl\b/g, 'text-lg');
    
    // Button Standardization
    content = content.replace(/className=\"([^\"]*?px-\d+[^\"]*?py-\d+[^\"]*?)\"/g, (match, classes) => {
      if (classes.includes('bg-')) {
        return 'className="px-4 py-2 text-sm rounded-lg bg-[#0f172a] text-white hover:scale-[1.02] shadow-sm transition-transform"';
      }
      return match;
    });
    
    // Spacing fixes
    content = content.replace(/\bpt-20\b/g, 'pt-4');
    content = content.replace(/\bpt-24\b/g, 'pt-4');
    content = content.replace(/\bmt-20\b/g, 'mt-0');
    content = content.replace(/\bmt-24\b/g, 'mt-0');
    
    // Navbar
    if (filePath.toLowerCase().includes('navbar')) {
       content = content.replace(/\bh-20\b/g, 'h-16');
       content = content.replace(/\bh-24\b/g, 'h-16');
    }
    
    if (content !== original) {
      fs.writeFileSync(filePath, content, 'utf8');
      console.log('Compacted: ' + filePath);
    }
  }
});
