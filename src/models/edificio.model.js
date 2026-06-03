import mongoose from "mongoose";

const edificioSchema = new mongoose.Schema(
  {
    nombre: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 100,
    },
    estado: {
      type: Boolean,
      default: true,
    },
    direccion: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
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
 * Virtual para contar laboratorios
 */
edificioSchema.virtual("cantidadLaboratorios", {
  ref: "Laboratorio",
  localField: "_id",
  foreignField: "edificioId",
  count: true,
});

const Edificio = mongoose.model("Edificio", edificioSchema);

export default Edificio;