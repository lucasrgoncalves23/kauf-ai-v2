// Client-side file processing using pdf.js and canvas.
// Runs in the browser so file size is not limited by Vercel's ~4.5MB
// serverless request body cap — only the (small) extracted text or
// compressed page images are ever uploaded.

let pdfjsPromise: Promise<typeof import("pdfjs-dist")> | null = null;

async function loadPdfjs() {
  if (!pdfjsPromise) {
    pdfjsPromise = import("pdfjs-dist").then((pdfjs) => {
      pdfjs.GlobalWorkerOptions.workerSrc = new URL(
        "pdfjs-dist/build/pdf.worker.min.mjs",
        import.meta.url
      ).toString();
      return pdfjs;
    });
  }
  return pdfjsPromise;
}

/** Extract the embedded text layer of a PDF (works for digitally-generated PDFs). */
export async function extractPdfText(
  file: File
): Promise<{ text: string; pageCount: number }> {
  const pdfjs = await loadPdfjs();
  const task = pdfjs.getDocument({ data: await file.arrayBuffer() });
  const doc = await task.promise;
  const pageCount = doc.numPages;
  let out = "";
  for (let i = 1; i <= pageCount; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    out +=
      content.items
        .map((item) => ("str" in item ? item.str : ""))
        .join(" ") + "\n";
  }
  await task.destroy();
  return { text: out.trim(), pageCount };
}

/** Render PDF pages to compressed JPEGs for OCR (for scanned PDFs with no text layer). */
export async function renderPdfPagesToImages(
  file: File,
  maxPages: number
): Promise<{ images: Blob[]; pageCount: number; truncated: boolean }> {
  const pdfjs = await loadPdfjs();
  const task = pdfjs.getDocument({ data: await file.arrayBuffer() });
  const doc = await task.promise;
  const pageCount = doc.numPages;
  const n = Math.min(pageCount, maxPages);
  const images: Blob[] = [];

  for (let i = 1; i <= n; i++) {
    const page = await doc.getPage(i);
    const baseViewport = page.getViewport({ scale: 1 });
    // Target ~1400px wide pages: enough resolution for lab-report OCR
    const scale = Math.min(2.5, Math.max(1, 1400 / baseViewport.width));
    const viewport = page.getViewport({ scale });

    const canvas = document.createElement("canvas");
    canvas.width = Math.floor(viewport.width);
    canvas.height = Math.floor(viewport.height);

    await page.render({ canvas, viewport }).promise;

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", 0.8)
    );
    if (!blob) throw new Error(`Falha ao converter página ${i}`);
    images.push(blob);
    page.cleanup();
  }

  await task.destroy();
  return { images, pageCount, truncated: pageCount > n };
}

/** Downscale/recompress an image so it fits under the upload limit. */
export async function compressImageFile(
  file: File,
  maxDim = 2200,
  quality = 0.8
): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const ratio = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * ratio);
  canvas.height = Math.round(bitmap.height * ratio);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas não suportado neste navegador");
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("Falha ao comprimir imagem"))),
      "image/jpeg",
      quality
    )
  );
}
