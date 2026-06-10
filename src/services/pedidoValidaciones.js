export const validarAnticipacionPedido = (fechaHora) => {
  const now = new Date();

  // Lee la variable de entorno, si no existe, usa 2 como valor por defecto.
  const minHorasAnticipacion = parseInt(process.env.MIN_HORAS_ANTICIPACION_PEDIDO, 10) || 2;

  // No permitir fechas pasadas
  if (fechaHora < now) {
    return false;
  }

  // Comparar si es el mismo día (misma zona horaria)
  const mismaFecha =
    now.getFullYear() === fechaHora.getFullYear() &&
    now.getMonth() === fechaHora.getMonth() &&
    now.getDate() === fechaHora.getDate();

  if (mismaFecha) {
    const diffHoras = (fechaHora - now) / (1000 * 60 * 60);

    // Usar la variable en lugar del valor fijo
    if (diffHoras < minHorasAnticipacion) {
      return false;
    }
  }

  return true;
};