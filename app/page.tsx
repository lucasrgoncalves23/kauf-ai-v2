"use client";

import { useState, useEffect, useCallback } from "react";

// --- LIB IMPORTS ---
import {
  approveCorrection,
  unapproveCorrection,
  deleteCorrection,
  getCorrectionStats,
} from "./lib/corrections";
import { extractDemographics } from "./lib/extraction";
import {
  getAuditStats,
  exportAuditLog,
} from "./lib/audit";

// --- TYPE IMPORTS ---
import type {
  ClinicalData,
  ClinicalOutputs,
  ChatMessage,
  EngineStatus,
  Settings,
  PatientRecord,
  PatientProfile,
  Consulta,
} from "./types/clinical";
import { DEFAULT_SETTINGS } from "./types/clinical";
import { saveConsulta, fetchConsultas, fetchAllConsultas } from "./lib/api-client";

// --- COMPONENT IMPORTS ---
import { TrendingUp, Columns3 } from "lucide-react";
import { Toast, ConfirmDialog } from "./components/ui";
import { TrashBanner } from "./components/TrashBanner";
import { DataBox } from "./components/DataBox";
import { MedicalReportPrint } from "./components/MedicalReportPrint";
import { LabTrendsModal } from "./components/LabTrendsModal";
import { ConsultaCompareModal } from "./components/ConsultaCompareModal";
import {
  PinLogin,
  PatientSwitcher,
  PatientSnapshot,
  DataSourcesStatus,
  ConsultaHistory,
  HeaderBar,
  GenerationButtons,
  EnginePanel,
  CopilotChat,
  SettingsDrawer,
  FullscreenEditor,
  CorrectionsPanel,
  OutputPanel,
  ErrorBoundary,
  AnamneseForm,
} from "./components";

// --- HOOK IMPORTS ---
import {
  useSessionPersistence,
  usePatientManagement,
  useGenerationWorkflow,
  useCopilotChat,
  useExportHandlers,
  useEngineStatus,
  useFileImport,
  useCorrectionCapture,
} from "./hooks";

// --- MAIN PAGE ---

