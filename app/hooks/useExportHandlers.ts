import { useState } from "react";
import { logExport } from "../lib/audit";
import { getPinHeaders } from "../lib/api-client";
import { logger } from "../lib/logger";
import type { ClinicalOutputs, ToastState } from "../types/clinical";

interface ExportHandlersOptions {
  outputs: ClinicalOutputs;
  currentPatientId: string | null;
  patientName: string;
  setToast: (toast: ToastState) => void;
}

export function useExportHandlers({
  outputs,
  currentPatientId,
  patientName,
  setToast,
}: ExportHandlersOptions) {
  const [showExportDropdown, setShowExportDropdown] = useState(false);
  const [isGeneratingPatientPdf, setIsGeneratingPatientPdf] = useState(false);
  const [patientPdfContent, setPatientPdfContent] = useState<string | null>(null);
  const [prescriptionContent, setPrescriptionContent] = useState<string | null>(null);

  // Export clinical PDF (original)
  function handleExportClinical() {
    setShowExportDropdown(false);
    logExport({
      patientId: currentPatientId,
      patientName,
      format: "clinical",
      content: {
        analise: outputs.analise,
        conduta: outputs.conduta,
        receita: outputs.receita,
      },
    });
    window.print();
  }

  // Generate and export patient-friendly PDF
  async function handleExportPatient() {
    setShowExportDropdown(false);

    if (!outputs.analise && !outputs.conduta) {
      setToast({ message: "Gere a Análise ou Conduta primeiro", type: "error" });
      return;
    }

    setIsGeneratingPatientPdf(true);
    setToast({ message: "Gerando versão para paciente...", type: "info" });

    try {
      const res = await fetch("/api/generate-patient-pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getPinHeaders() },
        body: JSON.stringify({
          analise: outputs.analise,
          conduta: outputs.conduta,
          patientName: patientName || "Paciente",
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Falha ao gerar PDF");

      setPatientPdfContent(data.text);

      logExport({
        patientId: currentPatientId,
        patientName,
        format: "patient",
        content: {
          analise: outputs.analise,
          conduta: outputs.conduta,
        },
      });

      // Small delay to allow state update, then print
      setTimeout(() => {
        window.print();
        // Clear after printing
        setTimeout(() => setPatientPdfContent(null), 1000);
      }, 100);
    } catch (err: any) {
      logger.error("Patient PDF export failed", { error: err.message });
      setToast({ message: "Erro: " + err.message, type: "error" });
    } finally {
      setIsGeneratingPatientPdf(false);
    }
  }

  // Generate and export prescription PDF
  function handleExportPrescription() {
    setShowExportDropdown(false);

    if (!outputs.receita) {
      setToast({ message: "Gere a Receita primeiro", type: "error" });
      return;
    }

    logExport({
      patientId: currentPatientId,
      patientName,
      format: "prescription",
      content: {
        receita: outputs.receita,
      },
    });

    // Use existing receita content for printing
    setPrescriptionContent(outputs.receita);

    // Small delay to allow state update, then print
    setTimeout(() => {
      window.print();
      // Clear after printing
      setTimeout(() => setPrescriptionContent(null), 1000);
    }, 100);
  }

  return {
    showExportDropdown,
    setShowExportDropdown,
    isGeneratingPatientPdf,
    patientPdfContent,
    prescriptionContent,
    handleExportClinical,
    handleExportPatient,
    handleExportPrescription,
  };
}
