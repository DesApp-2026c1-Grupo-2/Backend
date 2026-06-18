import SugerenciaRecurso from '../models/sugerenciaRecurso.model.js';
import Item from '../models/item.model.js';
import Equipo from '../models/equipo.model.js';

async function validarReferencia({ itemId, equipoId }) {
  if (itemId) {
    const item = await Item.findOne({ _id: itemId, activo: true });
    if (!item) throw new Error('Item inválido');
  }

  if (equipoId) {
    const equipo = await Equipo.findOne({ _id: equipoId, activo: true });
    if (!equipo) throw new Error('Equipo inválido');
  }
}

// GET /sugerencias
export const getSugerencias = async (req, res) => {
  try {
    const sugerencias = await SugerenciaRecurso.find({ activo: true })
      .populate('itemId', 'nombre codigo')
      .populate('equipoId', 'nombre codigo estado')
      .sort({ orden: 1, createdAt: 1 });
    res.status(200).json(sugerencias);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// POST /sugerencias
export const createSugerencia = async (req, res) => {
  try {
    await validarReferencia(req.body);

    const nuevaSugerencia = new SugerenciaRecurso(req.body);
    await nuevaSugerencia.save();
    res.status(201).json(nuevaSugerencia);
  } catch (error) {
    if (error.message === 'Item inválido' || error.message === 'Equipo inválido') {
      return res.status(404).json({ error: error.message });
    }
    if (error.code === 11000) {
      return res.status(409).json({ error: 'Ya existe una sugerencia para este recurso y tipo de actividad.' });
    }
    res.status(500).json({ error: error.message });
  }
};

// PUT /sugerencias/:id
export const updateSugerencia = async (req, res) => {
  try {
    const { id } = req.params;

    await validarReferencia(req.body);

    const sugerenciaActualizada = await SugerenciaRecurso.findByIdAndUpdate(id, req.body, { new: true, runValidators: true });
    if (!sugerenciaActualizada) {
      return res.status(404).json({ error: 'Sugerencia no encontrada' });
    }
    res.status(200).json(sugerenciaActualizada);
  } catch (error) {
    if (error.message === 'Item inválido' || error.message === 'Equipo inválido') {
      return res.status(404).json({ error: error.message });
    }
    if (error.code === 11000) {
      return res.status(409).json({ error: 'Ya existe una sugerencia para este recurso y tipo de actividad.' });
    }
    res.status(500).json({ error: error.message });
  }
};

// DELETE /sugerencias/:id
export const deleteSugerencia = async (req, res) => {
  try {
    const { id } = req.params;
    const sugerenciaEliminada = await SugerenciaRecurso.findByIdAndUpdate(id, { activo: false }, { new: true });
    if (!sugerenciaEliminada) {
      return res.status(404).json({ error: 'Sugerencia no encontrada' });
    }
    res.status(200).json({ message: 'Sugerencia eliminada lógicamente', sugerencia: sugerenciaEliminada });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};