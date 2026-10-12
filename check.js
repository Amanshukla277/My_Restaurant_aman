const { HttpError } = require('./errors');

function text(value, name, { required = true, max = 100 } = {}) {
  if (value === undefined || value === null || String(value).trim() === '') {
    if (required) throw new HttpError(`${name} is required.`);
    return '';
  }
  if (typeof value !== 'string') throw new HttpError(`${name} must be text.`);
  const trimmed = value.trim();
  if (trimmed.length > max) throw new HttpError(`${name} can have at most ${max} characters.`);
  return trimmed;
}

function whole(value, name, { required = true, min = 0, max = 1000000000, fallback = null } = {}) {
  if (value === undefined || value === null || value === '') {
    if (required) throw new HttpError(`${name} is required.`);
    return fallback;
  }
  const number = Number(value);
  if (!Number.isInteger(number)) throw new HttpError(`${name} must be a whole number.`);
  if (number < min) throw new HttpError(`${name} must be at least ${min}.`);
  if (number > max) throw new HttpError(`${name} must be at most ${max}.`);
  return number;
}

function decimal(value, name, { min = 0, max = 100 } = {}) {
  if (value === undefined || value === null || value === '') {
    throw new HttpError(`${name} is required.`);
  }
  const number = Number(value);
  if (Number.isNaN(number)) throw new HttpError(`${name} must be a number.`);
  if (number < min || number > max) throw new HttpError(`${name} must be between ${min} and ${max}.`);
  return number;
}

function bool(value, name, fallback = false) {
  if (value === undefined) return fallback;
  if (typeof value !== 'boolean') throw new HttpError(`${name} must be true or false.`);
  return value;
}

function oneOf(value, name, options, { required = true } = {}) {
  if (value === undefined || value === null || value === '') {
    if (required) throw new HttpError(`${name} is required.`);
    return null;
  }
  if (!options.includes(value)) throw new HttpError(`${name} must be one of: ${options.join(', ')}.`);
  return value;
}


function bodyObject(body) {
  if (body === null || typeof body !== 'object' || Array.isArray(body)) {
    throw new HttpError('Request body must be a JSON object.');
  }
  return body;
}

module.exports = { text, whole, decimal, bool, oneOf, bodyObject };
