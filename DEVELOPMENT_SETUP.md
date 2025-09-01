# 🛡️ Development Environment Setup Guide

## Overview
This guide shows you how to set up a safe development environment where you can make changes without affecting your main production system.

## 🎯 **Strategy 1: Environment-Based Development (Recommended)**

### Step 1: Create Development Environment Files

Create these files in your project root:

**`.env.development`**
```env
# Development Environment Configuration
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
```

**`.env.production`**
```env
# Production Environment Configuration
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_mysql_password
DB_NAME=inventory_system

# JWT Configuration
JWT_SECRET=your_super_secret_jwt_key_here_change_this_in_production

# Server Configuration
PORT=5000
NODE_ENV=production

# Optional: Email Configuration
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email@gmail.com
SMTP_PASS=your_email_password

# Optional: File Upload Configuration
UPLOAD_PATH=./uploads
MAX_FILE_SIZE=5242880
```

### Step 2: Create Development Database

```sql
-- Create development database
CREATE DATABASE inventory_system_dev;
USE inventory_system_dev;

-- Copy your production schema
-- (You can export your current database structure)
```

### Step 3: Update Package.json Scripts

Add these scripts to your `package.json`:

```json
{
  "scripts": {
    "dev": "NODE_ENV=development node server.js",
    "prod": "NODE_ENV=production node server.js",
    "dev:client": "cd client && npm start",
    "build:dev": "cd client && npm run build",
    "build:prod": "cd client && npm run build"
  }
}
```

### Step 4: Update Server.js to Use Environment Variables

Modify your `server.js` to load the correct environment file:

```javascript
// At the top of server.js
const path = require('path');
const envFile = process.env.NODE_ENV === 'production' ? '.env.production' : '.env.development';
require('dotenv').config({ path: path.join(__dirname, envFile) });
```

## 🎯 **Strategy 2: Git Branching (Best Practice)**

### Development Workflow:

```bash
# 1. Create development branch
git checkout -b development

# 2. Create feature branches for specific changes
git checkout -b feature/remove-print-buttons
git checkout -b feature/add-new-feature

# 3. Make your changes and test them
# ... make changes ...

# 4. Commit your changes
git add .
git commit -m "Remove print functionality from stock table"

# 5. Push to remote (optional)
git push origin feature/remove-print-buttons

# 6. When ready, merge to development
git checkout development
git merge feature/remove-print-buttons

# 7. Test on development branch
# ... test thoroughly ...

# 8. Only merge to main when everything is working
git checkout main
git merge development
```

## 🎯 **Strategy 3: Docker Development (Advanced)**

### Create `docker-compose.dev.yml`:

```yaml
version: '3.8'
services:
  app-dev:
    build: .
    ports:
      - "5001:5001"
    environment:
      - NODE_ENV=development
      - DB_HOST=db-dev
      - DB_NAME=inventory_system_dev
    volumes:
      - .:/app
      - /app/node_modules
    depends_on:
      - db-dev

  db-dev:
    image: mysql:8.0
    environment:
      MYSQL_ROOT_PASSWORD: your_password
      MYSQL_DATABASE: inventory_system_dev
    ports:
      - "3307:3306"
    volumes:
      - mysql_dev_data:/var/lib/mysql

volumes:
  mysql_dev_data:
```

## 🎯 **Strategy 4: Database Backup & Restore**

### Before Making Changes:

```bash
# 1. Backup your current database
mysqldump -u root -p inventory_system > backup_$(date +%Y%m%d_%H%M%S).sql

# 2. Create development database
mysql -u root -p -e "CREATE DATABASE inventory_system_dev;"

# 3. Restore to development database
mysql -u root -p inventory_system_dev < backup_$(date +%Y%m%d_%H%M%S).sql
```

## 🚀 **Quick Start Development Setup**

### Option A: Simple Environment Switch

1. **Copy your current `.env` to `.env.production`**
2. **Create `.env.development` with different database name and port**
3. **Run development server:**
   ```bash
   NODE_ENV=development node server.js
   ```
4. **Run production server:**
   ```bash
   NODE_ENV=production node server.js
   ```

### Option B: Git Branching (Recommended)

1. **Create development branch:**
   ```bash
   git checkout -b development
   ```
2. **Make all changes in development branch**
3. **Test thoroughly**
4. **Only merge to main when ready**

## 🔧 **Development Tools & Tips**

### 1. **Hot Reloading**
```bash
# Install nodemon for auto-restart
npm install -g nodemon

# Run with nodemon
nodemon server.js
```

### 2. **Database Management**
```bash
# Quick database switch
mysql -u root -p -e "USE inventory_system_dev;"

# Reset development database
mysql -u root -p inventory_system_dev < backup.sql
```

### 3. **Environment Validation**
Create a script to validate your environment:

```javascript
// validate-env.js
const requiredEnvVars = [
  'DB_HOST',
  'DB_USER', 
  'DB_PASSWORD',
  'DB_NAME',
  'JWT_SECRET',
  'PORT'
];

requiredEnvVars.forEach(varName => {
  if (!process.env[varName]) {
    console.error(`❌ Missing required environment variable: ${varName}`);
    process.exit(1);
  }
});

console.log('✅ Environment variables validated');
```

## 🛡️ **Safety Checklist**

Before making changes:

- [ ] **Backup your database**
- [ ] **Create development environment**
- [ ] **Use git branching**
- [ ] **Test thoroughly in development**
- [ ] **Have a rollback plan**

## 🎯 **Recommended Approach for Your Project**

Based on your current setup, I recommend:

1. **Start with Strategy 1 (Environment-Based)** - easiest to implement
2. **Add Strategy 2 (Git Branching)** - for version control safety
3. **Use Strategy 4 (Database Backup)** - before major changes

This combination gives you:
- ✅ Safe development environment
- ✅ Version control safety
- ✅ Easy rollback capability
- ✅ No impact on production system

Would you like me to help you implement any of these strategies?
