const path = require('path');
const fs = require('fs');

async function main() {
  let puppeteer;
  try {
    puppeteer = require('puppeteer-core');
  } catch (e) {
    try {
      puppeteer = require('puppeteer');
    } catch (e2) {
      console.error('Puppeteer not found in node_modules.');
      process.exit(1);
    }
  }

  const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  const executablePath = fs.existsSync(chromePath) ? chromePath : (fs.existsSync(edgePath) ? edgePath : undefined);

  console.log('Using browser binary:', executablePath);

  const browser = await puppeteer.launch({
    executablePath,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--force-color-profile=srgb']
  });

  const page = await browser.newPage();
  const htmlPath = path.join(__dirname, 'report_pro.html');
  const pdfPath = path.join(__dirname, 'CertiFlow_Project_Report_and_User_Manual.pdf');

  console.log('Loading HTML from:', htmlPath);
  await page.goto(`file:///${htmlPath.replace(/\\/g, '/')}`, { waitUntil: 'networkidle0' });

  console.log('Generating PDF...');
  await page.pdf({
    path: pdfPath,
    format: 'A4',
    printBackground: true,
    margin: {
      top: '15mm',
      bottom: '18mm',
      left: '15mm',
      right: '15mm'
    }
  });

  await browser.close();
  console.log('PDF successfully generated at:', pdfPath);
}

main().catch(err => {
  console.error('Error generating PDF:', err);
  process.exit(1);
});
