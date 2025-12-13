# Server Resource Monitoring Guide

## What is Server Monitoring?

Server monitoring means **watching your server's health** in real-time to see:
- How much CPU is being used
- How much RAM (memory) is available
- How fast the disk is reading/writing
- How many database connections are active
- Network traffic

## Why Monitor?

**Without monitoring:**
- Server crashes → You don't know why
- Slow performance → You don't know what's wrong
- High costs → You don't know what's using resources

**With monitoring:**
- See problems before they crash the server
- Know when to upgrade
- Optimize what's using too much

## How to Monitor (Windows Server)

### Method 1: Task Manager (Built-in)
1. Press `Ctrl + Shift + Esc` to open Task Manager
2. Click "Performance" tab
3. Watch:
   - **CPU**: Should be under 70% normally
   - **Memory (RAM)**: Should have free space
   - **Disk**: Should be under 80% usage

### Method 2: Resource Monitor
1. Press `Win + R`, type `resmon`, press Enter
2. See detailed CPU, Memory, Disk, Network usage
3. See which processes are using resources

### Method 3: PowerShell Commands
```powershell
# Check CPU and Memory
Get-Counter "\Processor(_Total)\% Processor Time"
Get-Counter "\Memory\Available MBytes"

# Check Disk Usage
Get-PSDrive C | Select-Object Used,Free
```

## What to Watch For

### CPU Usage
- **Normal**: 20-50%
- **Warning**: 70-80%
- **Critical**: 90%+ (server will slow down)

### RAM Usage
- **Normal**: 50-70% used
- **Warning**: 80-90% used
- **Critical**: 95%+ (server may crash)

### Disk I/O
- **Normal**: Low activity
- **Warning**: High read/write (database queries)
- **Critical**: 100% disk usage (everything slows down)

## When to Upgrade

Upgrade your server if you see:
- CPU constantly above 80%
- RAM constantly above 90%
- Disk always at 100%
- Slow response times
- Users complaining about slowness

## Free Monitoring Tools

1. **Windows Performance Monitor** (Built-in)
   - Type `perfmon` in Run dialog
   - Create custom monitors

2. **HWiNFO** (Free)
   - Download from hwinfo.com
   - Real-time monitoring

3. **Process Explorer** (Free from Microsoft)
   - Advanced Task Manager
   - See what's using resources

