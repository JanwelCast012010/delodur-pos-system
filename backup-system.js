#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('🛡️ Creating Safety Backup System...\n');

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

// Create backup directory
const backupDir = path.join(__dirname, 'SAFETY_BACKUPS');
if (!fs.existsSync(backupDir)) {
  fs.mkdirSync(backupDir);
  log('✅ Created SAFETY_BACKUPS directory', 'green');
}

// Critical files to backup
const criticalFiles = [
  'client/src/components/Stock.js',
  'server.js',
  'package.json',
  '.env',
  '.env.development'
];

// Create backup function
function createBackup() {
  const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
  const backupName = `backup_${timestamp}`;
  const backupPath = path.join(backupDir, backupName);
  
  if (!fs.existsSync(backupPath)) {
    fs.mkdirSync(backupPath);
  }
  
  log(`📦 Creating backup: ${backupName}`, 'blue');
  
  // Backup critical files
  criticalFiles.forEach(file => {
    const sourcePath = path.join(__dirname, file);
    const destPath = path.join(backupPath, file);
    
    if (fs.existsSync(sourcePath)) {
      // Create directory structure if needed
      const destDir = path.dirname(destPath);
      if (!fs.existsSync(destDir)) {
        fs.mkdirSync(destDir, { recursive: true });
      }
      
      fs.copyFileSync(sourcePath, destPath);
      log(`  ✅ Backed up: ${file}`, 'green');
    } else {
      log(`  ⚠️  File not found: ${file}`, 'yellow');
    }
  });
  
  // Create database backup script
  const dbBackupScript = `@echo off
echo Creating database backup...
mysqldump -u root -p inventory_system > "${backupPath.replace(/\\/g, '/')}/database_backup.sql"
echo Database backup complete!
pause
`;
  
  fs.writeFileSync(path.join(backupPath, 'backup_database.bat'), dbBackupScript);
  log(`  📊 Database backup script created`, 'green');
  
  // Create restore script
  const restoreScript = `@echo off
echo 🚨 RESTORING FROM BACKUP: ${backupName}
echo.
echo This will overwrite current files with backup files.
echo Are you sure? (y/n)
set /p confirm=
if /i "%confirm%"=="y" (
  echo Restoring files...
  xcopy /E /Y "${backupPath.replace(/\\/g, '/')}\\*" "${__dirname.replace(/\\/g, '/')}\\"
  echo.
  echo Files restored! You may need to restart the server.
  echo Run: npm run prod
) else (
  echo Restore cancelled.
)
pause
`;
  
  fs.writeFileSync(path.join(backupPath, 'RESTORE.bat'), restoreScript);
  log(`  🔄 Restore script created`, 'green');
  
  return backupPath;
}

// Create initial backup
log('Creating initial safety backup...', 'blue');
const backupPath = createBackup();
log(`✅ Safety backup created at: ${backupPath}`, 'green');

// Create automatic backup script
const autoBackupScript = `@echo off
echo 🛡️ Creating automatic backup...
cd /d "${__dirname.replace(/\\/g, '/')}"
node backup-system.js
echo Backup complete!
pause
`;

fs.writeFileSync('create-backup.bat', autoBackupScript);
log('✅ Created create-backup.bat for easy backups', 'green');

// Create emergency restore script
const emergencyRestore = `@echo off
echo 🚨 EMERGENCY RESTORE SYSTEM
echo.
echo This will restore the most recent backup.
echo Are you sure? (y/n)
set /p confirm=
if /i "%confirm%"=="y" (
  cd /d "${__dirname.replace(/\\/g, '/')}"
  for /f "delims=" %%i in ('dir /b /ad /o-d SAFETY_BACKUPS\\backup_*') do (
    echo Restoring from: %%i
    cd /d "${__dirname.replace(/\\/g, '/')}\\SAFETY_BACKUPS\\%%i"
    call RESTORE.bat
    goto :done
  )
  :done
) else (
  echo Restore cancelled.
)
pause
`;

fs.writeFileSync('EMERGENCY_RESTORE.bat', emergencyRestore);
log('✅ Created EMERGENCY_RESTORE.bat', 'green');

console.log(`\n${colors.green}🎉 Safety System Setup Complete!${colors.reset}\n`);

log('📋 Available Safety Commands:', 'blue');
console.log('create-backup.bat          - Create a new backup');
console.log('EMERGENCY_RESTORE.bat      - Restore from most recent backup');
console.log('SAFETY_BACKUPS/            - All your backups are stored here');

log('\n🛡️ Safety Features:', 'blue');
console.log('✅ Automatic file backups');
console.log('✅ Database backup scripts');
console.log('✅ Easy restore system');
console.log('✅ Emergency recovery');

log('\n💡 Usage Tips:', 'blue');
console.log('1. Run create-backup.bat before making major changes');
console.log('2. If something breaks, run EMERGENCY_RESTORE.bat');
console.log('3. Check SAFETY_BACKUPS/ folder for all your backups');

console.log(`\n${colors.yellow}⚠️  Remember: Always backup before making changes!${colors.reset}\n`);
