/**
 * Registra un evento en el historial del pedido.
 *
 * @param {Document} pedido     - Documento Mongoose del pedido (mutable)
 * @param {string}   usuarioId  - ID del usuario que realizó la acción
 * @param {string}   accion     - Clave de acción (CREACION, MODIFICACION, etc.)
 * @param {string}   descripcion- Texto legible para mostrar en el historial
 * @param {object}   cambios    - Mapa { campo: { antes, despues } }
 */
export const registrarHistorial = (
  pedido,
  usuarioId,
  accion,
  descripcion,
  cambios = {}
) => {
  pedido.historial.push({
    usuario: usuarioId,
    accion,
    descripcion,
    cambios: formatCambios(cambios),
  });
};

/**
 * Normaliza el mapa de cambios para garantizar que cada entrada
 * tenga siempre la forma { antes, despues }.
 */
const formatCambios = (cambios) => {
  const resultado = {};

  for (const key in cambios) {
    const value = cambios[key];

    if (
      value !== null &&
      typeof value === "object" &&
      "antes" in value &&
      "despues" in value
    ) {
      // Ya tiene la forma correcta
      resultado[key] = value;
    } else {
      // Valor plano → envolver
      resultado[key] = {
        antes: null,
        despues: value,
      };
    }
  }

  return resultado;
};
