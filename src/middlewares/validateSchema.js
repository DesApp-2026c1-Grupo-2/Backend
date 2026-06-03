const validateSchema = (schema, property = 'body') => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req[property], {
      abortEarly: false, // Recopila todos los errores, no se detiene en el primero
      stripUnknown: true, // Elimina de req.body cualquier campo que no esté en el esquema
    });

    if (error) {
      const errores = error.details.map((detail) => detail.message);
      return res.status(400).json({ error: "Error de validación", detalles: errores });
    }

    // Reemplazamos la propiedad del request con los valores validados (aplica defaults, conversiones de tipos y recortes)
    req[property] = value;
    next();
  };
};

export default validateSchema;