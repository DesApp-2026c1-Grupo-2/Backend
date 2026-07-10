import {
  getPedidosService,
  getPedidoByIdService,
  createPedidoService,
  updatePedidoService,
  aprobarPedidoService,
  finalizarPedidoService,
  updateEstadoService,
  borrarPedidoLogicoService,
  agregarComentarioService,
  marcarComentariosVistosService,
  updateChecklistService,
} from "../services/pedido.service.js";

const getPedidos = async (req, res) => {
  try {
    const pedidos = await getPedidosService(req.usuario);
    res.json(pedidos);
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message });
  }
};

const getPedidoById = async (req, res) => {
  try {
    const pedido = await getPedidoByIdService(req.params.id, req.usuario);
    res.json(pedido);
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message });
  }
};

const createPedido = async (req, res) => {
  try {
    const nuevo = await createPedidoService(req.body, req.usuario, {
      detalleProblemas: req.detalleProblemas,
      estadoCalculado: req.estadoCalculado,
    });
    res.status(201).json(nuevo);
  } catch (error) {
    res.status(error.status || 400).json({ error: error.message });
  }
};

const updatePedido = async (req, res) => {
  try {
    const pedido = await updatePedidoService(req.params.id, req.body, req.usuario);
    res.json(pedido);
  } catch (error) {
    res.status(error.status || 400).json({ error: error.message });
  }
};

const aprobarPedido = async (req, res) => {
  try {
    const { pedido, reservaId } = await aprobarPedidoService(req.params.id, req.usuario);
    res.json({
      message: "Pedido aprobado. Reserva creada y disponibilidad confirmada.",
      pedido,
      reservaId,
    });
  } catch (error) {
    res.status(error.status || 500).json({
      error: error.message,
      ...(error.conflictos && { conflictos: error.conflictos }),
    });
  }
};

const finalizarPedido = async (req, res) => {
  try {
    const pedido = await finalizarPedidoService(req.params.id, req.body, req.usuario);
    res.json({ message: "Pedido finalizado y novedades registradas.", pedido });
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message });
  }
};

const updateEstado = async (req, res) => {
  try {
    const pedido = await updateEstadoService(req.params.id, req.body, req.usuario);
    res.json(pedido);
  } catch (error) {
    res.status(error.status || 400).json({ error: error.message });
  }
};

const borrarPedidoLogico = async (req, res) => {
  try {
    const pedido = await borrarPedidoLogicoService(req.params.id, req.usuario);
    res.json({ message: "Pedido eliminado lógicamente", pedido });
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message });
  }
};

const agregarComentario = async (req, res) => {
  try {
    const comentario = await agregarComentarioService(
      req.params.id,
      req.body.mensaje,
      req.usuario
    );
    res.status(201).json(comentario);
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message });
  }
};

const marcarComentariosVistos = async (req, res) => {
  try {
    await marcarComentariosVistosService(req.params.id, req.usuario.id);
    res.json({ ok: true });
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message });
  }
};

export const updateChecklist = async (req, res) => {
  try {
    const pedido = await updateChecklistService(req.params.id, req.body.checklist);
    res.json(pedido);
  } catch (error) {
    console.error("Error al actualizar checklist:", error);
    res.status(error.status || 500).json({ error: "Error interno al actualizar la checklist" });
  }
};

export {
  getPedidos,
  getPedidoById,
  createPedido,
  updatePedido,
  updateEstado,
  aprobarPedido,
  finalizarPedido,
  borrarPedidoLogico,
  agregarComentario,
  marcarComentariosVistos,
};
