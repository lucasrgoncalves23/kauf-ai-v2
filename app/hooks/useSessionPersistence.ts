"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import type {
  ClinicalData,
  ClinicalOutputs,
  ChatMessage,
  EngineStatus,
  Settings,
  PatientRecord,
  PatientProfile,
} from "../types/clinical";
import { DEFAULT_SETTINGS } from "../types/clinical";
import { generatePatientId, createBlankPatient } from "../utils/patient";
import { fetchAllPatients, savePatient, getPinHeaders } from "../lib/api-client";
import { logger } from "../lib/logger";

type SessionState = {
  inputs: ClinicalData;
  outputs: ClinicalOutputs;
  patientProfile: PatientProfile;
  chatMessages: ChatMessage[];
  engineStatus: EngineStatus;
  patients: Record<string, PatientRecord>;
  currentPatientId: string | null;
  settings: Settings;
  isHydrated: boolean;
};

type SessionActions = {
  setInputs: React.Dispatch<React.SetStateAction<ClinicalData>>;
  setOutputs: React.Dispatch<React.SetStateAction<ClinicalOutputs>>;
  setPatientProfile: React.Dispatch<React.SetStateAction<PatientProfile>>;
  setChatMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
  setEngineStatus: React.Dispatch<React.SetStateAction<EngineStatus>>;
  setPatients: React.Dispatch<React.SetStateAction<Record<string, PatientRecord>>>;
  setCurrentPatientId: React.Dispatch<React.SetStateAction<string | null>>;
  setSettings: React.Dispatch<React.SetStateAction<Settings>>;
};

/** Per-patient cache of the open chart ("kai-session"); read back by the offline fallback. */
function writeSessionCache(patient: PatientRecord): void {
  try {
    localStorage.setItem(
      "kai-session",
      JSON.stringify({
        patientId: patient.id,
        inputs: patient.inputs,
        outputs: patient.outputs,
        patientProfile: patient.profile,
        chatMessages: patient.chatMessages,
        engineStatus: patient.engineStatus,
      })
    );
  } catch (e) {
    logger.error("Failed to save to localStorage", { error: String(e) });
  }
}

/**
 * Hook that handles data persistence for the session.
 * - Tries to load from database first, falls back to localStorage
 * - Saves to both database and localStorage (localStorage as offline cache)
 * - Manages dark mode class on document
 */
export type SaveStatus = "saved" | "saving" | "offline";

