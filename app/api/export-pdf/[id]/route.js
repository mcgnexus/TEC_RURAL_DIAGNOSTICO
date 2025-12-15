import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';

const cleanMarkdown = markdown => {
  if (!markdown) return 'Sin diagnóstico registrado.';
  return markdown
    .replace(/#+\s?/g, '')
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/\*(.*?)\*/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\[(.*?)\]\((.*?)\)/g, '$1 ($2)')
    .trim();
};

const loadImageBuffer = async url => {
  if (!url) return null;
  try {
    const response = await fetch(url);
    if (!response.ok) {
      return null;
    }
    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  } catch (error) {
    console.warn('No se pudo cargar la imagen del diagnóstico:', error);
    return null;
  }
};

const buildPdfBuffer = (PDFDocument, { diagnosis, profile, imageBuffer }) =>
  new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50 });
    const chunks = [];

    doc.on('data', chunk => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    doc.fontSize(18).text('Informe de Diagnóstico - TEC Rural', { align: 'center' });
    doc.moveDown();

    const fullName =
      [profile?.first_name, profile?.last_name].filter(Boolean).join(' ').trim() || 'Sin nombre';

    doc
      .fontSize(12)
      .text(`Diagnóstico ID: ${diagnosis.id}`)
      .text(`Fecha: ${new Date(diagnosis.created_at).toLocaleString('es-ES')}`)
      .text(`Agricultor: ${fullName}`)
      .text(`Email: ${profile?.email || 'Sin email'}`)
      .text(`Teléfono: ${profile?.phone || 'Sin teléfono'}`)
      .moveDown();

    doc
      .fontSize(14)
      .text(`Cultivo: ${diagnosis.cultivo_name}`, { underline: true })
      .moveDown(0.5);

    const confidenceValue =
      typeof diagnosis.confidence_score === 'number'
        ? `${(diagnosis.confidence_score * 100).toFixed(1)}%`
        : 'No disponible';

    doc.fontSize(12).text(`Confianza del sistema: ${confidenceValue}`);

    if (diagnosis.gps_lat && diagnosis.gps_long) {
      doc.text(`Ubicación aproximada: ${diagnosis.gps_lat}, ${diagnosis.gps_long}`);
    }

    doc.moveDown();
    doc.fontSize(14).text('Diagnóstico detallado:', { underline: true }).moveDown(0.5);
    doc.fontSize(12).text(cleanMarkdown(diagnosis.ai_diagnosis_md), {
      align: 'left',
    });

    if (imageBuffer) {
      doc.addPage();
      doc.fontSize(14).text('Fotografía enviada', { align: 'center' }).moveDown(1);
      try {
        doc.image(imageBuffer, {
          align: 'center',
          fit: [450, 450],
        });
      } catch (err) {
        doc
          .fontSize(12)
          .fillColor('red')
          .text('No se pudo renderizar la imagen en el PDF.', { align: 'center' })
          .fillColor('black');
      }
    }

    doc.end();
  });

export async function GET(request, { params }) {
  try {
    const { default: PDFDocument } = await import('pdfkit');
    const supabase = supabaseAdmin;
    const { id } = params;

    const { data: diagnosis, error } = await supabase
      .from('diagnoses')
      .select(
        `
        id,
        user_id,
        cultivo_name,
        ai_diagnosis_md,
        confidence_score,
        gps_lat,
        gps_long,
        image_url,
        created_at,
        profiles:profiles!diagnoses_user_id_fkey(
          first_name,
          last_name,
          email,
          phone
        )
      `
      )
      .eq('id', id)
      .single();

    if (error || !diagnosis) {
      return NextResponse.json(
        { error: 'No se encontró el diagnóstico solicitado.' },
        { status: 404 }
      );
    }

    const imageBuffer = await loadImageBuffer(diagnosis.image_url);

    const pdfBuffer = await buildPdfBuffer(PDFDocument, {
      diagnosis,
      profile: diagnosis.profiles,
      imageBuffer,
    });

    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="diagnostico-${id}.pdf"`,
      },
    });
  } catch (error) {
    console.error('Export PDF error:', error);
    return NextResponse.json({ error: error.message || 'Error inesperado.' }, { status: 500 });
  }
}
