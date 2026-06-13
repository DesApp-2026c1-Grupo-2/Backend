export const calcularVentana = (fechaHora, duracionClase) => {
  const inicio = new Date(fechaHora.getTime() - 60 * 60 * 1000);
  const fin = new Date(fechaHora.getTime() + (duracionClase + 30) * 60 * 1000);
  return { inicio, fin };
};
