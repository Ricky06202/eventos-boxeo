/**
 * Avisos a Discord — best-effort.
 *
 * REGLA DURA: esto NUNCA debe alterar el flujo del sitio. Cualquier fallo se
 * traga con try/catch y el envio se hace via ctx.waitUntil() para no bloquear
 * ni cambiar la respuesta HTTP. Las URLs de webhook viven como SECRETOS del
 * Worker (DISCORD_WEBHOOK_LEADS / _PEDIDOS / _PAGOS), nunca en el codigo.
 */

export type NotifyKind = 'leads' | 'pedidos' | 'pagos';

const ENV_KEY: Record<NotifyKind, string> = {
  leads: 'DISCORD_WEBHOOK_LEADS',
  pedidos: 'DISCORD_WEBHOOK_PEDIDOS',
  pagos: 'DISCORD_WEBHOOK_PAGOS',
};

export function notifyDiscord(
  env: any,
  kind: NotifyKind,
  content: string,
  ctx?: any,
): void {
  try {
    const url = env?.[ENV_KEY[kind]];
    if (!url || typeof url !== 'string') return;

    const send = async (): Promise<void> => {
      try {
        await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content: String(content ?? '').slice(0, 1900) }),
        });
      } catch {
        /* best-effort: nunca romper el flujo del sitio */
      }
    };

    if (ctx && typeof ctx.waitUntil === 'function') {
      try {
        ctx.waitUntil(send());
        return;
      } catch {
        /* si waitUntil falla, cae al disparo sin bloquear */
      }
    }
    void send();
  } catch {
    /* best-effort */
  }
}
