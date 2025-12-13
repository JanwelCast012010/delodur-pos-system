# 🛡️ Inventory System Backup & Restore Guide

## Overview
This backup system provides complete protection for your inventory system with automatic timestamped backups and multiple restore options.

## 📁 Backup Files Created

### **`create-backup.bat`** - Create System Backup
- Creates timestamped backups of all critical files
- Backs up server.js, package.json, .env files
- Backs up entire React client source code
- Attempts database backup (if MySQL available)
- Creates detailed backup information

### **`restore-backup.bat`** - Restore Specific Backup
- Restores from any backup timestamp
- Shows available backups if no timestamp provided
- Creates safety backup before restore
- Optional database restore
- Interactive confirmation

### **`list-backups.bat`** - List All Backups
- Shows all available backups with details
- Displays creation dates and file contents
- Provides restore instructions

### **`emergency-restore.bat`** - Emergency Recovery
- Automatically finds and restores most recent backup
- Requires "EMERGENCY" confirmation
- Creates emergency backup of current state
- Fastest recovery option

## 🚀 How to Use

### **Before Making Changes (Always!)**
```bash
# Create a backup before any changes
create-backup.bat
```

### **List Available Backups**
```bash
# See all your backups
list-backups.bat
```

### **Restore a Specific Backup**
```bash
# Restore from a specific timestamp
restore-backup.bat 2025-09-01_14-30-25
```

### **Emergency Recovery**
```bash
# Quick restore of most recent backup
emergency-restore.bat
```

## 📦 What Gets Backed Up

### **Critical Files**
- ✅ `server.js` - Main server file
- ✅ `package.json` - Dependencies and scripts
- ✅ `.env` - Production environment variables
- ✅ `.env.development` - Development environment variables

### **React Client**
- ✅ `client/src/` - All React components
- ✅ `client/src/components/` - Stock.js, Dashboard.js, etc.
- ✅ `client/src/App.js` - Main application
- ✅ All CSS and configuration files

### **Database**
- ✅ `database_backup.sql` - Complete database dump (if MySQL available)

## 🔄 Restore Process

### **Safety Features**
1. **Pre-restore backup** - Current system backed up before restore
2. **Confirmation prompts** - Multiple safety confirmations
3. **File validation** - Checks backup integrity
4. **Rollback option** - Can restore from pre-restore backup

### **Restore Options**
1. **Files only** - Restore code without database
2. **Complete restore** - Files + database
3. **Emergency restore** - Fastest recovery option

## 📁 Backup Structure

```
SYSTEM_BACKUPS/
├── backup_2025-09-01_14-30-25/
│   ├── server.js
│   ├── package.json
│   ├── .env
│   ├── .env.development
│   ├── client_src/
│   │   └── [all React files]
│   ├── database_backup.sql
│   ├── backup_info.txt
│   └── restore_this_backup.bat
├── backup_2025-09-01_15-45-12/
│   └── [another backup]
└── emergency_backup_2025-09-01_16-20-30/
    └── [emergency backup]
```

## 🎯 Best Practices

### **Before Implementing New Features**
1. **Always create a backup first**
   ```bash
   create-backup.bat
   ```

2. **Test your changes thoroughly**
   ```bash
   npm start
   ```

3. **If something breaks, restore immediately**
   ```bash
   emergency-restore.bat
   ```

### **Regular Maintenance**
1. **Create backups weekly** - Even if no changes
2. **Keep last 5 backups** - Delete older ones to save space
3. **Test restore process** - Verify backups work

### **Before Major Updates**
1. **Create multiple backups** - One before each major change
2. **Document changes** - Note what you're changing
3. **Test in stages** - Small changes, test, backup, repeat

## 🚨 Emergency Procedures

### **System Won't Start**
```bash
# Quick emergency restore
emergency-restore.bat
```

### **Database Issues**
```bash
# Restore with database
restore-backup.bat [TIMESTAMP]
# Choose 'y' when asked about database restore
```

### **React App Broken**
```bash
# Restore client files only
restore-backup.bat [TIMESTAMP]
# Choose 'n' for database restore
```

## 💡 Tips & Tricks

### **Naming Your Backups**
- Create descriptive backups: `create-backup.bat`
- Note what you're changing in the backup info
- Use meaningful timestamps for easy identification

### **Space Management**
- Each backup is ~10-50MB depending on client size
- Keep last 5 backups for safety
- Delete older backups manually if needed

### **Testing Backups**
- Periodically test restore process
- Verify system works after restore
- Keep backup of working system before testing

## 🔧 Troubleshooting

### **Backup Fails**
- Check if MySQL is installed and accessible
- Verify file permissions
- Ensure enough disk space

### **Restore Fails**
- Check backup integrity
- Verify MySQL credentials
- Try emergency restore as fallback

### **Database Restore Issues**
- Check MySQL is running
- Verify database exists
- Check user permissions

## 📞 Support

If you encounter issues:
1. Check this guide first
2. Try emergency restore
3. Check backup files exist
4. Verify MySQL connection

---

**Remember: Always backup before making changes!** 🛡️
