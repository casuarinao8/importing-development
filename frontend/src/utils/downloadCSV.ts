export function downloadCSV(content: string | Blob, fileName: string, type = 'text/csv;charset=utf-8;') {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    // Not in a browser environment (SSR) — nothing to do
    return;
  }

  // Ensure filename has extension if it's likely a CSV
  if (!fileName.includes('.') && type.startsWith('text/csv')) {
    fileName = `${fileName}.csv`;
  }

  const blob = content instanceof Blob ? content : new Blob([content], { type });

  // Legacy IE/Edge support
  const nav = navigator as any;
  if (nav && typeof nav.msSaveOrOpenBlob === 'function') {
    nav.msSaveOrOpenBlob(blob, fileName);
    return;
  }

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  // Some browsers require the element to be in the DOM
  document.body.appendChild(a);
  a.click();
  a.remove();

  // Revoke after a short delay to ensure download started
  setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 1000);
}
