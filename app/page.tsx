"use client";

import { useRef, useState, useEffect } from "react";

// --- TYPES ---
type ClinicalData = {
  anamnese: string;
  bioimpedancia: string;
  genetica: string;
  wearable: string;
};

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

type EngineStatus = {
  phase: "A" | "B" | "C";
  alerts: string[];
  blocked: string[];
} | null;

// --- COMPONENTS ---

function Toast({
  message,
  type,
  onClose,
}: {
  message: string;
  type: "success" | "error" | "info";
  onClose: () => void;
}) {
  useEffect(() => {
    const timer = setTimeout(onClose, 4000);
    return () => clearTimeout(timer);
  }, [onClose]);

  const bg = type === "success" ? "bg-emerald-100 text-emerald-800" : type === "error" ? "bg-red-100 text-red-800" : "bg-blue-100 text-blue-800";

  return (
    <div className={`fixed top-6 right-6 z-50 px-4 py-3 rounded shadow-lg ${bg} animate-slide-in font-medium text-sm flex items-center gap-3`}>
      <span>{message}</span>
      <button onClick={onClose} className="opacity-50 hover:opacity-100">✕</button>
    </div>
  );
}

function Spinner() {
  return (
    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
    </svg>
  );
}

function SectionLabel({ children }: { children: string }) {
  return (
    <div className="text-[11px] tracking-[0.14em] uppercase text-slate-500 font-medium mb-2">
      {children}
    </div>
  );
}

function DataBox({
  title,
  value,
  onChange,
  onImport,
  isOutput = false,
  isLoading = false,
  placeholder,
}: {
  title: string;
  value: string;
  onChange: (v: string) => void;
  onImport?: (file: File) => void;
  isOutput?: boolean;
  isLoading?: boolean;
  placeholder?: string;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && onImport) onImport(file);
    if (e.target) e.target.value = "";
  };

  return (
    <div className={`flex flex-col gap-2 rounded-lg border p-4 transition-all duration-200 ${isOutput ? "bg-slate-50/50 border-slate-200" : "bg-white border-slate-200 hover:border-slate-300 shadow-sm"}`}>
      <div className="flex items-center justify-between">
        <span className={`text-[10px] font-bold uppercase tracking-wider ${isOutput ? "text-emerald-600" : "text-slate-500"}`}>
          {title}
        </span>
        {!isOutput && onImport && (
          <div className="no-print">
            <input type="file" accept="application/pdf" className="hidden" ref={fileInputRef} onChange={handleFileChange} />
            <button onClick={() => fileInputRef.current?.click()} disabled={isLoading} className="flex items-center gap-1.5 text-[10px] font-medium text-slate-400 hover:text-slate-700 transition-colors px-2 py-1 rounded hover:bg-slate-100">
              {isLoading ? <Spinner /> : "📎"} Import
            </button>
          </div>
        )}
      </div>
      <textarea
        className={`w-full resize-none bg-transparent text-[12px] leading-relaxed outline-none placeholder:text-slate-300 ${isOutput ? "text-slate-800 min-h-[120px]" : "text-slate-600 min-h-[80px]"}`}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder || "..."}
      />
    </div>
  );
}

// --- MAIN PAGE ---

