/**
 * FormField.jsx
 * Componente genérico para campos de formulario con React Hook Form y Zod.
 */

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

/**
 * Schema de validación para un campo simple.
 */
const fieldSchema = (label, required = false) => {
  return z.object({
    [label]: z.string().trim(),
  });
};

/**
 * Componente genérico para campos de formulario.
 * @param {string} label - Etiqueta del campo.
 * @param {string} name - Nombre del campo en el formulario.
 * @param {string} type - Tipo de input (text, email, number, etc.).
 * @param {object} defaultValue - Valor por defecto.
 * @param {boolean} required - Si el campo es obligatorio.
 */
export const FormField = ({ label, name, type = 'text', defaultValue, required }) => {
  const { register, formState: { errors } } = useForm({
    resolver: zodResolver(fieldSchema(label, required)),
    defaultValues: { [label]: defaultValue },
  });

  return (
    <div className="form-group">
      <label htmlFor={name}>{label}</label>
      <input
        id={name}
        type={type}
        {...register(name)}
        aria-label={label}
        aria-required={required}
        aria-invalid={!!errors[name]}
        aria-describedby={errors[name] ? `${name}-error` : undefined}
      />
      {errors[name] && (
        <span id={`${name}-error`} className="error-text" role="alert">
          {errors[name].message}
        </span>
      )}
    </div>
  );
};

/**
 * Componente genérico para campos de texto.
 */
export const TextField = ({ label, name, defaultValue, required }) => (
  <FormField label={label} name={name} type="text" defaultValue={defaultValue} required={required} />
);

/**
 * Componente genérico para campos de email.
 */
export const EmailField = ({ label, name, defaultValue, required }) => (
  <FormField label={label} name={name} type="email" defaultValue={defaultValue} required={required} />
);

/**
 * Componente genérico para campos numéricos.
 */
export const NumberField = ({ label, name, defaultValue, required }) => (
  <FormField label={label} name={name} type="number" defaultValue={defaultValue} required={required} />
);
