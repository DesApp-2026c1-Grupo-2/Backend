const Pedido = require("../models/pedido.model");
const Equipo = require("../models/equipo.model");
const Lote = require("../models/lote.model");

const verificarConflictos = async (pedido) => {
  const conflictos = [];

  for (const r of pedido.recursos) {

    const ref = r.modeloRef || r.tipoRecurso;

    // =========================
    // EQUIPOS
    // =========================
    if (ref === "Equipo") {

      const equipo = await Equipo.findById(r.recursoId);

      if (!equipo) {
        conflictos.push({
          tipo: "equipo_no_existente",
          severidad: "alta",
          mensaje: "El equipo solicitado no existe",
        });

        continue;
      }

      if (equipo.estado !== "disponible") {
        conflictos.push({
          tipo: "equipo_no_disponible",
          severidad: "alta",
          mensaje: `${equipo.nombre} no está disponible`,
        });
      }
    }

    // =========================
    // ITEMS
    // =========================
    if (ref === "Item") {

      const stockDisponible =
        await Lote.calcularStockDisponible(r.recursoId);

      if (stockDisponible < r.cantidad) {

        conflictos.push({
          tipo: "stock_insuficiente",
          severidad: "alta",
          mensaje:
            `Stock insuficiente para ${
              r.recursoId?.nombre || "ítem"
            }. ` +
            `Solicitado: ${r.cantidad}. ` +
            `Disponible: ${stockDisponible}.`
        });
      }
    }
  }

  return conflictos;
};

module.exports = {
  verificarConflictos,
};