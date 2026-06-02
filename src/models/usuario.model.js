const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const usuarioSchema = new mongoose.Schema({
  nombre: {
    type: String,
    required: [true, 'El nombre es obligatorio'],
    trim: true
  },
  apellido: {
    type: String,
    required: [true, 'El apellido es obligatorio'],
    trim: true
  },
  email: {
    type: String,
    required: [true, 'El correo electrónico es obligatorio'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [/.+\@.+\..+/, 'Por favor ingrese un correo válido'] 
  },
  password: {
    type: String,
    required: [true, 'La contraseña es obligatoria']
  },
  legajo: {
    type: String,
    unique: true,
    sparse: true, // Permite valores nulos (ej: si un Admin no tiene legajo), pero si se ingresa, debe ser único
    trim: true
  },
  activo: {
    type: Boolean,
    default: true,
    index: true
  },
  rol: {
    type: String,
    enum: {
      values: ['DOCENTE', 'PERSONAL', 'ADMIN'],
      message: '{VALUE} no es un rol válido'
    },
    required: [true, 'El rol es obligatorio']
  },
  estado: {
    type: String,
    enum: ['ACTIVO', 'PENDIENTE', 'SUSPENDIDO'],
    default: 'PENDIENTE' // Asume el modelo de "Registro con aprobación pendiente"
  }
}, {
  timestamps: true, // Genera automáticamente los campos createdAt y updatedAt
  versionKey: false // Evita que MongoDB agregue el campo interno __v
});

usuarioSchema.pre('save', async function() {

  // Evita re-hashear si no cambió
  if (!this.isModified('password')) {
    return;
  }

  // Hash
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

// Método para limpiar la respuesta: evita que la contraseña viaje al frontend
usuarioSchema.methods.toJSON = function() {
  const { password, ...usuario } = this.toObject();
  return usuario;
};

const Usuario = mongoose.model('Usuario', usuarioSchema);

module.exports = Usuario;