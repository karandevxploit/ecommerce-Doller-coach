const fs = require("fs");
const path = require("path");

const controllersDir = path.join(__dirname, "../controllers");
const BACKUP_DIR = path.join(__dirname, "../.backup/controllers");

const DRY_RUN = process.argv.includes("--dry-run");

/**
 * Ensure backup directory
 */
if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
}

/**
 * Safe transform:
 * Instead of removing asyncHandler → replace with safeHandler
 */
function transform(content) {
    let modified = false;

    // Replace import
    if (content.includes("express-async-handler")) {
        content = content.replace(
            /const\s+asyncHandler\s*=\s*require\(['"]express-async-handler['"]\);\s*\n?/g,
            'const { safeHandler } = require("../middlewares/error.middleware");\n'
        );
        modified = true;
    }

    // Replace asyncHandler(...) with safeHandler(...)
    if (content.includes("asyncHandler(")) {
        content = content.replace(/asyncHandler\s*\(/g, "safeHandler(");
        modified = true;
    }

    return { content, modified };
}

const files = fs.readdirSync(controllersDir).filter(f => f.endsWith(".js"));

files.forEach(file => {
    const filePath = path.join(controllersDir, file);
    const backupPath = path.join(BACKUP_DIR, file);

    const original = fs.readFileSync(filePath, "utf8");

    const { content, modified } = transform(original);

    if (!modified) return;

    console.log(`🔧 Updating ${file}`);

    if (!DRY_RUN) {
        // Backup first
        fs.writeFileSync(backupPath, original);

        // Write updated file
        fs.writeFileSync(filePath, content);
    }
});

console.log(`\n✅ Migration complete ${DRY_RUN ? "(DRY RUN)" : ""}`);