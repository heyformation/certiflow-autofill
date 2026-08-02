# FREE PDF Conversion Setup (No API Needed!)

## ⚠️ Current Issue
The app is trying to use CloudConvert API but you don't have an API key, so PDF conversion fails.

## ✅ Solution: Install LibreOffice (100% FREE)

LibreOffice is free and open-source. Once installed, the app will automatically use it instead of CloudConvert.

---

## Step 1: Download LibreOffice

**Download link:** https://www.libreoffice.org/download/download/

1. Click **"Download version X.X.X"** (latest stable version)
2. Choose **Windows x86_64** (64-bit)
3. Download the MSI installer (~300MB)

---

## Step 2: Install LibreOffice

1. **Run the installer** (LibreOffice_X.X.X_Win_x86-64.msi)
2. **Accept defaults** and click "Next" through all screens
3. **Complete installation** (takes 2-3 minutes)
4. **Restart your terminal/command prompt**

---

## Step 3: Verify Installation

Open PowerShell or Command Prompt:

```powershell
where.exe soffice
```

Should show:
```
C:\Program Files\LibreOffice\program\soffice.exe
```

---

## Step 4: Test PDF Conversion

```bash
cd f:\Office\Hedar_project
npm run dev
```

Then generate documents - they will automatically convert to PDF!

---

## How It Works

The app now has TWO conversion methods:

1. **LibreOffice (Local)** - FREE, fast, works offline
   - Tries this FIRST
   - Requires LibreOffice installed
   
2. **CloudConvert (API)** - Paid, requires API key
   - Only used as FALLBACK if LibreOffice fails
   - Can be disabled completely

---

## Alternative: Use Microsoft Word (If You Have Office)

If you have Microsoft Word installed, I can create a script that uses Word instead of LibreOffice.

**Benefits:**
- ✅ FREE (if you already have Office)
- ✅ High quality PDFs
- ✅ Works offline

**To use Word instead:**
Run this PowerShell script in the project folder:

```powershell
.\Convert-AllDocxToPdf.ps1
```

(I can create this script if you want)

---

## Disable CloudConvert Completely

In your `.env.local` file:

```env
# Disable CloudConvert - use only local conversion
CLOUDCONVERT_API_KEY=""
PDF_CONVERSION="local-only"
```

---

## Troubleshooting

### "LibreOffice NOT found" after installation
1. Restart your terminal/PowerShell
2. Check installation path: `C:\Program Files\LibreOffice\`
3. Re-run: `where.exe soffice`

### "PDF conversion not available"
1. Make sure LibreOffice is installed
2. Restart Node.js server: `npm run dev`
3. Check console logs for conversion attempts

### "libreoffice-convert" errors
The app will automatically fall back to DOCX if conversion fails.
You'll still get the documents, just not in PDF format.

---

## Summary

**Recommended approach:**
1. ✅ Install LibreOffice (free, 5 minutes)
2. ✅ Restart terminal
3. ✅ Run `npm run dev`
4. ✅ Generate documents → automatic PDF conversion!

**No API keys needed. No costs. Works offline. 100% free.**
