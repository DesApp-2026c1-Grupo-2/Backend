import HistorialMantenimiento from "../models/historialMantenimiento.model.js";
import Equipo from "../models/equipo.model.js";
import Usuario from "../models/usuario.model.js";

export const seedHistorialMantenimiento = async () => {
  try {
    await HistorialMantenimiento.deleteMany({});

    const equipos = await Equipo.find().limit(2);
    const responsable = await Usuario.findOne({ rol: { $in: ["PERSONAL", "ADMIN"] } });

    if (equipos.length === 0) {
      console.log("⚠️ No se pudo sembrar el historial de mantenimiento: no hay equipos. Ejecuta primero los seeds de equipos.");
      return;
    }

    const ahora = Date.now();
    const dia = 24 * 60 * 60 * 1000;

    // Registros cerrados (con `fin`), coherentes con equipos que hoy están
    // disponibles. Un mantenimiento abierto tendría fin: null y el equipo en
    // estado "mantenimiento".
    const registros = [
      {
        equipoId: equipos[0]._id,
        tipo: "preventivo",
        descripcion: "Limpieza general y calibración de rutina.",
        responsableId: responsable ? responsable._id : null,
        fecha: new Date(ahora - 90 * dia),
        fin: new Date(ahora - 89 * dia),
      },
      {
        equipoId: equipos[0]._id,
        tipo: "correctivo",
        descripcion: "Reemplazo de pieza defectuosa detectada durante el uso.",
        responsableId: responsable ? responsable._id : null,
        fecha: new Date(ahora - 15 * dia),
        fin: new Date(ahora - 13 * dia),
      },
      {
        equipoId: equipos[equipos.length > 1 ? 1 : 0]._id,
        tipo: "preventivo",
        descripcion: "Revisión periódica programada.",
        responsableId: responsable ? responsable._id : null,
        fecha: new Date(ahora - 30 * dia),
        fin: new Date(ahora - 30 * dia + 3 * 60 * 60 * 1000),
      },
    ];

    await HistorialMantenimiento.insertMany(registros);
    console.log("✅ Historial de mantenimiento sembrado correctamente.");
  } catch (error) {
    console.error("❌ Error al sembrar el historial de mantenimiento:", error);
  }
};
