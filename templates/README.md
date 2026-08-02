# Templates Directory

This directory contains certification document templates.

## Important Note

The actual `.docx`, `.xlsx`, `.pptx`, and `.zip` template files are **not stored in Git** to save repository space (they total ~40MB).

## Setup Instructions

### For Development
The templates should be stored externally and referenced via the `CERTIFLOW_TEMPLATES_ROOT` environment variable in `.env.local`.

Example:
```env
CERTIFLOW_TEMPLATES_ROOT="F:\Office\Input -output\CertiFlow_Verified_Document_Templates_v1"
```

### For Production (Vercel)
Upload templates to:
1. **Vercel Blob Storage** (recommended), or
2. **External CDN/Cloud Storage** (Google Drive, AWS S3, etc.)

Then update the environment variable accordingly.

## What IS Tracked in Git

- `reports/` folder with JSON metadata files
- This README
- Any documentation files

## Directory Structure Required

```
templates/
├── reports/
│   └── complete-document-status.json  ← Required metadata
├── [Template files go here in production]
└── README.md
```
