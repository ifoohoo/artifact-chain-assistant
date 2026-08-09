// @feature ACA16 @scenario S-50
// Self-contained, fail-closed YAML subset parser for artifact workflow profiles.

/**
 * Parse the deterministic YAML subset accepted by artifact-workflow-profile.
 * Blocks may use any positive child indentation, but every sibling in one block
 * must use the exact same indentation. Sequences contain scalar values only.
 *
 * @param {string} source
 * @returns {object|null}
 */
export function parseMinimalYaml(source) {
  if (typeof source !== 'string') {
    throw new TypeError('parseMinimalYaml expects a string');
  }

  const lines = preprocess(source);
  if (lines.length === 0) return null;
  if (lines[0].indent !== 0) {
    throw yamlError(lines[0], 'invalid top-level indentation');
  }

  const parsed = parseBlock(lines, 0, 0);
  if (parsed.next !== lines.length) {
    throw yamlError(lines[parsed.next], 'unexpected indentation');
  }
  if (Array.isArray(parsed.value)) {
    throw yamlError(lines[0], 'top-level sequence is not supported');
  }
  return parsed.value;
}

function preprocess(source) {
  const result = [];
  const rawLines = source.replaceAll('\r\n', '\n').replaceAll('\r', '\n').split('\n');

  for (let index = 0; index < rawLines.length; index += 1) {
    const raw = rawLines[index];
    if (/^[ ]*$/.test(raw) || /^[ ]*#/.test(raw)) continue;

    const leading = raw.match(/^[\t ]*/)?.[0] ?? '';
    if (leading.includes('\t')) {
      throw new Error(`Unsupported YAML: tab indentation at line ${index + 1}`);
    }

    const text = raw.slice(leading.length);
    if (text === '---') {
      throw new Error(`Unsupported YAML: multi-document separator --- at line ${index + 1}`);
    }
    if (text === '...') {
      throw new Error(`Unsupported YAML: document end marker ... at line ${index + 1}`);
    }
    result.push({ line: index + 1, indent: leading.length, text });
  }

  return result;
}

function parseBlock(lines, index, indent) {
  const first = lines[index];
  if (!first || first.indent !== indent) {
    throw yamlError(first, 'invalid block indentation');
  }
  return first.text.startsWith('-')
    ? parseSequence(lines, index, indent)
    : parseMapping(lines, index, indent);
}

// Prototype pollution keys that must never appear as mapping keys.
const PROTOTYPE_POLLUTION_KEYS = new Set(['__proto__', 'prototype', 'constructor']);

function parseMapping(lines, start, indent) {
  const value = Object.create(null);
  let index = start;

  while (index < lines.length) {
    const line = lines[index];
    if (line.indent < indent) break;
    if (line.indent > indent) {
      throw yamlError(line, `unexpected indentation; expected ${indent} spaces`);
    }
    if (line.text.startsWith('-')) {
      throw yamlError(line, 'mixed mapping and sequence block');
    }

    const entry = parseMappingEntry(line);
    if (Object.prototype.hasOwnProperty.call(value, entry.key)) {
      throw yamlError(line, `duplicate key "${entry.key}"`);
    }

    if (entry.rawValue !== '') {
      value[entry.key] = parseScalar(entry.rawValue, line);
      index += 1;
      continue;
    }

    const child = lines[index + 1];
    if (!child || child.indent <= indent) {
      throw yamlError(line, `key "${entry.key}" requires a nested block`);
    }
    const parsedChild = parseBlock(lines, index + 1, child.indent);
    value[entry.key] = parsedChild.value;
    index = parsedChild.next;
  }

  return { value, next: index };
}

function parseSequence(lines, start, indent) {
  const value = [];
  let index = start;

  while (index < lines.length) {
    const line = lines[index];
    if (line.indent < indent) break;
    if (line.indent > indent) {
      throw yamlError(line, `unexpected indentation; expected ${indent} spaces`);
    }
    if (!line.text.startsWith('-')) {
      throw yamlError(line, 'mixed sequence and mapping block');
    }
    if (!line.text.startsWith('- ')) {
      throw yamlError(line, 'sequence items must use "- <scalar>"');
    }

    const rawValue = line.text.slice(2).trim();
    if (rawValue === '') {
      throw yamlError(line, 'empty or nested sequence items are not supported');
    }
    if (looksLikeMappingEntry(rawValue)) {
      throw yamlError(line, 'mapping sequence items are not supported');
    }
    value.push(parseScalar(rawValue, line));
    index += 1;
  }

  return { value, next: index };
}

function parseMappingEntry(line) {
  if (/^["']/.test(line.text) || line.text.startsWith('?')) {
    throw yamlError(line, 'complex key is not supported');
  }

  const separator = line.text.indexOf(':');
  if (separator <= 0) {
    throw yamlError(line, `unparseable mapping entry: ${line.text}`);
  }
  const key = line.text.slice(0, separator).trim();
  if (!/^[A-Za-z0-9_.-]+$/.test(key)) {
    throw yamlError(line, `unsupported mapping key "${key}"`);
  }
  if (PROTOTYPE_POLLUTION_KEYS.has(key)) {
    throw yamlError(line, `prototype pollution key "${key}" is not allowed`);
  }
  return { key, rawValue: line.text.slice(separator + 1).trim() };
}

function looksLikeMappingEntry(value) {
  return /^[A-Za-z0-9_.-]+\s*:/.test(value);
}

function parseScalar(raw, line) {
  rejectUnsupportedScalar(raw, line);

  if (raw === '{}') return Object.create(null);
  if (raw === '[]') return [];
  if (raw === 'true') return true;
  if (raw === 'false') return false;
  if (raw === 'null') return null;
  if (/^-?\d+$/.test(raw)) return Number.parseInt(raw, 10);

  if (raw.startsWith('"') || raw.endsWith('"')) {
    if (!(raw.startsWith('"') && raw.endsWith('"'))) {
      throw yamlError(line, 'unterminated double-quoted scalar');
    }
    try {
      return JSON.parse(raw);
    } catch {
      throw yamlError(line, 'invalid double-quoted scalar');
    }
  }

  if (raw.startsWith("'") || raw.endsWith("'")) {
    if (!(raw.startsWith("'") && raw.endsWith("'"))) {
      throw yamlError(line, 'unterminated single-quoted scalar');
    }
    const body = raw.slice(1, -1);
    if (/(^|[^'])'(?!')/.test(body)) {
      throw yamlError(line, 'invalid single-quoted scalar');
    }
    return body.replaceAll("''", "'");
  }

  if (/^[\[\]{},]/.test(raw)) {
    throw yamlError(line, 'flow collections are not supported');
  }
  return raw;
}

function rejectUnsupportedScalar(raw, line) {
  if (/^(?:&|\*)\S/.test(raw) || /(?:^|\s)(?:&|\*)\S/.test(raw)) {
    throw yamlError(line, 'anchor or alias is not supported');
  }
  if (/^(?:!|!!)/.test(raw)) {
    throw yamlError(line, 'tag is not supported');
  }
  if (raw === '|' || raw === '>' || /^[|>]\d?[+-]?$/.test(raw)) {
    throw yamlError(line, 'block scalar is not supported');
  }
}

function yamlError(line, message) {
  const suffix = line ? ` at line ${line.line}` : '';
  return new Error(`Unsupported YAML: ${message}${suffix}`);
}
