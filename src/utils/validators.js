/**
 * validators.js
 * Funciones de validacion de datos para formularios de la aplicacion.
 * Cada funcion retorna { valid: boolean, message: string }.
 */

/** Expresion regular para NIT colombiano: digitos-digito */
const NIT_REGEX = /^\d{1,9}-\d{1}$/;

/** Expresion regular para correo electronico */
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Expresion regular basica para telefono colombiano */
const PHONE_REGEX = /^\+?[\d\s\-()]{7,15}$/;

/**
 * Valida un numero de NIT colombiano.
 * @param {string} nit - NIT a validar.
 * @returns {{ valid: boolean, message: string }}
 */
export const validateNIT = (nit) => {
  if (!nit || nit.trim() === '') {
    return { valid: false, message: 'El NIT es obligatorio.' };
  }
  if (!NIT_REGEX.test(nit.trim())) {
    return { valid: false, message: 'Formato de NIT invalido (ej: 900.123.456-7).' };
  }
  return { valid: true, message: '' };
};

/**
 * Valida un correo electronico.
 * @param {string} email - Correo a validar.
 * @returns {{ valid: boolean, message: string }}
 */
export const validateEmail = (email) => {
  if (!email || email.trim() === '') {
    return { valid: true, message: '' }; // El email es opcional
  }
  if (!EMAIL_REGEX.test(email.trim())) {
    return { valid: false, message: 'Formato de correo electronico invalido.' };
  }
  return { valid: true, message: '' };
};

/**
 * Valida un numero de telefono.
 * @param {string} phone - Telefono a validar.
 * @returns {{ valid: boolean, message: string }}
 */
export const validatePhone = (phone) => {
  if (!phone || phone.trim() === '') {
    return { valid: true, message: '' }; // El telefono es opcional
  }
  if (!PHONE_REGEX.test(phone.trim())) {
    return { valid: false, message: 'Formato de telefono invalido.' };
  }
  return { valid: true, message: '' };
};

/**
 * Valida que un campo de texto no este vacio.
 * @param {string} value - Valor del campo.
 * @param {string} fieldName - Nombre del campo para el mensaje de error.
 * @returns {{ valid: boolean, message: string }}
 */
export const validateRequired = (value, fieldName = 'Este campo') => {
  if (!value || (typeof value === 'string' && value.trim() === '')) {
    return { valid: false, message: `${fieldName} es obligatorio.` };
  }
  return { valid: true, message: '' };
};

/**
 * Valida un formulario completo de cliente.
 * @param {object} cliente - Objeto con datos del cliente.
 * @returns {{ valid: boolean, errors: object }}
 */
export const validateCliente = (cliente) => {
  const errors = {};

  const idResult = validateRequired(cliente.identificacion, 'La identificacion');
  if (!idResult.valid) errors.identificacion = idResult.message;

  const nombreResult = validateRequired(cliente.nombre, 'El nombre');
  if (!nombreResult.valid) errors.nombre = nombreResult.message;

  const emailResult = validateEmail(cliente.email);
  if (!emailResult.valid) errors.email = emailResult.message;

  const phoneResult = validatePhone(cliente.telefono);
  if (!phoneResult.valid) errors.telefono = phoneResult.message;

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
};
