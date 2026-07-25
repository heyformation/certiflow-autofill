import { google } from 'googleapis';
import { Readable } from 'stream';

export interface DriveUploadParams {
  filename: string;
  folderPath: string; // e.g. "Proforma Institut/RS6485 - Comptabilité TPE"
  buffer: Buffer;
  mimeType?: string;
}

/**
 * Credentials are resolved EXCLUSIVELY from environment variables so no secret
 * is ever committed to source control or bundled into the deployment.
 * Required (only when Drive sync is used):
 *   GOOGLE_SERVICE_ACCOUNT_EMAIL
 *   GOOGLE_PRIVATE_KEY            (with literal \n escapes; they are unescaped here)
 *   GOOGLE_DRIVE_FOLDER_ID
 */
export async function uploadFileToGoogleDrive(params: DriveUploadParams) {
  const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || '';
  const privateKey = (process.env.GOOGLE_PRIVATE_KEY || '').replace(/\\n/g, '\n');
  const parentFolderId = process.env.GOOGLE_DRIVE_FOLDER_ID || '';

  if (!clientEmail || !privateKey) {
    throw new Error(
      'Les identifiants Google Drive (GOOGLE_SERVICE_ACCOUNT_EMAIL et GOOGLE_PRIVATE_KEY) ne sont pas configurés.'
    );
  }

  if (!parentFolderId) {
    throw new Error(
      'Le dossier Google Drive cible (GOOGLE_DRIVE_FOLDER_ID) doit être configuré.'
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
