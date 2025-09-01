#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('🚀 Setting up Development Environment...\n');

// Colors for console output
const colors = {
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  blue: '\x1b[34m',
  reset: '\x1b[0m'
};

function log(message, color = 'green') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logStep(step) {
  console.log(`\n${colors.blue}📋 Step ${step}${colors.reset}`);
}

// Step 1: Check if .env exists
logStep(1);
if (fs.existsSync('.env')) {
  log('✅ Found existing .env file', 'green');
  
  // Backup current .env
  const backupName = `.env.backup.${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}`;
  fs.copyFileSync('.env', backupName);
  log(`📦 Backed up current .env to ${backupName}`, 'yellow');
  
  // Copy to .env.production
  fs.copyFileSync('.env', '.env.production');
  log('✅ Created .env.production', 'green');
} else {
  log('❌ No .env file found. Please create one first.', 'red');
  process.exit(1);
}

// Step 2: Create development environment file
logStep(2);
const devEnvContent = `# Development Environment Configuration
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_mysql_password
DB_NAME=inventory_system_dev

# JWT Configuration
JWT_SECRET=dev_jwt_secret_key_change_in_production

# Server Configuration
PORT=5001
NODE_ENV=development

# Optional: Email Configuration
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email@gmail.com
SMTP_PASS=your_email_password

# Optional: File Upload Configuration
UPLOAD_PATH=./uploads_dev
MAX_FILE_SIZE=5242880
`;

fs.writeFileSync('.env.development', devEnvContent);
log('✅ Created .env.development', 'green');

// Step 3: Update package.json scripts
logStep(3);
const packagePath = path.join(__dirname, 'package.json');
if (fs.existsSync(packagePath)) {
  const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
  
  if (!packageJson.scripts) {
    packageJson.scripts = {};
  }
  
  // Add development scripts
  packageJson.scripts = {
    ...packageJson.scripts,
    "dev": "NODE_ENV=development node server.js",
    "prod": "NODE_ENV=production node server.js",
    "dev:client": "cd client && npm start",
    "build:dev": "cd client && npm run build",
    "build:prod": "cd client && npm run build",
    "setup:dev": "node setup-dev.js"
  };
  
  fs.writeFileSync(packagePath, JSON.stringify(packageJson, null, 2));
  log('✅ Updated package.json with development scripts', 'green');
} else {
  log('⚠️  package.json not found, skipping script updates', 'yellow');
}

// Step 4: Create development database script
logStep(4);
const dbScript = `-- Development Database Setup Script
-- Run this in MySQL to create your development database

-- Create development database
CREATE DATABASE IF NOT EXISTS inventory_system_dev;

-- Use the development database
USE inventory_system_dev;

-- Copy your production schema here
-- You can export your current database structure with:
-- mysqldump -u root -p inventory_system --no-data > schema.sql
-- Then import it to the development database

-- Example: Import your current schema
-- mysql -u root -p inventory_system_dev < schema.sql

SELECT 'Development database setup complete!' as status;
`;

fs.writeFileSync('setup-dev-database.sql', dbScript);
log('✅ Created setup-dev-database.sql', 'green');

// Step 5: Create development startup script
logStep(5);
const startupScript = `@echo off
echo 🚀 Starting Development Environment...
echo.
echo 📋 Environment: Development
echo 🌐 Port: 5001
echo 🗄️  Database: inventory_system_dev
echo.
echo ⚠️  Make sure you have:
echo    - Created the development database
echo    - Copied your production data to development
echo.
echo Starting server...
NODE_ENV=development node server.js
pause
`;

fs.writeFileSync('start-dev.bat', startupScript);
log('✅ Created start-dev.bat for Windows', 'green');

// Step 6: Create .gitignore entries
logStep(6);
const gitignorePath = path.join(__dirname, '.gitignore');
let gitignoreContent = '';

if (fs.existsSync(gitignorePath)) {
  gitignoreContent = fs.readFileSync(gitignorePath, 'utf8');
}

const newEntries = `
# Development Environment
.env.development
.env.production
.env.backup.*
uploads_dev/
setup-dev-database.sql
start-dev.bat
`;

if (!gitignoreContent.includes('.env.development')) {
  fs.appendFileSync(gitignorePath, newEntries);
  log('✅ Updated .gitignore with development files', 'green');
} else {
  log('✅ .gitignore already contains development entries', 'green');
}

// Step 7: Create validation script
logStep(7);
const validationScript = `#!/usr/bin/env node

const requiredEnvVars = [
  'DB_HOST',
  'DB_USER', 
  'DB_PASSWORD',
  'DB_NAME',
  'JWT_SECRET',
  'PORT'
];

console.log('🔍 Validating environment variables...\\n');

let allValid = true;

requiredEnvVars.forEach(varName => {
  if (!process.env[varName]) {
    console.error(\`❌ Missing required environment variable: \${varName}\`);
    allValid = false;
  } else {
    console.log(\`✅ \${varName}: \${varName.includes('PASSWORD') ? '***' : process.env[varName]}\`);
  }
});

if (allValid) {
  console.log('\\n✅ All environment variables are valid!');
  console.log(\`🌍 Environment: \${process.env.NODE_ENV || 'development'}\`);
  console.log(\`🌐 Port: \${process.env.PORT}\`);
  console.log(\`🗄️  Database: \${process.env.DB_NAME}\`);
} else {
  console.log('\\n❌ Environment validation failed!');
  process.exit(1);
}
`;

fs.writeFileSync('validate-env.js', validationScript);
log('✅ Created validate-env.js', 'green');

// Final instructions
console.log(`\n${colors.green}🎉 Development Environment Setup Complete!${colors.reset}\n`);

log('📋 Next Steps:', 'blue');
console.log('1. Update your .env.development with your actual database credentials');
console.log('2. Create the development database:');
console.log('   mysql -u root -p -e "CREATE DATABASE inventory_system_dev;"');
console.log('3. Copy your production data to development:');
console.log('   mysqldump -u root -p inventory_system | mysql -u root -p inventory_system_dev');
console.log('4. Start development server:');
console.log('   npm run dev');
console.log('   or');
console.log('   start-dev.bat (Windows)');

log('\n🛡️ Safety Features:', 'blue');
console.log('✅ Separate development database');
console.log('✅ Different port (5001)');
console.log('✅ Environment-specific configuration');
console.log('✅ Backup of original .env file');

log('\n🔧 Available Commands:', 'blue');
console.log('npm run dev          - Start development server');
console.log('npm run prod         - Start production server');
console.log('npm run dev:client   - Start React development server');
console.log('node validate-env.js - Validate environment variables');

console.log(`\n${colors.yellow}⚠️  Remember: Always test changes in development before applying to production!${colors.reset}\n`);