export default function Home() {
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" | "info" } | null>(null);
  
  // DATA STATES
  const [inputs, setInputs] = useState<ClinicalData>({ anamnese: "", bioimpedancia: "", genetica: "", wearable: "" });
  const [outputs, setOutputs] = useState<ClinicalData>({ anamnese: "", bioimpedancia: "", genetica: "", wearable: "" });
  const [patientProfile, setPatientProfile] = useState({ name: "", age: "", sex: "" });

  // ENGINE STATE
  const [engineStatus, setEngineStatus] = useState<EngineStatus>(null);

  // UI STATES
  const [loadingImport, setLoadingImport] = useState<keyof ClinicalData | null>(null);
  const [isRunningEngine, setIsRunningEngine] = useState(false);

  // CHAT STATES
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [isChatLoading, setIsChatLoading] = useState(false);
  const chatScrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll chat
  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [chatMessages]);

  // --- AUTO-PARSE PATIENT INFO ---
  useEffect(() => {
    const text = inputs.anamnese;
    if (!text) return;

    // Regex magic to find Name and Age automatically
    const nameMatch = text.match(/(?:PACIENTE|NOME)\s*:\s*([^,.\n]+)/i);
    const ageMatch = text.match(/(?:Idade\s*:\s*|)(\d+)\s*anos/i);
    const sexMatch = text.match(/(Masculino|Feminino|Homem|Mulher)/i);

    if (nameMatch || ageMatch || sexMatch) {
      setPatientProfile(prev => ({
        name: nameMatch ? nameMatch[1].trim() : prev.name,
        age: ageMatch ? ageMatch[1] : prev.age,
        sex: sexMatch ? sexMatch[1] : prev.sex,
      }));
    }
  }, [inputs.anamnese]);

  // --- HANDLERS ---

  async function handleImport(file: File, target: keyof ClinicalData) {
    setLoadingImport(target);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/import-pdf", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setInputs((prev) => ({ ...prev, [target]: data.text }));
      setToast({ message: "PDF Importado", type: "success" });
    } catch {
      setToast({ message: "Erro na importação", type: "error" });
    } finally {
      setLoadingImport(null);
    }
  }

  async function handleRunEngine() {
    setIsRunningEngine(true);
    setEngineStatus(null); 

    try {
      // --- STEP A: GENERATE THE REPORT ---
      const response = await fetch("/api/rewrite-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patient: inputs, 
          decision: { phase: "Pending Analysis" },
          report: {} 
        }),
      });

      const data = await response.json();

      if (!data.ok || !data.filled) {
        throw new Error(data.error || "Falha na análise do KAI.");
      }

      // --- STEP B: UPDATE UI ---
      const result = data.filled;

      setOutputs({
        anamnese: result.analise_anamnese || "Sem análise.",
        bioimpedancia: result.analise_bioimpedancia || "Sem análise.",
        genetica: result.analise_genetica || "Sem análise.",
        wearable: result.analise_wearable || "Sem análise.",
      });

      // --- STEP C: DETERMINE PHASE ---
      const aiText = JSON.stringify(result).toLowerCase();
      const isPhaseA = aiText.includes("recuperação") || aiText.includes("hrv") || aiText.includes("inflamação");

      setEngineStatus({
        phase: isPhaseA ? "A" : "B",
        alerts: isPhaseA ? ["Detectado pelo KAI"] : [],
        blocked: isPhaseA ? ["Hormonal", "Peptídeos"] : ["Peptídeos"],
      });

      setToast({ message: "Análise Real do KAI Concluída!", type: "success" });

    } catch (err: any) {
      console.error(err);
      setToast({ message: "Erro: " + err.message, type: "error" });
    } finally {
      setIsRunningEngine(false);
    }
  }

  async function handleSendMessage() {
    if (!chatInput.trim()) return;
    
    const newUserMsg: ChatMessage = { role: "user", content: chatInput };
    setChatMessages(prev => [...prev, newUserMsg]);
    setChatInput("");
    setIsChatLoading(true);

    try {
      const res = await fetch("/api/chat-assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [...chatMessages, newUserMsg],
          context: { inputs, outputs, engineStatus }
        })
      });
      
      const data = await res.json();
      
      if (data.error) {
        throw new Error(data.error); 
      }

      let rawText = data.content && data.content[0] ? data.content[0].text : "Erro: Resposta vazia do KAI.";
      
      // --- COMMAND PARSING LOGIC ---
      const commandRegex = /:::COMMAND:::([\s\S]*?):::END:::/;
      const match = rawText.match(commandRegex);

      if (match) {
        const jsonStr = match[1];
        try {
          const command = JSON.parse(jsonStr);
          if (command.action === "update_output" && command.field && command.text) {
            const key = command.field as keyof ClinicalData;
            if (["anamnese", "bioimpedancia", "genetica", "wearable"].includes(key)) {
               setOutputs(prev => ({ ...prev, [key]: command.text }));
               setToast({ message: `KAI atualizou: ${key}`, type: "success" });
            }
          }
        } catch (e) {
          console.error("Failed to execute KAI command", e);
        }
        rawText = rawText.replace(commandRegex, "").trim();
      }

      setChatMessages(prev => [...prev, { role: "assistant", content: rawText }]);
    } catch (err: any) {
      setChatMessages(prev => [...prev, { 
        role: "assistant", 
        content: `❌ Erro: ${err.message || "Falha de conexão"}` 
      }]);
    } finally {
      setIsChatLoading(false);
    }
  }

  return (
    <>
      {/* --- WEB VIEW (Hides when printing) --- */}
      <div className="min-h-screen bg-slate-50 text-slate-800 font-sans print:hidden">
        {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

        <div className="mx-auto max-w-[1600px] p-6">
          <div className="grid grid-cols-[280px_1fr_340px] gap-6">
            
            {/* LEFT: SNAPSHOT */}
            <aside className="no-print h-[calc(100vh-48px)] overflow-y-auto rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <SectionLabel>Patient Snapshot</SectionLabel>
              <div className="mt-4 space-y-3 text-sm">
                <div className="rounded bg-slate-50 p-3 border border-slate-100">
                   <label className="block text-[10px] uppercase text-slate-400 mb-1">Nome</label>
                   <input 
                     className="w-full bg-transparent font-medium outline-none" 
                     placeholder="Ex: João Silva" 
                     value={patientProfile.name}
                     onChange={(e) => setPatientProfile(p => ({...p, name: e.target.value}))}
                   />
                 </div>
                 <div className="flex gap-2">
                   <div className="flex-1 rounded bg-slate-50 p-3 border border-slate-100">
                      <label className="block text-[10px] uppercase text-slate-400 mb-1">Idade</label>
                      <input 
                        className="w-full bg-transparent font-medium outline-none" 
                        placeholder="--" 
                        value={patientProfile.age}
                        onChange={(e) => setPatientProfile(p => ({...p, age: e.target.value}))}
                      />
                   </div>
                   <div className="flex-1 rounded bg-slate-50 p-3 border border-slate-100">
                      <label className="block text-[10px] uppercase text-slate-400 mb-1">Sexo</label>
                      <input 
                      className="w-full bg-transparent font-medium outline-none capitalize" 
                      placeholder="--" 
                      value={patientProfile.sex} 
                      onChange={(e) => setPatientProfile(p => ({...p, sex: e.target.value}))} 
                    />
                   </div>
                 </div>
              </div>
              <div className="mt-8">
                 <SectionLabel>Status de Importação</SectionLabel>
                 {Object.entries(inputs).map(([k, v]) => (
                   <div key={k} className="flex justify-between text-xs py-1">
                     <span className="capitalize text-slate-500">{k}</span>
                     <span className={v ? "text-emerald-600 font-bold" : "text-slate-300"}>{v ? "●" : "○"}</span>
                   </div>
                 ))}
              </div>
            </aside>

            {/* CENTER: ENGINE */}
            <main className="flex flex-col gap-6 h-[calc(100vh-48px)] overflow-y-auto print:h-auto print:overflow-visible">
              <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-6 py-4 shadow-sm print:hidden">
                <div>
                  <h1 className="text-lg font-bold text-slate-800">KAI Engine</h1>
                  <p className="text-[11px] text-slate-400">Clinical Intelligence v2.0</p>
                </div>
                <button onClick={() => window.print()} className="bg-slate-800 text-white px-4 py-2 rounded-lg text-xs font-bold hover:bg-slate-700">
                  Export PDF
                </button>
              </div>

              <section className="no-print space-y-4">
                <div className="flex items-center gap-2 mb-2"><div className="h-px flex-1 bg-slate-200"/> <span className="text-[10px] font-bold uppercase text-slate-400">Inputs</span> <div className="h-px flex-1 bg-slate-200"/></div>
                <div className="grid grid-cols-2 gap-4">
                  {Object.keys(inputs).map((key) => (
                    <DataBox key={key} title={key} value={inputs[key as keyof ClinicalData]} onChange={(v) => setInputs(p => ({...p, [key]: v}))} onImport={(f) => handleImport(f, key as keyof ClinicalData)} isLoading={loadingImport === key} />
                  ))}
                </div>
              </section>

              <div className="no-print flex justify-center py-2">
                <button onClick={handleRunEngine} disabled={isRunningEngine} className="flex items-center gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-8 py-3 rounded-full font-bold shadow-lg hover:scale-105 transition-all disabled:opacity-50">
                  {isRunningEngine ? <Spinner /> : "⚡ Run with KAI"}
                </button>
              </div>

              <section className="print-report space-y-4 pb-10">
                <div className="flex items-center gap-2 mb-2 no-print"><div className="h-px flex-1 bg-slate-200"/> <span className="text-[10px] font-bold uppercase text-emerald-600">Analysis</span> <div className="h-px flex-1 bg-slate-200"/></div>
                <div className="grid grid-cols-1 gap-6">
                  <div className="grid grid-cols-2 gap-6">
                     <DataBox title="Análise: Exames & Anamnese" value={outputs.anamnese} onChange={v => setOutputs(p => ({...p, anamnese: v}))} isOutput />
                     <DataBox title="Análise: Composição Corporal" value={outputs.bioimpedancia} onChange={v => setOutputs(p => ({...p, bioimpedancia: v}))} isOutput />
                  </div>
                  <div className="grid grid-cols-2 gap-6">
                     <DataBox title="Análise: Genética" value={outputs.genetica} onChange={v => setOutputs(p => ({...p, genetica: v}))} isOutput />
                     <DataBox title="Análise: Wearable" value={outputs.wearable} onChange={v => setOutputs(p => ({...p, wearable: v}))} isOutput />
                  </div>
                </div>
              </section>
            </main>

            {/* RIGHT: KAI ASSISTANT */}
            <aside className="no-print h-[calc(100vh-48px)] flex flex-col rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
               
               {/* 1. STATUS PANEL */}
               <div className="p-4 border-b border-slate-100 bg-slate-50/50">
                  <SectionLabel>Engine Status</SectionLabel>
                  {engineStatus ? (
                    <div className="mt-2 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-slate-500">Phase</span>
                        <span className={`text-sm font-bold ${engineStatus.phase === "A" ? "text-amber-600" : "text-emerald-600"}`}>
                          {engineStatus.phase}
                        </span>
                      </div>
                      {engineStatus.alerts.length > 0 && (
                        <div className="p-2 bg-amber-50 border border-amber-100 rounded text-[10px] text-amber-700">
                          {engineStatus.alerts.join(", ")}
                        </div>
                      )}
                      {engineStatus.blocked.length > 0 && (
                        <div className="p-2 bg-red-50 border border-red-100 rounded text-[10px] text-red-700">
                          <strong>Blocked:</strong> {engineStatus.blocked.join(", ")}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-[11px] text-slate-400 italic py-2">
                      Aguardando análise...
                    </div>
                  )}
               </div>

               {/* 2. CHAT PANEL */}
               <div className="flex-1 flex flex-col min-h-0 bg-white">
                  <div className="p-3 border-b border-slate-50 flex items-center justify-between">
                     <h3 className="text-xs font-bold text-slate-700 flex items-center gap-2">
                       KAI Copilot
                     </h3>
                     <span className="text-[9px] px-1.5 py-0.5 bg-blue-50 text-blue-600 rounded-full font-medium">BETA</span>
                  </div>

                  <div className="flex-1 overflow-y-auto p-4 space-y-4" ref={chatScrollRef}>
                     {chatMessages.length === 0 && (
                       <div className="text-center text-xs text-slate-300 mt-4 space-y-1">
                         <p>"Por que Fase A?"</p>
                         <p>"Corrija a genética para..."</p>
                       </div>
                     )}
                     {chatMessages.map((msg, i) => (
                       <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                          <div className={`max-w-[90%] rounded-lg p-3 text-xs leading-relaxed ${msg.role === "user" ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-700"}`}>
                             {msg.content}
                          </div>
                       </div>
                     ))}
                     {isChatLoading && <div className="text-xs text-slate-400 animate-pulse ml-2">KAI está digitando...</div>}
                  </div>

                  <div className="p-3 border-t border-slate-100">
                     <div className="flex gap-2">
                        <input 
                          className="flex-1 bg-slate-50 rounded-md px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-blue-200 transition-all placeholder:text-slate-400"
                          placeholder="Comandos ou perguntas..."
                          value={chatInput}
                          onChange={(e) => setChatInput(e.target.value)}
                          onKeyDown={(e) => e.key === "Enter" && handleSendMessage()}
                        />
                        <button onClick={handleSendMessage} disabled={isChatLoading} className="bg-white border border-slate-200 text-slate-600 px-3 rounded-md hover:bg-slate-50 hover:text-blue-600 transition-colors disabled:opacity-50">
                          ➤
                        </button>
                     </div>
                  </div>
               </div>
            </aside>

          </div>
        </div>
      </div>

      {/* --- PRINT VIEW (Visible only when printing) --- */}
      <MedicalReportPrint profile={patientProfile} outputs={outputs} />
    </>
  );
}

// --- PRINT LAYOUT COMPONENT ---
function MedicalReportPrint({ profile, outputs }: { profile: any, outputs: any }) {
  const today = new Date().toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' });
  
  return (
    <div className="hidden print:block bg-white text-black p-8 max-w-[210mm] mx-auto min-h-screen">
      {/* Header */}
      <div className="flex justify-between items-end border-b-2 border-slate-900 pb-4 mb-8">
        <div>
          <h1 className="text-3xl font-serif font-bold text-slate-900 tracking-tight">Relatório Clínico Integrado</h1>
          <p className="text-sm text-slate-600 mt-1 uppercase tracking-widest font-medium">Kauf Clinical Intelligence</p>
        </div>
        <div className="text-right">
          <p className="text-sm font-bold text-slate-900">{today}</p>
          <p className="text-xs text-slate-500">ID: {Math.random().toString(36).slice(2, 8).toUpperCase()}</p>
        </div>
      </div>

      {/* Patient Info Card */}
      <div className="bg-slate-50 border border-slate-200 rounded-lg p-6 mb-10 grid grid-cols-2 gap-8">
        <div>
          <span className="block text-[10px] uppercase tracking-wider text-slate-400 mb-1">Paciente</span>
          <span className="block text-xl font-serif font-medium text-slate-900">{profile.name || "Paciente Não Identificado"}</span>
        </div>
        <div className="flex gap-12">
           <div>
            <span className="block text-[10px] uppercase tracking-wider text-slate-400 mb-1">Idade</span>
            <span className="block text-lg font-medium text-slate-800">{profile.age || "--"} anos</span>
           </div>
           <div>
            <span className="block text-[10px] uppercase tracking-wider text-slate-400 mb-1">Sexo</span>
            <span className="block text-lg font-medium text-slate-800 capitalize">{profile.sex || "--"}</span>
           </div>
        </div>
      </div>

      {/* Clinical Analysis Body */}
      <div className="space-y-8 font-serif">
        
        <section>
          <h2 className="text-sm font-bold text-emerald-700 uppercase tracking-widest border-b border-emerald-100 pb-2 mb-3">
            1. Análise Metabólica & Anamnese
          </h2>
          <p className="text-sm leading-relaxed text-justify text-slate-800 whitespace-pre-wrap">
            {outputs.anamnese || "Nenhuma análise gerada."}
          </p>
        </section>

        <section>
          <h2 className="text-sm font-bold text-emerald-700 uppercase tracking-widest border-b border-emerald-100 pb-2 mb-3">
            2. Composição Corporal
          </h2>
          <p className="text-sm leading-relaxed text-justify text-slate-800 whitespace-pre-wrap">
            {outputs.bioimpedancia || "Nenhuma análise gerada."}
          </p>
        </section>

        <section>
          <h2 className="text-sm font-bold text-emerald-700 uppercase tracking-widest border-b border-emerald-100 pb-2 mb-3">
            3. Genética & Polimorfismos
          </h2>
          <p className="text-sm leading-relaxed text-justify text-slate-800 whitespace-pre-wrap">
            {outputs.genetica || "Nenhuma análise gerada."}
          </p>
        </section>

        <section>
          <h2 className="text-sm font-bold text-emerald-700 uppercase tracking-widest border-b border-emerald-100 pb-2 mb-3">
            4. Modulação Autonômica (Wearables)
          </h2>
          <p className="text-sm leading-relaxed text-justify text-slate-800 whitespace-pre-wrap">
            {outputs.wearable || "Nenhuma análise gerada."}
          </p>
        </section>

      </div>

      {/* Professional Footer */}
      <div className="mt-16 pt-8 border-t border-slate-200 text-center">
        <p className="text-[10px] text-slate-400 italic">
          Relatório gerado por inteligência artificial (KAI v2.0). As sugestões terapêuticas devem ser validadas por julgamento clínico humano.
        </p>
      </div>
    </div>
  );
}