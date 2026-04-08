const fs = require('fs');
const path = require('path');

function processFile(filePath) {
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
    if (classes.includes('bg-') && !classes.includes('opacity') && !match.includes('absolute')) {
      return 'className="px-4 py-2 text-sm rounded-lg bg-[#0f172a] text-white hover:scale-[1.02] shadow-sm transition-all"';
    }
    return match;
  });

  // Top spacing
  content = content.replace(/\bpt-20\b/g, 'pt-4');
  content = content.replace(/\bpt-24\b/g, 'pt-4');
  content = content.replace(/\bmt-20\b/g, 'mt-0');
  content = content.replace(/\bmt-24\b/g, 'mt-0');

  // Navbar specific height
  if (filePath.toLowerCase().includes('navbar')) {
    content = content.replace(/\bh-20\b/g, 'h-16');
    content = content.replace(/\bh-24\b/g, 'h-16');
  }

  if (content !== original) {
    fs.writeFileSync(filePath, content, 'utf8');
  }
}

function walk(dir) {
  let list = fs.readdirSync(dir);
  list.forEach(file => {
    let fileDir = path.join(dir, file);
    let stat = fs.statSync(fileDir);
    if (stat && stat.isDirectory()) {
      walk(fileDir);
    } else if (file.endsWith('.jsx')) {
      processFile(fileDir);
    }
  });
}

walk(path.join(__dirname, 'frontend/src'));
console.log("Done");
