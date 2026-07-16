import { registrarDescarteSchema } from "../schemas/descarteSchema.js";

const validarRegistrarDescarte = (req, res, next) => {
  const { error, value } = registrarDescarteSchema.validate(req.body, {
    abortEarly: false,
    stripUnknown: true,
  });

  if (error) {
    return res.status(400).json({
      error: error.details.map((detalle) => detalle.message),
    });
  }

  req.body = value;
  next();
};

export default validarRegistrarDescarte;
