import { NextResponse } from 'next/server';

/**
 * Endpoint para recibir webhooks de Whapi.
 * @param {import('next/server').NextRequest} request
 */
export async function POST(request) {
  try {
    const body = await request.json();

    // Imprime el cuerpo del webhook en la consola para depuración
    console.log('===== Webhook de WhatsApp Recibido =====');
    console.log(JSON.stringify(body, null, 2));
    console.log('========================================');

    // Aquí es donde procesaremos el mensaje en el futuro.
    // Por ahora, solo confirmamos la recepción.

    return NextResponse.json({ success: true, message: 'Webhook recibido' }, { status: 200 });
  } catch (error) {
    console.error('Error al procesar el webhook de Whapi:', error);
    return NextResponse.json({ success: false, message: 'Error interno del servidor' }, { status: 500 });
  }
}