/**
 * WhatsApp Message Template Registry
 *
 * Maps clinical events to approved WhatsApp Business template names
 * and builds the parameter components for each. Template names must
 * match exactly what's approved in Meta Business Manager.
 *
 * Language: pt_BR for all templates.
 */

import type { WaTemplateComponent } from "./whatsapp";
import type { PatientRecord, Consulta } from "../types/clinical";

export interface TemplateSpec {
  name: string;
  description: string;
  buildComponents: (ctx: TemplateContext) => WaTemplateComponent[];
}

export interface TemplateContext {
  patient: PatientRecord;
  consulta?: Consulta;
  appointmentDate?: string;
  appointmentTime?: string;
  documentUrl?: string;
  documentType?: string;
  customMessage?: string;
}

function patientFirstName(patient: PatientRecord): string {
  return (patient.profile.name || patient.name).split(/\s/)[0];
}

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return text.slice(0, max - 3) + "...";
}

export const TEMPLATES: Record<string, TemplateSpec> = {
  consulta_resumo: {
    name: "consulta_resumo",
    description:
      "Sent after a consulta is finalized — delivers a summary of the treatment plan.",
    buildComponents: (ctx) => {
      const firstName = patientFirstName(ctx.patient);
      const conduta = ctx.consulta?.outputs?.conduta ?? "";
      const summary = truncate(
        conduta.split("\n").filter((l) => l.trim()).slice(0, 5).join("\n"),
        900
      );
      return [
        {
          type: "body",
          parameters: [
            { type: "text", text: firstName },
            { type: "text", text: summary || "Seu plano de tratamento está pronto." },
          ],
        },
      ];
    },
  },

  lembrete_consulta: {
    name: "lembrete_consulta",
    description:
      "Appointment reminder sent 24h before a scheduled visit.",
    buildComponents: (ctx) => {
      const firstName = patientFirstName(ctx.patient);
      return [
        {
          type: "body",
          parameters: [
            { type: "text", text: firstName },
            { type: "text", text: ctx.appointmentDate ?? "" },
            { type: "text", text: ctx.appointmentTime ?? "" },
          ],
        },
        {
          type: "button",
          sub_type: "quick_reply" as const,
          index: 0,
          parameters: [{ type: "payload" as const, payload: "CONFIRM_APPOINTMENT" }],
        },
        {
          type: "button",
          sub_type: "quick_reply" as const,
          index: 1,
          parameters: [{ type: "payload" as const, payload: "RESCHEDULE_APPOINTMENT" }],
        },
      ];
    },
  },

  retorno_fase: {
    name: "retorno_fase",
    description:
      "Follow-up nudge when a phase milestone or cronograma event is approaching.",
    buildComponents: (ctx) => {
      const firstName = patientFirstName(ctx.patient);
      return [
        {
          type: "body",
          parameters: [
            { type: "text", text: firstName },
            { type: "text", text: ctx.customMessage ?? "É hora de agendar seu retorno." },
          ],
        },
        {
          type: "button",
          sub_type: "quick_reply" as const,
          index: 0,
          parameters: [{ type: "payload" as const, payload: "SCHEDULE_RETURN" }],
        },
      ];
    },
  },

  formulario_anamnese: {
    name: "formulario_anamnese",
    description:
      "Intake form request sent to new patients before their first visit.",
    buildComponents: (ctx) => {
      const firstName = patientFirstName(ctx.patient);
      return [
        {
          type: "body",
          parameters: [
            { type: "text", text: firstName },
          ],
        },
      ];
    },
  },

  documento_disponivel: {
    name: "documento_disponivel",
    description:
      "Notification that a clinical document (PDF, receita) is ready for the patient.",
    buildComponents: (ctx) => {
      const firstName = patientFirstName(ctx.patient);
      const docLabel =
        ctx.documentType === "prescription"
          ? "receituário"
          : ctx.documentType === "patient_pdf"
          ? "plano de tratamento"
          : "documento clínico";
      return [
        {
          type: "body",
          parameters: [
            { type: "text", text: firstName },
            { type: "text", text: docLabel },
          ],
        },
      ];
    },
  },
};

export function getTemplate(name: string): TemplateSpec | undefined {
  return TEMPLATES[name];
}

export function listTemplates(): { name: string; description: string }[] {
  return Object.values(TEMPLATES).map((t) => ({
    name: t.name,
    description: t.description,
  }));
}
