"use client";

import React, { useState, useCallback, useEffect } from "react";
import type {
  PatientRecord,
  ClinicalData,
  ClinicalOutputs,
  PatientProfile,
  ChatMessage,
  EngineStatus,
  ToastState,
} from "../types/clinical";
import { createBlankPatient } from "../utils/patient";
import { savePatient, deletePatientFromStorage } from "../lib/api-client";

type PatientManagementState = {
  patients: Record<string, PatientRecord>;
  currentPatientId: string | null;
};

type PatientManagementCallbacks = {
  setPatients: React.Dispatch<React.SetStateAction<Record<string, PatientRecord>>>;
  setCurrentPatientId: (id: string | null) => void;
  setInputs: (inputs: ClinicalData) => void;
  setOutputs: (outputs: ClinicalOutputs) => void;
  setPatientProfile: (profile: PatientProfile) => void;
  setChatMessages: (messages: ChatMessage[]) => void;
  setEngineStatus: (status: EngineStatus) => void;
  setToast: (toast: ToastState) => void;
};

const TRASH_RETENTION_DAYS = 30;

export function usePatientManagement(
  state: PatientManagementState,
  callbacks: PatientManagementCallbacks
) {
  const { patients, currentPatientId } = state;

  const {
    setPatients,
    setCurrentPatientId,
    setInputs,
    setOutputs,
    setPatientProfile,
    setChatMessages,
    setEngineStatus,
    setToast,
  } = callbacks;

  const [showSwitcher, setShowSwitcher] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [trashBanner, setTrashBanner] = useState<{ patientId: string; patientName: string } | null>(null);

  // Sync full patients record to localStorage
  const syncToLocalStorage = useCallback((updatedPatients: Record<string, PatientRecord>) => {
    try {
      localStorage.setItem("kai-patients", JSON.stringify(updatedPatients));
    } catch { /* ignore */ }
  }, []);

  // Auto-cleanup: remove patients in trash for more than 30 days
  useEffect(() => {
    const now = Date.now();
    const expiredIds: string[] = [];

    for (const [id, patient] of Object.entries(patients)) {
      if (patient.deletedAt) {
        const deletedTime = new Date(patient.deletedAt).getTime();
        const daysSinceDelete = (now - deletedTime) / (1000 * 60 * 60 * 24);
        if (daysSinceDelete >= TRASH_RETENTION_DAYS) {
          expiredIds.push(id);
        }
      }
    }

    if (expiredIds.length > 0) {
      setPatients(prev => {
        const next = { ...prev };
        for (const id of expiredIds) {
          delete next[id];
        }
        syncToLocalStorage(next);
        return next;
      });
      // Remove from DB
      for (const id of expiredIds) {
        deletePatientFromStorage(id);
      }
    }
  }, [patients, setPatients, syncToLocalStorage]);

  // Get active (non-trashed) patients
  const activePatients = Object.values(patients).filter(p => !p.deletedAt);
  const trashedPatients = Object.values(patients).filter(p => !!p.deletedAt);

  const handleCreateNewPatient = useCallback(() => {
    if (currentPatientId && patients[currentPatientId]) {
      setPatients(prev => ({ ...prev }));
    }

    const newPatient = createBlankPatient();

    setPatients(prev => ({ ...prev, [newPatient.id]: newPatient }));
    setCurrentPatientId(newPatient.id);

    setInputs({ anamnese: "", bioimpedancia: "", laboratoriais: "", genetica: "", wearable: "" });
    setOutputs({ analise: "", conduta: "", receita: "" });
    setPatientProfile({ name: "", age: "", sex: "", cpf: "", birthDate: "" });
    setChatMessages([]);
    setEngineStatus(null);

    setShowSwitcher(false);
    setToast({ message: "Novo paciente criado", type: "success" });
  }, [currentPatientId, patients, setPatients, setCurrentPatientId, setInputs, setOutputs, setPatientProfile, setChatMessages, setEngineStatus, setToast]);

  const handleSwitchPatient = useCallback((patientId: string) => {
    if (patientId === currentPatientId) {
      setShowSwitcher(false);
      return;
    }

    const patient = patients[patientId];
    if (!patient || patient.deletedAt) return;

    setCurrentPatientId(patientId);
    setInputs(patient.inputs || { anamnese: "", bioimpedancia: "", laboratoriais: "", genetica: "", wearable: "" });
    setOutputs(patient.outputs || { analise: "", conduta: "", receita: "" });
    setPatientProfile(patient.profile || { name: "", age: "", sex: "", cpf: "", birthDate: "" });
    setChatMessages(patient.chatMessages || []);
    setEngineStatus(patient.engineStatus || null);

    setShowSwitcher(false);
    setToast({ message: `Carregado: ${patient.name || "Paciente"}`, type: "info" });
  }, [patients, currentPatientId, setCurrentPatientId, setInputs, setOutputs, setPatientProfile, setChatMessages, setEngineStatus, setToast]);

  // Soft-delete: move to trash without confirmation
  const handleDeletePatient = useCallback((patientId: string) => {
    const active = Object.values(patients).filter(p => !p.deletedAt);
    if (active.length <= 1) {
      setToast({ message: "Nao e possivel excluir o unico paciente", type: "error" });
      return;
    }

    const patient = patients[patientId];
    if (!patient) return;

    // Soft-delete: set deletedAt, save previous folder for restore
    const trashedPatient = {
      ...patient,
      deletedAt: new Date().toISOString(),
      previousFolder: patient.folder,
    };

    setPatients(prev => {
      const next = { ...prev, [patientId]: trashedPatient };
      syncToLocalStorage(next);
      return next;
    });

    // Persist to DB
    savePatient(trashedPatient);

    // Show undo banner
    setTrashBanner({ patientId, patientName: patient.name || "Paciente" });

    // Auto-dismiss banner after 8 seconds
    setTimeout(() => {
      setTrashBanner(prev => (prev?.patientId === patientId ? null : prev));
    }, 8000);

    // If we deleted the current patient, switch to another active one
    if (patientId === currentPatientId) {
      const remaining = active.filter(p => p.id !== patientId);
      const next = remaining[0];
      if (next) {
        setCurrentPatientId(next.id);
        setInputs(next.inputs);
        setOutputs(next.outputs);
        setPatientProfile(next.profile);
        setChatMessages(next.chatMessages || []);
        setEngineStatus(next.engineStatus);
      }
    }
  }, [patients, currentPatientId, setPatients, setCurrentPatientId, setInputs, setOutputs, setPatientProfile, setChatMessages, setEngineStatus, setToast, syncToLocalStorage]);

  // Undo: restore from trash
  const handleUndoTrash = useCallback((patientId: string) => {
    const patient = patients[patientId];
    if (!patient) return;

    const restoredPatient = {
      ...patient,
      deletedAt: undefined,
      folder: patient.previousFolder,
      previousFolder: undefined,
    };

    setPatients(prev => {
      const next = { ...prev, [patientId]: restoredPatient };
      syncToLocalStorage(next);
      return next;
    });

    // Persist to DB
    savePatient(restoredPatient);

    setTrashBanner(null);
    setToast({ message: `${patient.name || "Paciente"} restaurado`, type: "success" });
  }, [patients, setPatients, setToast, syncToLocalStorage]);

  // Restore from trash (used from Lixeira UI)
  const handleRestorePatient = useCallback((patientId: string) => {
    const patient = patients[patientId];
    if (!patient) return;

    const restoredPatient = {
      ...patient,
      deletedAt: undefined,
      folder: patient.previousFolder,
      previousFolder: undefined,
    };

    setPatients(prev => {
      const next = { ...prev, [patientId]: restoredPatient };
      syncToLocalStorage(next);
      return next;
    });

    // Persist to DB
    savePatient(restoredPatient);

    setToast({ message: `${patient.name || "Paciente"} restaurado`, type: "success" });
  }, [patients, setPatients, setToast, syncToLocalStorage]);

  // Permanent delete
  const handlePermanentDelete = useCallback((patientId: string) => {
    setPatients(prev => {
      const { [patientId]: _, ...rest } = prev;
      syncToLocalStorage(rest);
      return rest;
    });

    // Remove from DB
    deletePatientFromStorage(patientId);

    setToast({ message: "Paciente excluido permanentemente", type: "info" });
  }, [setPatients, setToast, syncToLocalStorage]);

  const handleStartRename = useCallback((patientId: string) => {
    const patient = patients[patientId];
    if (!patient) return;
    setEditId(patientId);
    setEditName(patient.name || "");
  }, [patients]);

  const handleSaveRename = useCallback(() => {
    if (!editId) return;

    const newName = editName.trim() || "Paciente";
    const updatedPatient = {
      ...patients[editId],
      name: newName,
      updatedAt: new Date().toISOString(),
    };

    const updatedPatients = { ...patients, [editId]: updatedPatient };
    setPatients(updatedPatients);

    setEditId(null);
    setEditName("");
  }, [editId, editName, patients, setPatients]);

  const handleCancelRename = useCallback(() => {
    setEditId(null);
    setEditName("");
  }, []);

  // Sort only active patients for display
  const sortedPatients = activePatients.sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );

  // Sort trashed patients by deletedAt (newest first)
  const sortedTrashedPatients = trashedPatients.sort(
    (a, b) => new Date(b.deletedAt!).getTime() - new Date(a.deletedAt!).getTime()
  );

  return {
    // State
    showPatientSwitcher: showSwitcher,
    setShowPatientSwitcher: setShowSwitcher,
    editingPatientId: editId,
    editingPatientName: editName,
    setEditingPatientName: setEditName,
    sortedPatients,
    sortedTrashedPatients,
    trashBanner,

    // Actions
    handleCreateNewPatient,
    handleSwitchPatient,
    handleDeletePatient,
    handleUndoTrash,
    handleRestorePatient,
    handlePermanentDelete,
    handleStartRename,
    handleSaveRename,
    handleCancelRename,
  };
}
