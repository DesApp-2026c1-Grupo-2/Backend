/*
 * Helper de paginación compartido por los listados que exponen page/limit.
 *
 * Normaliza page/limit de la query a enteros acotados (evita traer colecciones
 * completas). Los defaults/máximos se pasan por endpoint porque cada listado
 * tiene su propio techo razonable (p. ej. el log de auditoría de /movimientos
 * admite hasta 200; el inventario de /items, 100).
 *
 * Nota: cuando el listado está detrás de `validate(schema, 'query')`, Joi ya
 * aplicó defaults y coerción a número; este helper sigue siendo seguro porque
 * reacota igual. En rutas sin validación Joi (p. ej. /lotes) es la única
 * defensa contra valores fuera de rango.
 */
const LIMIT_DEFAULT = 50;
const LIMIT_MAX = 200;

export const parsePaginacion = (query = {}, { def = LIMIT_DEFAULT, max = LIMIT_MAX } = {}) => {
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limitPedido = parseInt(query.limit, 10) || def;
  const limit = Math.min(Math.max(1, limitPedido), max);
  return { page, limit, skip: (page - 1) * limit };
};
