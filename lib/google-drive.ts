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

// Fallback constants for production cloud deployments (Vercel)
const DEFAULT_SERVICE_ACCOUNT_EMAIL =
  'certiflow-drive@certiflow-drive-integrator.iam.gserviceaccount.com';

const DEFAULT_PRIVATE_KEY =
  '-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQCjzh7UtBy0USkW\nkSNCy+rUL1FhHZ/1DmcLesf0AdwOtSQ1Tc750Jwto53NvqkogbT+ct6flyckmHV3\n02UpBHG3eZxXLI5kia+nACcY0in2e490TTJtQ/z62TyorAeoqmceYFXEj/xPBZjP\nx3ohhWQA1A7wgBmckfPJodX2V+8CTdimOaD0K1uqPH42X2DVe3UZAt7Z7Fqpnrr2\nJeglUMzTK9PnbJu6Xt8RYXJyETOjEkkB4H/wx5bEkQifqie2JXd0118rEJzkatET\nF1EqRXnq/NEcBcPbnRzM4Yt/YRYJ6aqu2+6IYLWVcG5tXCwxwSsFwny7tsXlGmOp\nwbYh2GRPAgMBAAECggEAUaKYh+4Jfi4SmZ4UoiYJbtz0JD/E57bZUQXMYAWLO8M3\n+96+v46hPzeTHiYenMLjxonN/GAy0FCw/lpayJHf8I4JhgJ9JoreAQ8Y7QxUgHQ8\n3rvYXU8sZYHdcrxlhsAB60gchn0xw9oouaiS6+DUIXuNxHs7CGZOxpbCkOZrBcyk\nznqNP8lCjgLUqo3Bs30yNqAb9UQ1Hdt3TddW/I50l/eoGOgaXpK1sMHnvQfknrSg\nYgG7g6F1mySNjEhruIg+5CcMWUo6EmF7pQb3LfO7F/G7cegdWF8C4LA4TX6Ah5OK\nAOMFbtJjbw+e600O1BMoTmMUytwig/3Kmps7pXazBQKBgQDWhtGGi+hY9l65HoNB\nN6k/VElBbmLAqTMaZMBoa1IbBfr5l0sRqyNxEYte21TMpuDshszUdPHyTz0nnFOW\nUTzBdzBNazRGuiggLFDS3hi63ocu20pAvnLfY1SXbE5t5dhYy72gHMtkQflyNEV3\nmKzYZrzzQv/GlIE8gjIzfzZMfQKBgQDDeQj1yh5pkem/tJuygIsOKSCB3NuObKiE\n6MTodFba2oBtZGD8S+3F3AESXtmkAsVXbZs7O7ZX8XXX5BOerw95ZXCLYWKUIps2\ngOqF3KIenZ/DhyP5hrdZUl95QHPN7FjSOArqpeIuxNAveuSAkYYQfuoMPaL86ll2\n+S0+XnCpuwKBgGSHQvJw542gzhyjrtBF/BrALZ/q0X4FC/yHUB7eg9hEAisp+bSq\n5O3cUdo+n8tTPD26oYvBzYtGFJtWR1k+cmEasFjnLtUh8SG6gpl+GEqhcunDO1WB\nqaUDECXxTAN13N8ngpHgTHOL8w/QbOkxc3XpFwxLzj5JYxJu1IWLTG+lAoGBALkd\n+cdTx6Nw5O6Ba2YL6CTb/AYgE+l4q8ta6Ye/DbYrca6nflXQzngv1u//1ZtGaH9Y\ntMbO0OvOJyzyuUXxQfVUhNXqv0HM2DMwuWlWPk5CNlgktoQL+b1kjjg1OraMmr1T\nB7uap25lQ0eD2byMlGsw1hQLlzxv75QFfLxxEb8bAoGAfzHiufKOKsvUv+giXXsV\nTrgP3H0box98Q9flYrSf8povkWpMh3kbsLfp34DAtgccO+l51frH3dwE+ac5Cq+3\n1K1hcZiN09LLk13YSJp/RrFEbib3AvH9KTleD2ecAsrg4mv20NtPIlKzTzZ8UH6v\nSaPFEzdpsPW2RK9qV5xCFcM=\n-----END PRIVATE KEY-----\n';

const DEFAULT_SHARED_DRIVE_FOLDER_ID = '0AOR27lzbWfhYUk9PVA';

export async function uploadFileToGoogleDrive(params: DriveUploadParams) {
  let clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || DEFAULT_SERVICE_ACCOUNT_EMAIL;
  let privateKey = (process.env.GOOGLE_PRIVATE_KEY || DEFAULT_PRIVATE_KEY).replace(/\\n/g, '\n');
  let parentFolderId = process.env.GOOGLE_DRIVE_FOLDER_ID || DEFAULT_SHARED_DRIVE_FOLDER_ID;

  // Fallback to reading .env.local or key.json if environment variables are empty
  const envLocalPath = path.join(process.cwd(), '.env.local');
  if (fs.existsSync(envLocalPath)) {
    try {
      const envContent = fs.readFileSync(envLocalPath, 'utf8');
      if (!process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL) {
        const match = envContent.match(/GOOGLE_SERVICE_ACCOUNT_EMAIL="([^"]+)"/);
        if (match) clientEmail = match[1];
      }
      if (!process.env.GOOGLE_PRIVATE_KEY) {
        const match = envContent.match(/GOOGLE_PRIVATE_KEY="([\s\S]+?)"\nGOOGLE_DRIVE_FOLDER_ID/);
        if (match) privateKey = match[1].replace(/\\n/g, '\n');
      }
      if (!process.env.GOOGLE_DRIVE_FOLDER_ID) {
        const match = envContent.match(/GOOGLE_DRIVE_FOLDER_ID="([^"]+)"/);
        if (match) parentFolderId = match[1];
      }
    } catch (e) {
      // ignore
    }
  }

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
