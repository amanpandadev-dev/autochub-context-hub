# GitHub Configuration - Detailed Step-by-Step Guide

## Overview

This guide provides detailed screenshots and instructions for configuring your GitHub repository after pushing your code.

---

## 📋 Table of Contents

1. [Add NPM Token Secret](#add-npm-token-secret)
2. [Enable Branch Protection](#enable-branch-protection)
3. [Enable Code Security](#enable-code-security)
4. [Verify Configuration](#verify-configuration)

---

## 🔐 Add NPM Token Secret

### What is NPM_TOKEN?

NPM_TOKEN is a secret token that allows GitHub Actions to automatically publish your package to npm.org when you create a release.

### Step 1: Get Your NPM Token

1. Go to https://www.npmjs.com/settings/tokens
2. Click "Generate New Token"
3. Select "Automation" (recommended for CI/CD)
4. Copy the token (you'll only see it once)
5. Keep it safe - don't share it

### Step 2: Add Secret to GitHub

#### 2.1 Navigate to Settings
1. Go to your GitHub repository
2. Click on **Settings** tab (top right)
3. Look for **Secrets and variables** in the left sidebar
4. Click on **Actions**

```
Repository → Settings → Secrets and variables → Actions
```

#### 2.2 Create New Secret
1. Click **New repository secret** button (green button, top right)
2. You'll see a form with two fields:
   - **Name**: `NPM_TOKEN`
   - **Secret**: (paste your npm token here)

#### 2.3 Add the Secret
1. In the **Name** field, type: `NPM_TOKEN`
2. In the **Secret** field, paste your npm token
3. Click **Add secret** button

#### 2.4 Verify
You should see `NPM_TOKEN` listed under "Repository secrets"

### Step 3: Verify in GitHub Actions

1. Go to **Actions** tab
2. Click on any workflow run
3. You should see `NPM_TOKEN` is available (but hidden for security)

---

## 🛡️ Enable Branch Protection

### What is Branch Protection?

Branch protection ensures that code changes go through a review process before being merged to the main branch.

### Step 1: Navigate to Branch Settings

1. Go to your GitHub repository
2. Click on **Settings** tab
3. In the left sidebar, click **Branches**

```
Repository → Settings → Branches
```

### Step 2: Add Protection Rule

1. Click **Add rule** button (green button)
2. You'll see a form to configure the rule

### Step 3: Configure Rule Details

#### 3.1 Branch Name Pattern
1. In the **Branch name pattern** field, type: `main`
2. This applies the rule to the main branch

#### 3.2 Require Pull Request Reviews
1. Check the box: **Require a pull request before merging**
2. Check the box: **Require approvals**
3. Set **Required number of approvals before merging**: `1`
4. (Optional) Check **Dismiss stale pull request approvals when new commits are pushed**
5. (Optional) Check **Require review from Code Owners**

#### 3.3 Require Status Checks
1. Check the box: **Require status checks to pass before merging**
2. Check the box: **Require branches to be up to date before merging**
3. Under **Status checks that are required**:
   - Search for and select: `test` (from your test workflow)
   - Search for and select: `build` (from your build workflow)

#### 3.4 Additional Settings
1. Check the box: **Require code reviews before merging**
2. Check the box: **Require conversation resolution before merging**
3. (Optional) Check **Include administrators** to apply rules to admins too

### Step 4: Create the Rule

1. Scroll down to the bottom
2. Click **Create** button

### Step 5: Verify

You should see the rule listed:
```
Branch protection rule for main
- Require pull request reviews before merging
- Require status checks to pass before merging
- Require branches to be up to date before merging
```

---

## 🔒 Enable Code Security

### What is Code Security?

Code security features help identify vulnerabilities and security issues in your code.

### Step 1: Navigate to Code Security Settings

1. Go to your GitHub repository
2. Click on **Settings** tab
3. In the left sidebar, click **Code security and analysis**

```
Repository → Settings → Code security and analysis
```

### Step 2: Enable Dependabot Alerts

#### 2.1 Dependabot Alerts
1. Look for **Dependabot alerts** section
2. Click **Enable** button (if not already enabled)
3. You should see: "Dependabot alerts are enabled"

**What it does:**
- Scans your dependencies for known vulnerabilities
- Alerts you when vulnerabilities are found
- Suggests fixes

#### 2.2 Dependabot Security Updates
1. Look for **Dependabot security updates** section
2. Click **Enable** button (if not already enabled)
3. You should see: "Dependabot security updates are enabled"

**What it does:**
- Automatically creates pull requests to fix vulnerabilities
- Updates dependencies to secure versions
- Runs tests to ensure updates don't break anything

### Step 3: Enable Secret Scanning

#### 3.1 Secret Scanning
1. Look for **Secret scanning** section
2. Click **Enable** button (if not already enabled)
3. You should see: "Secret scanning is enabled"

**What it does:**
- Scans your code for accidentally committed secrets
- Alerts you if secrets are found
- Prevents secrets from being pushed

#### 3.2 Push Protection (Optional)
1. Look for **Push protection** section
2. Click **Enable** button (if available)
3. This prevents pushing code with secrets

**What it does:**
- Blocks pushes that contain secrets
- Prevents accidental secret commits
- Requires you to remove secrets before pushing

### Step 4: Verify All Settings

You should see all enabled:
```
✓ Dependabot alerts - Enabled
✓ Dependabot security updates - Enabled
✓ Secret scanning - Enabled
✓ Push protection - Enabled (optional)
```

---

## ✅ Verify Configuration

### Step 1: Check Secrets

1. Go to **Settings** → **Secrets and variables** → **Actions**
2. You should see:
   - `NPM_TOKEN` listed under "Repository secrets"

### Step 2: Check Branch Protection

1. Go to **Settings** → **Branches**
2. You should see:
   - Rule for `main` branch
   - Status showing all protections enabled

### Step 3: Check Code Security

1. Go to **Settings** → **Code security and analysis**
2. You should see all enabled:
   - Dependabot alerts ✓
   - Dependabot security updates ✓
   - Secret scanning ✓
   - Push protection ✓

### Step 4: Check GitHub Actions

1. Go to **Actions** tab
2. You should see:
   - Test workflow
   - Build workflow
   - Both workflows running on your commits

---

## 🎯 Complete Configuration Checklist

- [ ] NPM_TOKEN secret added
- [ ] Branch protection rule created for "main"
- [ ] Pull request reviews required
- [ ] Status checks required
- [ ] Dependabot alerts enabled
- [ ] Dependabot security updates enabled
- [ ] Secret scanning enabled
- [ ] Push protection enabled (optional)
- [ ] GitHub Actions workflows running
- [ ] All settings verified

---

## 📊 Configuration Summary

### Secrets
```
NPM_TOKEN: [hidden for security]
```

### Branch Protection (main)
```
✓ Require pull request reviews
✓ Require status checks to pass
✓ Require branches to be up to date
✓ Require conversation resolution
```

### Code Security
```
✓ Dependabot alerts
✓ Dependabot security updates
✓ Secret scanning
✓ Push protection
```

### GitHub Actions
```
✓ Test workflow (Node 16, 18, 20)
✓ Build workflow (Build & upload artifacts)
```

---

## 🚀 What Happens Next

### When You Push Code
1. GitHub Actions runs test workflow
2. Tests run on Node 16, 18, 20
3. Linting runs
4. Build runs
5. Results shown in PR

### When You Create a PR
1. Status checks must pass
2. At least 1 review required
3. Branch must be up to date
4. Conversation must be resolved
5. Then you can merge

### When You Create a Release
1. GitHub Actions runs build workflow
2. Artifacts are uploaded
3. If NPM_TOKEN is set, publishes to npm
4. Release is created on GitHub

---

## 🔍 Troubleshooting

### NPM_TOKEN Not Working

**Problem:** GitHub Actions can't publish to npm

**Solution:**
1. Verify token is correct
2. Check token has "Automation" scope
3. Verify token is not expired
4. Check repository secret name is exactly `NPM_TOKEN`

### Branch Protection Not Working

**Problem:** Can't merge PR even after approval

**Solution:**
1. Verify all status checks passed
2. Verify branch is up to date
3. Verify at least 1 review approved
4. Verify conversation is resolved

### Code Security Not Detecting Issues

**Problem:** Dependabot not finding vulnerabilities

**Solution:**
1. Verify Dependabot is enabled
2. Wait 24 hours for initial scan
3. Check if vulnerabilities exist in your dependencies
4. Manually run `npm audit` to verify

---

## 📚 Additional Resources

- [GitHub Secrets Documentation](https://docs.github.com/en/actions/security-guides/encrypted-secrets)
- [Branch Protection Documentation](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches)
- [Code Security Documentation](https://docs.github.com/en/code-security)
- [Dependabot Documentation](https://docs.github.com/en/code-security/dependabot)
- [Secret Scanning Documentation](https://docs.github.com/en/code-security/secret-scanning)

---

## ✨ Summary

You have successfully configured:

✅ **NPM_TOKEN Secret** - For automated npm publishing  
✅ **Branch Protection** - For code review process  
✅ **Code Security** - For vulnerability detection  
✅ **GitHub Actions** - For automated testing and building  

Your repository is now production-ready with:
- Automated testing on every push
- Code review requirements
- Security scanning
- Automated npm publishing (when you create releases)

---

**Your GitHub repository is now fully configured!** 🎉

