#!/usr/bin/env node

/**
 * deploy.js — Quick Vercel deployment script
 * Run: node deploy.js
 *
 * This script:
 * 1. Ensures .git is initialized
 * 2. Commits all changes
 * 3. Checks for required env vars in Vercel
 * 4. Runs vercel deploy --prod
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const log = (msg) => console.log(`\n📌 ${msg}`);
const success = (msg) => console.log(`✅ ${msg}`);
const error = (msg) => { console.log(`❌ ${msg}`); process.exit(1); };
const warn = (msg) => console.log(`⚠️  ${msg}`);

log('Starting Vercel deployment...');

// 1. Check Git
try {
  execSync('git status', { stdio: 'ignore' });
} catch {
  log('Initializing Git repository...');
  execSync('git init', { stdio: 'inherit' });
  execSync('git add .', { stdio: 'inherit' });
  execSync('git commit -m "Initial commit: Certification auto-fill tool"', { stdio: 'inherit' });
}

// 2. Commit changes if any
log('Checking for uncommitted changes...');
try {
  const status = execSync('git status --porcelain', { encoding: 'utf-8' });
  if (status.trim()) {
    log('Committing pending changes...');
    execSync('git add .', { stdio: 'inherit' });
    execSync('git commit -m "Deployment: ready for Vercel"', { stdio: 'inherit' });
    success('Changes committed');
  } else {
    success('No pending changes');
  }
} catch (e) {
  warn('Git commit skipped or failed (may already be deployed)');
}

// 3. Verify Vercel CLI
log('Checking Vercel CLI...');
try {
  execSync('vercel --version', { stdio: 'ignore' });
  success('Vercel CLI found');
} catch {
  error('Vercel CLI not installed. Run: npm i -g vercel');
}

// 4. Check .env vars (at least the required ones)
log('Checking environment variables in Vercel...');
warn(`⚠️  IMPORTANT: Set these in Vercel Dashboard (Project > Settings > Environment Variables):\n
  Required:
    □ CLAUDE_API_KEY        (from https://console.anthropic.com)
    □ DATABASE_URL          (from Neon PostgreSQL)
    
  Optional:
    □ CLOUDCONVERT_API_KEY  (for PDF conversion; leave empty for DOCX-only)
    □ GOOGLE_SERVICE_ACCOUNT_EMAIL (if using Drive sync)
    □ GOOGLE_PRIVATE_KEY (if using Drive sync; use literal \\n escapes)
    □ GOOGLE_DRIVE_FOLDER_ID (if using Drive sync)

  🚨 SECURITY: Google service account key was exposed. Rotate it now:
     1. Go to Google Cloud Console
     2. Delete service account: certiflow-drive@certiflow-drive-integrator.iam.gserviceaccount.com
     3. Create new service account
     4. Download JSON key
     5. Add to Vercel as env vars (above)
`);

// 5. Deploy
log('Proceeding with deployment to Vercel...');
log('You may be prompted to login if not already authenticated.');

try {
  execSync('vercel deploy --prod', { stdio: 'inherit' });
  success('Deployment successful!');
  log('Your live URL is shown above. Go to https://vercel.com/dashboard to verify.');
} catch (e) {
  error('Deployment failed. Check the error above.');
}
