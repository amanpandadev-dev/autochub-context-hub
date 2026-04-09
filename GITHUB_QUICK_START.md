# GitHub Deployment - Quick Start

## 🚀 5-Minute Setup

### Step 1: Create Repository (1 minute)

**Using GitHub CLI:**
```bash
gh repo create autochub-context-hub \
  --description "Context-first coding assistant with Memgraph analysis" \
  --public \
  --source=. \
  --remote=origin \
  --push
```

**Or manually:**
1. Go to https://github.com/new
2. Name: `autochub-context-hub`
3. Description: `Context-first coding assistant with Memgraph analysis`
4. Public
5. Create repository

### Step 2: Push Code (1 minute)

```bash
git add .
git commit -m "Initial commit: Memgraph integration and CLI tool"
git push origin main
```

### Step 3: Configure Secrets (1 minute)

1. Go to Settings → Secrets and variables → Actions
2. Click "New repository secret"
3. Add `NPM_TOKEN` (if publishing to npm)

### Step 4: Enable Branch Protection (1 minute)

1. Go to Settings → Branches
2. Add rule for "main"
3. Enable:
   - Require pull request reviews
   - Require status checks to pass

### Step 5: Create Release (1 minute)

```bash
git tag -a v1.0.0 -m "Release v1.0.0"
git push origin v1.0.0
```

## ✅ What You Get

✅ **Automated Testing** - Tests run on every push  
✅ **Automated Building** - Builds on every push  
✅ **Issue Templates** - Standardized bug/feature reports  
✅ **Branch Protection** - Require reviews and checks  
✅ **Code Security** - Dependabot and secret scanning  
✅ **Release Management** - Automated releases  

## 📋 Files Included

```
.gitignore                    # Git ignore rules
.env.example                  # Environment template
LICENSE                       # MIT License

.github/
├── workflows/
│   ├── test.yml             # Test workflow
│   └── build.yml            # Build workflow
└── ISSUE_TEMPLATE/
    ├── bug_report.md        # Bug report template
    └── feature_request.md   # Feature request template
```

## 🔄 Typical Workflow

### For Contributors

```bash
# 1. Fork repository
gh repo fork autochub-context-hub

# 2. Create feature branch
git checkout -b feature/amazing-feature

# 3. Make changes
# ... edit files ...

# 4. Commit
git commit -m "Add amazing feature"

# 5. Push
git push origin feature/amazing-feature

# 6. Create Pull Request
gh pr create --title "Add amazing feature"
```

### For Maintainers

```bash
# 1. Review PR
# ... review changes ...

# 2. Merge PR
gh pr merge <pr-number> --merge

# 3. Create release
git tag -a v1.1.0 -m "Release v1.1.0"
git push origin v1.1.0

# GitHub Actions automatically:
# - Builds the project
# - Creates release
# - Publishes to npm (if configured)
```

## 📊 GitHub Actions Status

Check workflow status:
1. Go to Actions tab
2. See all workflow runs
3. Click on run to see details

## 🔐 Security Checklist

- [ ] .env file not committed
- [ ] .env.example created
- [ ] Secrets configured in GitHub
- [ ] Branch protection enabled
- [ ] Code scanning enabled
- [ ] Dependabot enabled

## 📚 Documentation

- **GITHUB_DEPLOYMENT.md** - Complete guide
- **GITHUB_DEPLOYMENT_SUMMARY.md** - Detailed summary
- **GITHUB_QUICK_START.md** - This file

## 🎯 Next Steps

1. **Create repository** - Use GitHub CLI or web UI
2. **Push code** - `git push origin main`
3. **Configure secrets** - Add NPM_TOKEN
4. **Enable protection** - Require reviews
5. **Create release** - Tag version

## 💡 Tips

### Use GitHub CLI
```bash
# Install
brew install gh

# Login
gh auth login

# Create repo
gh repo create autochub-context-hub --public --source=. --remote=origin --push
```

### Semantic Versioning
```bash
# Major version (breaking changes)
git tag -a v2.0.0 -m "Release v2.0.0"

# Minor version (new features)
git tag -a v1.1.0 -m "Release v1.1.0"

# Patch version (bug fixes)
git tag -a v1.0.1 -m "Release v1.0.1"
```

### View Workflows
```bash
# List workflows
gh workflow list

# View workflow runs
gh run list

# View specific run
gh run view <run-id>
```

## 🚀 You're Ready!

Your Auto-CHUB project is now ready for GitHub deployment.

```bash
# 1. Create repo
gh repo create autochub-context-hub --public --source=. --remote=origin --push

# 2. Configure secrets
# Go to Settings → Secrets → Add NPM_TOKEN

# 3. Create release
git tag -a v1.0.0 -m "Release v1.0.0"
git push origin v1.0.0

# Done! 🎉
```

## 📞 Help

- [GitHub Docs](https://docs.github.com)
- [GitHub CLI](https://cli.github.com)
- [GitHub Actions](https://github.com/features/actions)

---

**Your project is ready for GitHub!** 🚀

