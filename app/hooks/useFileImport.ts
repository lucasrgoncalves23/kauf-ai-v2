import { useState } from "react";
import type { ClinicalData, ToastState } from "../types/clinical";
import { logger } from "../lib/logger";

// Vercel rejects request bodies over ~4.5MB, so large files are processed
// client-side (PDF text extraction / page rendering) or compressed before upload.
const MAX_UPLOAD = 4 * 1024 * 1024;
const MAX_SCAN_PAGES = 30;
const OCR_CONCURRENCY = 3;

export function useFileImport(
  inputs: ClinicalData,
  setInputs: React.Dispatch<React.SetStateAction<ClinicalData>>,
  setToast: (toast: ToastState) => void
) {
  const [loadingImport, setLoadingImport] = useState<keyof ClinicalData | null>(null);

  function isCSV(file: File): boolean {
    return file.type === "text/csv" || file.name.toLowerCase().endsWith(".csv");
  }

  function formatCSV(raw: string): string {
    const lines = raw.trim().split(/\r?\n/).filter(Boolean);
    if (lines.length === 0) return "";

    // Detect delimiter (comma, semicolon, or tab)
    const firstLine = lines[0];
    const delimiter = firstLine.includes(";") ? ";" : firstLine.includes("\t") ? "\t" : ",";

    const headers = firstLine.split(delimiter).map((h) => h.trim().replace(/^["']|["']$/g, ""));
    const rows = lines.slice(1).map((line) =>
      line.split(delimiter).map((c) => c.trim().replace(/^["']|["']$/g, ""))
    );

    // Format as readable text: one row per line, "Header: Value" pairs
    return rows
      .map((row) =>
        headers.map((h, i) => `${h}: ${row[i] ?? ""}`).join(" | ")
      )
      .join("\n");
  }

  async function ocrUpload(blob: Blob, filename: string): Promise<string> {
    const formData = new FormData();
    formData.append("file", blob, filename);

    const res = await fetch("/api/import-pdf", { method: "POST", body: formData });

    // Platform errors (413 body too large, 504 timeout) return HTML, not JSON
    let data: { text?: string; error?: string };
    try {
      data = await res.json();
    } catch {
      if (res.status === 413) throw new Error("Arquivo muito grande para o servidor");
      if (res.status === 504) throw new Error("Tempo limite excedido. Tente novamente.");
      throw new Error(`Falha no servidor (código ${res.status})`);
    }

    if (!res.ok || !data.text) throw new Error(data.error || "Falha no servidor");
    return data.text;
  }

  async function handleImport(file: File, target: keyof ClinicalData) {
    setLoadingImport(target);

    // Save existing content before showing loading status
    const existingContent = inputs[target]?.trim() || "";

    const showStatus = (status: string) => {
      if (existingContent) {
        setInputs((prev) => ({ ...prev, [target]: existingContent + "\n\n---\n\n" + status }));
      } else {
        setInputs((prev) => ({ ...prev, [target]: status }));
      }
    };

    const applyResult = (text: string, kind: "Arquivo" | "CSV" = "Arquivo") => {
      if (existingContent) {
        const separator = `\n\n--- ${file.name} ---\n\n`;
        setInputs((prev) => ({ ...prev, [target]: existingContent + separator + text }));
        setToast({ message: `${kind} adicionado com sucesso!`, type: "success" });
      } else {
        setInputs((prev) => ({ ...prev, [target]: text }));
        setToast({ message: `${kind} importado com sucesso!`, type: "success" });
      }
    };

    try {
      // CSV files: read client-side, no server call needed
      if (isCSV(file)) {
        const raw = await file.text();
        const formatted = formatCSV(raw);
        if (!formatted) throw new Error("CSV vazio ou inválido");
        applyResult(formatted, "CSV");
        return;
      }

      // Validate file type
      const validTypes = ["application/pdf", "image/jpeg", "image/png"];
      if (!validTypes.includes(file.type)) {
        setToast({ message: "Formato inválido. Use PDF, JPG, PNG ou CSV.", type: "error" });
        return;
      }

      if (file.type === "application/pdf") {
        showStatus("Lendo PDF...");

        try {
          const { extractPdfText, renderPdfPagesToImages } = await import("../lib/clientPdf");

          // Digital PDFs: extract text in the browser — no upload, no size limit
          const { text } = await extractPdfText(file);
          if (text.length > 150) {
            applyResult(text);
            return;
          }

          // Scanned PDFs: render pages to JPEG and OCR each one via the API
          showStatus("PDF digitalizado — preparando páginas para leitura (IA)...");
          const { images, pageCount, truncated } = await renderPdfPagesToImages(
            file,
            MAX_SCAN_PAGES
          );

          const results: string[] = new Array(images.length);
          let done = 0;
          let nextIndex = 0;
          const workers = Array.from(
            { length: Math.min(OCR_CONCURRENCY, images.length) },
            async () => {
              while (nextIndex < images.length) {
                const i = nextIndex++;
                results[i] = await ocrUpload(images[i], `pagina-${i + 1}.jpg`);
                done++;
                showStatus(`Lendo página ${done}/${images.length} (IA)...`);
              }
            }
          );
          await Promise.all(workers);

          let fullText = results.join("\n\n");
          if (truncated) {
            fullText += `\n\n[Aviso: PDF com ${pageCount} páginas — apenas as primeiras ${MAX_SCAN_PAGES} foram lidas.]`;
          }
          applyResult(fullText);
          return;
        } catch (pdfErr) {
          // Fallback: small PDFs can still go through the server route
          logger.error("Client-side PDF processing failed", { error: String(pdfErr) });
          if (file.size > MAX_UPLOAD) throw pdfErr;
          showStatus("Lendo PDF...");
          applyResult(await ocrUpload(file, file.name));
          return;
        }
      }

      // Images: compress client-side if over the upload limit
      let payload: Blob = file;
      let filename = file.name;
      if (file.size > MAX_UPLOAD) {
        showStatus("Comprimindo imagem...");
        const { compressImageFile } = await import("../lib/clientPdf");
        payload = await compressImageFile(file);
        filename = file.name.replace(/\.\w+$/, "") + ".jpg";
        if (payload.size > MAX_UPLOAD) {
          throw new Error("Imagem grande demais, mesmo após compressão.");
        }
      }

      showStatus("Lendo Imagem (IA)...");
      applyResult(await ocrUpload(payload, filename));
    } catch (err: any) {
      logger.error("File import failed", { error: String(err), target });
      // Restore existing content on error instead of clearing
      setInputs((prev) => ({ ...prev, [target]: existingContent }));
      setToast({ message: "Erro na importação: " + err.message, type: "error" });
    } finally {
      setLoadingImport(null);
    }
  }

  return { handleImport, loadingImport };
}
