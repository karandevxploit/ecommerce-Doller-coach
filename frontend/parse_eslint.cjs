const fs = require('fs');
const data = JSON.parse(fs.readFileSync('eslint_report.json', 'utf8'));
data.forEach(f => {
  if (f.errorCount > 0 || f.warningCount > 0) {
    console.log('\n' + f.filePath);
    f.messages.forEach(m => {
      console.log(`  Line ${m.line}: ${m.message} (${m.ruleId})`);
    });
  }
});
