# 💾 External Hard Drive Backup Guide

## 🚀 Quick Backup Options

### Option 1: Automated Backup (Recommended)
1. **Connect your external hard drive** to your computer
2. **Run the backup script:**
   ```bash
   backup-to-external.bat
   ```
3. **Follow the prompts** to select your external drive
4. **Wait for completion** - the script will copy everything automatically

### Option 2: Manual Backup
1. **Connect your external hard drive**
2. **Create a folder** on your external drive (e.g., `INVENTORY_SYSTEM_BACKUP_2025-09-02`)
3. **Copy these folders and files:**
   - `client/` (entire folder)
   - `CSV FILES/` (entire folder)
   - `DB_BACKUPS/` (entire folder)
   - `SYSTEM_BACKUPS/` (entire folder)
   - `FILES/` (entire folder)
   - `FOR LABEL/` (entire folder)
   - `server.js`
   - `package.json`
   - `package-lock.json`
   - `.env` (if exists)
   - `*.md` (all documentation files)
   - `*.pdf` (all PDF guides)
   - `*.sql` (all database scripts)
   - `*.bat` (all batch files)

## 📋 What Gets Backed Up

### ✅ Included:
- **Complete source code** (server.js, React client)
- **Database files** (SQL scripts, backups)
- **CSV data files** (your inventory data)
- **Documentation** (guides, API docs, user manual)
- **System backups** (existing backups)
- **Configuration files** (.env, package.json)
- **Scripts and utilities** (backup, restore, import scripts)

### ❌ Excluded (to save space):
- `node_modules/` (can be reinstalled with `npm install`)
- `client/build/` (can be rebuilt with `npm run build`)
- `.git/` (version control history)
- `temp/` (temporary files)

## 🔄 How to Restore from External Backup

### On a New Computer:
1. **Copy the backup folder** from external drive to new computer
2. **Install Node.js** (download from nodejs.org)
3. **Install MySQL** (download from mysql.com)
4. **Open Command Prompt** in the backup folder
5. **Install dependencies:**
   ```bash
   npm install
   cd client
   npm install
   cd ..
   ```
6. **Import database:**
   ```bash
   mysql -u root -p inventory_system < DB_BACKUPS/inventory_system_backup.sql
   ```
7. **Start the system:**
   ```bash
   npm start
   ```

### Using the Restore Script:
1. **Run the restore script:**
   ```bash
   RESTORE_BACKUP.bat
   ```
2. **Follow the prompts** to restore files
3. **Complete the setup steps** as shown above

## 📊 Backup Size Estimation

- **Source code:** ~50 MB
- **CSV data files:** ~100-500 MB (depending on your data)
- **Database backups:** ~50-200 MB (depending on your data)
- **Documentation:** ~20 MB
- **Total estimated size:** ~200-800 MB

## 🔒 Backup Security Tips

1. **Keep multiple backups** on different external drives
2. **Test your backups** by restoring on a test computer
3. **Update backups regularly** (weekly or monthly)
4. **Store backups in different locations** (home, office, cloud)
5. **Label your backup drives** with dates and contents

## 🆘 Troubleshooting

### Backup Script Issues:
- **Drive not found:** Check external drive connection
- **Permission denied:** Run Command Prompt as Administrator
- **Out of space:** Free up space on external drive

### Restore Issues:
- **Node.js not found:** Install Node.js from nodejs.org
- **MySQL not found:** Install MySQL from mysql.com
- **Database import fails:** Check MySQL credentials and database exists

## 📞 Support

If you encounter any issues:
1. Check the `BACKUP_INFO.txt` file in your backup
2. Review the `USER_GUIDE.md` and `SYSTEM_DOCUMENTATION.md`
3. Check the console logs for error messages

---

**Last Updated:** September 2, 2025  
**System Version:** DELODUR CORPORATION TRACK v2
