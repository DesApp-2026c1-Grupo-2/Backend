const Pedido = require("../models/pedido.model");

const getPedidos = async (req, res) => {
  try {
    const pedidos = await Pedido.find();
    res.json(pedidos);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const createPedido = async (req, res) => {
  try {
    const pedido = new Pedido({
      ...req.body,
      estado: req.estadoCalculado,
      problemas: 0,
      detalleProblemas: [],
    });

    const nuevo = await pedido.save();
    res.status(201).json(nuevo);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};
const updatePedido = async (req, res) => {
  try {
    const { id } = req.params;
    const actualizado = await Pedido.findByIdAndUpdate(
      id,
      {
        ...req.body,
        estado: req.estadoCalculado,
        problemas: 0,
        detalleProblemas: [],
      },
      { new: true }
    );

    if (!actualizado) {
      return res.status(404).json({ error: "Pedido no encontrado" });
    }

    res.json(actualizado);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};
const updateEstado = async (req, res) => {
  try {
    const { id } = req.params;
    const { estado } = req.body;

    if (!["Pendiente", "En Revisión", "Aceptado", "Rechazado"].includes(estado)) {
      return res.status(400).json({ error: "Estado no válido" });
    }

    const pedido = await Pedido.findByIdAndUpdate(
      id,
      { estado },
      { new: true }
    );

    res.json(pedido);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};
const borrarPedido = async (req, res) => {
  try {
    const { id } = req.params;
    await Pedido.findByIdAndDelete(id);
    res.json({ message: "Pedido eliminado" });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};
module.exports = {
  getPedidos,
  createPedido,
  updatePedido,
  updateEstado,
  borrarPedido,
};