export default function Home() {
  // --- AUTH STATE ---
  const [authenticated, setAuthenticated] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);

  useEffect(() => {
    const isAuth = sessionStorage.getItem("kai-authenticated") === "true";
    setAuthenticated(isAuth);
    setAuthChecked(true);
  }, []);

  // --- CORE STATE ---
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" | "info" } | null>(null);
  const [inputs, setInputs] = useState<ClinicalData>({ anamnese: "", bioimpedancia: "", laboratoriais: "", genetica: "", wearable: "" });
  const [outputs, setOutputs] = useState<ClinicalOutputs>({ analise: "", conduta: "", receita: "" });
  const [patientProfile, setPatientProfile] = useState<PatientProfile>({ name: "", age: "", sex: "", cpf: "", birthDate: "" });
  const [engineStatus, setEngineStatus] = useState<EngineStatus>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [showSettings, setShowSettings] = useState(false);
  const [showLabTrends, setShowLabTrends] = useState(false);
  const [showCompare, setShowCompare] = useState(false);
  const [fullscreenPanel, setFullscreenPanel] = useState<'analise' | 'conduta' | 'receita' | 'copilot' | null>(null);
  const [patients, setPatients] = useState<Record<string, PatientRecord>>({});
  const [currentPatientId, setCurrentPatientId] = useState<string | null>(null);

  // --- LAYOUT STATE ---
  const [leftCollapsed, setLeftCollapsed] = useState(false);
  const [rightCollapsed, setRightCollapsed] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState<{
    title: string;
    message?: string;
    confirmLabel?: string;
    danger?: boolean;
    onConfirm: () => void;
  } | null>(null);

  // Restore sidebar state; on narrow screens default to collapsed panels
  useEffect(() => {
    const left = localStorage.getItem("kai-left-collapsed");
    const right = localStorage.getItem("kai-right-collapsed");
    const narrow = window.innerWidth < 1280;
    setLeftCollapsed(left !== null ? left === "1" : narrow && window.innerWidth < 1100);
    setRightCollapsed(right !== null ? right === "1" : narrow);
  }, []);

  const toggleLeft = useCallback(() => {
    setLeftCollapsed((prev) => {
      localStorage.setItem("kai-left-collapsed", prev ? "0" : "1");
      return !prev;
    });
  }, []);

  const toggleRight = useCallback(() => {
    setRightCollapsed((prev) => {
      localStorage.setItem("kai-right-collapsed", prev ? "0" : "1");
      return !prev;
    });
  }, []);

  // --- CONSULTA STATE ---
  const [consultasMap, setConsultasMap] = useState<Record<string, Consulta[]>>({});
  const [isSavingConsulta, setIsSavingConsulta] = useState(false);

  const handleSaveConsulta = useCallback(async () => {
    if (!currentPatientId) {
      setToast({ message: "Nenhum paciente selecionado", type: "error" });
      return;
    }
    const hasInputs = Object.values(inputs).some(v => v.trim() !== "");
    const hasOutputs = Object.values(outputs).some(v => v.trim() !== "");
    if (!hasInputs && !hasOutputs) {
      setToast({ message: "Nada para salvar. Preencha os dados do paciente primeiro.", type: "error" });
      return;
    }
    setIsSavingConsulta(true);
    try {
      const result = await saveConsulta(currentPatientId, {
        inputs,
        outputs,
        engineStatus,
        notes: "",
      });
      if (result.success && result.consulta) {
        setConsultasMap(prev => ({
          ...prev,
          [currentPatientId]: [result.consulta!, ...(prev[currentPatientId] || [])],
        }));
        setToast({ message: "Consulta salva no prontuario", type: "success" });
      } else {
        setToast({ message: result.error || "Erro desconhecido ao salvar consulta", type: "error" });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setToast({ message: `Sem conexao com o servidor: ${message}`, type: "error" });
    } finally {
      setIsSavingConsulta(false);
    }
  }, [currentPatientId, inputs, outputs, engineStatus, setToast]);

  const handleSetPatientFolder = useCallback((patientId: string, folder: string | undefined) => {
    setPatients(prev => {
      const patient = prev[patientId];
      if (!patient) return prev;
      return { ...prev, [patientId]: { ...patient, folder, updatedAt: new Date().toISOString() } };
    });
  }, [setPatients]);

  // Load all consultas on startup
  const [consultasLoaded, setConsultasLoaded] = useState(false);
  useEffect(() => {
    if (consultasLoaded) return;
    fetchAllConsultas().then(grouped => {
      if (Object.keys(grouped).length > 0) {
        setConsultasMap(grouped);
      }
      setConsultasLoaded(true);
    }).catch(() => setConsultasLoaded(true));
  }, [consultasLoaded]);

  // Fallback: load per-patient if batch failed
  useEffect(() => {
    if (!consultasLoaded || !currentPatientId) return;
    if (consultasMap[currentPatientId]) return;
    fetchConsultas(currentPatientId).then(consultas => {
      if (consultas.length > 0) {
        setConsultasMap(prev => ({ ...prev, [currentPatientId]: consultas }));
      }
    });
  }, [currentPatientId, consultasLoaded, consultasMap]);

  // --- HOOKS ---
  const { updateEngineStatus } = useEngineStatus(inputs, settings, setEngineStatus);
  const { handleImport, loadingImport } = useFileImport(inputs, setInputs, setToast);

  const {
    setOriginalOutputs,
    showCorrectionsPanel, setShowCorrectionsPanel,
    correctionsList,
    handleOutputBlur, handleSaveAsExample, refreshCorrectionsList,
  } = useCorrectionCapture(outputs, patientProfile, currentPatientId, setToast);

  const { saveStatus } = useSessionPersistence(
    { inputs, outputs, patientProfile, chatMessages, engineStatus, patients, currentPatientId, settings },
    { setInputs, setOutputs, setPatientProfile, setChatMessages, setEngineStatus, setPatients, setCurrentPatientId, setSettings }
  );

  const {
    showPatientSwitcher, setShowPatientSwitcher,
    editingPatientId, editingPatientName, setEditingPatientName,
    sortedPatients,
    handleCreateNewPatient, handleSwitchPatient, handleDeletePatient,
    handleStartRename, handleSaveRename, handleCancelRename,
    sortedTrashedPatients, trashBanner, handleUndoTrash,
    handleRestorePatient, handlePermanentDelete,
  } = usePatientManagement(
    { patients, currentPatientId },
    { setPatients, setCurrentPatientId, setInputs, setOutputs, setPatientProfile, setChatMessages, setEngineStatus, setToast }
  );

  const handleLoadConsulta = useCallback((consulta: Consulta) => {
    // Always load a consulta into its own patient's chart — switching first
    // prevents autosave from writing one patient's data into another's record
    if (consulta.patientId !== currentPatientId) {
      const target = patients[consulta.patientId];
      if (!target || target.deletedAt) {
        setToast({ message: "Paciente desta consulta não está ativo", type: "error" });
        return;
      }
      handleSwitchPatient(consulta.patientId);
    }
    setInputs(consulta.inputs);
    setOutputs(consulta.outputs);
    if (consulta.engineStatus) setEngineStatus(consulta.engineStatus);
    setToast({
      message: `Consulta de ${new Date(consulta.timestamp).toLocaleDateString("pt-BR")} carregada`,
      type: "info",
    });
  }, [currentPatientId, patients, handleSwitchPatient, setInputs, setOutputs, setEngineStatus, setToast]);

  const { chatInput, setChatInput, isChatLoading, handleSendMessage } = useCopilotChat({
    inputs, outputs, engineStatus, chatMessages,
    setChatMessages, setOutputs, setToast,
  });

  const {
    isRunningAnalise, canRunAnalise, handleRunAnalise, handleStopAnalise,
    isRunningConduta, canRunConduta, handleRunConduta, handleStopConduta,
    isRunningReceita, canRunReceita, handleRunReceita, handleStopReceita,
    previousOutputs, handleRestoreOutput,
  } = useGenerationWorkflow({
    inputs, outputs, setOutputs, setOriginalOutputs, setToast,
    currentPatientId, patientName: patientProfile.name,
    engineStatus, onEngineUpdate: updateEngineStatus,
  });

  const {
    showExportDropdown, setShowExportDropdown,
    isGeneratingPatientPdf, patientPdfContent, prescriptionContent,
    handleExportClinical, handleExportPatient, handleExportPrescription,
  } = useExportHandlers({
    outputs, currentPatientId, patientName: patientProfile.name, setToast,
  });

  // --- EFFECTS ---
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;

      // Cmd/Ctrl+S: salvar consulta
      if (mod && e.key.toLowerCase() === "s") {
        e.preventDefault();
        handleSaveConsulta();
        return;
      }

      // Cmd/Ctrl+Enter: run the next pending generation step
      if (mod && e.key === "Enter") {
        e.preventDefault();
        if (isRunningAnalise || isRunningConduta || isRunningReceita) return;
        if (!outputs.analise.trim()) handleRunAnalise();
        else if (!outputs.conduta.trim()) handleRunConduta();
        else if (!outputs.receita.trim()) handleRunReceita();
        else setToast({ message: "Análise, Conduta e Receita já geradas", type: "info" });
        return;
      }

      // Esc: close whatever is open
      if (e.key === "Escape") {
        setFullscreenPanel(null);
        setShowSettings(false);
        setShowLabTrends(false);
        setShowCompare(false);
        setShowCorrectionsPanel(false);
        setShowPatientSwitcher(false);
        setShowExportDropdown(false);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  });

  useEffect(() => {
    const text = inputs.anamnese;
    if (!text) return;
    const demographics = extractDemographics(text);
    setPatientProfile(prev => ({
      ...prev,
      age: demographics.age?.value?.toString() || prev.age,
      sex: demographics.sex ? (demographics.sex.value === "M" ? "Masculino" : "Feminino") : prev.sex,
      cpf: demographics.cpf?.value || prev.cpf,
      birthDate: demographics.birthDate?.value || prev.birthDate,
    }));
  }, [inputs.anamnese]);

  // --- RENDER ---
  const compact = settings.ui.compactView;

  // Show nothing while checking auth
  if (!authChecked) {
    return <div className="min-h-screen bg-white dark:bg-slate-900" />;
  }

  // Show PIN login if not authenticated
  if (!authenticated) {
    return <PinLogin onSuccess={() => setAuthenticated(true)} />;
  }

  const gridCols = [
    !leftCollapsed && (compact ? "240px" : "280px"),
    "minmax(0,1fr)",
    !rightCollapsed && (compact ? "300px" : "360px"),
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <>
      <div
        data-density={compact ? "compact" : "comfortable"}
        className="min-h-screen text-slate-800 dark:text-slate-200 font-sans print:hidden overflow-hidden relative bg-white dark:bg-slate-900 transition-colors duration-300"
      >
        {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
        {trashBanner && (
          <TrashBanner
            patientName={trashBanner.patientName}
            onUndo={() => handleUndoTrash(trashBanner.patientId)}
          />
        )}

        <div className="relative mx-auto max-w-[1600px] h-screen flex flex-col p-6 compact:p-3">
          <div className="grid h-full gap-8 compact:gap-4" style={{ gridTemplateColumns: gridCols }}>

            {/* LEFT: SNAPSHOT */}
            {!leftCollapsed && (
            <ErrorBoundary fallbackLabel="Painel do Paciente">
            <aside className="no-print h-full min-h-0 overflow-visible flex flex-col">
              <div className="rounded-2xl bg-slate-50/80 dark:bg-slate-800/80 backdrop-blur-xl border border-slate-200/40 dark:border-slate-700/40 shadow-sm flex-1 overflow-y-auto overflow-x-visible transition-colors duration-300 p-6 compact:p-4">
                <PatientSwitcher
                  isOpen={showPatientSwitcher}
                  onToggle={() => setShowPatientSwitcher(!showPatientSwitcher)}
                  currentPatientId={currentPatientId}
                  patients={patients}
                  sortedPatients={sortedPatients}
                  editingPatientId={editingPatientId}
                  editingPatientName={editingPatientName}
                  onEditingNameChange={setEditingPatientName}
                  onCreateNew={handleCreateNewPatient}
                  onSwitch={handleSwitchPatient}
                  onStartRename={handleStartRename}
                  onSaveRename={handleSaveRename}
                  onCancelRename={handleCancelRename}
                  onDelete={handleDeletePatient}
                  consultas={consultasMap}
                  onLoadConsulta={handleLoadConsulta}
                  onSetPatientFolder={handleSetPatientFolder}
                  trashedPatients={sortedTrashedPatients}
                  onRestorePatient={handleRestorePatient}
                  onPermanentDelete={handlePermanentDelete}
                />
                <PatientSnapshot profile={patientProfile} onProfileChange={setPatientProfile} />
                <DataSourcesStatus inputs={inputs} />
                <ConsultaHistory
                  consultas={currentPatientId ? (consultasMap[currentPatientId] || []) : []}
                  onLoadConsulta={handleLoadConsulta}
                />
                <button
                  onClick={() => setShowLabTrends(true)}
                  className="no-print w-full flex items-center gap-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] hover:border-slate-200 dark:hover:border-slate-600 text-left transition-all p-4 compact:p-3"
                >
                  <TrendingUp className="w-4 h-4 text-brand-600 dark:text-brand-400" />
                  <span className="text-2xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Evolução Laboratorial
                  </span>
                </button>
                <button
                  onClick={() => setShowCompare(true)}
                  className="no-print w-full flex items-center gap-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] hover:border-slate-200 dark:hover:border-slate-600 text-left transition-all p-4 compact:p-3"
                >
                  <Columns3 className="w-4 h-4 text-indigo-500 dark:text-indigo-400" />
                  <span className="text-2xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Comparar Consultas
                  </span>
                </button>
              </div>
            </aside>
            </ErrorBoundary>
            )}

            {/* CENTER: ENGINE */}
            <ErrorBoundary fallbackLabel="Painel Principal">
            <main className="flex flex-col h-full overflow-hidden no-scrollbar">
              <HeaderBar
                showExportDropdown={showExportDropdown}
                onToggleExportDropdown={() => setShowExportDropdown(!showExportDropdown)}
                isGeneratingPatientPdf={isGeneratingPatientPdf}
                onExportClinical={handleExportClinical}
                onExportPatient={handleExportPatient}
                onExportPrescription={handleExportPrescription}
                onClearSession={() => {
                  // Start a fresh patient instead of blanking the current one —
                  // blanking in place gets autosaved over the patient's record
                  setConfirmDialog({
                    title: "Limpar a tela?",
                    message: "Um novo paciente será iniciado. O paciente atual permanece salvo.",
                    confirmLabel: "Limpar",
                    onConfirm: () => {
                      localStorage.removeItem("kai-session");
                      handleCreateNewPatient();
                      setConfirmDialog(null);
                    },
                  });
                }}
                onOpenSettings={() => setShowSettings(true)}
                onSaveConsulta={handleSaveConsulta}
                isSavingConsulta={isSavingConsulta}
                saveStatus={saveStatus}
                leftCollapsed={leftCollapsed}
                rightCollapsed={rightCollapsed}
                onToggleLeft={toggleLeft}
                onToggleRight={toggleRight}
              />

              <div className="flex-1 overflow-y-auto pr-2 space-y-8 pb-10 compact:space-y-4 compact:pb-6">
                {/* Input boxes */}
                <section className="no-print">
                  <div className="flex items-center gap-3 mb-4 compact:mb-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-brand-500"></span>
                    <span className="text-2xs font-semibold uppercase text-slate-400 dark:text-slate-500 tracking-wider">Inputs Clínicos</span>
                  </div>
                  <AnamneseForm
                    value={inputs.anamnese}
                    onChange={(v) => setInputs((p) => ({ ...p, anamnese: v }))}
                    onImport={(f) => handleImport(f, "anamnese")}
                    isLoading={loadingImport === "anamnese"}
                  />
                  <div className="grid grid-cols-2 gap-4 compact:gap-2">
                    {(["bioimpedancia", "laboratoriais", "genetica", "wearable"] as const).map((key) => (
                      <DataBox key={key} title={key} value={inputs[key]} onChange={(v) => setInputs(p => ({...p, [key]: v}))} onImport={(f) => handleImport(f, key)} isLoading={loadingImport === key} />
                    ))}
                  </div>
                </section>

                <GenerationButtons
                  isRunningAnalise={isRunningAnalise} canRunAnalise={canRunAnalise()} onRunAnalise={handleRunAnalise} onStopAnalise={handleStopAnalise}
                  isRunningConduta={isRunningConduta} canRunConduta={canRunConduta()} onRunConduta={handleRunConduta} onStopConduta={handleStopConduta}
                  isRunningReceita={isRunningReceita} canRunReceita={canRunReceita()} onRunReceita={handleRunReceita} onStopReceita={handleStopReceita}
                />

                {/* Output panels */}
                <section className="print-report animate-slide-up space-y-6 compact:space-y-3">
                  <OutputPanel
                    label="Análise Clínica Integrada"
                    color="emerald"
                    dataBoxTitle="Tese Fisiológica"
                    value={outputs.analise}
                    onChange={v => setOutputs(p => ({...p, analise: v}))}
                    onBlur={() => handleOutputBlur("analise")}
                    onFullscreen={() => setFullscreenPanel('analise')}
                    minHeight={compact ? "min-h-[350px]" : "min-h-[600px]"}
                    isRunning={isRunningAnalise}
                    canRestore={!!previousOutputs.analise && previousOutputs.analise !== outputs.analise}
                    onRestore={() => handleRestoreOutput("analise")}
                  />
                  <OutputPanel
                    label="Conduta & Planejamento"
                    color="indigo"
                    dataBoxTitle="Plano Terapêutico"
                    value={outputs.conduta}
                    onChange={v => setOutputs(p => ({...p, conduta: v}))}
                    onBlur={() => handleOutputBlur("conduta")}
                    onFullscreen={() => setFullscreenPanel('conduta')}
                    minHeight={compact ? "min-h-[180px]" : "min-h-[300px]"}
                    isRunning={isRunningConduta}
                    canRestore={!!previousOutputs.conduta && previousOutputs.conduta !== outputs.conduta}
                    onRestore={() => handleRestoreOutput("conduta")}
                  />
                  <OutputPanel
                    label="Receita Médica"
                    color="rose"
                    dataBoxTitle="Prescrição para Farmácia"
                    value={outputs.receita}
                    onChange={v => setOutputs(p => ({...p, receita: v}))}
                    onBlur={() => handleOutputBlur("receita")}
                    onFullscreen={() => setFullscreenPanel('receita')}
                    minHeight={compact ? "min-h-[180px]" : "min-h-[300px]"}
                    isRunning={isRunningReceita}
                    canRestore={!!previousOutputs.receita && previousOutputs.receita !== outputs.receita}
                    onRestore={() => handleRestoreOutput("receita")}
                  />
                </section>
              </div>
            </main>
            </ErrorBoundary>

            {/* RIGHT: KAUAI ASSISTANT */}
            {!rightCollapsed && (
            <ErrorBoundary fallbackLabel="KAUAI Assistant">
            <aside className="no-print h-full flex flex-col rounded-2xl compact:rounded-xl border border-indigo-100/60 dark:border-indigo-900/60 bg-indigo-50/60 dark:bg-indigo-950/40 backdrop-blur-xl shadow-xl shadow-indigo-200/30 dark:shadow-indigo-900/20 overflow-hidden transition-colors duration-300">
              <div className="flex-shrink-0 max-h-[45%] overflow-y-auto border-b border-slate-100 dark:border-slate-700 bg-white/40 dark:bg-slate-800/40 shadow-sm z-10 p-5 compact:p-3">
                <EnginePanel engineStatus={engineStatus} settings={settings} />
              </div>
              <CopilotChat
                messages={chatMessages}
                input={chatInput}
                onInputChange={setChatInput}
                onSend={handleSendMessage}
                isLoading={isChatLoading}
                onOpenFullscreen={() => setFullscreenPanel('copilot')}
              />
            </aside>
            </ErrorBoundary>
            )}

            {/* MODALS & OVERLAYS */}
            <LabTrendsModal
              isOpen={showLabTrends}
              onClose={() => setShowLabTrends(false)}
              consultas={currentPatientId ? (consultasMap[currentPatientId] || []) : []}
              currentLabText={inputs.laboratoriais}
              patientName={patientProfile.name}
            />
            <ConsultaCompareModal
              isOpen={showCompare}
              onClose={() => setShowCompare(false)}
              consultas={currentPatientId ? (consultasMap[currentPatientId] || []) : []}
              currentInputs={inputs}
              currentOutputs={outputs}
              patientName={patientProfile.name}
            />
            <SettingsDrawer
              isOpen={showSettings}
              onClose={() => setShowSettings(false)}
              settings={settings}
              onSettingsChange={setSettings}
              onOpenCorrections={() => { setShowCorrectionsPanel(true); refreshCorrectionsList(); }}
              correctionStats={getCorrectionStats()}
              auditStats={getAuditStats()}
              onExportAuditLog={() => {
                const logJson = exportAuditLog();
                const blob = new Blob([logJson], { type: "application/json" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = `audit-log-${new Date().toISOString().split("T")[0]}.json`;
                a.click();
                URL.revokeObjectURL(url);
                setToast({ message: "Log de auditoria exportado", type: "success" });
              }}
            />


            <FullscreenEditor
              panel={fullscreenPanel}
              onClose={() => setFullscreenPanel(null)}
              outputs={outputs}
              onOutputChange={(field, value) => setOutputs(p => ({ ...p, [field]: value }))}
              onSaveAsExample={handleSaveAsExample}
              chatMessages={chatMessages}
              chatInput={chatInput}
              onChatInputChange={setChatInput}
              onSendMessage={handleSendMessage}
              isChatLoading={isChatLoading}
            />

            <CorrectionsPanel
              isOpen={showCorrectionsPanel}
              onClose={() => setShowCorrectionsPanel(false)}
              corrections={correctionsList}
              onApprove={(id) => { approveCorrection(id); refreshCorrectionsList(); }}
              onUnapprove={(id) => { unapproveCorrection(id); refreshCorrectionsList(); }}
              onDelete={(id) => { deleteCorrection(id); refreshCorrectionsList(); }}
            />

            <ConfirmDialog
              open={!!confirmDialog}
              title={confirmDialog?.title ?? ""}
              message={confirmDialog?.message}
              confirmLabel={confirmDialog?.confirmLabel}
              danger={confirmDialog?.danger}
              onConfirm={() => confirmDialog?.onConfirm()}
              onCancel={() => setConfirmDialog(null)}
            />

          </div>
        </div>
      </div>

      <MedicalReportPrint profile={patientProfile} outputs={outputs} patientVersion={patientPdfContent} prescriptionVersion={prescriptionContent} />
    </>
  );
}
