# Vercel Deployment Guide

## Pre-flight checklist

✅ **Build passes** (`npm run build` — green)  
✅ **Env vars isolated** (removed hardcoded Google key)  
✅ **Function timeouts configured** (vercel.json + route exports)  
✅ **Templates bundled** (next.config.mjs outputFileTracingIncludes)

## 🚨 SECURITY ALERT

A **Google service account private key was hardcoded** in `lib/google-drive.ts` until today and may have been exposed in your Git history. 

**Action required immediately:**
1. Log into your Google Cloud console
2. Delete the service account `certiflow-drive@certiflow-drive-integrator.iam.gserviceaccount.com`
3. Create a NEW service account and download the JSON key
4. Add the key to Vercel as env vars (see step 2 below)

## Deployment steps

### 1. Create a Vercel project (if not already done)

```bash
npm i -g vercel
vercel
```

Follow the prompts to link to your GitHub/GitLab repo and Vercel account.

### 2. Set environment variables in Vercel Dashboard

Go to **Project Settings > Environment Variables** and add:

| Variable | Value | Required? |
|---|---|---|
| `CLAUDE_API_KEY` | Your Anthropic API key | ✅ Yes |
| `DATABASE_URL` | Neon PostgreSQL connection string (pooled) | ✅ Yes |
| `CLOUDCONVERT_API_KEY` | CloudConvert API key for PDF conversion | ❌ Optional* |
| `PDF_CONVERSION` | Leave empty or set to `off` to disable PDFs | ❌ Optional |
| `GOOGLE_SERVICE_ACCOUNT_EMAIL` | Service account email (new one, after key rotation) | ❌ Optional** |
| `GOOGLE_PRIVATE_KEY` | Private key **with literal `\n` escapes** (see example below) | ❌ Optional** |
| `GOOGLE_DRIVE_FOLDER_ID` | Shared Drive folder ID | ❌ Optional** |

*️⃣ **PDF_CONVERSION note**: Requires **Vercel Pro** ($20/month) for `maxDuration: 300`. On Hobby (free), functions timeout at 60s, so PDF conversion may fail. Leave `CLOUDCONVERT_API_KEY` empty to deliver DOCX only.

**️⃣ **Google Drive is optional**: Only needed if you use the "Envoyer vers Google Drive" button. If not, leave these three blank.

### 3. Format the Google private key correctly

If you're adding Google credentials, the private key must have **literal `\n` escapes** (not real newlines):

**Wrong** ❌
```
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----
MIIEvQIBADANBgkq...
-----END PRIVATE KEY-----"
```

**Correct** ✅
```
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkq...\n-----END PRIVATE KEY-----\n"
```

To convert: open the JSON key file, grab the `private_key` field (it already has `\n`), paste directly.

### 4. Deploy

```bash
vercel deploy --prod
```

The CLI will confirm deployment and give you the live URL.

## Post-deployment verification

1. **Open the live URL** in your browser
2. **Login**: admin / Certiflow@2026
3. **Upload test EDOF file** → check for parsing errors
4. **Generate one candidate** → confirm documents fill correctly
5. **Check the fill-status panel** → see checkboxes/fields/PDFs counts

## If generation fails on Vercel

### Timeout errors?
- **Hobby plan**: PDF conversion times out. Disable it (leave `CLOUDCONVERT_API_KEY` empty).
- **Pro plan**: `maxDuration: 300` is set; if still timing out, reduce PDF resolution in CloudConvert or use a faster tier.

### Claude API errors?
- Verify `CLAUDE_API_KEY` is set and has active credits (https://console.anthropic.com/account/billing/overview).

### Database errors?
- Verify `DATABASE_URL` is set and the Neon project is active.
- Test locally: `psql $DATABASE_URL` should connect.

### Google Drive "folder not shared"?
- Make sure the Shared Drive folder is shared with the **new** service account email (after key rotation).
- Share with role: **Editor**.

## Rollback

If something breaks after deploy:
- Vercel auto-keeps the previous production build. You can quickly roll back in the Vercel dashboard (**Deployments > [previous] > Promote to Production**).

## Future improvements

1. **Upgrade login**: Replace hardcoded `admin / Certiflow@2026` with OAuth or an env-based code.
2. **Deeper theme correlation** (spec §6): The AI engine currently uses simplified levels; implement full theme-by-theme flow for higher fidelity.
3. **Add automated tests** for spec §10 scenarios (completeness, jury rules, pass-mark floor).
4. **Use a secrets manager** (Vercel + 1Password integration) instead of plain env vars.

## Support

If you hit issues:
1. Check the **Vercel Function logs** (Vercel dashboard > Logs tab).
2. Test locally with `npm run dev` and the same `.env.local` vars.
3. Ensure all required vars are set (at minimum: `CLAUDE_API_KEY`, `DATABASE_URL`).

---

**Deployed app architecture:**
- Frontend: Next.js 15 on Vercel Edge/Serverless
- Templates: Bundled in `.vercel/output` (outputFileTracingIncludes)
- APIs: /api/{upload, generate, download, drive, analyze, settings} — maxDuration 120–300s on Pro
- Database: Neon PostgreSQL (pooled connection)
- AI: Anthropic Claude (via @anthropic-ai/sdk)
- PDF: Optional CloudConvert API (external)
- Drive: Optional Google Drive API (requires service account)

All secrets stay in environment — never in code.
