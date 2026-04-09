# ⚡ Quick Reference Card

## 🎯 3-Step GitHub Configuration

### 1️⃣ Add NPM Token (2 min)
```
Settings → Secrets and variables → Actions → New repository secret
Name: NPM_TOKEN
Secret: [paste npm token from https://www.npmjs.com/settings/tokens]
```

### 2️⃣ Enable Branch Protection (3 min)
```
Settings → Branches → Add rule
Pattern: main
✓ Require pull request reviews
✓ Require status checks (test, build)
✓ Require branches up to date
```

### 3️⃣ Enable Code Security (2 min)
```
Settings → Code security and analysis
✓ Dependabot alerts
✓ Dependabot security updates
✓ Secret scanning
✓ Push protection
```

---

## 📦 CLI Commands

```bash
# Analyze code
autochub analyze src/ --with-graph

# Fix issues (dry-run)
autochub fix src/ --dry-run

# Generate report
autochub report src/ --format html

# Manage config
autochub config get
autochub config set key value
```

---

## 🔧 Setup Commands

```bash
# Install dependencies
npm install

# Setup Memgraph
npm run setup

# Run example
npm run example:memgraph

# Run tests
npm test

# Build
npm run build
```

---

## 📊 Repository Info

- **URL**: https://github.com/amanpandadev-dev/autochub-context-hub
- **Branch**: main
- **Status**: Ready for configuration
- **Files**: 95 total
- **Documentation**: 30+ guides

---

## 📚 Key Documentation

| File | Use When |
|------|----------|
| `GITHUB_CONFIGURATION_DETAILED.md` | Configuring GitHub |
| `CLI_GUIDE.md` | Using the CLI |
| `MEMGRAPH_IMPLEMENTATION.md` | Using Memgraph |
| `SETUP_GUIDE.md` | Installing locally |
| `NEXT_STEPS.md` | What to do next |

---

## ✅ Verification

After each step, verify:

**NPM_TOKEN:**
```
Settings → Secrets and variables → Actions
Should see: NPM_TOKEN ✓
```

**Branch Protection:**
```
Settings → Branches
Should see: Rule for main ✓
```

**Code Security:**
```
Settings → Code security and analysis
Should see: All features enabled ✓
```

---

## 🚀 After Configuration

```bash
# Create release
git tag -a v1.0.0 -m "Release v1.0.0"
git push origin v1.0.0

# GitHub Actions will:
# 1. Run tests
# 2. Build project
# 3. Publish to npm (if NPM_TOKEN set)
```

---

## 🆘 Quick Troubleshooting

| Issue | Solution |
|-------|----------|
| NPM_TOKEN not working | Check token scope is "Automation" |
| Branch protection not working | Verify status checks passed |
| Code security not detecting issues | Wait 24 hours for initial scan |
| GitHub Actions failing | Check workflow logs in Actions tab |

---

**Total Configuration Time: ~7 minutes** ⏱️

Start with Step 1: Add NPM Token 🚀
