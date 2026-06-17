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
    cambios: formatCambios(cambios)
  });
};

// 🔥 NUEVO: normaliza SIEMPRE el formato
const formatCambios = (cambios) => {
  const resultado = {};

  for (const key in cambios) {
    const value = cambios[key];

    // si ya viene bien formado
    if (value?.antes !== undefined && value?.despues !== undefined) {
      resultado[key] = value;
    }

    // si viene mal (string o valor plano)
    else {
      resultado[key] = {
        antes: null,
        despues: value
      };
    }
  }

  return resultado;
};