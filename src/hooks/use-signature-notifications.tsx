/**
 * Signature notifications.
 *
 * Anteriormente este hook usava `postgres_changes` para reagir a alterações
 * em `signature_requests`. Por segurança, essas tabelas foram removidas da
 * publicação Realtime (contêm CPF, e-mail e tokens ZapSign que vazariam
 * para outros tenants em canais públicos). As notificações em tempo real
 * podem ser reintroduzidas via mensagens de broadcast emitidas pelo
 * webhook do ZapSign no canal privado `signature-notifications:<companyId>`.
 */
export function useSignatureNotifications() {
  // no-op
}
