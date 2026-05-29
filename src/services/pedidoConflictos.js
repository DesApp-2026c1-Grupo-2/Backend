const Pedido = require("../models/Pedido");
const Equipo = require("../models/Equipo");
const Lote = require("../models/Lote");

async function verificarConflictos(pedido) {
  const conflictos = [];

  for (const recurso of pedido.recursos) {

    // =========================
    // EQUIPOS
    // =========================
    if (recurso.tipoRecurso === "Equipo") {

      const disponibles = await Equipo.countDocuments({
        tipo: recurso.recursoId,
        estado: "disponible",
      });

      if (disponibles < recurso.cantidad) {
        conflictos.push(
          `Solo hay ${disponibles} equipos disponibles para ${recurso.nombre}`
        );
      }
    }

    // =========================
    // ITEMS
    // =========================
    if (recurso.tipoRecurso === "Item") {

      const stock = await Lote.calcularStockDisponible(
        recurso.recursoId
      );

      if (stock < recurso.cantidad) {
        conflictos.push(
          `Stock insuficiente para ${recurso.nombre}. Disponible: ${stock}`
        );
      }
    }
  }

  return conflictos;
}

module.exports = {
  verificarConflictos,
};