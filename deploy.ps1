# deploy.ps1 — Quick Vercel deployment script for Windows
# Run: .\deploy.ps1

Write-Host "`n📌 Starting Vercel deployment..." -ForegroundColor Cyan

# 1. Check Git
Write-Host "`n📌 Checking Git..." -ForegroundColor Cyan
try {
    git status | Out-Null
} catch {
    Write-Host "`n📌 Initializing Git repository..." -ForegroundColor Cyan
    git init
    git add .
    git commit -m "Initial commit: Certification auto-fill tool"
}

# 2. Commit changes
Write-Host "`n📌 Checking for uncommitted changes..." -ForegroundColor Cyan
$status = git status --porcelain
if ($status) {
    Write-Host "`n📌 Committing changes..." -ForegroundColor Cyan
    git add .
    git commit -m "Deployment: ready for Vercel"
    Write-Host "✅ Changes committed" -ForegroundColor Green
} else {
    Write-Host "✅ No pending changes" -ForegroundColor Green
}

# 3. Check Vercel CLI
Write-Host "`n📌 Checking Vercel CLI..." -ForegroundColor Cyan
try {
    vercel --version | Out-Null
    Write-Host "✅ Vercel CLI found" -ForegroundColor Green
} catch {
    Write-Host "❌ Vercel CLI not installed. Run: npm i -g vercel" -ForegroundColor Red
    exit 1
}

# 4. Show env var checklist
Write-Host "`n⚠️  REQUIRED STEPS BEFORE DEPLOYING:" -ForegroundColor Yellow
Write-Host @"
1. Go to https://vercel.com/dashboard
2. Open your project settings
3. Go to Settings > Environment Variables
4. Add these vars:

   REQUIRED:
   □ CLAUDE_API_KEY        (from https://console.anthropic.com)
   □ DATABASE_URL          (from Neon PostgreSQL)
   
   OPTIONAL:
   □ CLOUDCONVERT_API_KEY  (for PDF; leave empty for DOCX-only)
   □ GOOGLE_SERVICE_ACCOUNT_EMAIL (if using Drive)
   □ GOOGLE_PRIVATE_KEY (if using Drive; must have literal \n escapes)
   □ GOOGLE_DRIVE_FOLDER_ID (if using Drive)

5. 🚨 SECURITY ALERT:
   The Google service account key (certiflow-drive@...) was hardcoded.
   You MUST rotate it:
   - Go to Google Cloud Console
   - Delete the old service account
   - Create a new one, download JSON key
   - Add to Vercel env vars

Ready? Press Enter to continue with deployment...
"@
Read-Host

# 5. Deploy
Write-Host "`n📌 Deploying to Vercel..." -ForegroundColor Cyan
Write-Host "You may be prompted to login..." -ForegroundColor Gray
vercel deploy --prod

if ($LASTEXITCODE -eq 0) {
    Write-Host "`n✅ Deployment successful!" -ForegroundColor Green
    Write-Host "Check your live URL above. Go to https://vercel.com/dashboard to verify." -ForegroundColor Green
} else {
    Write-Host "`n❌ Deployment failed!" -ForegroundColor Red
    exit 1
}
