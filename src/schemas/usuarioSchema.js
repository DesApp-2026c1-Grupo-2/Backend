import Joi from 'joi';

const createUsuarioSchema = Joi.object({
  nombre: Joi.string().trim().required().messages({
    'string.empty': 'El nombre es obligatorio',
    'any.required': 'El nombre es obligatorio'
  }),
  apellido: Joi.string().trim().required().messages({
    'string.empty': 'El apellido es obligatorio',
    'any.required': 'El apellido es obligatorio'
  }),
  email: Joi.string().trim().email().required().messages({
    'string.email': 'Por favor ingrese un correo válido',
    'string.empty': 'El correo electrónico es obligatorio',
    'any.required': 'El correo electrónico es obligatorio'
  }),
  password: Joi.string().min(6).required().messages({
    'string.empty': 'La contraseña es obligatoria',
    'string.min': 'La contraseña debe tener al menos 6 caracteres',
    'any.required': 'La contraseña es obligatoria'
  }),
  legajo: Joi.string().trim().allow(null, '').optional(),
  activo: Joi.boolean().optional(),
  rol: Joi.string().valid('DOCENTE', 'PERSONAL', 'ADMIN').required().messages({
    'any.only': 'Rol no válido',
    'any.required': 'El rol es obligatorio'
  }),
  estado: Joi.string().valid('ACTIVO', 'PENDIENTE', 'SUSPENDIDO').optional()
});

const updateUsuarioSchema = Joi.object({
  nombre: Joi.string().trim().optional().messages({
    'string.empty': 'El nombre no puede estar vacío'
  }),
  apellido: Joi.string().trim().optional().messages({
    'string.empty': 'El apellido no puede estar vacío'
  }),
  email: Joi.string().trim().email().optional().messages({
    'string.email': 'Por favor ingrese un correo válido',
    'string.empty': 'El correo electrónico no puede estar vacío'
  }),
  password: Joi.string().min(6).optional().messages({
    'string.empty': 'La contraseña no puede estar vacía',
    'string.min': 'La contraseña debe tener al menos 6 caracteres'
  }),
  legajo: Joi.string().trim().allow(null, '').optional(),
  activo: Joi.boolean().optional(),
  rol: Joi.string().valid('DOCENTE', 'PERSONAL', 'ADMIN').optional().messages({
    'any.only': 'Rol no válido'
  }),
  estado: Joi.string().valid('ACTIVO', 'PENDIENTE', 'SUSPENDIDO').optional()
}).min(1).messages({
  'object.min': 'Debe proporcionar al menos un campo para actualizar'
});

const loginUsuarioSchema = Joi.object({
  email: Joi.string().trim().email().required().messages({
    'string.email': 'Por favor ingrese un correo válido',
    'string.empty': 'El correo electrónico es obligatorio',
    'any.required': 'El correo electrónico es obligatorio'
  }),
  password: Joi.string().required().messages({
    'string.empty': 'La contraseña es obligatoria',
    'any.required': 'La contraseña es obligatoria'
  })
});

export { createUsuarioSchema, updateUsuarioSchema, loginUsuarioSchema };