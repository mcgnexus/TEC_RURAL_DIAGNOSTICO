const SENSITIVE_KEY_RE = /(authorization|cookie|set-cookie|token|secret|signature|api[_-]?key|password|bearer)/i;
const PII_KEY_RE = /(phone|email|telegram(_id)?|chat_id|from|to)/i;

export function maskPhone(value) {
  const str = String(value || '');
  const digits = str.replace(/[^\d]/g, '');
  if (!digits) return '***';
  const tail = digits.slice(-4);
  const prefix = str.trim().startsWith('+') ? '+' : '';
  return `${prefix}***${tail}`;
}

export function maskEmail(value) {
  const str = String(value || '');
  const at = str.indexOf('@');
  if (at <= 0) return '***';
  const domain = str.slice(at + 1);
  const first = str[0] || '*';
  return `${first}***@${domain || '***'}`;
}

export function maskId(value) {
  const str = String(value || '');
  if (!str) return '***';
  if (str.length <= 6) return '***';
  return `${str.slice(0, 2)}***${str.slice(-2)}`;
}

export function redactString(input) {
  const value = String(input ?? '');

  return value
    .replace(/Bearer\s+[A-Za-z0-9\-._~+/]+=*/gi, 'Bearer ***')
    .replace(/(token|secret|api[_-]?key|access[_-]?token|refresh[_-]?token)=([^&\s]+)/gi, '$1=***')
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '***@***')
    .replace(/\+\d{7,15}/g, '+***')
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '***')
    .replace(/[A-Za-z0-9_-]{24,}/g, '***');
}

export function redactForLog(value, depth = 0) {
  if (value == null) return value;
  if (depth > 4) return '[Truncated]';

  if (typeof value === 'string') return redactString(value);
  if (typeof value === 'number' || typeof value === 'boolean') return value;

  if (value instanceof Error) {
    return {
      name: value.name,
      message: redactString(value.message || ''),
    };
  }

  if (Array.isArray(value)) {
    return value.slice(0, 50).map((v) => redactForLog(v, depth + 1));
  }

  if (typeof value === 'object') {
    const out = {};
    const entries = Object.entries(value).slice(0, 80);

    for (const [key, v] of entries) {
      if (SENSITIVE_KEY_RE.test(key)) {
        out[key] = '***';
        continue;
      }

      if (PII_KEY_RE.test(key)) {
        if (/email/i.test(key)) out[key] = maskEmail(v);
        else if (/phone|chat_id|from|to/i.test(key)) out[key] = maskPhone(v);
        else out[key] = maskId(v);
        continue;
      }

      out[key] = redactForLog(v, depth + 1);
    }

    return out;
  }

  return '[Unserializable]';
}

