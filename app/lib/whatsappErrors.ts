/**
 * Plain-Portuguese, doctor-actionable explanations for Meta WhatsApp
 * send errors. Client-safe (no Node imports) — used by the send route
 * and by the inbox UI to render failed-status messages.
 */

export function waErrorMessagePtBr(code: number | undefined | null): string | null {
  switch (code) {
    case 131047:
      return "Janela de 24 horas expirada — envie um template para reabrir a conversa.";
    case 131042:
      return "Problema com o método de pagamento da conta WhatsApp Business. Verifique a forma de pagamento no Meta Business Manager.";
    case 132001:
      return "Template não aprovado ou inexistente no Meta Business Manager. Confirme o nome exato e o status de aprovação do template.";
    case 131037:
      return "O nome de exibição do número ainda não foi aprovado pela Meta. Verifique o display name no WhatsApp Manager.";
    case 131026:
      return "Mensagem não pôde ser entregue — o número pode não ter WhatsApp ou não aceitou os novos Termos.";
    case 131048:
    case 131056:
      return "Limite de envio atingido temporariamente. Aguarde alguns minutos e tente novamente.";
    case 133005:
      return "PIN de verificação em duas etapas incorreto no registro do número.";
    default:
      return null;
  }
}

/** Message for a failed send, always actionable — never a bare 500. */
export function waSendFailureMessage(code: number | undefined | null): string {
  return (
    waErrorMessagePtBr(code) ??
    (code
      ? `Falha ao enviar (código Meta ${code}). Consulte os logs para detalhes.`
      : "Falha ao enviar a mensagem. Consulte os logs para detalhes.")
  );
}
