/**
 * validators.test.js
 * Pruebas unitarias de las reglas de validacion de formularios.
 * Espejo de FacturaExpress-V3/frontend/src/app/core/validators.spec.ts:
 * si una de las dos versiones relaja o endurece una regla, esta prueba lo
 * delata antes de que llegue a la interfaz.
 *
 * Ejecutar: npm test
 */

import { describe, it, expect } from 'vitest';
import {
  validateRequired,
  validateNIT,
  validateEmail,
  validatePhone,
  validateCliente,
  validateProducto,
  validateUsuario,
} from './validators';

describe('validateRequired', () => {
  it('rechaza vacios, nulos y cadenas de espacios', () => {
    expect(validateRequired('').valid).toBe(false);
    expect(validateRequired('   ').valid).toBe(false);
    expect(validateRequired(null).valid).toBe(false);
    expect(validateRequired(undefined).valid).toBe(false);
  });

  it('acepta valores con contenido', () => {
    expect(validateRequired('Cliente').valid).toBe(true);
    expect(validateRequired(0).valid).toBe(true);
  });

  it('nombra el campo en el mensaje', () => {
    expect(validateRequired('', 'La identificacion').message).toBe(
      'La identificacion es obligatorio.'
    );
  });
});

describe('validateNIT', () => {
  it('acepta el formato digitos-digito', () => {
    expect(validateNIT('900123456-7').valid).toBe(true);
    expect(validateNIT('900.123.456-7').valid).toBe(false); // los puntos no son validos
  });

  it('rechaza vacios y formatos invalidos', () => {
    expect(validateNIT('').valid).toBe(false);
    expect(validateNIT('9001234567').valid).toBe(false);
    expect(validateNIT('ABC-1').valid).toBe(false);
  });
});

describe('validateEmail', () => {
  it('es opcional: vacio es valido', () => {
    expect(validateEmail('').valid).toBe(true);
    expect(validateEmail(null).valid).toBe(true);
  });

  it('acepta correos con forma correcta y rechaza el resto', () => {
    expect(validateEmail('cliente@empresa.co').valid).toBe(true);
    expect(validateEmail('cliente@empresa').valid).toBe(false);
    expect(validateEmail('cliente empresa@x.co').valid).toBe(false);
    expect(validateEmail('@x.co').valid).toBe(false);
  });
});

describe('validatePhone', () => {
  it('es opcional: vacio es valido', () => {
    expect(validatePhone('').valid).toBe(true);
  });

  it('acepta numeros con espacios, guiones y parentesis', () => {
    expect(validatePhone('+57 300 123 4567').valid).toBe(true);
    expect(validatePhone('(601) 555-1234').valid).toBe(true);
  });

  it('rechaza longitudes fuera de rango y letras', () => {
    expect(validatePhone('123').valid).toBe(false);
    expect(validatePhone('llamar al cliente').valid).toBe(false);
  });
});

describe('validateCliente', () => {
  const base = { identificacion: '900123456-7', nombre: 'Cliente Prueba', email: '', telefono: '' };

  it('acepta un cliente minimo valido', () => {
    expect(validateCliente(base)).toEqual({ valid: true, errors: {} });
  });

  it('acumula los errores de los campos obligatorios', () => {
    const res = validateCliente({ identificacion: '', nombre: '  ', email: 'mal', telefono: 'x' });
    expect(res.valid).toBe(false);
    expect(Object.keys(res.errors).sort()).toEqual(['email', 'identificacion', 'nombre', 'telefono']);
  });
});

describe('validateProducto', () => {
  const base = { codigo: 'P-001', nombre: 'Insumo', precio: 15000, stock: 10 };

  it('acepta un producto valido', () => {
    expect(validateProducto(base)).toEqual({ valid: true, errors: {} });
  });

  it('exige precio mayor que cero', () => {
    expect(validateProducto({ ...base, precio: 0 }).errors.precio).toBeDefined();
    expect(validateProducto({ ...base, precio: -1 }).errors.precio).toBeDefined();
    expect(validateProducto({ ...base, precio: '' }).errors.precio).toBeDefined();
  });

  it('exige stock entero no negativo', () => {
    expect(validateProducto({ ...base, stock: 1.5 }).errors.stock).toBeDefined();
    expect(validateProducto({ ...base, stock: -1 }).errors.stock).toBeDefined();
    expect(validateProducto({ ...base, stock: '' }).errors.stock).toBeDefined();
    expect(validateProducto({ ...base, stock: 0 }).valid).toBe(true);
  });
});

describe('validateUsuario', () => {
  const base = { nit: '900123456-7', nombre: 'Usuario', password: 'clave123', email: '', telefono: '' };

  it('acepta un usuario nuevo valido', () => {
    expect(validateUsuario(base)).toEqual({ valid: true, errors: {} });
  });

  it('exige contrasena de al menos 4 caracteres al crear', () => {
    expect(validateUsuario({ ...base, password: '' }).errors.password).toBeDefined();
    expect(validateUsuario({ ...base, password: '123' }).errors.password).toBeDefined();
  });

  it('no exige contrasena al editar', () => {
    expect(validateUsuario({ ...base, password: '' }, { requierePassword: false }).valid).toBe(true);
  });

  it('valida NIT y nombre obligatorios', () => {
    const res = validateUsuario({ ...base, nit: '', nombre: '' });
    expect(res.errors.nit).toBeDefined();
    expect(res.errors.nombre).toBeDefined();
  });
});
