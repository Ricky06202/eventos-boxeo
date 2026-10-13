export const prerender = false;
import type { APIRoute } from 'astro';
import { generateYappySignature } from '../../../utils/yappyCrypto';
import { notifyDiscord } from '../../../lib/discord';

export const POST: APIRoute = async ({ request, locals }) => {
  try {
    const payload = await request.json();
    const { orderId, status, subtotal, taxes, total, signature } = payload;

    // Obtener el Secret Key de las variables de entorno
    // @ts-ignore
    const env = locals.runtime?.env || process.env; 
    const secretKey = env.YAPPY_SECRET_KEY;

    if (!secretKey) {
       console.error("YAPPY_SECRET_KEY no está configurado.");
       return new Response(JSON.stringify({ error: 'Configuración inválida' }), { status: 500 });
    }

    const expectedSignature = await generateYappySignature(orderId, subtotal, taxes, total, secretKey);
    
    if (signature !== expectedSignature) {
      return new Response(JSON.stringify({ error: 'Firma inválida' }), { status: 401 });
    }

    if (status === 'E') { 
      // Llamada a SonicJS para marcar como pagado
      await fetch(`${env.SONICJS_API_URL}/api/content/${orderId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${env.SONICJS_ADMIN_TOKEN}`
        },
        body: JSON.stringify({
           collectionId: 'col-ticket-sales', // ID de la colección real
           collection_id: 'col-ticket-sales',
           data: { paymentStatus: 'Pagado' }
        })
      });
    }

    // Aviso a Discord (best-effort): resultado de pago Yappy.
    try {
      const _ctx = (locals as any)?.runtime?.ctx;
      const _st = String(status || '').toUpperCase();
      if (_st === 'E') {
        const _t = Number(String(total ?? '').replace(/[^0-9.]/g, '') || 0);
        notifyDiscord(env, 'pagos',
          `\u2705 Pago confirmado \u2014 Comibox Chiriquí${_t > 0 ? ` \u00b7 $${_t.toFixed(2)}` : ''} \u00b7 ref ${orderId}`,
          _ctx);
      } else if (['R', 'C', 'F', 'FAILED', 'FAIL', 'REJECTED', 'CANCELED', 'CANCELLED', 'DECLINED', 'ERROR'].includes(_st)) {
        notifyDiscord(env, 'pagos', `\u274C Pago rechazado \u2014 Comibox Chiriquí \u00b7 ref ${orderId}`, _ctx);
      }
    } catch { /* best-effort */ }

    return new Response(JSON.stringify({ success: true }), { status: 200 });
  } catch (error) {
    console.error('Error en Webhook de Yappy:', error);
    return new Response(JSON.stringify({ error: 'Error interno' }), { status: 500 });
  }
};
