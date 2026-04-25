const mongoose = require("mongoose");

const edificioSchema = new mongoose.Schema(
  {
    nombre: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 100,
    },

    direccion: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },

    cantidadAulas: {
      type: Number,
      required: true,
      min: 0,
    },
  },
  {
    timestamps: true,
    strict: true,

    toJSON: {
      virtuals: true,
      transform: (_, ret) => {
        ret.id = ret._id;
        delete ret._id;
        delete ret.__v;
      },
    },
  }
);

/**
 * 🔹 Virtual (relación inversa)
 */
edificioSchema.virtual("laboratorios", {
  ref: "Laboratorio",
  localField: "_id",
  foreignField: "edificioId",
});

const Edificio = mongoose.model("Edificio", edificioSchema);

module.exports = Edificio;