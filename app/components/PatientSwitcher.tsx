"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import type { PatientRecord, Consulta } from "../types/clinical";

type PatientSwitcherProps = {
  isOpen: boolean;
  onToggle: () => void;
  currentPatientId: string | null;
  patients: Record<string, PatientRecord>;
  sortedPatients: PatientRecord[];
  editingPatientId: string | null;
  editingPatientName: string;
  onEditingNameChange: (name: string) => void;
  onCreateNew: () => void;
  onSwitch: (id: string) => void;
  onStartRename: (id: string) => void;
  onSaveRename: () => void;
  onCancelRename: () => void;
  onDelete: (id: string) => void;
  compact?: boolean;
  consultas: Record<string, Consulta[]>;
  onLoadConsulta?: (consulta: Consulta) => void;
  onSetPatientFolder?: (patientId: string, folder: string | undefined) => void;
  trashedPatients?: PatientRecord[];
  onRestorePatient?: (id: string) => void;
  onPermanentDelete?: (id: string) => void;
};

const DEFAULT_FOLDERS = ["Ativos", "Retorno", "Arquivo"];

export function PatientSwitcher({
  isOpen,
  onToggle,
  currentPatientId,
  patients,
  sortedPatients,
  editingPatientId,
  editingPatientName,
  onEditingNameChange,
  onCreateNew,
  onSwitch,
  onStartRename,
  onSaveRename,
  onCancelRename,
  onDelete,
  compact = false,
  consultas,
  onLoadConsulta,
  onSetPatientFolder,
  trashedPatients = [],
  onRestorePatient,
  onPermanentDelete,
}: PatientSwitcherProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    if (!isOpen) return;
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        onToggle();
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen, onToggle]);

  const [search, setSearch] = useState("");
  const [expandedPatientId, setExpandedPatientId] = useState<string | null>(null);
  const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>({ Ativos: true });
  const [viewMode, setViewMode] = useState<"folders" | "alpha">("folders");
  const [folderMenuPatientId, setFolderMenuPatientId] = useState<string | null>(null);
  const [newFolderName, setNewFolderName] = useState("");
  const [showNewFolderInput, setShowNewFolderInput] = useState(false);
  const [editingFolder, setEditingFolder] = useState<string | null>(null);
  const [editingFolderName, setEditingFolderName] = useState("");
  const [folderMenuOpen, setFolderMenuOpen] = useState<string | null>(null);
  const [showTrash, setShowTrash] = useState(false);

  // Get all unique folders from patients + defaults
  const allFolders = useMemo(() => {
    const custom = new Set<string>();
    for (const p of sortedPatients) {
      if (p.folder) custom.add(p.folder);
    }
    const merged = new Set([...DEFAULT_FOLDERS, ...custom]);
    return Array.from(merged);
  }, [sortedPatients]);

  // Filter patients by search
  const filtered = useMemo(() => {
    if (!search.trim()) return sortedPatients;
    const q = search.toLowerCase();
    return sortedPatients.filter(
      (p) =>
        (p.name || "").toLowerCase().includes(q) ||
        (p.profile?.cpf || "").includes(q) ||
        (p.folder || "").toLowerCase().includes(q)
    );
  }, [sortedPatients, search]);

  // Group by folder
  const byFolder = useMemo(() => {
    const groups: Record<string, PatientRecord[]> = {};
    // Init all known folders
    for (const f of allFolders) groups[f] = [];
    groups["Sem pasta"] = [];

    for (const p of filtered) {
      const folder = p.folder || "Sem pasta";
      if (!groups[folder]) groups[folder] = [];
      groups[folder].push(p);
    }
    return groups;
  }, [filtered, allFolders]);

  // Group by first letter
  const byLetter = useMemo(() => {
    const groups: Record<string, PatientRecord[]> = {};
    for (const p of filtered) {
      const letter = (p.name || "S")[0].toUpperCase();
      if (!groups[letter]) groups[letter] = [];
      groups[letter].push(p);
    }
    return Object.fromEntries(
      Object.entries(groups).sort(([a], [b]) => a.localeCompare(b))
    );
  }, [filtered]);

  const toggleFolder = (folder: string) => {
    setExpandedFolders((prev) => ({ ...prev, [folder]: !prev[folder] }));
  };

  const handleCreateFolder = () => {
    const name = newFolderName.trim();
    if (!name) return;
    setExpandedFolders((prev) => ({ ...prev, [name]: true }));
    setNewFolderName("");
    setShowNewFolderInput(false);
  };

  const handleStartRenameFolder = (folder: string) => {
    setEditingFolder(folder);
    setEditingFolderName(folder);
    setFolderMenuOpen(null);
  };

  const handleSaveRenameFolder = () => {
    if (!editingFolder) return;
    const newName = editingFolderName.trim();
    if (!newName || newName === editingFolder) {
      setEditingFolder(null);
      return;
    }
    // Move all patients from old folder to new folder
    for (const p of sortedPatients) {
      if (p.folder === editingFolder) {
        onSetPatientFolder?.(p.id, newName);
      }
    }
    // Update expanded state
    setExpandedFolders((prev) => {
      const next = { ...prev };
      next[newName] = next[editingFolder] ?? false;
      delete next[editingFolder];
      return next;
    });
    setEditingFolder(null);
  };

  const handleDeleteFolder = (folder: string) => {
    // Move all patients in this folder to "Sem pasta"
    for (const p of sortedPatients) {
      if (p.folder === folder) {
        onSetPatientFolder?.(p.id, undefined);
      }
    }
    setExpandedFolders((prev) => {
      const next = { ...prev };
      delete next[folder];
      return next;
    });
    setFolderMenuOpen(null);
  };

  return (
    <div ref={containerRef} className={`relative z-50 ${compact ? "mb-3" : "mb-5"}`}>
      {/* Toggle button */}
      <button
        onClick={onToggle}
        className={`w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl border transition-all ${
          isOpen
            ? "bg-blue-50 dark:bg-blue-900/30 border-blue-200 dark:border-blue-800"
            : "bg-white/60 dark:bg-slate-700/60 border-slate-200 dark:border-slate-600 hover:bg-white dark:hover:bg-slate-700"
        }`}
      >
        <div className="flex items-center gap-2 min-w-0">
          <div
            className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
              isOpen ? "bg-blue-100 dark:bg-blue-800" : "bg-slate-100 dark:bg-slate-600"
            }`}
          >
            <svg
              className={`w-4 h-4 ${isOpen ? "text-blue-600 dark:text-blue-300" : "text-slate-500 dark:text-slate-400"}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          </div>
          <div className="text-left min-w-0">
            <div className={`text-sm font-semibold truncate ${isOpen ? "text-blue-700 dark:text-blue-300" : "text-slate-700 dark:text-slate-200"}`}>
              {(currentPatientId && patients[currentPatientId]?.name) || "Paciente"}
            </div>
            <div className="text-[10px] text-slate-400 dark:text-slate-500">
              {sortedPatients.length} paciente{sortedPatients.length !== 1 ? "s" : ""}
            </div>
          </div>
        </div>
        <svg
          className={`w-4 h-4 flex-shrink-0 transition-transform ${isOpen ? "rotate-180 text-blue-600 dark:text-blue-300" : "text-slate-400"}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Dropdown panel */}
      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-xl z-50 overflow-hidden">
          {/* Header: search + actions */}
          <div className="p-3 border-b border-slate-100 dark:border-slate-700 space-y-2">
            {/* Search bar */}
            <div className="relative">
              <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                placeholder="Buscar paciente..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-slate-700 dark:text-slate-200 outline-none focus:ring-1 focus:ring-blue-400 placeholder:text-slate-400"
                autoFocus
              />
            </div>
            {/* Actions row */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setViewMode("folders")}
                  className={`text-[10px] font-bold px-2 py-1 rounded-md transition-colors ${
                    viewMode === "folders"
                      ? "bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300"
                      : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                  }`}
                >
                  PASTAS
                </button>
                <button
                  onClick={() => setViewMode("alpha")}
                  className={`text-[10px] font-bold px-2 py-1 rounded-md transition-colors ${
                    viewMode === "alpha"
                      ? "bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300"
                      : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                  }`}
                >
                  A-Z
                </button>
              </div>
              <button
                onClick={onCreateNew}
                className="w-7 h-7 flex items-center justify-center rounded-md text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors"
                title="Novo paciente"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
              </button>
            </div>
          </div>

          {/* Patient list */}
          <div className="max-h-96 overflow-y-auto">
            {filtered.length === 0 && (
              <div className="px-4 py-6 text-center text-xs text-slate-400 dark:text-slate-500">
                Nenhum paciente encontrado
              </div>
            )}

            {/* Folder view */}
            {viewMode === "folders" && filtered.length > 0 && (
              <>
                {Object.entries(byFolder).map(([folder, folderPatients]) => {
                  if (folderPatients.length === 0 && folder === "Sem pasta") return null;
                  const isExpanded = expandedFolders[folder] ?? false;
                  const isEmpty = folderPatients.length === 0;

                  const isDefaultFolder = folder === "Sem pasta";
                  const isRenamingThis = editingFolder === folder;

                  return (
                    <div key={folder}>
                      <div className="relative group/folder flex items-center border-b border-slate-50 dark:border-slate-700/30 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                        <button
                          onClick={() => toggleFolder(folder)}
                          className="flex-1 flex items-center gap-2 px-3 py-2 text-left"
                        >
                          <svg
                            className={`w-3 h-3 text-slate-400 transition-transform flex-shrink-0 ${isExpanded ? "rotate-90" : ""}`}
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                          <svg className="w-3.5 h-3.5 text-amber-500 dark:text-amber-400 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M10 4H4a2 2 0 00-2 2v12a2 2 0 002 2h16a2 2 0 002-2V8a2 2 0 00-2-2h-8l-2-2z" />
                          </svg>
                          {isRenamingThis ? (
                            <form
                              onSubmit={(e) => { e.preventDefault(); handleSaveRenameFolder(); }}
                              onClick={(e) => e.stopPropagation()}
                              className="flex-1"
                            >
                              <input
                                type="text"
                                value={editingFolderName}
                                onChange={(e) => setEditingFolderName(e.target.value)}
                                onBlur={handleSaveRenameFolder}
                                onKeyDown={(e) => e.key === "Escape" && setEditingFolder(null)}
                                autoFocus
                                className="w-full text-[11px] font-semibold px-1.5 py-0.5 rounded border border-blue-300 dark:border-blue-600 bg-white dark:bg-slate-700 outline-none focus:ring-1 focus:ring-blue-400 dark:text-white"
                              />
                            </form>
                          ) : (
                            <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-300 flex-1">
                              {folder}
                            </span>
                          )}
                          <span className={`text-[10px] font-medium ${isEmpty ? "text-slate-300 dark:text-slate-600" : "text-slate-400 dark:text-slate-500"}`}>
                            {folderPatients.length}
                          </span>
                        </button>
                        {/* Folder actions */}
                        {!isDefaultFolder && !isRenamingThis && (
                          <div className="relative pr-2">
                            <button
                              onClick={(e) => { e.stopPropagation(); setFolderMenuOpen(folderMenuOpen === folder ? null : folder); }}
                              className="opacity-0 group-hover/folder:opacity-100 p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-all"
                              title="Opcoes da pasta"
                            >
                              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                              </svg>
                            </button>
                            {folderMenuOpen === folder && (
                              <div className="absolute right-0 top-full mt-1 w-32 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 shadow-lg z-50 py-1">
                                <button
                                  onClick={(e) => { e.stopPropagation(); handleStartRenameFolder(folder); }}
                                  className="w-full text-left px-3 py-1.5 text-xs text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors flex items-center gap-2"
                                >
                                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                  </svg>
                                  Renomear
                                </button>
                                <button
                                  onClick={(e) => { e.stopPropagation(); handleDeleteFolder(folder); }}
                                  className="w-full text-left px-3 py-1.5 text-xs text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors flex items-center gap-2"
                                >
                                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                  </svg>
                                  Excluir pasta
                                </button>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                      {isExpanded &&
                        folderPatients.map((patient) => (
                          <PatientRow
                            key={patient.id}
                            patient={patient}
                            isCurrent={patient.id === currentPatientId}
                            isEditing={editingPatientId === patient.id}
                            editingName={editingPatientName}
                            onEditingNameChange={onEditingNameChange}
                            onSwitch={onSwitch}
                            onSaveRename={onSaveRename}
                            onCancelRename={onCancelRename}
                            onStartRename={onStartRename}
                            onDelete={onDelete}
                            canDelete={sortedPatients.length > 1}
                            consultas={consultas[patient.id] || []}
                            isConsultaExpanded={expandedPatientId === patient.id}
                            onToggleConsultas={() => setExpandedPatientId(expandedPatientId === patient.id ? null : patient.id)}
                            onLoadConsulta={onLoadConsulta}
                            folderMenuOpen={folderMenuPatientId === patient.id}
                            onToggleFolderMenu={() => setFolderMenuPatientId(folderMenuPatientId === patient.id ? null : patient.id)}
                            allFolders={allFolders}
                            onSetFolder={(folder) => {
                              onSetPatientFolder?.(patient.id, folder);
                              setFolderMenuPatientId(null);
                            }}
                            indented
                          />
                        ))}
                    </div>
                  );
                })}
                {/* New folder button */}
                <div className="px-3 py-2 border-t border-slate-100 dark:border-slate-700">
                  {showNewFolderInput ? (
                    <form
                      onSubmit={(e) => { e.preventDefault(); handleCreateFolder(); }}
                      className="flex gap-1"
                    >
                      <input
                        type="text"
                        placeholder="Nome da pasta..."
                        value={newFolderName}
                        onChange={(e) => setNewFolderName(e.target.value)}
                        onKeyDown={(e) => e.key === "Escape" && setShowNewFolderInput(false)}
                        autoFocus
                        className="flex-1 text-xs px-2 py-1 rounded border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 outline-none focus:ring-1 focus:ring-blue-400 dark:text-white"
                      />
                      <button type="submit" className="text-[10px] font-bold text-blue-600 dark:text-blue-400 px-2">OK</button>
                      <button type="button" onClick={() => setShowNewFolderInput(false)} className="text-[10px] text-slate-400 px-1">✕</button>
                    </form>
                  ) : (
                    <button
                      onClick={() => setShowNewFolderInput(true)}
                      className="text-[10px] font-medium text-slate-400 hover:text-blue-500 dark:hover:text-blue-400 flex items-center gap-1 transition-colors"
                    >
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                      Nova pasta
                    </button>
                  )}
                </div>
              </>
            )}

            {/* Alphabetical view */}
            {viewMode === "alpha" && filtered.length > 0 && (
              <>
                {Object.entries(byLetter).map(([letter, letterPatients]) => (
                  <div key={letter}>
                    <div className="px-3 py-1.5 bg-slate-50/80 dark:bg-slate-900/40 border-b border-slate-100 dark:border-slate-700/30 sticky top-0">
                      <span className="text-[11px] font-bold text-slate-400 dark:text-slate-500">{letter}</span>
                    </div>
                    {letterPatients.map((patient) => (
                      <PatientRow
                        key={patient.id}
                        patient={patient}
                        isCurrent={patient.id === currentPatientId}
                        isEditing={editingPatientId === patient.id}
                        editingName={editingPatientName}
                        onEditingNameChange={onEditingNameChange}
                        onSwitch={onSwitch}
                        onSaveRename={onSaveRename}
                        onCancelRename={onCancelRename}
                        onStartRename={onStartRename}
                        onDelete={onDelete}
                        canDelete={sortedPatients.length > 1}
                        consultas={consultas[patient.id] || []}
                        isConsultaExpanded={expandedPatientId === patient.id}
                        onToggleConsultas={() => setExpandedPatientId(expandedPatientId === patient.id ? null : patient.id)}
                        onLoadConsulta={onLoadConsulta}
                        folderMenuOpen={folderMenuPatientId === patient.id}
                        onToggleFolderMenu={() => setFolderMenuPatientId(folderMenuPatientId === patient.id ? null : patient.id)}
                        allFolders={allFolders}
                        onSetFolder={(folder) => {
                          onSetPatientFolder?.(patient.id, folder);
                          setFolderMenuPatientId(null);
                        }}
                      />
                    ))}
                  </div>
                ))}
              </>
            )}

          </div>

          {/* Lixeira (Trash) section */}
          {trashedPatients.length > 0 && (
            <div className="border-t border-slate-200 dark:border-slate-700">
              <button
                onClick={() => setShowTrash(!showTrash)}
                className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
              >
                <svg
                  className={`w-3 h-3 text-slate-400 transition-transform flex-shrink-0 ${showTrash ? "rotate-90" : ""}`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
                <svg className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 flex-1">
                  Lixeira
                </span>
                <span className="text-[10px] font-medium text-slate-400 dark:text-slate-500">
                  {trashedPatients.length}
                </span>
              </button>
              {showTrash && (
                <div className="max-h-48 overflow-y-auto">
                  {trashedPatients.map((patient) => {
                    const deletedDate = patient.deletedAt ? new Date(patient.deletedAt) : null;
                    const daysAgo = deletedDate
                      ? Math.floor((Date.now() - deletedDate.getTime()) / (1000 * 60 * 60 * 24))
                      : 0;
                    const daysLeft = 30 - daysAgo;

                    return (
                      <div
                        key={patient.id}
                        className="flex items-center justify-between pl-9 pr-3 py-2 group hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
                      >
                        <div className="flex-1 min-w-0 opacity-60">
                          <div className="text-sm font-medium text-slate-500 dark:text-slate-400 truncate">
                            {patient.name || "Sem nome"}
                          </div>
                          <div className="text-[10px] text-slate-400 dark:text-slate-500">
                            {deletedDate?.toLocaleDateString("pt-BR")}
                            {daysLeft > 0 && ` • ${daysLeft}d restantes`}
                            {daysLeft <= 0 && " • expira em breve"}
                          </div>
                        </div>
                        <div className="flex items-center gap-0.5 ml-2">
                          <button
                            onClick={() => onRestorePatient?.(patient.id)}
                            className="opacity-0 group-hover:opacity-100 p-1 text-emerald-500 hover:text-emerald-600 dark:text-emerald-400 dark:hover:text-emerald-300 transition-all"
                            title="Restaurar"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                            </svg>
                          </button>
                          <button
                            onClick={() => {
                              if (confirm(`Excluir ${patient.name || "este paciente"} permanentemente?`)) {
                                onPermanentDelete?.(patient.id);
                              }
                            }}
                            className="opacity-0 group-hover:opacity-100 p-1 text-red-400 hover:text-red-500 dark:text-red-500 dark:hover:text-red-400 transition-all"
                            title="Excluir permanentemente"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// --- Patient Row Component ---

type PatientRowProps = {
  patient: PatientRecord;
  isCurrent: boolean;
  isEditing: boolean;
  editingName: string;
  onEditingNameChange: (name: string) => void;
  onSwitch: (id: string) => void;
  onSaveRename: () => void;
  onCancelRename: () => void;
  onStartRename: (id: string) => void;
  onDelete: (id: string) => void;
  canDelete: boolean;
  consultas: Consulta[];
  isConsultaExpanded: boolean;
  onToggleConsultas: () => void;
  onLoadConsulta?: (consulta: Consulta) => void;
  folderMenuOpen: boolean;
  onToggleFolderMenu: () => void;
  allFolders: string[];
  onSetFolder: (folder: string | undefined) => void;
  indented?: boolean;
};

function PatientRow({
  patient,
  isCurrent,
  isEditing,
  editingName,
  onEditingNameChange,
  onSwitch,
  onSaveRename,
  onCancelRename,
  onStartRename,
  onDelete,
  canDelete,
  consultas: patientConsultas,
  isConsultaExpanded,
  onToggleConsultas,
  onLoadConsulta,
  folderMenuOpen,
  onToggleFolderMenu,
  allFolders,
  onSetFolder,
  indented,
}: PatientRowProps) {
  return (
    <>
      <div
        className={`flex items-center justify-between py-2 cursor-pointer transition-colors group ${
          indented ? "pl-9 pr-3" : "px-3"
        } ${
          isCurrent
            ? "bg-blue-50 dark:bg-blue-900/30"
            : "hover:bg-slate-50 dark:hover:bg-slate-700/50"
        }`}
        onClick={() => !isEditing && onSwitch(patient.id)}
      >
        <div className="flex-1 min-w-0">
          {isEditing ? (
            <form onSubmit={(e) => { e.preventDefault(); onSaveRename(); }} className="flex gap-1">
              <input
                type="text"
                value={editingName}
                onChange={(e) => onEditingNameChange(e.target.value)}
                onBlur={onSaveRename}
                onKeyDown={(e) => e.key === "Escape" && onCancelRename()}
                autoFocus
                className="flex-1 text-sm px-2 py-0.5 rounded border border-blue-300 dark:border-blue-600 bg-white dark:bg-slate-700 outline-none focus:ring-1 focus:ring-blue-400 dark:text-white"
                onClick={(e) => e.stopPropagation()}
              />
            </form>
          ) : (
            <>
              <div className={`text-sm font-medium truncate ${isCurrent ? "text-blue-700 dark:text-blue-300" : "text-slate-700 dark:text-slate-300"}`}>
                {patient.name || "Sem nome"}
              </div>
              <div className="text-[10px] text-slate-400 dark:text-slate-500">
                {new Date(patient.updatedAt).toLocaleDateString("pt-BR")}
                {patient.profile?.age && ` • ${patient.profile.age} anos`}
                {patientConsultas.length > 0 && (
                  <span className="ml-1 text-emerald-500 dark:text-emerald-400">
                    • {patientConsultas.length} consulta{patientConsultas.length !== 1 ? "s" : ""}
                  </span>
                )}
              </div>
            </>
          )}
        </div>
        {!isEditing && (
          <div className="flex items-center gap-0.5 ml-2 relative">
            {isCurrent && <span className="text-blue-600 dark:text-blue-400 text-xs">●</span>}
            <button
              onClick={(e) => { e.stopPropagation(); onToggleConsultas(); }}
              className={`p-1 transition-all ${
                isConsultaExpanded
                  ? "text-emerald-500 dark:text-emerald-400"
                  : patientConsultas.length > 0
                    ? "text-emerald-400 dark:text-emerald-500 hover:text-emerald-600 dark:hover:text-emerald-300"
                    : "text-slate-300 dark:text-slate-600"
              }`}
              title={patientConsultas.length > 0 ? `${patientConsultas.length} consulta${patientConsultas.length !== 1 ? "s" : ""}` : "Sem consultas"}
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </button>
            {/* Folder assign button */}
            <button
              onClick={(e) => { e.stopPropagation(); onToggleFolderMenu(); }}
              className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-amber-500 dark:hover:text-amber-400 transition-all"
              title="Mover para pasta"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
              </svg>
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onStartRename(patient.id); }}
              className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-blue-500 dark:hover:text-blue-400 transition-all"
              title="Renomear"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
              </svg>
            </button>
            {canDelete && (
              <button
                onClick={(e) => { e.stopPropagation(); onDelete(patient.id); }}
                className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-red-500 dark:hover:text-red-400 transition-all"
                title="Excluir"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            )}
            {/* Folder assignment dropdown */}
            {folderMenuOpen && (
              <div
                className="absolute right-0 top-full mt-1 w-36 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 shadow-lg z-50 py-1"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="px-2 py-1 text-[9px] uppercase text-slate-400 font-bold tracking-wider">Mover para</div>
                {allFolders.map((f) => (
                  <button
                    key={f}
                    onClick={() => onSetFolder(f)}
                    className={`w-full text-left px-3 py-1.5 text-xs hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors ${
                      patient.folder === f ? "text-blue-600 dark:text-blue-400 font-medium" : "text-slate-600 dark:text-slate-300"
                    }`}
                  >
                    {f} {patient.folder === f && "●"}
                  </button>
                ))}
                <div className="border-t border-slate-100 dark:border-slate-700 mt-1 pt-1">
                  <button
                    onClick={() => onSetFolder(undefined)}
                    className="w-full text-left px-3 py-1.5 text-xs text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                  >
                    Remover da pasta
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Consulta history */}
      {isConsultaExpanded && (
        <div className={`bg-slate-50/80 dark:bg-slate-900/40 border-t border-slate-100 dark:border-slate-700/50 ${indented ? "pl-9" : ""}`}>
          <div className="px-3 py-1.5">
            <span className="text-[9px] uppercase text-slate-400 dark:text-slate-500 font-bold tracking-wider">
              Historico de Consultas
            </span>
          </div>
          {patientConsultas.length === 0 && (
            <div className="px-4 py-3 text-[10px] text-slate-400 dark:text-slate-500 italic">
              Nenhuma consulta salva ainda.
            </div>
          )}
          {patientConsultas.map((consulta) => {
            const date = new Date(consulta.timestamp);
            const hasOutputs = !!(consulta.outputs.analise || consulta.outputs.conduta || consulta.outputs.receita);
            return (
              <button
                key={consulta.id}
                onClick={(e) => { e.stopPropagation(); onLoadConsulta?.(consulta); }}
                className="w-full text-left px-4 py-2 hover:bg-white dark:hover:bg-slate-800 transition-colors border-t border-slate-100/60 dark:border-slate-700/30"
              >
                <div className="flex items-center justify-between">
                  <div className="text-xs font-medium text-slate-600 dark:text-slate-300">
                    {date.toLocaleDateString("pt-BR")} {date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                  </div>
                  {hasOutputs && (
                    <div className="flex gap-1">
                      {consulta.outputs.analise && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" title="Analise" />}
                      {consulta.outputs.conduta && <span className="w-1.5 h-1.5 rounded-full bg-indigo-400" title="Conduta" />}
                      {consulta.outputs.receita && <span className="w-1.5 h-1.5 rounded-full bg-rose-400" title="Receita" />}
                    </div>
                  )}
                </div>
                {consulta.notes && (
                  <div className="text-[10px] text-slate-400 dark:text-slate-500 truncate mt-0.5">{consulta.notes}</div>
                )}
                {!consulta.notes && consulta.engineStatus && (
                  <div className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">
                    Fase {consulta.engineStatus.phase} • {consulta.engineStatus.priority}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      )}
    </>
  );
}
