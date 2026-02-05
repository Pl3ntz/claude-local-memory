const CONTROL_CHAR_PATTERNS = [
  /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g,
  /\uFEFF/g,
  /[\uFFF0-\uFFFF]/g,
];

const MAX_METADATA_FIELDS = 50;
const MAX_KEY_LENGTH = 128;
const MAX_VALUE_LENGTH = 1024;

function sanitizeContent(text, maxLength = 100000) {
  if (!text || typeof text !== 'string') {
    return '';
  }

  let result = text;
  for (const pattern of CONTROL_CHAR_PATTERNS) {
    result = result.replace(pattern, '');
  }

  if (result.length > maxLength) {
    result = result.slice(0, maxLength);
  }

  return result;
}

function validateContentLength(text, min = 1, max = 100000) {
  if (text.length < min) {
    return { valid: false, reason: `content below minimum length (${min})` };
  }
  if (text.length > max) {
    return { valid: false, reason: `content exceeds maximum length (${max})` };
  }
  return { valid: true };
}

function validateContainerTag(tag) {
  if (!tag || typeof tag !== 'string') {
    return { valid: false, reason: 'tag is empty' };
  }
  if (tag.length > 100) {
    return { valid: false, reason: 'tag exceeds 100 characters' };
  }
  if (!/^[a-zA-Z0-9_-]+$/.test(tag)) {
    return {
      valid: false,
      reason:
        'tag contains invalid characters (only alphanumeric, underscore, hyphen allowed)',
    };
  }
  if (/^[-_]|[-_]$/.test(tag)) {
    return {
      valid: false,
      reason: 'tag must not start or end with - or _',
    };
  }
  return { valid: true };
}

function sanitizeMetadata(metadata) {
  if (!metadata || typeof metadata !== 'object') {
    return {};
  }

  const result = {};
  let count = 0;

  for (const [key, value] of Object.entries(metadata)) {
    if (count >= MAX_METADATA_FIELDS) {
      break;
    }
    if (key.length > MAX_KEY_LENGTH) {
      continue;
    }
    if (/[^\w.-]/.test(key)) {
      continue;
    }

    if (typeof value === 'string') {
      result[key] = value.slice(0, MAX_VALUE_LENGTH);
      count++;
    } else if (typeof value === 'number' && Number.isFinite(value)) {
      result[key] = value;
      count++;
    } else if (typeof value === 'boolean') {
      result[key] = value;
      count++;
    }
  }

  return result;
}

module.exports = {
  sanitizeContent,
  validateContentLength,
  validateContainerTag,
  sanitizeMetadata,
};
