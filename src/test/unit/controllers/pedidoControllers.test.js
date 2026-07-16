import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mocks para modelos y dependencias ANTES de las importaciones
vi.mock('../../../models/pedido.model.js');
vi.mock('../../../models/reserva.model.js');
vi.mock('../../../models/lote.model.js');
vi.mock('../../../models/item.model.js');
vi.mock('../../../models/laboratorio.model.js');
vi.mock('../../../models/equipo.model.js');
vi.mock('../../../models/descarte.model.js');
vi.mock('../../../services/pedidoConflictos.js');
vi.mock('../../../services/pedidoValidaciones.js');
vi.mock('../../../services/descarte.service.js');

// Finalización de pedido: forzamos el camino degradado (sin transacción) para no
// depender de mongoose, preservando el resto de exports (aprobarConReserva, etc.,
// que usa aprobarPedidoService).
vi.mock('../../../services/aprobacionReserva.js', async (importOriginal) => ({
  ...(await importOriginal()),
  soportaTransacciones: vi.fn().mockResolvedValue(false),
}));

// Devolución de stock: aislamos el servicio compartido; su lógica fina se prueba
// en devolucionReserva.test.js. Solo verificamos la delegación desde el pedido.
vi.mock('../../../services/devolucionReserva.js', async (importOriginal) => ({
  ...(await importOriginal()),
  aplicarDevolucionesFinalizacion: vi.fn(),
}));

import Pedido from '../../../models/pedido.model.js';
import Reserva from '../../../models/reserva.model.js';
import Lote from '../../../models/lote.model.js';
import Item from '../../../models/item.model.js';
import Laboratorio from '../../../models/laboratorio.model.js';
import Equipo from '../../../models/equipo.model.js';
import Descarte from '../../../models/descarte.model.js';
import { verificarConflictos } from '../../../services/pedidoConflictos.js';
import { validarAnticipacionPedido } from '../../../services/pedidoValidaciones.js';
import { registrarDescarteService } from '../../../services/descarte.service.js';
import { aplicarDevolucionesFinalizacion } from '../../../services/devolucionReserva.js';
import {
  getPedidos,
  getPedidoById,
  createPedido,
  updatePedido,
  updateEstado,
  aprobarPedido,
  finalizarPedido,
  borrarPedidoLogico
} from '../../../controllers/pedidoControllers.js';

// =========================================
// HELPERS
// =========================================
const mockReq = (overrides = {}) => ({
  params: {}, 
  body: {}, 
  usuario: { id: 'admin_1', rol: 'ADMIN' }, 
  ...overrides
});

const mockRes = () => {
  const res = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
};

const createQueryMock = (resolvedValue) => {
  const mockInstance = resolvedValue ? {
    ...resolvedValue,
    save: vi.fn().mockResolvedValue(resolvedValue),
    populate: vi.fn().mockResolvedValue(resolvedValue),
    toObject: () => resolvedValue,
  } : null;

  const query = Promise.resolve(mockInstance);
  query.populate = vi.fn().mockReturnValue(query);
  query.sort = vi.fn().mockReturnValue(query);
  return query;
};

