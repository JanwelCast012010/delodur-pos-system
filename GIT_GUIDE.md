# 🚀 Git Guide for Your Inventory System

## 📚 What is Git?
Git is a **version control system** that tracks changes to your code. Think of it as a time machine for your files - you can:
- Save snapshots of your code (commits)
- Go back to any previous version
- See what changed and when
- Work on different features without breaking your main code

---

## 🎯 **Daily Git Workflow (Most Common Commands)**

### **1. Check Status** - See what changed
```bash
git status
```
Shows you:
- Modified files (files you changed)
- Untracked files (new files not yet tracked)
- Files ready to commit

### **2. Save Changes (Commit)** - Create a snapshot
```bash
# Step 1: Add files you want to save
git add server.js                    # Add specific file
git add client/src/components/       # Add entire folder
git add .                            # Add ALL changed files

# Step 2: Save with a message
git commit -m "Fix duplicate code in server.js"
```

**Good commit messages:**
- ✅ `"Fix duplicate code in server.js"`
- ✅ `"Add online user count feature"`
- ✅ `"Update stock management UI"`
- ❌ `"fix"` (too vague)
- ❌ `"changes"` (not descriptive)

### **3. View History** - See your saved snapshots
```bash
git log                    # Full history
git log --oneline          # Compact view (recommended)
git log -5                 # Last 5 commits
```

### **4. Undo Changes** - Go back in time

**Undo changes in a file (before committing):**
```bash
git restore server.js      # Discard changes, go back to last commit
```

**Undo last commit (keep changes):**
```bash
git reset --soft HEAD~1    # Undo commit, keep changes staged
```

**Undo last commit (discard changes):**
```bash
git reset --hard HEAD~1    # ⚠️ WARNING: This deletes your changes!
```

---

## 🌿 **Branching (Working on Features Safely)**

You're currently on `development` branch. This is good practice!

### **Create a new branch for a feature:**
```bash
git checkout -b feature/online-users    # Create and switch to new branch
# or
git switch -c feature/online-users      # Modern way
```

### **Switch between branches:**
```bash
git checkout main              # Switch to main branch
git checkout development      # Switch to development branch
git switch development        # Modern way
```

### **See all branches:**
```bash
git branch                    # Local branches
git branch -a                 # All branches (including remote)
```

### **Merge branch into development:**
```bash
git checkout development      # Switch to development
git merge feature/online-users # Merge your feature
```

---

## ☁️ **Working with Remote (GitHub/GitLab)**

### **Push your changes to remote:**
```bash
git push origin development   # Push development branch
git push origin main          # Push main branch
```

### **Pull latest changes:**
```bash
git pull origin development   # Get latest from remote
```

### **See differences:**
```bash
git diff                      # See what changed (unstaged)
git diff --staged             # See what's ready to commit
git diff HEAD~1               # Compare with previous commit
```

---

## 🛡️ **Protection Against File Corruption**

### **Before making big changes:**
```bash
# 1. Check current status
git status

# 2. Commit current work
git add .
git commit -m "Save before major changes"

# 3. Create a backup branch (extra safety)
git branch backup-before-changes
```

### **If something goes wrong:**
```bash
# See what changed
git diff server.js

# Restore from last commit
git restore server.js

# Or go back to a specific commit
git log --oneline              # Find the commit hash
git checkout <commit-hash>     # Go back to that version
git checkout development       # Return to latest
```

---

## 📋 **Common Scenarios**

### **Scenario 1: You made changes and want to save them**
```bash
git status                    # Check what changed
git add .                     # Add all changes
git commit -m "Your message"  # Save with message
git push origin development   # Upload to remote
```

### **Scenario 2: You broke something and want to undo**
```bash
git log --oneline             # Find the last good commit
git restore server.js         # Restore specific file
# OR
git reset --hard HEAD~1       # Go back one commit (⚠️ deletes changes)
```

### **Scenario 3: You want to work on a new feature**
```bash
git checkout development      # Make sure you're on development
git pull origin development   # Get latest changes
git checkout -b feature/new-feature  # Create new branch
# ... make your changes ...
git add .
git commit -m "Add new feature"
git push origin feature/new-feature
```

### **Scenario 4: You want to see what changed in a file**
```bash
git diff server.js            # See current changes
git log -p server.js          # See all changes in file history
```

---

## 🎓 **Best Practices**

1. **Commit often** - Small, frequent commits are better than huge ones
2. **Write clear messages** - Describe WHAT and WHY you changed
3. **Use branches** - Keep `main` stable, work on `development` or feature branches
4. **Pull before push** - Always get latest changes first
5. **Review before commit** - Use `git diff` to see what you're committing

---

## 🔧 **Quick Reference**

| Command | What it does |
|---------|-------------|
| `git status` | See what changed |
| `git add .` | Stage all changes |
| `git commit -m "msg"` | Save snapshot |
| `git log --oneline` | View history |
| `git restore <file>` | Undo file changes |
| `git checkout -b <name>` | Create new branch |
| `git push origin <branch>` | Upload to remote |
| `git pull origin <branch>` | Download from remote |
| `git diff` | See changes |

---

## 🆘 **Emergency Recovery**

If your file gets corrupted (like what happened with `server.js`):

```bash
# Option 1: Restore from last commit
git restore server.js

# Option 2: Go back to specific commit
git log --oneline server.js   # Find good commit
git checkout <commit-hash> -- server.js
git commit -m "Restore server.js from backup"

# Option 3: See all versions
git log --all --oneline server.js
```

---

## 💡 **Pro Tips**

1. **Use `.gitignore`** - Already set up! It prevents committing:
   - `node_modules/` (too large)
   - `.env` files (sensitive data)
   - Backup files
   - Temporary files

2. **Create backup branches before risky changes:**
   ```bash
   git branch backup-$(date +%Y%m%d)
   ```

3. **Use descriptive branch names:**
   - ✅ `feature/online-users`
   - ✅ `fix/duplicate-code`
   - ❌ `test` or `new`

4. **Review before committing:**
   ```bash
   git diff --staged    # See what you're about to commit
   ```

---

## 🎯 **Your Current Setup**

- **Current branch:** `development` ✅
- **Remote:** `origin` (connected to GitHub/GitLab)
- **Main branch:** `main` (stable/production)
- **Working branch:** `development` (where you make changes)

**Recommended workflow:**
1. Work on `development` branch
2. Test your changes
3. Commit frequently
4. When stable, merge to `main`

---

## 📞 **Need Help?**

- `git help <command>` - Get help for any command
- `git status` - Always start here to see what's happening
- Check your commit history: `git log --oneline --graph --all`

---

**Remember:** Git is your safety net. Commit often, and you'll never lose your work! 🛡️

