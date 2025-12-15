/**
 * Utilidades para extraer texto de diferentes tipos de archivos
 */

/**
 * Extrae texto de un archivo PDF
 * @param {Buffer} buffer - Buffer del archivo PDF
 * @returns {Promise<string>} - Texto extraído
 */
export async function extractTextFromPDF(buffer) {
  try {
    // Usaremos pdf-parse para extraer texto de PDFs
    const pdfParseModule = await import('pdf-parse');
    const pdfParse = pdfParseModule.default || pdfParseModule;
    const data = await pdfParse(buffer);
    return data.text;
  } catch (error) {
    console.error('Error extracting text from PDF:', error);
    throw new Error('Error al extraer texto del PDF: ' + error.message);
  }
}

/**
 * Extrae texto de un archivo DOCX
 * @param {Buffer} buffer - Buffer del archivo DOCX
 * @returns {Promise<string>} - Texto extraído
 */
export async function extractTextFromDOCX(buffer) {
  try {
    // Usaremos mammoth para extraer texto de DOCX
    const mammothModule = await import('mammoth');
    const mammoth = mammothModule.default || mammothModule;
    const result = await mammoth.extractRawText({ buffer });
    return result.value;
  } catch (error) {
    console.error('Error extracting text from DOCX:', error);
    throw new Error('Error al extraer texto del DOCX: ' + error.message);
  }
}

/**
 * Extrae texto de un archivo DOC (Word antiguo)
 * @param {Buffer} buffer - Buffer del archivo DOC
 * @returns {Promise<string>} - Texto extraído
 */
export async function extractTextFromDOC(buffer) {
  try {
    // Para archivos DOC antiguos, también usaremos mammoth
    const mammothModule = await import('mammoth');
    const mammoth = mammothModule.default || mammothModule;
    const result = await mammoth.extractRawText({ buffer });
    return result.value;
  } catch (error) {
    console.error('Error extracting text from DOC:', error);
    throw new Error('Error al extraer texto del DOC: ' + error.message);
  }
}

/**
 * Extrae texto de un archivo TXT
 * @param {Buffer} buffer - Buffer del archivo TXT
 * @returns {string} - Texto extraído
 */
export function extractTextFromTXT(buffer) {
  try {
    return buffer.toString('utf-8');
  } catch (error) {
    console.error('Error extracting text from TXT:', error);
    throw new Error('Error al extraer texto del TXT: ' + error.message);
  }
}

/**
 * Extrae texto de un archivo según su tipo MIME
 * @param {Buffer} buffer - Buffer del archivo
 * @param {string} mimeType - Tipo MIME del archivo
 * @returns {Promise<string>} - Texto extraído
 */
export async function extractText(buffer, mimeType) {
  switch (mimeType) {
    case 'application/pdf':
      return await extractTextFromPDF(buffer);

    case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
      return await extractTextFromDOCX(buffer);

    case 'application/msword':
      return await extractTextFromDOC(buffer);

    case 'text/plain':
      return extractTextFromTXT(buffer);

    default:
      throw new Error(`Tipo de archivo no soportado: ${mimeType}`);
  }
}

/**
 * Limpia el texto extraído de caracteres no deseados
 * @param {string} text - Texto a limpiar
 * @returns {string} - Texto limpio
 */
export function cleanText(text) {
  return (
    text
      // Eliminar caracteres de control y especiales
      .replace(/[\x00-\x1F\x7F-\x9F]/g, '')
      // Reemplazar múltiples espacios con uno solo
      .replace(/\s+/g, ' ')
      // Reemplazar múltiples saltos de línea con máximo dos
      .replace(/\n{3,}/g, '\n\n')
      // Eliminar espacios al inicio y final
      .trim()
  );
}
