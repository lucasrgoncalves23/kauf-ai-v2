"use client";

import { useRef, useState, useEffect } from "react";

// --- TYPES ---
type ClinicalData = {
  anamnese: string;
  bioimpedancia: string;
  genetica: string;
  wearable: string;
};

// NEW: Output is strictly these two sections
type ClinicalOutputs = {
  analise: string;
  conduta: string;
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
    <div className="text-[11px] tracking-[0.14em] uppercase text-slate-400 font-bold mb-3 tracking-widest">
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
  minHeight = "min-h-[100px]", // Support for taller boxes
}: {
  title: string;
  value: string;
  onChange: (v: string) => void;
  onImport?: (file: File) => void;
  isOutput?: boolean;
  isLoading?: boolean;
  placeholder?: string;
  minHeight?: string;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && onImport) onImport(file);
    if (e.target) e.target.value = "";
  };

  return (
    <div className={`flex flex-col gap-2 rounded-xl p-5 transition-all duration-300 group
      ${isOutput 
        ? "bg-slate-50/50 border border-slate-200/60" 
        : "bg-white border border-slate-100 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] hover:shadow-[0_8px_20px_-8px_rgba(0,0,0,0.1)] hover:border-slate-200"
      }
    `}>
      <div className="flex items-center justify-between">
        <span className={`text-[10px] font-bold uppercase tracking-wider ${isOutput ? "text-emerald-600" : "text-slate-400 group-hover:text-slate-600 transition-colors"}`}>
          {title}
        </span>
        {!isOutput && onImport && (
          <div className="no-print">
            {/* UPDATED: Accepts PDF, JPG, PNG */}
            <input type="file" accept="application/pdf, image/jpeg, image/png" className="hidden" ref={fileInputRef} onChange={handleFileChange} />
            <button onClick={() => fileInputRef.current?.click()} disabled={isLoading} className="flex items-center gap-1.5 text-[10px] font-medium text-slate-400 hover:text-blue-600 transition-colors px-2 py-1 rounded hover:bg-slate-50">
              {isLoading ? <Spinner /> : "📎 Import File"}
            </button>
          </div>
        )}
      </div>
      <textarea
        className={`w-full resize-none bg-transparent text-[13px] leading-relaxed outline-none placeholder:text-slate-200 ${isOutput ? "text-slate-700 font-medium" : "text-slate-600"} ${minHeight}`}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder || "Paste or type here..."}
      />
    </div>
  );
}

// --- MAIN PAGE ---

