/**
 * printHtml — prints an arbitrary HTML string via a hidden iframe.
 * Uses a minimal inline print stylesheet with Thai font stack, clean table borders,
 * page margins, and break-inside:avoid on chart/section containers.
 */
export function printHtml(innerHtml: string, title: string): void {
  const iframe = document.createElement('iframe');
  iframe.style.cssText =
    'position:fixed;top:-9999px;left:-9999px;width:800px;height:1px;border:none;opacity:0;pointer-events:none';
  document.body.appendChild(iframe);

  const iframeDoc = iframe.contentDocument ?? iframe.contentWindow?.document;
  if (!iframeDoc) {
    document.body.removeChild(iframe);
    return;
  }

  const printCss = `
    @page { margin: 18mm 16mm; }
    body {
      font-family: 'Sarabun','Leelawadee UI','Tahoma',sans-serif;
      font-size: 14px;
      color: #1a1a1a;
      margin: 0;
    }
    h1 { font-size: 20px; margin: 0 0 4px 0; }
    h2 { font-size: 15px; margin: 16px 0 6px 0; border-bottom: 1px solid #ddd; padding-bottom: 4px; }
    .section { break-inside: avoid; margin-bottom: 20px; }
    .chart-img { break-inside: avoid; margin-bottom: 16px; }
    .chart-img img { width: 100%; border: 1px solid #e2e8f0; border-radius: 4px; display: block; }
    .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 4px 24px; margin: 8px 0; }
    .info-row { display: flex; gap: 6px; }
    .info-label { color: #666; min-width: 100px; }
    .pills { display: flex; gap: 8px; flex-wrap: wrap; margin: 6px 0; }
    .pill { padding: 3px 10px; border-radius: 999px; font-size: 13px; font-weight: 600; border: 1px solid #ccc; }
    table { width: 100%; border-collapse: collapse; font-size: 13px; margin-top: 8px; }
    th { background: #f1f5f9; font-weight: 700; padding: 6px 8px; border: 1px solid #cbd5e1; text-align: left; }
    td { padding: 5px 8px; border: 1px solid #e2e8f0; }
    tr:nth-child(even) td { background: #f8fafc; }
    .footer { margin-top: 24px; font-size: 12px; color: #666; border-top: 1px solid #ddd; padding-top: 8px; }
  `;

  iframeDoc.open();
  iframeDoc.write(
    `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${title}</title><style>${printCss}</style></head><body>${innerHtml}</body></html>`,
  );
  iframeDoc.close();

  const win = iframe.contentWindow;
  if (!win) {
    document.body.removeChild(iframe);
    return;
  }

  let printed = false;
  const w = win;

  function doPrint() {
    if (printed) return;
    printed = true;
    w.focus();
    w.print();
    setTimeout(() => {
      if (document.body.contains(iframe)) {
        document.body.removeChild(iframe);
      }
    }, 1000);
  }

  win.onload = () => {
    doPrint();
  };
  setTimeout(() => {
    doPrint();
  }, 200);
}

/**
 * printElement — prints a DOM element via a hidden iframe (no popup window).
 * Copies all <style> and <link rel="stylesheet"> from the page into the iframe
 * so system/inherited fonts and CSS variables render correctly (FR-11.1/11.3).
 */
export function printElement(el: HTMLElement): void {
  const iframe = document.createElement('iframe');
  iframe.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:800px;height:1px;border:none;opacity:0;pointer-events:none';
  document.body.appendChild(iframe);

  const iframeDoc = iframe.contentDocument ?? iframe.contentWindow?.document;
  if (!iframeDoc) {
    document.body.removeChild(iframe);
    return;
  }

  // Collect page styles
  const styleNodes = Array.from(document.querySelectorAll('style, link[rel="stylesheet"]'));
  const stylesHtml = styleNodes
    .map((node) => {
      if (node.tagName === 'STYLE') return `<style>${(node as HTMLStyleElement).textContent ?? ''}</style>`;
      const link = node as HTMLLinkElement;
      return `<link rel="stylesheet" href="${link.href}">`;
    })
    .join('\n');

  iframeDoc.open();
  iframeDoc.write(`<!DOCTYPE html><html><head><meta charset="utf-8">${stylesHtml}<style>
    @media print { body { margin: 0; } }
    body { font-family: system-ui, -apple-system, sans-serif; }
  </style></head><body>${el.outerHTML}</body></html>`);
  iframeDoc.close();

  // Give styles a moment to load, then print
  const win = iframe.contentWindow;
  if (!win) {
    document.body.removeChild(iframe);
    return;
  }

  let printed = false;
  const w = win;

  function doPrint() {
    if (printed) return;
    printed = true;
    w.focus();
    w.print();
    // Clean up after a brief delay to allow print dialog to open
    setTimeout(() => {
      if (document.body.contains(iframe)) {
        document.body.removeChild(iframe);
      }
    }, 1000);
  }

  win.onload = () => {
    doPrint();
  };

  // Fallback: if onload already fired or styles are inline
  setTimeout(() => {
    doPrint();
  }, 200);
}
