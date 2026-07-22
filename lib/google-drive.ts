import fs from 'fs';
import { google } from 'googleapis';
import path from 'path';
import { Readable } from 'stream';

export interface DriveUploadParams {
  filename: string;
  folderPath: string; // e.g. "Proforma Institut/RS6485 - Comptabilité TPE"
  buffer: Buffer;
  mimeType?: string;
}

export async function uploadFileToGoogleDrive(params: DriveUploadParams) {
  let clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  let privateKey = (process.env.GOOGLE_PRIVATE_KEY || '').replace(/\\n/g, '\n');
  let parentFolderId = process.env.GOOGLE_DRIVE_FOLDER_ID;

  // Fallback to reading .env.local or key.json directly if environment variables are not populated
  const envLocalPath = path.join(process.cwd(), '.env.local');
  if (fs.existsSync(envLocalPath)) {
    try {
      const envContent = fs.readFileSync(envLocalPath, 'utf8');
      if (!clientEmail) {
        const match = envContent.match(/GOOGLE_SERVICE_ACCOUNT_EMAIL="([^"]+)"/);
        if (match) clientEmail = match[1];
      }
      if (!privateKey) {
        const match = envContent.match(/GOOGLE_PRIVATE_KEY="([\s\S]+?)"\nGOOGLE_DRIVE_FOLDER_ID/);
        if (match) privateKey = match[1].replace(/\\n/g, '\n');
      }
      if (!parentFolderId) {
        const match = envContent.match(/GOOGLE_DRIVE_FOLDER_ID="([^"]+)"/);
        if (match) parentFolderId = match[1];
      }
    } catch (e) {
      // ignore read error
    }
  }

  // Secondary fallback to local key.json
  const keyJsonPath = path.join(process.cwd(), 'key.json');
  if ((!clientEmail || !privateKey) && fs.existsSync(keyJsonPath)) {
    try {
      const keyData = JSON.parse(fs.readFileSync(keyJsonPath, 'utf8'));
      clientEmail = keyData.client_email;
      privateKey = keyData.private_key;
    } catch (err) {
      console.warn('Could not parse local key.json:', err);
    }
  }

  if (!clientEmail || !privateKey) {
    throw new Error(
      'Les identifiants Google Drive (GOOGLE_SERVICE_ACCOUNT_EMAIL et GOOGLE_PRIVATE_KEY ou key.json) ne sont pas configurés.'
    );
  }

  if (!parentFolderId) {
    throw new Error(
      'Le dossier Google Drive cible (GOOGLE_DRIVE_FOLDER_ID) doit être configuré dans .env.local.'
    );
  }

  const auth = new google.auth.JWT({
    email: clientEmail,
    key: privateKey,
    scopes: ['https://www.googleapis.com/auth/drive'],
  });

  const drive = google.drive({ version: 'v3', auth });

  // Convert buffer to stream
  const bufferStream = new Readable();
  bufferStream.push(params.buffer);
  bufferStream.push(null);

  const fileMetadata = {
    name: params.filename,
    parents: [parentFolderId],
  };

  const media = {
    mimeType: params.mimeType || 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    body: bufferStream,
  };

  const res = await drive.files.create({
    supportsAllDrives: true,
    requestBody: fileMetadata,
    media,
    fields: 'id, name, webViewLink',
  });

  return {
    fileId: res.data.id,
    fileName: res.data.name,
    webViewLink: res.data.webViewLink,
  };
}