// =========================================
// TESTS
// =========================================
describe('pedidoControllers', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Mocks estáticos de Pedido
    Pedido.find = vi.fn();
    Pedido.findOne = vi.fn();
    Pedido.findById = vi.fn();
    Pedido.findByIdAndUpdate = vi.fn();
    
    // Mocks de constructores e instancias.
    // La instancia se auto-referencia en save/populate (devuelven el mismo objeto,
    // como Mongoose) e incluye historial:[] para que registrarHistorial funcione.
    const PedidoMock = function(data) {
      const instance = { historial: [], ...data };
      instance.save = vi.fn().mockResolvedValue(instance);
      instance.populate = vi.fn().mockResolvedValue(instance);
      return instance;
    };
    Pedido.mockImplementation(PedidoMock);

    Reserva.findOneAndUpdate = vi.fn();
    const ReservaMock = function(data) { return { ...data, save: vi.fn().mockResolvedValue(this) }; };
    Reserva.mockImplementation(ReservaMock);

    // Prevención de llamadas a DB de otros modelos
    Lote.find = vi.fn().mockReturnValue(createQueryMock([]));
    Lote.findByIdAndUpdate = vi.fn().mockResolvedValue({});
    Item.findById = vi.fn().mockResolvedValue(null);
    Laboratorio.findById = vi.fn().mockReturnValue(createQueryMock(null));
    Equipo.findById = vi.fn().mockReturnValue(createQueryMock(null));
    Equipo.findByIdAndUpdate = vi.fn().mockResolvedValue({});
    Descarte.find = vi.fn().mockResolvedValue([]);

    verificarConflictos.mockResolvedValue([]);
    validarAnticipacionPedido.mockReturnValue(true);
    registrarDescarteService.mockResolvedValue({});
  });

  describe('getPedidos', () => {
    it('debe filtrar los pedidos por docente si el rol es DOCENTE', async () => {
      const req = mockReq({ usuario: { id: 'docente_1', rol: 'DOCENTE' } });
      const res = mockRes();
      Pedido.find.mockReturnValue(createQueryMock([]));
      
      await getPedidos(req, res);
      
      expect(Pedido.find).toHaveBeenCalledWith({ activo: { $ne: false }, docente: 'docente_1' });
      expect(res.json).toHaveBeenCalled();
    });

    it('debe obtener todos los pedidos si el rol es ADMIN', async () => {
      const req = mockReq({ usuario: { id: 'admin_1', rol: 'ADMIN' } });
      const res = mockRes();
      Pedido.find.mockReturnValue(createQueryMock([]));

      await getPedidos(req, res);

      expect(Pedido.find).toHaveBeenCalledWith({ activo: { $ne: false } });
      expect(res.json).toHaveBeenCalled();
    });
  });

  describe('getPedidoById', () => {
    it('debe devolver 404 si el pedido no se encuentra', async () => {
      const req = mockReq({ params: { id: 'p_inexistente' } });
      const res = mockRes();
      Pedido.findById.mockReturnValue(createQueryMock(null));

      await getPedidoById(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ error: 'Pedido no encontrado' });
    });

    it('debe devolver 403 si un docente intenta ver un pedido ajeno', async () => {
      const req = mockReq({ params: { id: 'p_1' }, usuario: { id: 'docente_1', rol: 'DOCENTE' } });
      const res = mockRes();
      const mockPedido = { _id: 'p_1', docente: { _id: { toString: () => 'docente_2_distinto' } } };
      Pedido.findById.mockReturnValue(createQueryMock(mockPedido));

      await getPedidoById(req, res);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({ error: 'No autorizado' });
    });

    it('debe devolver el pedido y sus conflictos si lo encuentra', async () => {
      const req = mockReq({ params: { id: 'p_1' }, usuario: { id: 'user_1', rol: 'ADMIN' } });
      const res = mockRes();
      // El controller valida doc.docente._id vs user_1
      const mockPedido = { _id: 'p_1', docente: { _id: { toString: () => 'user_1' } } };
      Pedido.findById.mockReturnValue(createQueryMock(mockPedido));
      verificarConflictos.mockResolvedValue([{ tipo: 'test', severidad: 'baja' }]);

      await getPedidoById(req, res);

      expect(res.status).not.toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        ...mockPedido,
        conflictos: [{ tipo: 'test', severidad: 'baja' }]
      }));
    });
  });

  describe('createPedido', () => {
    it('debe crear un pedido correctamente', async () => {
      const req = mockReq({
        body: {
          // El middleware entrega fechaHora como Date; calcularVentana lo asume.
          fechaHora: new Date('2026-06-03T10:00:00Z'),
          materia: 'Química',
          duracionClase: 120,
          recursos: [{ recursoId: '1', tipoRecurso: 'Item', cantidad: 1 }]
        }
      });
      const res = mockRes();

      await createPedido(req, res);

      expect(Pedido).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalled();
    });

    it('debe retornar 400 si falta fechaHora', async () => {
      const req = mockReq({ body: { materia: 'Física' } });
      const res = mockRes();

      await createPedido(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'fechaHora es obligatorio' });
    });

    it('debe retornar 400 si la validación de anticipación falla', async () => {
      // Forzamos que la validación sea rechazada
      validarAnticipacionPedido.mockReturnValue(false);
      const req = mockReq({
        body: {
          fechaHora: '2026-06-10T12:00:00Z',
          materia: 'Física',
          duracionClase: 120,
          recursos: [{ recursoId: '1', tipoRecurso: 'Item', cantidad: 1 }]
        }
      });
      const res = mockRes();

      await createPedido(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'No se pueden crear pedidos con menos de 2 horas de anticipación el mismo día o en fechas pasadas' });
    });
  });

  describe('updatePedido', () => {
    it('debe retornar 400 si la nueva fecha en la actualización no cumple con la anticipación mínima', async () => {
      validarAnticipacionPedido.mockReturnValue(false);
      const req = mockReq({
        params: { id: 'p_1' },
        body: { fechaHora: '2026-06-10T12:00:00Z' }
      });
      const res = mockRes();
      const mockPedido = { _id: 'p_1', fechaHora: new Date(), toObject() { return this; } };
      Pedido.findById.mockResolvedValue(mockPedido);

      await updatePedido(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'No se pueden actualizar pedidos con menos de 2 horas de anticipación el mismo día o en fechas pasadas' });
    });
  });

  describe('updateEstado', () => {
    it('debe rechazar estados inválidos devolviendo 400', async () => {
      const req = mockReq({ params: { id: '1' }, body: { estado: 'EstadoInvalido' } });
      const res = mockRes();

      await updateEstado(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'Estado no válido' });
    });

    it('debe liberar stock y equipos al cancelar un pedido aceptado con reserva', async () => {
      const req = mockReq({ params: { id: 'p_1' }, body: { estado: 'Cancelado' } });
      const res = mockRes();
      const mockPedido = {
        _id: 'p_1',
        estado: 'Aceptado',
        historial: [],
        save: vi.fn().mockResolvedValue({}),
        populate: vi.fn().mockResolvedValue({}),
      };
      const mockReserva = {
        _id: 'r_1',
        estado: 'En Curso',
        materialesReservados: [{ itemId: 'item_1', lotesUsados: [{ loteId: 'l_1', cantidad: 4 }] }],
        equiposReservados: [{ equipoId: 'eq_1' }],
      };

      Pedido.findById.mockResolvedValue(mockPedido);
      Reserva.findOne.mockResolvedValue(mockReserva);
      Item.findById.mockResolvedValue({ _id: 'item_1', esConsumible: true });

      await updateEstado(req, res);

      expect(Reserva.findOneAndUpdate).toHaveBeenCalledWith(
        { pedidoId: 'p_1' },
        { estado: 'Cancelada' }
      );
      expect(Lote.findByIdAndUpdate).toHaveBeenCalled();
      expect(Equipo.findByIdAndUpdate).toHaveBeenCalledWith('eq_1', { estado: 'disponible' });
      expect(res.json).toHaveBeenCalled();
    });
  });

  describe('aprobarPedido', () => {
    it('debe retornar 400 si el pedido ya fue aceptado', async () => {
      const req = mockReq({ params: { id: 'p_1' } });
      const res = mockRes();
      Pedido.findById.mockResolvedValue({ estado: 'Aceptado' });

      await aprobarPedido(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'El pedido ya fue aceptado previamente y sus recursos ya fueron descontados.' });
    });

    it('debe retornar 400 si hay conflictos graves', async () => {
      const req = mockReq({ params: { id: 'p_1' } });
      const res = mockRes();
      const mockPedido = { _id: 'p_1', estado: 'Pendiente' };
      Pedido.findById.mockResolvedValue(mockPedido);
      verificarConflictos.mockResolvedValue([{ severidad: 'alta', mensaje: 'No hay stock' }]);

      await aprobarPedido(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'El pedido tiene conflictos' }));
    });

    it('debe aprobar el pedido, crear la reserva y devolver 200', async () => {
      const req = mockReq({ params: { id: 'p_1' } });
      const res = mockRes();
      const mockPedido = {
        _id: 'p_1',
        estado: 'Pendiente',
        historial: [],
        recursos: [],
        duracionClase: 120,
        fechaHora: new Date(),
        save: vi.fn(),
        populate: vi.fn(),
      };
      mockPedido.save.mockResolvedValue(mockPedido);
      mockPedido.populate.mockResolvedValue(mockPedido);
      Pedido.findById.mockResolvedValue(mockPedido);
      verificarConflictos.mockResolvedValue([]); // Sin conflictos
      // Nuevo flujo (docs/stock-disponibilidad-temporal.md §5): la reserva se crea
      // vía aprobarConReserva → Reserva.create([...]).
      Reserva.create.mockResolvedValue([{ _id: 'r_1' }]);

      await aprobarPedido(req, res);

      expect(mockPedido.estado).toBe('Aceptado');
      expect(mockPedido.save).toHaveBeenCalled();
      expect(Reserva.create).toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        message: expect.any(String),
        pedido: mockPedido,
      }));
    });
  });

  describe('finalizarPedido', () => {
    // La exigencia de reportar el consumo NO depende del estado de la reserva (lo
    // mueve un cron cada minuto), sino de si salió stock físico que siga sin
    // liquidar. Estos tests fijan las tres ventanas por las que pasa una reserva.
    // `validarConsumosRequeridos` corre de verdad (el mock del módulo preserva el
    // original), así que el gate se ejercita end-to-end.

    const pedidoAceptado = () => {
      const mockPedido = {
        _id: 'p_1',
        estado: 'Aceptado',
        historial: [],
        recursos: [{ tipoRecurso: 'Item', recursoId: 'item_1', cantidad: 10 }],
        detalleProblemas: [],
        save: vi.fn(),
        populate: vi.fn(),
      };
      mockPedido.save.mockResolvedValue(mockPedido);
      mockPedido.populate.mockResolvedValue(mockPedido);
      return mockPedido;
    };

    // Reserva con un consumible cuyo stock ya salió (consumoEjecutado) y sigue sin
    // liquidar: el escenario que exige el consumo reportado.
    const reservaConConsumibleSinLiquidar = (estado) => ({
      _id: 'r_1',
      pedidoId: 'p_1',
      estado,
      materialesReservados: [{
        itemId: 'item_1',
        cantidadTotal: 10,
        consumoEjecutado: true,
        liquidado: false,
        lotesUsados: [{ loteId: 'l_1', cantidad: 10 }],
      }],
      save: vi.fn().mockResolvedValue(true),
    });

    // El gate resuelve esConsumible con Item.findById(...).select(...).session(...)
    const mockItemConsumible = (esConsumible = true) => {
      Item.findById.mockReturnValue({
        select: vi.fn().mockReturnValue({
          session: vi.fn().mockResolvedValue({ esConsumible, nombre: 'Agua Destilada' }),
        }),
      });
    };

    it('debe retornar 400 si el pedido no está Aceptado', async () => {
      const req = mockReq({ params: { id: 'p_1' } });
      const res = mockRes();
      Pedido.findById.mockResolvedValue({ estado: 'Pendiente' });

      await finalizarPedido(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('ventana 1 (reserva Pendiente, sin descuento físico): finaliza sin exigir consumos', async () => {
      // Nada salió del inventario todavía, no hay nada que reportar ni que devolver.
      const req = mockReq({ params: { id: 'p_1' } });
      const res = mockRes();
      const mockPedido = pedidoAceptado();
      const reserva = {
        _id: 'r_1',
        pedidoId: 'p_1',
        estado: 'Pendiente',
        materialesReservados: [{
          itemId: 'item_1',
          consumoEjecutado: false,
          liquidado: false,
          lotesUsados: [{ loteId: 'l_1', cantidad: 10 }],
        }],
        save: vi.fn().mockResolvedValue(true),
      };
      Pedido.findById.mockResolvedValue(mockPedido);
      Reserva.findOne.mockResolvedValue(reserva);

      await finalizarPedido(req, res);

      expect(res.status).not.toHaveBeenCalledWith(400);
      expect(mockPedido.estado).toBe('Finalizado');
      expect(reserva.estado).toBe('Finalizada');
      // Sin `consumoEjecutado` el gate ni siquiera consulta el Item.
      expect(Item.findById).not.toHaveBeenCalled();
      expect(res.json).toHaveBeenCalled();
    });

    it('ventana 2 (reserva En Curso): 400 si no se reporta el consumo, sin efectos colaterales', async () => {
      const req = mockReq({
        params: { id: 'p_1' },
        body: { descartes: [{ tipo: 'material', itemId: 'item_9', cantidad: 1 }] },
      });
      const res = mockRes();
      const mockPedido = pedidoAceptado();
      Pedido.findById.mockResolvedValue(mockPedido);
      Reserva.findOne.mockResolvedValue(reservaConConsumibleSinLiquidar('En Curso'));
      mockItemConsumible();

      await finalizarPedido(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: expect.stringContaining('Agua Destilada'),
      });
      // Fail-fast: el gate corre antes de registrar descartes o tocar el pedido.
      expect(registrarDescarteService).not.toHaveBeenCalled();
      expect(aplicarDevolucionesFinalizacion).not.toHaveBeenCalled();
      expect(mockPedido.estado).toBe('Aceptado');
    });

    it('ventana 2 (reserva En Curso): con consumos reportados finaliza y delega la devolución', async () => {
      const req = mockReq({
        params: { id: 'p_1' },
        body: { consumos: [{ itemId: 'item_1', cantidadConsumida: 7 }] },
      });
      const res = mockRes();
      const mockPedido = pedidoAceptado();
      const reserva = reservaConConsumibleSinLiquidar('En Curso');
      Pedido.findById.mockResolvedValue(mockPedido);
      Reserva.findOne.mockResolvedValue(reserva);
      mockItemConsumible();

      await finalizarPedido(req, res);

      expect(mockPedido.estado).toBe('Finalizado');
      expect(aplicarDevolucionesFinalizacion).toHaveBeenCalledWith(
        reserva,
        expect.objectContaining({
          consumos: [{ itemId: 'item_1', cantidadConsumida: 7 }],
          usuarioId: 'admin_1',
        })
      );
      expect(reserva.estado).toBe('Finalizada');
      expect(reserva.save).toHaveBeenCalled();
      expect(res.json).toHaveBeenCalled();
    });

    it('ventana 3 (el cron ya la finalizó): sigue exigiendo el consumo del consumible sin liquidar', async () => {
      // Regresión: antes el claim filtraba por estado 'En Curso', así que finalizar
      // acá devolvía 200 en silencio y el sobrante nunca volvía al inventario.
      const req = mockReq({ params: { id: 'p_1' } });
      const res = mockRes();
      Pedido.findById.mockResolvedValue(pedidoAceptado());
      Reserva.findOne.mockResolvedValue(reservaConConsumibleSinLiquidar('Finalizada'));
      mockItemConsumible();

      await finalizarPedido(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: expect.stringContaining('Agua Destilada'),
      });
    });

    it('ventana 3 (el cron ya la finalizó): con consumos reportados recupera el sobrante', async () => {
      const req = mockReq({
        params: { id: 'p_1' },
        body: { consumos: [{ itemId: 'item_1', cantidadConsumida: 7 }] },
      });
      const res = mockRes();
      const mockPedido = pedidoAceptado();
      const reserva = reservaConConsumibleSinLiquidar('Finalizada');
      Pedido.findById.mockResolvedValue(mockPedido);
      Reserva.findOne.mockResolvedValue(reserva);
      mockItemConsumible();

      await finalizarPedido(req, res);

      expect(mockPedido.estado).toBe('Finalizado');
      // La liquidación corre igual sobre una reserva ya Finalizada por el cron.
      expect(aplicarDevolucionesFinalizacion).toHaveBeenCalledWith(
        reserva,
        expect.objectContaining({ consumos: [{ itemId: 'item_1', cantidadConsumida: 7 }] })
      );
      expect(reserva.save).toHaveBeenCalled();
      expect(res.json).toHaveBeenCalled();
    });

    it('no exige consumo ni devuelve si el material ya está liquidado', async () => {
      const req = mockReq({ params: { id: 'p_1' } });
      const res = mockRes();
      const mockPedido = pedidoAceptado();
      const reserva = reservaConConsumibleSinLiquidar('Finalizada');
      reserva.materialesReservados[0].liquidado = true;
      Pedido.findById.mockResolvedValue(mockPedido);
      Reserva.findOne.mockResolvedValue(reserva);

      await finalizarPedido(req, res);

      expect(res.status).not.toHaveBeenCalledWith(400);
      expect(mockPedido.estado).toBe('Finalizado');
      expect(Item.findById).not.toHaveBeenCalled();
    });

    it('no toca una reserva Cancelada (su stock ya fue repuesto)', async () => {
      const req = mockReq({ params: { id: 'p_1' } });
      const res = mockRes();
      const mockPedido = pedidoAceptado();
      const reserva = {
        _id: 'r_1',
        pedidoId: 'p_1',
        estado: 'Cancelada',
        materialesReservados: [],
        save: vi.fn().mockResolvedValue(true),
      };
      Pedido.findById.mockResolvedValue(mockPedido);
      Reserva.findOne.mockResolvedValue(reserva);

      await finalizarPedido(req, res);

      expect(mockPedido.estado).toBe('Finalizado');
      expect(reserva.estado).toBe('Cancelada'); // no se pisa
      expect(aplicarDevolucionesFinalizacion).not.toHaveBeenCalled();
      expect(reserva.save).not.toHaveBeenCalled();
    });

    it('finaliza un pedido sin reserva asociada', async () => {
      const req = mockReq({ params: { id: 'p_1' } });
      const res = mockRes();
      const mockPedido = pedidoAceptado();
      Pedido.findById.mockResolvedValue(mockPedido);
      Reserva.findOne.mockResolvedValue(null);

      await finalizarPedido(req, res);

      expect(mockPedido.estado).toBe('Finalizado');
      expect(aplicarDevolucionesFinalizacion).not.toHaveBeenCalled();
      expect(res.json).toHaveBeenCalled();
    });

    it('debe aceptar desperfectos de equipos con motivo en el payload de finalización', async () => {
      const req = mockReq({
        params: { id: 'p_1' },
        body: {
          descartes: [],
          desperfectos: [{ equipoId: 'eq_1', motivo: 'Roto por uso' }],
        },
      });
      const res = mockRes();
      const mockPedido = pedidoAceptado();
      Pedido.findById.mockResolvedValue(mockPedido);
      Reserva.findOne.mockResolvedValue(null);

      await finalizarPedido(req, res);

      expect(registrarDescarteService).toHaveBeenCalledWith(
        expect.objectContaining({ tipo: 'equipo', equipoId: 'eq_1', motivo: 'Roto por uso' }),
        expect.anything()
      );
      expect(res.json).toHaveBeenCalled();
    });
  });

  describe('borrarPedidoLogico', () => {
    it('debe marcar el pedido como inactivo', async () => {
      const req = mockReq({ params: { id: 'p_1' } });
      const res = mockRes();
      const mockPedido = { _id: 'p_1', activo: true, historial: [], save: vi.fn().mockResolvedValue(true) };
      Pedido.findById.mockResolvedValue(mockPedido);

      await borrarPedidoLogico(req, res);

      expect(mockPedido.activo).toBe(false);
      expect(mockPedido.save).toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith({ message: 'Pedido eliminado lógicamente', pedido: mockPedido });
    });

    it('debe retornar 404 si el pedido no existe', async () => {
      const req = mockReq({ params: { id: 'p_1' } });
      const res = mockRes();
      Pedido.findById.mockResolvedValue(null);

      await borrarPedidoLogico(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
    });
  });
});