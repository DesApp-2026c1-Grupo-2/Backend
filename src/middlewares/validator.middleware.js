export const validate = (schema, property = 'body') => (req, res, next) => {
  const { error, value } = schema.validate(req[property], {
    abortEarly: false,
    allowUnknown: true,
    stripUnknown: true
  });

  if (error) {
    const errors = error.details.map((detail) => ({
      message: detail.message.replace(/['"]/g, ''),
      path: detail.path
    }));
    return res.status(400).json({ error: "Error de validación", detalles: errors, errors });
  }

  Object.defineProperty(req, property, {
    value: value,
    writable: true,
    enumerable: true,
    configurable: true
  });

  next();
};