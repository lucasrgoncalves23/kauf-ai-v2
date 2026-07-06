import { useState } from "react";
import type { ClinicalData, ToastState } from "../types/clinical";
import { logger } from "../lib/logger";

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

  async function handleImport(file: File, target: keyof ClinicalData) {
    setLoadingImport(target);

    // Save existing content before showing loading status
    const existingContent = inputs[target]?.trim() || "";

    try {
      // CSV files: read client-side, no server call needed
      if (isCSV(file)) {
        const raw = await file.text();
        const formatted = formatCSV(raw);
        if (!formatted) throw new Error("CSV vazio ou inválido");

        if (existingContent) {
          const separator = `\n\n--- ${file.name} ---\n\n`;
          setInputs((prev) => ({ ...prev, [target]: existingContent + separator + formatted }));
          setToast({ message: `CSV adicionado com sucesso!`, type: "success" });
        } else {
          setInputs((prev) => ({ ...prev, [target]: formatted }));
          setToast({ message: `CSV importado com sucesso!`, type: "success" });
        }
        return;
      }

      // Validate file type for server-side processing
      const validTypes = ["application/pdf", "image/jpeg", "image/png"];
      if (!validTypes.includes(file.type)) {
        setToast({ message: "Formato inválido. Use PDF, JPG, PNG ou CSV.", type: "error" });
        return;
      }

      const formData = new FormData();
      formData.append("file", file);

      // Conditional loading text - show at the end if there's existing content
      const statusText = file.type === "application/pdf" ? "Lendo PDF..." : "Lendo Imagem (IA)...";
      if (existingContent) {
        setInputs((prev) => ({ ...prev, [target]: existingContent + "\n\n---\n\n" + statusText }));
      } else {
        setInputs((prev) => ({ ...prev, [target]: statusText }));
      }

      const res = await fetch("/api/import-pdf", { method: "POST", body: formData });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error || "Falha no servidor");

      // Append to existing content with a separator, or set new content
      if (existingContent) {
        const separator = `\n\n--- ${file.name} ---\n\n`;
        setInputs((prev) => ({ ...prev, [target]: existingContent + separator + data.text }));
        setToast({ message: `Arquivo adicionado com sucesso!`, type: "success" });
      } else {
        setInputs((prev) => ({ ...prev, [target]: data.text }));
        setToast({ message: `Arquivo importado com sucesso!`, type: "success" });
      }
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
