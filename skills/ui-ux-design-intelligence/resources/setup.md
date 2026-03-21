# Python Installation

## Check if Python is Installed

```bash
python3 --version || python --version
```

If Python is installed, you'll see a version number (e.g., `Python 3.12.0`).

---

## Installation by Operating System

### macOS

**Using Homebrew (Recommended):**

```bash
brew install python3
```

**Verify installation:**
```bash
python3 --version
```

**Alternative: Download from python.org**
1. Visit [python.org/downloads](https://www.python.org/downloads/)
2. Download macOS installer
3. Run installer and follow prompts

---

### Ubuntu/Debian

```bash
sudo apt update && sudo apt install python3
```

**Verify installation:**
```bash
python3 --version
```

**Install pip (if not included):**
```bash
sudo apt install python3-pip
```

---

### Windows

**Using winget (Windows 10/11):**

```powershell
winget install Python.Python.3.12
```

**Verify installation:**
```powershell
python --version
```

**Alternative: Download from python.org**
1. Visit [python.org/downloads](https://www.python.org/downloads/)
2. Download Windows installer
3. **Important:** Check "Add Python to PATH" during installation
4. Run installer and follow prompts

---

### Fedora/RHEL/CentOS

```bash
sudo dnf install python3
```

**Verify installation:**
```bash
python3 --version
```

---

### Arch Linux

```bash
sudo pacman -S python
```

**Verify installation:**
```bash
python --version
```

---

## Post-Installation

### Verify pip is Installed

```bash
pip3 --version || pip --version
```

### Update pip (Recommended)

```bash
python3 -m pip install --upgrade pip
```

---

## Troubleshooting

### Command Not Found

**macOS/Linux:**
- Ensure Python is in PATH
- Try `python3` instead of `python`
- Restart terminal

**Windows:**
- Reinstall Python with "Add to PATH" checked
- Restart Command Prompt/PowerShell
- Try `py` instead of `python`

### Permission Denied

**macOS/Linux:**
```bash
# Use --user flag
pip3 install --user <package>

# Or use virtual environment (recommended)
python3 -m venv venv
source venv/bin/activate
```

**Windows:**
```powershell
# Run as Administrator or use --user flag
pip install --user <package>
```

### Multiple Python Versions

If you have multiple Python versions:

```bash
# Use specific version
python3.12 --version
python3.11 --version

# Create alias (macOS/Linux)
alias python=python3.12
```

---

## Using Virtual Environments (Recommended)

Virtual environments isolate project dependencies.

### Create Virtual Environment

```bash
# macOS/Linux
python3 -m venv venv

# Windows
python -m venv venv
```

### Activate Virtual Environment

```bash
# macOS/Linux
source venv/bin/activate

# Windows
venv\Scripts\activate
```

### Deactivate

```bash
deactivate
```

---

## Quick Reference

| OS | Install Command |
|----|----------------|
| macOS | `brew install python3` |
| Ubuntu/Debian | `sudo apt install python3` |
| Windows | `winget install Python.Python.3.12` |
| Fedora/RHEL | `sudo dnf install python3` |
| Arch | `sudo pacman -S python` |

| Task | Command |
|------|---------|
| Check version | `python3 --version` |
| Check pip | `pip3 --version` |
| Update pip | `python3 -m pip install --upgrade pip` |
| Create venv | `python3 -m venv venv` |
| Activate venv | `source venv/bin/activate` (macOS/Linux) |
| Activate venv | `venv\Scripts\activate` (Windows) |
