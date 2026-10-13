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


/**
 * Devuelve el ExecutionContext de Cloudflare de forma SEGURA, sin romper el
 * request. Astro v6 elimino locals.runtime.ctx (su getter lanza error) y lo
 * reemplazo por locals.cfContext. En Astro v5 sigue existiendo runtime.ctx.
 * Si no hay contexto disponible devuelve undefined (el aviso se dispara igual).
 */
export function execCtx(locals: any): any {
  try {
    const c = (locals as any)?.cfContext;
    if (c && typeof c.waitUntil === 'function') return c;
  } catch {
    /* Astro v5/v6 differences: nunca romper */
  }
  try {
    const c = (locals as any)?.runtime?.ctx;
    if (c && typeof c.waitUntil === 'function') return c;
  } catch {
    /* noop */
  }
  return undefined;
}
