/**
 * useDialog.js
 * Comportamiento accesible de un dialogo modal: foco inicial, trampa de foco,
 * cierre con Escape, bloqueo del scroll de fondo y devolucion del foco al
 * elemento que lo abrio.
 *
 * Existe porque la app tiene diez modales escritos a mano y ninguno atrapaba
 * el foco: con teclado se podia tabular fuera del dialogo hacia la pagina de
 * atras. La version Angular ya lo resuelve de forma centralizada.
 *
 * Uso:
 *   const dialogProps = useDialog(isOpen, () => setShowModal(false));
 *   <div className="modal-content" {...dialogProps}> ... </div>
 *
 * El hook debe llamarse siempre (sin condicionales) y antes de cualquier
 * `return` temprano del componente.
 */

import { useEffect, useRef } from 'react';

/** Selector de elementos que pueden recibir foco dentro del dialogo */
const FOCALIZABLES = [
  'a[href]',
  'button:not([disabled])',
  'textarea:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

/**
 * @param {boolean} abierto - Si el dialogo esta visible.
 * @param {function} alCerrar - Accion a ejecutar con Escape o clic de fondo.
 * @returns {object} Props para el contenedor del dialogo.
 */
const useDialog = (abierto, alCerrar) => {
  const ref = useRef(null);

  // El callback se guarda en una ref para que el efecto dependa solo de
  // `abierto`: si dependiera de `alCerrar` (que suele ser una funcion inline)
  // el efecto se reejecutaria en cada render, devolviendo y volviendo a pedir
  // el foco, y el foco terminaria en <body>.
  const cerrarRef = useRef(alCerrar);
  useEffect(() => {
    cerrarRef.current = alCerrar;
  }, [alCerrar]);

  useEffect(() => {
    if (!abierto) return undefined;

    const nodo = ref.current;
    const focoPrevio = document.activeElement;

    // Nota: no se bloquea el scroll de fondo a proposito. `overflow: hidden`
    // hace desaparecer la barra del navegador y desplaza todo el contenido
    // ~15 px, lo que rompe la paridad pixel a pixel con la version Angular
    // (que no bloquea el scroll). Si algun dia se añade, debe hacerse en las
    // dos aplicaciones a la vez.

    const focalizables = () => Array.from(nodo?.querySelectorAll(FOCALIZABLES) || []);

    // Foco inicial: primer control del dialogo, o el propio contenedor.
    // Se espera a que el overlay sea visible: mientras la transicion de
    // `.modal-overlay` siga en `visibility: hidden`, focus() falla en silencio
    // y el foco se queda en <body>.
    let rafId;
    const enfocarCuandoSeVea = (intentos = 0) => {
      const overlay = nodo?.closest('.modal-overlay');
      const visible = !overlay || getComputedStyle(overlay).visibility !== 'hidden';
      if (visible) {
        (focalizables()[0] || nodo)?.focus();
        return;
      }
      if (intentos < 40) {
        rafId = requestAnimationFrame(() => enfocarCuandoSeVea(intentos + 1));
      }
    };
    rafId = requestAnimationFrame(() => enfocarCuandoSeVea());

    const alPresionarTecla = (evento) => {
      if (evento.key === 'Escape') {
        evento.stopPropagation();
        cerrarRef.current?.();
        return;
      }
      if (evento.key !== 'Tab') return;

      const items = focalizables();
      if (items.length === 0) {
        evento.preventDefault();
        return;
      }

      const primeroItem = items[0];
      const ultimoItem = items[items.length - 1];

      // Ciclo cerrado: del ultimo al primero y viceversa
      if (evento.shiftKey && document.activeElement === primeroItem) {
        evento.preventDefault();
        ultimoItem.focus();
      } else if (!evento.shiftKey && document.activeElement === ultimoItem) {
        evento.preventDefault();
        primeroItem.focus();
      }
    };

    document.addEventListener('keydown', alPresionarTecla);

    return () => {
      cancelAnimationFrame(rafId);
      document.removeEventListener('keydown', alPresionarTecla);
      // Devolver el foco a quien abrio el dialogo
      if (focoPrevio instanceof HTMLElement) focoPrevio.focus();
    };
  }, [abierto]);

  return { ref, tabIndex: -1, role: 'dialog', 'aria-modal': 'true' };
};

export default useDialog;
