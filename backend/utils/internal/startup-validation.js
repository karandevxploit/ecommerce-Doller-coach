const path = require('path');
const fs = require('fs');
const chalk = require('chalk');
const env = require('../../config/env');

/**
 * STRICT STARTUP VALIDATION
 * Assures the system starts only when environment is 100% correct.
 */

const requiredEnv = [
  'NODE_ENV',
  'PORT',
  'MYSQL_HOST',
  'MYSQL_USER',
  'MYSQL_DATABASE',
  'JWT_SECRET',
  'REFRESH_TOKEN_SECRET',
  'CLIENT_URL',
  'ADMIN_SECRET',

];

const optionalEnv = [
  'GOOGLE_CLIENT_ID',
  'GOOGLE_CLIENT_SECRET',
  'BREVO_API_KEY',
  'RAZORPAY_KEY_ID',
  'SHIPROCKET_EMAIL'
];

function validateStartup() {
  const missingRequired = [];

  // 1. Validate Required Environment Variables
  requiredEnv.forEach(key => {
    if (!env[key]) {
      missingRequired.push(key);
    }
  });

  console.log(chalk.bold.cyan('\n=== ENV VALIDATION ==='));

  if (missingRequired.length > 0) {
    console.error(chalk.red.bold('❌ CRITICAL: Missing required environment variables:'));
    missingRequired.forEach(key => console.error(chalk.red(`   - ${key}`)));
    console.log(chalk.red('\n[FATAL] System cannot start. Please check your .env file.\n'));
    process.exit(1);
  }

  console.log(chalk.green('✅ All required environment variables present\n'));

  // 2. Validate Directories
  const requiredDirs = ['uploads', 'assets'];
  const rootDir = path.join(__dirname, '../../');
  requiredDirs.forEach(dir => {
    const dirPath = path.join(rootDir, dir);
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
  });
}

function showOptionalWarnings() {
  const missingOptional = [];

  optionalEnv.forEach(key => {
    if (!env[key]) {
      missingOptional.push(key);
    }
  });

  if (missingOptional.length > 0) {
    console.log(chalk.yellow('⚠️ Optional configs missing:'));
    missingOptional.forEach(key => console.log(chalk.yellow(`* ${key}`)));
    console.log(''); // Spacing
  }
}

if (require.main === module) {
  const path = require('path');
  require('dotenv').config({ path: path.join(__dirname, '../../.env') });
  validateStartup();
  showOptionalWarnings();
}

module.exports = { validateStartup, showOptionalWarnings };
