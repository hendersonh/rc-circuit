#!/bin/bash
# .agents/scripts/deploy.sh
# Production Deployment script via Git Remote Push to trigger Cloudflare Pages

set -e

echo "========================================="
echo "🚀 Preparing Production Deployment"
echo "========================================="

# 1. Run Pre-flight code quality checks
echo "🔍 Running code quality checks..."

echo "-> Running ESLint..."
npm run lint

echo "-> Compiling TypeScript and Vite Production Build..."
npm run build

echo "✅ All code quality and build checks passed!"
echo "========================================="

# 2. Detect active Git branch
CURRENT_BRANCH=$(git branch --show-current)
if [ -z "$CURRENT_BRANCH" ]; then
  echo "❌ Error: Could not detect the current Git branch."
  exit 1
fi

# 3. Check for uncommitted changes
if [ -n "$(git status --porcelain)" ]; then
  echo "⚠️ Warning: You have uncommitted changes in your workspace."
  git status -s
  echo "-----------------------------------------"
  read -p "Do you want to stage and commit these changes now? (y/N): " commit_choice
  if [[ "$commit_choice" =~ ^[Yy]$ ]]; then
    read -p "Enter commit message: " commit_msg
    if [ -z "$commit_msg" ]; then
      commit_msg="feat: minor deployment updates"
    fi
    git add .
    git commit -m "$commit_msg"
    echo "✅ Changes committed successfully!"
  else
    echo "❌ Deployment aborted. Please commit or stash your changes before deploying."
    exit 1
  fi
fi

# 4. Prompt for final push confirmation
echo "-----------------------------------------"
echo "Target Branch: origin/$CURRENT_BRANCH"
read -p "Ready to push to remote and trigger Cloudflare Pages deploy? (y/N): " deploy_choice
echo "-----------------------------------------"

if [[ "$deploy_choice" =~ ^[Yy]$ ]]; then
  echo "Pushing commits to origin/$CURRENT_BRANCH..."
  git push origin "$CURRENT_BRANCH"
  echo "========================================="
  echo "🚀 Deployment Triggered Successfully!"
  echo "Git Push completed. Cloudflare Pages is now building and deploying."
  echo "========================================="
else
  echo "❌ Deployment cancelled."
  exit 0
fi
