const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit');

function createReportPDF() {
  const doc = new PDFDocument({
    size: 'A4',
    margin: 40,
    bufferPages: true
  });

  const pdfPath = path.join(__dirname, 'CertiFlow_Project_Report_and_User_Manual.pdf');
  const writeStream = fs.createWriteStream(pdfPath);
  doc.pipe(writeStream);

  // Color Palette
  const PRIMARY = '#0f172a';      // Slate 900
  const SECONDARY = '#0d9488';    // Teal 600
  const ACCENT = '#2dd4bf';       // Teal 400
  const TEXT_DARK = '#1e293b';    // Slate 800
  const TEXT_MUTED = '#64748b';   // Slate 500
  const BG_LIGHT = '#f8fafc';     // Slate 50
  const CARD_BG = '#f1f5f9';      // Slate 100

  // -------------------------------------------------------------
  // PAGE 1: COVER PAGE
  // -------------------------------------------------------------
  // Outer Border & Dark Card
  doc.rect(30, 30, 535, 782).fill(PRIMARY);

  // Decorative Accent Bar
  doc.rect(30, 30, 535, 12).fill(SECONDARY);

  // Header Badge
  doc.fillColor(ACCENT)
     .fontSize(10)
     .font('Helvetica-Bold')
     .text('OFFICIAL ENTERPRISE DOCUMENTATION', 50, 65, { letterSpacing: 1.5 });

  // Main Title
  doc.fillColor('#ffffff')
     .fontSize(28)
     .font('Helvetica-Bold')
     .text('CertiFlow Platform', 50, 95);

  doc.fillColor('#94a3b8')
     .fontSize(14)
     .font('Helvetica')
     .text('Executive Project Report & Comprehensive User Manual', 50, 135);

  // Live URL Card Box
  doc.rect(50, 180, 495, 65).fill('#1e293b');
  doc.rect(50, 180, 6, 65).fill(ACCENT);
  
  doc.fillColor('#94a3b8')
     .fontSize(9)
     .font('Helvetica-Bold')
     .text('LIVE PRODUCTION WEB APPLICATION', 70, 195, { letterSpacing: 1 });
  
  doc.fillColor(ACCENT)
     .fontSize(15)
     .font('Helvetica-Bold')
     .text('https://certiflow-ten.vercel.app/', 70, 215);

  // Metadata Grid
  const metaBoxes = [
    { label: 'Version & Release', val: 'V1.0.0 Production Build' },
    { label: 'Target Organizations', val: 'Proforma & Proskills Institut' },
    { label: 'Compliance Standards', val: 'RNCP / RS & Qualiopi Certification' },
    { label: 'Core AI Engine', val: 'Anthropic Claude 3.5 Sonnet' }
  ];

  let boxY = 270;
  metaBoxes.forEach((box, i) => {
    const x = i % 2 === 0 ? 50 : 305;
    const y = boxY + Math.floor(i / 2) * 75;

    doc.rect(x, y, 240, 60).fill('rgba(255,255,255,0.05)').stroke('#334155');
    doc.fillColor('#94a3b8').fontSize(8).font('Helvetica-Bold').text(box.label.toUpperCase(), x + 15, y + 12);
    doc.fillColor('#f8fafc').fontSize(11).font('Helvetica-Bold').text(box.val, x + 15, y + 30);
  });

  // Highlights / Summary Box on Cover
  doc.rect(50, 440, 495, 290).fill('#1e293b').stroke('#334155');
  doc.fillColor(ACCENT).fontSize(12).font('Helvetica-Bold').text('EXECUTIVE HIGHLIGHTS & CAPABILITIES', 70, 460);

  const bullets = [
    'Automated extraction of candidate training data from EDOF Excel registers (.xlsx).',
    'Dual-track candidate classification: CLASSIQUE (Commercial) & WEDOF (Government).',
    'AI Quality Audit powered by Anthropic Claude for grade distribution & data integrity.',
    'Instant assembly of up to 80 verified Word document templates (.docx) with DocxTemplater.',
    'Hybrid PDF Generation Engine (Local LibreOffice converter with CloudConvert fallback).',
    'One-click ZIP package export & direct Google Shared Drive OAuth sync.'
  ];

  let bulletY = 490;
  bullets.forEach(txt => {
    doc.fillColor(ACCENT).fontSize(10).text('• ', 70, bulletY, { continued: true });
    doc.fillColor('#e2e8f0').font('Helvetica').fontSize(10).text(txt, { width: 450 });
    bulletY += 32;
  });

  // Footer Cover
  doc.fillColor('#94a3b8')
     .fontSize(9)
     .font('Helvetica')
     .text('Prepared for: Administrative & Technical Management Teams', 50, 775);
  doc.text('Release Date: August 2026', 380, 775, { align: 'right' });


  // -------------------------------------------------------------
  // PAGE 2: EXECUTIVE PROJECT OVERVIEW
  // -------------------------------------------------------------
  doc.addPage();

  addSectionHeader(doc, '1. Executive Project Overview');

  addSubHeader(doc, '1.1 Executive Summary');
  addParagraph(doc, 'CertiFlow is an enterprise-grade document automation and candidate evaluation platform built specifically for French professional training providers (including Proforma Institut and Proskills Institut) and certification authorities. Operating on live data imported from EDOF spreadsheet registers (EDOF.xlsx / Developer of EDOF_restructure_v9.xlsx), CertiFlow automates candidate evaluation, mark threshold verification, multi-template Word (.docx) document generation, high-fidelity PDF rendering, and automated cloud backup.');

  addParagraph(doc, 'By integrating Artificial Intelligence (Anthropic Claude 3.5 Sonnet / Claude AI Engine), CertiFlow eliminates manual data entry errors, ensuring that official certificates, evaluation sheets (Grille d\'Évaluation), jury transcripts (Procès-Verbal de Jury), and completion certificates (Attestations de Formation) are dynamically assembled with 100% accuracy in compliance with French RNCP and RS regulations.');

  addSubHeader(doc, '1.2 Problem Statement & Key Objectives');
  addParagraph(doc, 'Prior to CertiFlow, preparing certification packages required hours of repetitive manual data entry:');
  addBullet(doc, 'Manual Copy-Paste Errors: Transferring student grades and birth dates into 5 to 10 distinct Word templates per candidate caused missing fields and compliance risks.');
  addBullet(doc, 'Dual Tracking Requirements: Institutions manage both commercial candidates (CLASSIQUE) and government track candidates (WEDOF), each requiring different certificate layouts.');
  addBullet(doc, 'PDF Conversion Bottlenecks: Converting Word files into PDFs manually was slow and required costly third-party subscriptions.');

  addSubHeader(doc, '1.3 System Features Summary');
  
  // Table
  const tableTop = doc.y + 10;
  drawTableHeader(doc, tableTop, ['Feature Area', 'Technical Description & Capability', 'Business Impact']);
  
  let rowY = tableTop + 22;
  const rows = [
    ['EDOF Parsing', 'Extracts candidate rows from AUTOMATISATION sheet of EDOF Excel files.', 'Zero manual data entry; instant extraction.'],
    ['AI Quality Audit', 'Claude AI scans grades and attendance to detect missing fields or anomalies.', 'Proactive error prevention before printing.'],
    ['Dual Pipeline', 'Classifies candidates automatically into PRET_GENERATION_CLASSIQUE or WEDOF.', 'Seamless commercial & government workflows.'],
    ['DocxTemplater', 'Fills up to 80 Word templates with candidate details and jury marks.', 'Standardized high-speed document creation.'],
    ['Hybrid PDF Engine', 'Uses local LibreOffice in dev with fallback to CloudConvert REST API on Vercel.', 'Flexible, cost-effective PDF output everywhere.'],
    ['Google Drive Sync', 'OAuth Service Account pipeline uploads packages directly to Google Shared Drives.', 'Instant cloud archive & team access.']
  ];

  rows.forEach(r => {
    drawTableRow(doc, rowY, r);
    rowY += 28;
  });

  // -------------------------------------------------------------
  // PAGE 3: TECHNICAL ARCHITECTURE & SPECS
  // -------------------------------------------------------------
  doc.addPage();
  addSectionHeader(doc, '2. Technical Architecture & System Specifications');

  addSubHeader(doc, '2.1 Technology Stack Overview');
  addBullet(doc, 'Frontend Framework: Next.js 15 (App Router), React 19, TypeScript, Tailwind CSS, Lucide Icons.');
  addBullet(doc, 'AI Infrastructure: @anthropic-ai/sdk (Claude 3.5 Sonnet API) for evaluation audit & criteria calculation.');
  addBullet(doc, 'Template Processing: docxtemplater, pizzip, mammoth for XML template merging and Word creation.');
  addBullet(doc, 'Database Persistence: pg client connecting to Neon Serverless PostgreSQL database.');
  addBullet(doc, 'Cloud Integration: googleapis (Google Drive v3 API with Service Account credentials).');
  addBullet(doc, 'PDF Engine: libreoffice-convert (Local Node binary wrapper) & CloudConvert REST API (Vercel Serverless).');

  addSubHeader(doc, '2.2 REST API Specifications');
  
  const apiTableTop = doc.y + 10;
  drawTableHeader(doc, apiTableTop, ['Endpoint', 'Method', 'Functionality & Output']);
  let apiRowY = apiTableTop + 22;
  const apiRows = [
    ['/api/upload', 'POST', 'Parses AUTOMATISATION sheet, saves candidate rows to Neon PostgreSQL.'],
    ['/api/generate', 'POST', 'Orchestrates Claude AI evaluation, template filling, and PDF conversion.'],
    ['/api/download', 'POST', 'Compiles candidate document packages into a downloadable ZIP archive.'],
    ['/api/drive', 'POST', 'Uploads generated files directly to Google Shared Drive folder via Service Account.'],
    ['/api/analyze', 'POST', 'Sends dataset to Claude AI model for deep data audit and compliance checks.'],
    ['/api/settings', 'GET / POST', 'Inspects and updates environment configuration (API keys, DB, Drive ID).']
  ];

  apiRows.forEach(r => {
    drawTableRow(doc, apiRowY, r);
    apiRowY += 25;
  });

  doc.y = apiRowY + 15;
  addSubHeader(doc, '2.3 Template & Mapping Engine Structure');
  addParagraph(doc, 'The core template selection logic resides in lib/certiflow/pilot-mapping.json. This mapping matrix matches certification codes (e.g. RS5520, RS7311) to required document templates:');
  addBullet(doc, 'Attestation de Formation (.docx)');
  addBullet(doc, 'Certificat Répertoire Spécifique (.docx)');
  addBullet(doc, 'Procès-Verbal de Jury (.docx)');
  addBullet(doc, 'Grille d\'Évaluation des Compétences (.docx)');


  // -------------------------------------------------------------
  // PAGE 4: COMPREHENSIVE USER MANUAL
  // -------------------------------------------------------------
  doc.addPage();
  addSectionHeader(doc, '3. Comprehensive User Manual (Step-by-Step Guide)');

  const steps = [
    {
      num: '1',
      title: 'Accessing Platform & Authentication',
      desc: 'Navigate to https://certiflow-ten.vercel.app/ in your web browser. Enter credentials:\n• Username: admin\n• Password: Certiflow@2026\nClick "Se Connecter à CertiFlow" to enter the main dashboard.'
    },
    {
      num: '2',
      title: 'Uploading Candidate EDOF Data',
      desc: 'Click "Charger EDOF.xlsx" in the top bar. Select your official EDOF spreadsheet (e.g., Developer of EDOF_restructure_v9.xlsx). CertiFlow extracts candidate records and categorizes readiness into PRET_GENERATION_CLASSIQUE or PRET_GENERATION_WEDOF.'
    },
    {
      num: '3',
      title: 'Running AI Quality Audit',
      desc: 'Click "Analyse IA Fichier". Anthropic Claude AI audits candidate scores, attendance, and identification records, displaying missing fields or grade inconsistencies before generation.'
    },
    {
      num: '4',
      title: 'Generating Official Document Packages',
      desc: 'Single Candidate: Click "Générer Documents" on the target candidate row. CertiFlow populates Word templates, converts to PDF, and opens the preview modal.\nBatch ZIP: Select multiple candidates and click "Télécharger Package ZIP" to download Dossiers_Certification.zip.'
    },
    {
      num: '5',
      title: 'Synchronizing to Google Drive',
      desc: 'In the preview modal, click "Envoyer vers Google Drive". Files stream directly into your Google Shared Drive folder with confirmation: "Succès! X documents synchronisés sur Google Drive."'
    },
    {
      num: '6',
      title: 'Managing System Settings',
      desc: 'Click the Settings Gear icon to verify status for Claude API auto-connection, Neon PostgreSQL connection health, and Google Shared Drive folder ID.'
    }
  ];

  let stepY = doc.y + 10;
  steps.forEach(s => {
    doc.rect(40, stepY, 515, 72).fill('#ffffff').stroke('#cbd5e1');
    doc.circle(60, stepY + 22, 12).fill(SECONDARY);
    doc.fillColor('#ffffff').fontSize(10).font('Helvetica-Bold').text(s.num, 56, stepY + 17);
    
    doc.fillColor(PRIMARY).fontSize(11).font('Helvetica-Bold').text(s.title, 82, stepY + 12);
    doc.fillColor(TEXT_DARK).fontSize(8.5).font('Helvetica').text(s.desc, 82, stepY + 28, { width: 460 });

    stepY += 80;
  });


  // -------------------------------------------------------------
  // PAGE 5: OPERATIONAL & TROUBLESHOOTING GUIDE
  // -------------------------------------------------------------
  doc.addPage();
  addSectionHeader(doc, '4. Administrator & Troubleshooting Guide');

  addSubHeader(doc, '4.1 Production Environment Variables (Vercel)');
  addParagraph(doc, 'Store configuration settings securely in Vercel Project Settings > Environment Variables:');

  doc.rect(40, doc.y + 5, 515, 110).fill(PRIMARY);
  doc.fillColor(ACCENT).fontSize(8.5).font('Courier').text('CLAUDE_API_KEY="sk-ant-api03-..."\nDATABASE_URL="postgresql://user:pass@ep-cool-base-12345.us-east-2.aws.neon.tech/neondb"\nCERTIFLOW_TEMPLATES_ROOT="templates"\nCLOUDCONVERT_API_KEY="https://api.cloudconvert.com/v2/..."\nGOOGLE_SERVICE_ACCOUNT_EMAIL="certiflow-drive@certiflow-drive-integrator.iam..."\nGOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\\nMIIEvQ...\\n-----END PRIVATE KEY-----\\n"\nGOOGLE_DRIVE_FOLDER_ID="1A2b3C4d5E6f7G8h9I0j"', 52, doc.y + 15);

  doc.y += 125;
  addSubHeader(doc, '4.2 PDF Conversion Behavior Matrix');
  
  const pdfTableTop = doc.y + 5;
  drawTableHeader(doc, pdfTableTop, ['Environment', 'PDF Engine', 'Speed', 'Requirements']);
  let pdfRowY = pdfTableTop + 22;
  const pdfRows = [
    ['Local Development', 'libreoffice-convert', '2–4s / doc', 'Local LibreOffice installation. Free!'],
    ['Vercel Production', 'CloudConvert API', '8–15s / doc', 'CLOUDCONVERT_API_KEY configured.'],
    ['Fallback Mode', 'Native DOCX Only', '< 1 second', 'Default when PDF conversion disabled.']
  ];
  pdfRows.forEach(r => {
    drawTableRow(doc, pdfRowY, r);
    pdfRowY += 24;
  });

  doc.y = pdfRowY + 15;
  addSubHeader(doc, '4.3 Common Troubleshooting Scenarios');
  addBullet(doc, 'Vercel 504 Timeout: Serverless function exceeded 60s limit on free plan during PDF conversion. Upgrade to Vercel Pro (configured maxDuration: 300) or leave CLOUDCONVERT_API_KEY blank to deliver DOCX instantly.');
  addBullet(doc, 'Google Drive Permission Error: Service Account email lacks write access. Open Google Drive folder permissions and add service account email as Editor.');
  addBullet(doc, 'Missing Template Error: Template file missing for certification code. Verify file exists in templates/ directory and matches lib/certiflow/pilot-mapping.json.');


  // -------------------------------------------------------------
  // FOOTER PAGINATION & WATERMARK FOR ALL PAGES
  // -------------------------------------------------------------
  const range = doc.bufferedPageRange();
  for (let i = range.start; i < range.start + range.count; i++) {
    doc.switchToPage(i);

    // Skip footer on cover page
    if (i === range.start) continue;

    // Header line
    doc.moveTo(40, 30).lineTo(555, 30).strokeColor('#e2e8f0').stroke();
    doc.fillColor(TEXT_MUTED).fontSize(8).font('Helvetica').text('CertiFlow Platform — Executive Project Report & User Manual', 40, 18);
    doc.text('Production: certiflow-ten.vercel.app', 350, 18, { align: 'right' });

    // Footer line
    doc.moveTo(40, 805).lineTo(555, 805).strokeColor('#e2e8f0').stroke();
    doc.fillColor(TEXT_MUTED).fontSize(8).font('Helvetica').text('Proforma Institut & Proskills Institut © 2026 • Qualiopi & RNCP/RS Compliant', 40, 812);
    doc.text(`Page ${i + 1} of ${range.count}`, 450, 812, { align: 'right' });
  }

  doc.end();

  writeStream.on('finish', () => {
    console.log('Successfully created CertiFlow_Project_Report_and_User_Manual.pdf');
  });
}

