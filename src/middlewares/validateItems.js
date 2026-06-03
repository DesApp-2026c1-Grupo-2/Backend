import Item from "../models/item.model.js";
import Lote from "../models/lote.model.js";

const validarTipo = (tipo) => {
  const tiposValidos = ["sustancia", "reactivo", "material", "equipo"];
  if (!tiposValidos.includes(tipo)) {
    return `El tipo debe ser uno de: ${tiposValidos.join(", ")}`;
  }
  return null;
};

const validarNombre = (nombre) => {
  if (!nombre || typeof nombre !== "string" || nombre.trim().length === 0) {
    return "El nombre del ítem es obligatorio y debe ser una cadena no vacía";
  }
  return null;
};

const validarCodigo = async (codigo, itemId = null) => {
  if (!codigo || typeof codigo !== "string" || codigo.trim().length === 0) {
    return "El código del ítem es obligatorio y debe ser una cadena no vacía";
  }

  const filtro = { codigo };
  if (itemId) {
    filtro._id = { $ne: itemId };
  }

  const codigoExistente = await Item.findOne(filtro);
  if (codigoExistente) {
    return "El código del ítem ya existe en la base de datos";
  }
  return null;
};

const validarUnidad = (unidad) => {
  if (!unidad || typeof unidad !== "string" || unidad.trim().length === 0) {
    return "La unidad del ítem es obligatoria (ej: g, ml, unidad)";
  }
  return null;
};

const validarConsumible = (esConsumible) => {
  if (typeof esConsumible !== "boolean") {
    return "El campo esConsumible debe ser un booleano (true o false)";
  }
  return null;
};

const validarReceta = (tipo, requiereReceta) => {
  if (typeof requiereReceta !== "boolean") {
    return "El campo requiereReceta debe ser un booleano (true o false)";
  }

  if (requiereReceta === true && tipo !== "reactivo") {
    return "Solo los ítems de tipo 'reactivo' pueden requerir receta";
  }
  return null;
};

const validarItem = async (req, res, next) => {
  try {
    const data = req.body;
    const itemId = req.params.id;
    const detalleProblemas = [];

    // Validar nombre
    const problemaNombre = validarNombre(data.nombre);
    if (problemaNombre) detalleProblemas.push(problemaNombre);

    // Validar tipo
    if (data.tipo) {
      const problemaTipo = validarTipo(data.tipo);
      if (problemaTipo) detalleProblemas.push(problemaTipo);
    }

    // Validar código
    if (data.codigo) {
      const proximoProblema = await validarCodigo(data.codigo, itemId);
      if (proximoProblema) detalleProblemas.push(proximoProblema);
    }

    // Validar unidad
    if (data.unidad) {
      const problemaUnidad = validarUnidad(data.unidad);
      if (problemaUnidad) detalleProblemas.push(problemaUnidad);
    }

    // Validar esConsumible
    if (data.esConsumible !== undefined) {
      const problemaConsumible = validarConsumible(data.esConsumible);
      if (problemaConsumible) detalleProblemas.push(problemaConsumible);
    }

    // Validar requiereReceta
    if (data.requiereReceta !== undefined) {
      let tipoParaValidar = data.tipo;

      if (!tipoParaValidar && itemId) {
        const itemExistente = await Item.findById(itemId).lean();
        if (itemExistente) {
          tipoParaValidar = itemExistente.tipo;
        }
      }

      const problemaReceta = validarReceta(tipoParaValidar || "sustancia", data.requiereReceta);
      if (problemaReceta) detalleProblemas.push(problemaReceta);
    }

    if (detalleProblemas.length > 0) {
      return res.status(400).json({ 
        error: "Validación de ítem fallida",
        detalles: detalleProblemas 
      });
    }

    next();
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export default validarItem;
