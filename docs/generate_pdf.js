// docs/generate_pdf.js
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { marked } from 'marked';
import puppeteer from 'puppeteer-core';
import http from 'http';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const chromePath = '/usr/bin/google-chrome';

async function main() {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    console.log('Usage: node docs/generate_pdf.js <input_markdown_file> [output_pdf_file]');
    process.exit(1);
  }

  const inputFilename = args[0];
  const outputFilename = args[1] || inputFilename.replace(/\.md$/, '.pdf');

  const mdPath = path.resolve(__dirname, inputFilename);
  const pdfPath = path.resolve(__dirname, outputFilename);

  if (!fs.existsSync(mdPath)) {
    console.error(`Error: Input markdown file not found at ${mdPath}`);
    process.exit(1);
  }

  const title = inputFilename
    .replace(/\.md$/, '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase());

  let server;
  let browser;
  try {
    console.log(`Reading markdown file: ${inputFilename}...`);
    const mdContent = fs.readFileSync(mdPath, 'utf-8');

    console.log('Parsing markdown to HTML...');
    const htmlBody = await marked.parse(mdContent);

    const fullHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${title}</title>
  
  <!-- Fonts -->
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;600;700&display=swap" rel="stylesheet">

  <style>
    body {
      font-family: 'Outfit', sans-serif;
      line-height: 1.6;
      color: #1e293b;
      max-width: 850px;
      margin: 0 auto;
      padding: 3rem;
    }
    h1, h2, h3, h4 {
      color: #0f172a;
      font-weight: 700;
      margin-top: 1.8em;
      margin-bottom: 0.5em;
    }
    h1 {
      border-bottom: 2px solid #e2e8f0;
      padding-bottom: 0.4em;
      font-size: 2.2rem;
      margin-top: 0;
    }
    h2 {
      border-bottom: 1px solid #e2e8f0;
      padding-bottom: 0.3em;
      font-size: 1.6rem;
      margin-top: 2em;
    }
    h3 {
      font-size: 1.25rem;
    }
    p {
      margin-bottom: 1.2em;
      font-size: 1.05rem;
    }
    code {
      font-family: 'JetBrains Mono', monospace;
      background-color: #f1f5f9;
      padding: 0.15em 0.3em;
      border-radius: 4px;
      font-size: 0.85em;
      color: #0f172a;
    }
    pre {
      font-family: 'JetBrains Mono', monospace;
      background-color: #f8fafc;
      padding: 1.2rem;
      border-radius: 8px;
      border: 1px solid #e2e8f0;
      overflow-x: auto;
      margin: 1.5em 0;
    }
    pre code {
      background-color: transparent;
      padding: 0;
      font-size: 0.9em;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 2rem 0;
    }
    th, td {
      border: 1px solid #cbd5e1;
      padding: 0.85rem;
      text-align: left;
      font-size: 0.95rem;
    }
    th {
      background-color: #f1f5f9;
      font-weight: 600;
      color: #0f172a;
    }
    blockquote {
      border-left: 4px solid #f59e0b; /* Amber */
      background-color: #fffbeb;
      padding: 1rem 1.5rem;
      margin: 1.5em 0;
      border-radius: 0 8px 8px 0;
    }
    blockquote p {
      margin-bottom: 0;
      font-weight: 500;
      color: #78350f;
    }
    img {
      max-width: 80%;
      height: auto;
      display: block;
      margin: 2.5rem auto;
      border: 1px solid #cbd5e1;
      border-radius: 8px;
      box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.05), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
    }
    
    /* Print optimizations */
    @media print {
      body {
        max-width: 100%;
        padding: 0;
        margin: 0;
      }
      h1, h2, h3 {
        page-break-after: avoid;
      }
      table, pre, blockquote, tr {
        page-break-inside: avoid;
      }
      .page-break {
        page-break-before: always;
      }
    }
  </style>

  <!-- MathJax Configuration -->
  <script>
    window.MathJax = {
      tex: {
        inlineMath: [['$', '$'], ['\\\\(', '\\\\)']],
        displayMath: [['$$', '$$'], ['\\\\[', '\\\\]']]
      },
      svg: {
        fontCache: 'global'
      }
    };
  </script>
  <script id="MathJax-script" src="https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-svg.js"></script>
</head>
<body>
  ${htmlBody}
</body>
</html>`;

    console.log('Starting temporary HTTP server...');
    server = http.createServer((req, res) => {
      const decodedUrl = decodeURIComponent(req.url);
      if (decodedUrl === '/' || decodedUrl === '/index.html') {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(fullHtml);
      } else {
        // Resolve path relatively inside docs directory
        const relativePath = decodedUrl.startsWith('/') ? decodedUrl.substring(1) : decodedUrl;
        const filePath = path.join(__dirname, relativePath);
        if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
          const ext = path.extname(filePath).toLowerCase();
          let contentType = 'text/plain';
          if (ext === '.png') contentType = 'image/png';
          else if (ext === '.jpg' || ext === '.jpeg') contentType = 'image/jpeg';
          else if (ext === '.svg') contentType = 'image/svg+xml';
          else if (ext === '.css') contentType = 'text/css';
          else if (ext === '.js') contentType = 'application/javascript';

          res.writeHead(200, { 'Content-Type': contentType });
          res.end(fs.readFileSync(filePath));
        } else {
          res.writeHead(404);
          res.end('Not Found');
        }
      }
    });

    // Start server on an ephemeral port
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    const port = server.address().port;
    const localUrl = `http://127.0.0.1:${port}/index.html`;
    console.log(`Local server listening on ${localUrl}`);

    console.log('Launching headless Chrome...');
    browser = await puppeteer.launch({
      executablePath: chromePath,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    
    // Debug browser console, error, and network output
    page.on('console', msg => console.log('BROWSER LOG:', msg.text()));
    page.on('pageerror', err => console.error('BROWSER ERROR:', err.message));
    page.on('request', req => {
      if (req.url().startsWith('http://127.0.0.1')) {
        console.log('BROWSER REQ (LOCAL):', req.url());
      }
    });
    
    console.log('Writing temporary HTML file to disk for inspection...');
    const debugHtmlPath = mdPath.replace(/\.md$/, '.html');
    fs.writeFileSync(debugHtmlPath, fullHtml, 'utf-8');
    
    console.log('Loading page via HTTP...');
    await page.goto(localUrl, { waitUntil: 'networkidle0' });

    console.log('Waiting for MathJax to compile all equations...');
    await page.evaluate(async () => {
      // Poll until MathJax has loaded and initialized its typeset function
      await new Promise((resolve) => {
        const interval = setInterval(() => {
          if (window.MathJax && typeof window.MathJax.typesetPromise === 'function') {
            clearInterval(interval);
            resolve();
          }
        }, 50);
      });
      // Force render all math elements and wait for completion
      await window.MathJax.typesetPromise();
    });

    // Give a small extra delay for MathJax SVGs to paint
    await new Promise(resolve => setTimeout(resolve, 800));

    console.log('Generating PDF...');
    await page.pdf({
      path: pdfPath,
      format: 'A4',
      margin: {
        top: '1.2in',
        bottom: '1.2in',
        left: '1in',
        right: '1in'
      },
      printBackground: true
    });

    console.log(`Success! PDF successfully generated at: ${pdfPath}`);
  } catch (error) {
    console.error('Error during PDF generation:', error);
  } finally {
    if (browser) {
      console.log('Closing browser...');
      await browser.close();
    }
    if (server) {
      console.log('Stopping local server...');
      await new Promise((resolve) => server.close(resolve));
    }
  }
}

main();
