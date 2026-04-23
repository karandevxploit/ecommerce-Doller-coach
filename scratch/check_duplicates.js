const fs = require('fs');
const path = require('path');

const checkDuplicates = (filePath) => {
    if (!fs.existsSync(filePath)) return;
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');
    const declarations = {};
    const imports = {};

    lines.forEach((line, index) => {
        const declMatch = line.match(/(?:const|let|var)\s+([\w{},\s]+)\s*=/);
        if (declMatch) {
            const vars = declMatch[1].replace(/[{}]/g, '').split(',').map(v => v.trim());
            vars.forEach(v => {
                if (v) {
                    if (declarations[v]) {
                        console.log(`Duplicate variable '${v}' in ${filePath} at line ${index + 1} (previous at line ${declarations[v]})`);
                    }
                    declarations[v] = index + 1;
                }
            });
        }

        const importMatch = line.match(/require\(['"](.+)['"]\)/);
        if (importMatch) {
            const imp = importMatch[1];
            if (imports[imp]) {
                // Ignore some common repeats if they are deliberate, but usually they shouldn't be in same scope
                // For now, log all
                console.log(`Possible duplicate import '${imp}' in ${filePath} at line ${index + 1} (previous at line ${imports[imp]})`);
            }
            imports[imp] = index + 1;
        }
    });
};

const filesToCheck = [
    'backend/server.js',
    'backend/routes/product.routes.js',
    'backend/routes/auth.routes.js',
    'backend/controllers/product.controller.js',
    'backend/controllers/upload.controller.js',
    'backend/middlewares/upload.middleware.js'
];

filesToCheck.forEach(f => {
    const fullPath = path.join(process.cwd(), f);
    checkDuplicates(fullPath);
});
