const fs = require('fs');
const path = require('path');

// A minimalist gray placeholder PNG (1x1 gray pixel base64)
const base64Data = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==";
const buffer = Buffer.from(base64Data, 'base64');

const assetsDir = path.join(__dirname, 'backend', 'assets');
if (!fs.existsSync(assetsDir)) {
    fs.mkdirSync(assetsDir, { recursive: true });
}

fs.writeFileSync(path.join(assetsDir, 'placeholder.png'), buffer);
console.log("Placeholder created successfully at backend/assets/placeholder.png");
