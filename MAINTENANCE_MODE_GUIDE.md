# 🔧 Maintenance Mode Guide

## Current Status

**Maintenance mode is ENABLED by default** to help troubleshoot rate limiting issues.

## How to Enable/Disable Maintenance Mode

### Enable Maintenance Mode

Open your browser's Developer Console (F12) and run:

```javascript
// Enable maintenance mode
localStorage.setItem('maintenanceMode', 'true');
window.location.reload();
```

### Disable Maintenance Mode

```javascript
// Disable maintenance mode
localStorage.setItem('maintenanceMode', 'false');
localStorage.removeItem('maintenanceBypassed');
window.location.reload();
```

### Bypass Maintenance Mode (Temporary)

When maintenance mode is active, you can bypass it by:

1. Enter the password: **`delodur`** (case-insensitive)
2. Click "Bypass" button
3. The system will reload and you'll have access

**Note:** The bypass is stored in localStorage and will persist until you clear it or disable maintenance mode.

### Clear Bypass

```javascript
// Clear bypass (will show maintenance screen again if enabled)
localStorage.removeItem('maintenanceBypassed');
window.location.reload();
```

---

## Quick Reference

| Action | Command |
|--------|---------|
| **Enable** | `localStorage.setItem('maintenanceMode', 'true'); location.reload();` |
| **Disable** | `localStorage.removeItem('maintenanceMode'); location.reload();` |
| **Bypass Password** | `delodur` |
| **Clear Bypass** | `localStorage.removeItem('maintenanceBypassed'); location.reload();` |

---

## Features

- ✅ Beautiful animated maintenance screen
- ✅ Password-protected bypass (password: `delodur`)
- ✅ Persistent bypass (stored in localStorage)
- ✅ Easy to enable/disable via console
- ✅ Works across all routes
- ✅ Responsive design

---

*Use maintenance mode when troubleshooting rate limiting issues or performing system updates.*

