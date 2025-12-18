import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

/**
 * Normaliza un número de teléfono al formato internacional E.164
 * @param {string} phone - Número de teléfono (con o sin +)
 * @returns {string|null} Teléfono normalizado (ej: "+573001234567") o null si es inválido
 */
function normalizePhone(phone) {
  if (!phone) return null;

  // Extraer solo dígitos
  const cleaned = String(phone).replace(/[^\d]/g, '');
  if (!cleaned || cleaned.length < 7) return null; // Validación mínima

  // Siempre devolver con +
  return cleaned.startsWith('+') ? cleaned : `+${cleaned}`;
}

export const runtime = 'nodejs';

const fetchLatestImages = async supabase => {
  const { data, error } = await supabase
    .from('diagnoses')
    .select('user_id,image_url,created_at')
    .not('image_url', 'is', null)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error obteniendo imágenes:', error);
    return new Map();
  }

  const map = new Map();
  data?.forEach(row => {
    if (!map.has(row.user_id) && row.image_url) {
      map.set(row.user_id, row.image_url);
    }
  });
  return map;
};

export async function GET() {
  try {
    const supabase = supabaseAdmin;
    const { data: profiles, error } = await supabase
      .from('profiles')
      .select('id,email,first_name,last_name,phone,credits_remaining,role,notify_whatsapp_on_diagnosis,created_at,updated_at')
      .order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const imageMap = await fetchLatestImages(supabase);
    const payload = profiles.map(profile => ({
      ...profile,
      latest_image: imageMap.get(profile.id) || null,
    }));

    return NextResponse.json(payload);
  } catch (error) {
    console.error('Admin users GET error:', error);
    return NextResponse.json({ error: error.message || 'Error inesperado.' }, { status: 500 });
  }
}

export async function PATCH(request) {
  try {
    const supabase = supabaseAdmin;
    const body = await request.json();
    const { userId, ...updates } = body;

    if (!userId) {
      return NextResponse.json({ error: 'userId es requerido.' }, { status: 400 });
    }

    // Filtrar campos permitidos
    const allowedFields = ['first_name', 'last_name', 'phone', 'role', 'credits_remaining', 'location', 'notify_whatsapp_on_diagnosis'];
    const filteredUpdates = {};

    Object.keys(updates).forEach(key => {
      if (allowedFields.includes(key)) {
        // Normalizar teléfono si se está actualizando
        if (key === 'phone' && updates[key]) {
          filteredUpdates[key] = normalizePhone(updates[key]);
        } else {
          filteredUpdates[key] = updates[key];
        }
      }
    });

    if (Object.keys(filteredUpdates).length === 0) {
      return NextResponse.json({ error: 'No se enviaron campos válidos para actualizar.' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('profiles')
      .update(filteredUpdates)
      .eq('id', userId)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, profile: data });
  } catch (error) {
    console.error('Admin users PATCH error:', error);
    return NextResponse.json({ error: error.message || 'Error inesperado.' }, { status: 500 });
  }
}