// Helper Functions
function addSectionHeader(doc, title) {
  doc.fillColor('#0f172a').fontSize(16).font('Helvetica-Bold').text(title, 40, doc.y + 5);
  doc.moveTo(40, doc.y + 3).lineTo(555, doc.y + 3).strokeColor('#0f172a').lineWidth(1.5).stroke();
  doc.y += 10;
}

function addSubHeader(doc, title) {
  doc.fillColor('#0d9488').fontSize(11).font('Helvetica-Bold').text(title, 40, doc.y + 8);
  doc.y += 4;
}

function addParagraph(doc, text) {
  doc.fillColor('#1e293b').fontSize(9.5).font('Helvetica').text(text, 40, doc.y + 4, { width: 515, align: 'justify' });
  doc.y += 4;
}

function addBullet(doc, text) {
  doc.fillColor('#0d9488').fontSize(9.5).font('Helvetica-Bold').text('• ', 45, doc.y + 3, { continued: true });
  doc.fillColor('#1e293b').font('Helvetica').text(text, { width: 500 });
  doc.y += 3;
}

function drawTableHeader(doc, y, headers) {
  doc.rect(40, y, 515, 20).fill('#0f172a');
  const widths = [110, 240, 165];
  let x = 45;
  headers.forEach((h, idx) => {
    doc.fillColor('#ffffff').fontSize(8.5).font('Helvetica-Bold').text(h, x, y + 5, { width: widths[idx] });
    x += widths[idx];
  });
}

function drawTableRow(doc, y, cols) {
  doc.rect(40, y, 515, 24).fill(y % 2 === 0 ? '#f8fafc' : '#ffffff').stroke('#cbd5e1');
  const widths = [110, 240, 165];
  let x = 45;
  cols.forEach((c, idx) => {
    doc.fillColor('#1e293b').fontSize(8).font(idx === 0 ? 'Helvetica-Bold' : 'Helvetica').text(c, x, y + 6, { width: widths[idx] - 5 });
    x += widths[idx];
  });
}

createReportPDF();