export default function Home() {
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" | "info" } | null>(null);
  
  // DATA STATES
  const [inputs, setInputs] = useState<ClinicalData>({ anamnese: "", bioimpedancia: "", genetica: "", wearable: "" });
  
  // OUTPUT STATE: Just 2 fields now
  const [outputs, setOutputs] = useState<ClinicalOutputs>({ analise: "", conduta: "" });
  
  const [patientProfile, setPatientProfile] = useState({ name: "", age: "", sex: "" });
  const [engineStatus, setEngineStatus] = useState<EngineStatus>(null);
  const [loadingImport, setLoadingImport] = useState<keyof ClinicalData | null>(null);
  const [isRunningEngine, setIsRunningEngine] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [isChatLoading, setIsChatLoading] = useState(false);
  const chatScrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [chatMessages]);

  useEffect(() => {
    const text = inputs.anamnese;
    if (!text) return;
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

  // UPDATED: handleImport now handles PDF and Images
  async function handleImport(file: File, target: keyof ClinicalData) {
    setLoadingImport(target);
    try {
      // Validate file type
      const validTypes = ["application/pdf", "image/jpeg", "image/png"];
      if (!validTypes.includes(file.type)) {
        setToast({ message: "Formato inválido. Use PDF, JPG ou PNG.", type: "error" });
        return;
      }

      const formData = new FormData();
      formData.append("file", file);
      
      // Conditional loading text
      const statusText = file.type === "application/pdf" ? "Lendo PDF..." : "Lendo Imagem (IA)...";
      setInputs((prev) => ({ ...prev, [target]: statusText }));

      const res = await fetch("/api/import-pdf", { method: "POST", body: formData });
      const data = await res.json();
      
      if (!res.ok) throw new Error(data.error || "Falha no servidor");
      
      setInputs((prev) => ({ ...prev, [target]: data.text }));
      setToast({ message: `Arquivo importado com sucesso!`, type: "success" });
    } catch (err: any) {
      console.error("Import Error:", err);
      setInputs((prev) => ({ ...prev, [target]: "" })); 
      setToast({ message: "Erro na importação: " + err.message, type: "error" });
    } finally {
      setLoadingImport(null);
    }
  }

  async function handleRunEngine() {
    setIsRunningEngine(true);
    setEngineStatus(null); 
    try {
      const response = await fetch("/api/rewrite-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ patient: inputs, decision: { phase: "Pending Analysis" } }),
      });
      const data = await response.json();
      if (!data.ok || !data.filled) throw new Error(data.error || "Falha na análise do KAI.");
      
      const result = data.filled;
      setOutputs({
        analise: result.analise || "Sem análise gerada.",
        conduta: result.conduta || "Sem conduta gerada.",
      });

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
      if (data.error) throw new Error(data.error); 

      let rawText = data.content && data.content[0] ? data.content[0].text : "Erro: Resposta vazia do KAI.";
      
      const commandRegex = /:::COMMAND:::([\s\S]*?):::END:::/;
      const match = rawText.match(commandRegex);
      if (match) {
        const jsonStr = match[1];
        try {
          const command = JSON.parse(jsonStr);
          if (command.action === "update_output" && command.field && command.text) {
             const key = command.field as keyof ClinicalOutputs;
             if (["analise", "conduta"].includes(key)) {
                setOutputs(prev => ({ ...prev, [key]: command.text }));
                setToast({ message: `KAI atualizou: ${key}`, type: "success" });
             }
          }
        } catch (e) { console.error("Failed to execute KAI command", e); }
        rawText = rawText.replace(commandRegex, "").trim();
      }
      setChatMessages(prev => [...prev, { role: "assistant", content: rawText }]);
    } catch (err: any) {
      setChatMessages(prev => [...prev, { role: "assistant", content: `❌ Erro: ${err.message || "Falha de conexão"}` }]);
    } finally {
      setIsChatLoading(false);
    }
  }

  return (
    <>
      <div className="min-h-screen text-slate-800 font-sans print:hidden overflow-hidden relative">
        {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

        {/* --- MAIN CONTENT --- */}
        <div className="relative z-10 mx-auto max-w-[1600px] p-6 h-screen flex flex-col">
          <div className="grid grid-cols-[280px_1fr_360px] gap-8 h-full">
            
            {/* LEFT: SNAPSHOT */}
            <aside className="no-print h-full overflow-hidden flex flex-col">
              <div className="rounded-2xl bg-white/60 backdrop-blur-xl border border-white/40 shadow-sm p-6 flex-1 flex flex-col">
                <SectionLabel>Patient Snapshot</SectionLabel>
                <div className="space-y-4 text-sm">
                   <div className="group">
                     <label className="block text-[10px] uppercase text-slate-400 mb-1.5 font-bold">Nome</label>
                     <input className="w-full bg-white/50 rounded-lg border border-slate-200 px-3 py-2.5 font-medium outline-none focus:ring-2 focus:ring-blue-100 transition-all" placeholder="Ex: João Silva" value={patientProfile.name} onChange={(e) => setPatientProfile(p => ({...p, name: e.target.value}))} />
                   </div>
                   <div className="grid grid-cols-2 gap-3">
                     <div>
                        <label className="block text-[10px] uppercase text-slate-400 mb-1.5 font-bold">Idade</label>
                        <input className="w-full bg-white/50 rounded-lg border border-slate-200 px-3 py-2.5 font-medium outline-none focus:ring-2 focus:ring-blue-100 transition-all" placeholder="--" value={patientProfile.age} onChange={(e) => setPatientProfile(p => ({...p, age: e.target.value}))} />
                     </div>
                     <div>
                        <label className="block text-[10px] uppercase text-slate-400 mb-1.5 font-bold">Sexo</label>
                        <input className="w-full bg-white/50 rounded-lg border border-slate-200 px-3 py-2.5 font-medium outline-none capitalize focus:ring-2 focus:ring-blue-100 transition-all" placeholder="--" value={patientProfile.sex} onChange={(e) => setPatientProfile(p => ({...p, sex: e.target.value}))} />
                     </div>
                   </div>
                </div>
                
                <div className="mt-auto pt-8 border-t border-slate-100">
                   <SectionLabel>Data Sources</SectionLabel>
                   <div className="space-y-2">
                     {Object.entries(inputs).map(([k, v]) => (
                       <div key={k} className="flex items-center justify-between text-xs py-1.5 px-2 rounded hover:bg-slate-50 transition-colors">
                         <span className="capitalize text-slate-500 font-medium">{k}</span>
                         <div className={`flex items-center gap-2 ${v ? "text-emerald-600" : "text-slate-300"}`}>
                            <span className="text-[10px] font-bold">{v ? "Ready" : "Empty"}</span>
                            <div className={`w-2 h-2 rounded-full ${v ? "bg-emerald-500" : "bg-slate-200"}`}></div>
                         </div>
                       </div>
                     ))}
                   </div>
                </div>
              </div>
            </aside>

            {/* CENTER: ENGINE */}
            <main className="flex flex-col h-full overflow-hidden no-scrollbar">
              <div className="flex items-center justify-between rounded-2xl bg-white border border-slate-100 px-8 py-5 shadow-sm mb-6 print:hidden">
                <div>
                  <h1 className="text-xl font-bold text-slate-900 tracking-tight">KAI, by Oskar Kaufmann</h1>
                  <p className="text-[11px] text-slate-400 font-medium tracking-wide mt-0.5">VERSION 2.0 • DR. OSKAR KAUFMANN</p>
                </div>
                <button onClick={() => window.print()} className="bg-slate-900 text-white px-5 py-2.5 rounded-lg text-xs font-bold hover:bg-slate-800 transition-all shadow-lg shadow-slate-200">
                  EXPORTAR PDF
                </button>
              </div>

              <div className="flex-1 overflow-y-auto pr-2 space-y-8 pb-10">
                <section className="no-print">
                   <div className="flex items-center gap-3 mb-4">
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
                      <span className="text-xs font-bold uppercase text-slate-400 tracking-widest">Inputs Clínicos</span>
                   </div>
                   <div className="grid grid-cols-2 gap-4">
                     {Object.keys(inputs).map((key) => (
                       <DataBox key={key} title={key} value={inputs[key as keyof ClinicalData]} onChange={(v) => setInputs(p => ({...p, [key]: v}))} onImport={(f) => handleImport(f, key as keyof ClinicalData)} isLoading={loadingImport === key} />
                     ))}
                   </div>
                </section>

                <div className="no-print flex justify-center py-4">
                  <button onClick={handleRunEngine} disabled={isRunningEngine} className={`flex items-center gap-3 px-10 py-4 rounded-full font-bold text-sm shadow-xl hover:shadow-2xl hover:-translate-y-0.5 transition-all ${isRunningEngine ? "bg-slate-100 text-slate-400 cursor-not-allowed" : "bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-blue-200"}`}>
                    {isRunningEngine ? <Spinner /> : <span>⚡ Run with KAI</span>}
                  </button>
                </div>

                {/* --- NEW OUTPUT LAYOUT (2 Massive Windows) --- */}
                <section className="print-report animate-slide-up space-y-6">
                   
                   {/* 1. ANÁLISE INTEGRADA */}
                   <div>
                       <div className="flex items-center gap-3 mb-4">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                          <span className="text-xs font-bold uppercase text-emerald-600 tracking-widest">Análise Clínica Integrada</span>
                       </div>
                       <DataBox 
                          title="Tese Fisiológica (2-3 Pages)" 
                          value={outputs.analise} 
                          onChange={v => setOutputs(p => ({...p, analise: v}))} 
                          isOutput 
                          minHeight="min-h-[600px]" // HUGE BOX
                       />
                   </div>

                   {/* 2. CONDUTA */}
                   <div>
                       <div className="flex items-center gap-3 mb-4">
                          <span className="w-1.5 h-1.5 rounded-full bg-indigo-500"></span>
                          <span className="text-xs font-bold uppercase text-indigo-600 tracking-widest">Conduta & Planejamento</span>
                       </div>
                       <DataBox 
                          title="Plano Terapêutico" 
                          value={outputs.conduta} 
                          onChange={v => setOutputs(p => ({...p, conduta: v}))} 
                          isOutput 
                          minHeight="min-h-[300px]"
                       />
                   </div>

                </section>
              </div>
            </main>

            {/* RIGHT: KAI ASSISTANT */}
            <aside className="no-print h-full flex flex-col rounded-2xl border border-white/60 bg-white/40 backdrop-blur-xl shadow-xl shadow-slate-200/50 overflow-hidden">
               <div className="p-5 border-b-2 border-slate-100 bg-white/40 shadow-sm z-10">
                  <SectionLabel>Engine Status</SectionLabel>
                  {engineStatus ? (
                    <div className="mt-3 space-y-3">
                      <div className="flex items-center justify-between p-3 bg-white/60 rounded-lg border border-white/50">
                        <span className="text-xs text-slate-500 font-medium">Current Phase</span>
                        <span className={`text-sm font-bold px-2 py-0.5 rounded ${engineStatus.phase === "A" ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"}`}>
                          {engineStatus.phase}
                        </span>
                      </div>
                      {engineStatus.alerts.length > 0 && <div className="p-3 bg-amber-50/80 border border-amber-100/50 rounded-lg text-[11px] text-amber-800 leading-relaxed">⚠️ {engineStatus.alerts.join(", ")}</div>}
                      {engineStatus.blocked.length > 0 && <div className="p-3 bg-red-50/80 border border-red-100/50 rounded-lg text-[11px] text-red-800 leading-relaxed">🚫 <strong>Blocked:</strong> {engineStatus.blocked.join(", ")}</div>}
                    </div>
                  ) : ( <div className="text-[11px] text-slate-400 italic py-2 text-center">Waiting for analysis...</div> )}
               </div>
               
               <div className="flex-1 flex flex-col min-h-0 bg-transparent relative">
                  <div className="flex-1 overflow-y-auto p-5 space-y-4" ref={chatScrollRef}>
                     {chatMessages.length === 0 && (
                       <div className="h-full flex flex-col items-center justify-center text-center p-6 opacity-40">
                         <div className="text-4xl mb-4">💬</div>
                         <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Copiloto KAI</p>
                         <p className="text-[10px] text-slate-400">"Por que o paciente ta na Fase A?"</p>
                       </div>
                     )}
                     {chatMessages.map((msg, i) => (
                       <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                          <div className={`max-w-[90%] rounded-2xl p-3.5 text-xs leading-relaxed shadow-sm ${msg.role === "user" ? "bg-slate-800 text-white rounded-tr-none" : "bg-white text-slate-700 border border-slate-100 rounded-tl-none"}`}>
                             {msg.content}
                          </div>
                       </div>
                     ))}
                     {isChatLoading && <div className="text-[10px] text-slate-400 animate-pulse ml-2 font-medium">Thinking...</div>}
                  </div>

                  <div className="p-4 border-t border-white/50 bg-white/60">
                     <div className="flex items-center gap-2 bg-white rounded-xl border border-slate-200 p-1.5 shadow-sm focus-within:ring-2 focus-within:ring-blue-100 transition-all">
                        <input 
                           className="flex-1 bg-transparent px-3 py-2 text-xs outline-none placeholder:text-slate-400"
                           placeholder="Ask KAI anything..."
                           value={chatInput}
                           onChange={(e) => setChatInput(e.target.value)}
                           onKeyDown={(e) => e.key === "Enter" && handleSendMessage()}
                        />
                        <button 
                           onClick={handleSendMessage} 
                           disabled={isChatLoading} 
                           className="p-2 bg-slate-100 rounded-lg text-slate-500 hover:bg-blue-600 hover:text-white transition-all disabled:opacity-50 flex-shrink-0"
                        >
                          ➤
                        </button>
                     </div>
                  </div>
               </div>
            </aside>

          </div>
        </div>
      </div>

      <MedicalReportPrint profile={patientProfile} outputs={outputs} />
    </>
  );
}

// --- UPDATED PRINT LAYOUT ---
function MedicalReportPrint({ profile, outputs }: { profile: any, outputs: any }) {
  const [dateStr, setDateStr] = useState("");
  const [reportId, setReportId] = useState("");
  useEffect(() => {
    setDateStr(new Date().toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' }));
    setReportId(Math.random().toString(36).slice(2, 8).toUpperCase());
  }, []);
  
  return (
    <div className="hidden print:block bg-white text-black p-10 max-w-[210mm] mx-auto min-h-screen">
      
      {/* HEADER */}
      <div className="flex justify-between items-end border-b-2 border-slate-900 pb-4 mb-10">
        <div>
          <h1 className="text-3xl font-serif font-bold text-slate-900 tracking-tight">Relatório Clínico Integrado</h1>
          <p className="text-sm text-slate-600 mt-1 uppercase tracking-widest font-medium">Kauf Clinical Intelligence</p>
        </div>
        <div className="text-right">
          <p className="text-sm font-bold text-slate-900">{dateStr}</p>
          <p className="text-xs text-slate-500">ID: {reportId}</p>
        </div>
      </div>

      {/* PATIENT INFO */}
      <div className="bg-slate-50 border border-slate-200 rounded-lg p-6 mb-12 grid grid-cols-2 gap-8 break-inside-avoid">
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

      {/* SECTION 1: ANÁLISE */}
      <div className="mb-12">
        <h2 className="text-lg font-bold text-emerald-800 uppercase tracking-widest border-b border-emerald-100 pb-2 mb-6 break-after-avoid">
          1. Análise Clínica & Metabólica
        </h2>
        <div className="text-sm leading-relaxed text-justify text-slate-800 whitespace-pre-wrap font-serif">
          {outputs.analise || "Análise pendente..."}
        </div>
      </div>

      {/* SECTION 2: CONDUTA */}
      <div>
        <h2 className="text-lg font-bold text-indigo-800 uppercase tracking-widest border-b border-indigo-100 pb-2 mb-6 break-after-avoid">
          2. Conduta Terapêutica & Planejamento
        </h2>
        <div className="text-sm leading-relaxed text-justify text-slate-800 whitespace-pre-wrap font-serif">
          {outputs.conduta || "Conduta pendente..."}
        </div>
      </div>

      <div className="mt-20 pt-8 border-t border-slate-200 text-center break-inside-avoid">
        <p className="text-[10px] text-slate-400 italic">
          Relatório gerado por inteligência artificial (KAI v2.0). Documento para uso exclusivo médico.
        </p>
      </div>
    </div>
  );
}