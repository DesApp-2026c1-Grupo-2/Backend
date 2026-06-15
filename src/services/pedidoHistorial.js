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
    cambios
  });
};