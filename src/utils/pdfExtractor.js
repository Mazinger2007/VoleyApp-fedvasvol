export async function downloadPdfBase64(pdfUrl, { signal } = {}) {
  const response = await fetch(pdfUrl, { signal });
  if (!response.ok) throw new Error(`HTTP ${response.status} downloading PDF`);
  const buffer = await response.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}
