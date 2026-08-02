# Quick Vercel Setup Guide

## ✅ What Was Fixed

1. **Repository cleaned** - Removed ~40MB of large template files from Git
2. **Missing reports folder** - Created and populated with required `complete-document-status.json`
3. **Environment configuration** - Set up proper `CERTIFLOW_TEMPLATES_ROOT` variable
4. **Documentation updated** - Added templates README and deployment guide

## 🚀 Deploy to Vercel Now

### Step 1: Push to GitHub (Already Done ✅)
```bash
git push origin main
```

### Step 2: Link to Vercel
```bash
vercel
```
Follow prompts to link your GitHub repo.

### Step 3: Configure Environment Variables in Vercel Dashboard

Go to **Project Settings > Environment Variables**:

#### Required Variables
```
CLAUDE_API_KEY=sk-ant-api03-XXXXXXXX_your_actual_key_here
DATABASE_URL=postgresql://user:password@host/database?sslmode=require
PDF_CONVERSION=off
```

**Note:** PDF conversion is DISABLED. Users will receive DOCX files only (faster, simpler, 100% FREE).

#### For Templates (Choose One Option):

**Option A: Bundle templates folder in deployment** (recommended for Vercel)
- Don't set `CERTIFLOW_TEMPLATES_ROOT`
- The app will use the bundled `templates/` folder from your repo
- ⚠️ You'll need to add template files back to git temporarily, or upload via Vercel CLI

**Option B: Use external storage**
- Upload templates to Vercel Blob Storage or Google Drive
- Set `CERTIFLOW_TEMPLATES_ROOT=/path/to/templates`

#### Optional Variables (Google Drive integration)
```
GOOGLE_SERVICE_ACCOUNT_EMAIL=your-service-account@project.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY=-----BEGIN PRIVATE KEY-----\nYOUR_PRIVATE_KEY_HERE\n-----END PRIVATE KEY-----\n
GOOGLE_DRIVE_FOLDER_ID=your_folder_id_here
```
⚠️ Get these from your `.env.local` file or Google Cloud Console

---

## 📄 PDF Conversion Status

**DISABLED** - Application will deliver DOCX files only.

**Why DOCX only?**
- ✅ Faster generation (no conversion time)
- ✅ 100% FREE (no API costs)
- ✅ Smaller file sizes
- ✅ Fully editable
- ✅ Works perfectly on all platforms

**If you need PDF later:**
- Users can convert DOCX to PDF using Word, Google Docs, or any free online tool
- OR add CloudConvert API key (costs ~$9 per 1000 conversions)

### Step 4: Deploy
```bash
vercel --prod
```

## 📝 Important Notes

### Template Files
The template `.docx` files are **not in Git**. For Vercel deployment:
1. Keep them in your local `templates/` folder
2. Vercel's build will bundle them via `outputFileTracingIncludes` in `next.config.mjs`
3. OR upload to external storage and set `CERTIFLOW_TEMPLATES_ROOT`

### Security
- Never commit `.env.local` or `key.json` to Git
- Environment variables are safely stored in Vercel dashboard
- Consider rotating the Google service account key if exposed

### File Size Reduction
- Before: ~40MB of template files in Git
- After: Only metadata and code (~5MB)
- Saved: ~35MB per clone/fork

## 🔍 Verify Deployment

1. Visit your Vercel URL
2. Login: `admin` / `Certiflow@2026`
3. Upload a test EDOF file
4. Generate documents
5. Check that all templates are available

## ❓ Troubleshooting

**Error: "complete-document-status.json not found"**
- Make sure `templates/reports/complete-document-status.json` exists
- Check that templates are bundled in deployment or `CERTIFLOW_TEMPLATES_ROOT` is set

**Error: "Template file not found"**
- Template `.docx` files need to be in the deployment
- Either bundle them or use external storage

**Database connection errors**
- Verify `DATABASE_URL` in Vercel matches your Neon credentials
- Use the **pooled connection string**

For more details, see `DEPLOY.md`.
