import Joi from "joi";

/*
 * Query para el listado paginado de items (GET /items).
 * `tipo`/`esConsumible` ya existían como filtros; `q`, `page`, `limit`, `sort`
 * y `order` se agregan para la pantalla de Stock (paginación + búsqueda
 * server-side). El body de create/update lo sigue validando validateItems.js.
 */
export const itemQuerySchema = Joi.object({
  tipo: Joi.string().valid("sustancia", "reactivo", "material").optional(),
  esConsumible: Joi.boolean().optional(),
  q: Joi.string().trim().allow("").optional(),
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
  sort: Joi.string().valid("nombre", "codigo").default("nombre"),
  order: Joi.string().valid("asc", "desc").default("asc"),
});