export function useSessionPersistence(
  state: Omit<SessionState, "isHydrated">,
  actions: SessionActions
): { isHydrated: boolean; usingDatabase: boolean; saveStatus: SaveStatus } {
  const [isHydrated, setIsHydrated] = useState(false);
  const [usingDatabase, setUsingDatabase] = useState(false);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("saved");
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pendingSaveRef = useRef<PatientRecord | null>(null);

  const {
    inputs,
    outputs,
    patientProfile,
    chatMessages,
    engineStatus,
    patients,
    currentPatientId,
    settings,
  } = state;

  const {
    setInputs,
    setOutputs,
    setPatientProfile,
    setChatMessages,
    setEngineStatus,
    setPatients,
    setCurrentPatientId,
    setSettings,
  } = actions;

  // --- Load on mount ---
  useEffect(() => {
    async function loadData() {
      try {
        // Load settings first (always from localStorage)
        const savedSettings = localStorage.getItem("kai-settings");
        if (savedSettings) {
          setSettings({ ...DEFAULT_SETTINGS, ...JSON.parse(savedSettings) });
        }

        // Try to load patients from database, fall back to localStorage
        const { patients: loadedPatients, fromDatabase } = await fetchAllPatients();
        setUsingDatabase(fromDatabase);

        if (Object.keys(loadedPatients).length > 0) {
          setPatients(loadedPatients);
          // Open on a blank draft; it is only added to the list once the doctor types something
          setCurrentPatientId(createBlankPatient().id);
        } else {
          // No patients found - check for old format migration
          const oldSession = localStorage.getItem("kai-session");
          if (oldSession) {
            const data = JSON.parse(oldSession);

            // Create a patient from old data
            const migratedPatient: PatientRecord = {
              id: generatePatientId(),
              name: data.patientProfile?.name || "Paciente Migrado",
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              inputs: data.inputs || { anamnese: "", bioimpedancia: "", laboratoriais: "", genetica: "", wearable: "" },
              outputs: data.outputs || { analise: "", conduta: "", receita: "" },
              profile: { name: "", age: "", sex: "", cpf: "", birthDate: "", ...data.patientProfile },
              chatMessages: data.chatMessages || [],
              engineStatus: data.engineStatus || null,
            };

            // Set up state
            const newPatients = { [migratedPatient.id]: migratedPatient };
            setPatients(newPatients);
            setCurrentPatientId(migratedPatient.id);

            // Load into current state
            setInputs(migratedPatient.inputs);
            setOutputs(migratedPatient.outputs);
            setPatientProfile(migratedPatient.profile);
            setChatMessages(migratedPatient.chatMessages);
            setEngineStatus(migratedPatient.engineStatus);

            // Save to localStorage (will also try database in save effect)
            localStorage.setItem("kai-patients", JSON.stringify(newPatients));
          } else {
            // No existing data - create first patient
            const firstPatient = createBlankPatient("Novo Paciente");
            setPatients({ [firstPatient.id]: firstPatient });
            setCurrentPatientId(firstPatient.id);
          }
        }
      } catch (e) {
        logger.error("Failed to load session", { error: String(e) });
      }
      setIsHydrated(true);
    }

    loadData();
  }, []);

  // --- Debounced save function ---
  const debouncedSave = useCallback(
    async (updatedPatient: PatientRecord) => {
      // Cache the open patient locally first (small write; the full "kai-patients"
      // mirror is only rewritten on structural changes — re-serialising every patient
      // on each keystroke is what made the tab heavy)
      writeSessionCache(updatedPatient);

      // Try to save to database (non-blocking)
      try {
        const { savedToDatabase } = await savePatient(updatedPatient);
        setSaveStatus(savedToDatabase ? "saved" : "offline");
        if (savedToDatabase && !usingDatabase) {
          setUsingDatabase(true);
        }
      } catch (e) {
        setSaveStatus("offline");
        logger.warn("Failed to save to database", { error: String(e) });
      }
    },
    [usingDatabase]
  );

  // --- Save current patient on change (debounced) ---
  useEffect(() => {
    if (!isHydrated || !currentPatientId) return;

    const isUnsavedBlankDraft =
      !patients[currentPatientId] &&
      Object.values(inputs).every((v) => !v?.trim()) &&
      Object.values(outputs).every((v) => !v?.trim()) &&
      Object.values(patientProfile).every((v) => !v?.toString().trim()) &&
      chatMessages.length === 0;
    if (isUnsavedBlankDraft) return;

    // Clear previous timeout
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    // Build updated patient
    const updatedPatient: PatientRecord = {
      ...patients[currentPatientId],
      id: currentPatientId,
      name: patientProfile.name || patients[currentPatientId]?.name || "Paciente",
      updatedAt: new Date().toISOString(),
      inputs,
      outputs,
      profile: patientProfile,
      chatMessages,
      engineStatus,
    };

    // Update local state immediately
    setPatients((prev) => ({ ...prev, [currentPatientId]: updatedPatient }));

    // Debounce the actual save (500ms); track pending so tab-close can flush it
    setSaveStatus("saving");
    pendingSaveRef.current = updatedPatient;
    saveTimeoutRef.current = setTimeout(() => {
      pendingSaveRef.current = null;
      debouncedSave(updatedPatient);
    }, 500);

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [isHydrated, currentPatientId, inputs, outputs, patientProfile, chatMessages, engineStatus]);

  // --- Flush pending save when the tab closes or is hidden ---
  useEffect(() => {
    const flushPendingSave = () => {
      const pending = pendingSaveRef.current;
      if (!pending) return;
      pendingSaveRef.current = null;
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);

      // localStorage write is synchronous — survives unload
      writeSessionCache(pending);

      // keepalive lets the request outlive the page (best-effort)
      try {
        fetch(`/api/patients/${pending.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json", ...getPinHeaders() },
          body: JSON.stringify(pending),
          keepalive: true,
        }).catch(() => {});
      } catch {
        /* ignore */
      }
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") flushPendingSave();
    };

    window.addEventListener("beforeunload", flushPendingSave);
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      window.removeEventListener("beforeunload", flushPendingSave);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, []);

  // --- Save settings separately (localStorage only) ---
  useEffect(() => {
    if (!isHydrated) return;
    try {
      localStorage.setItem("kai-settings", JSON.stringify(settings));
    } catch (e) {
      logger.error("Failed to save settings", { error: String(e) });
    }
  }, [isHydrated, settings]);

  // --- Dark mode: Toggle class on document ---
  useEffect(() => {
    if (settings.ui.darkMode) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [settings.ui.darkMode]);

  return { isHydrated, usingDatabase, saveStatus };
}
