import { describe, it, expect, vi, beforeEach } from 'vitest';
import mongoose from 'mongoose';
import { registrarDescarteService, revertirDescarteService } from '../../../services/descarte.service.js';
import Descarte from '../../../models/descarte.model.js';
import Pedido from '../../../models/pedido.model.js';
import Equipo from '../../../models/equipo.model.js';
import Reserva from '../../../models/reserva.model.js';
import Lote from '../../../models/lote.model.js';
import Item from '../../../models/item.model.js';
import { registrarMovimiento, stockFisicoItem } from '../../../services/movimientoStock.service.js';

// 1. Mockeamos mongoose para poder simular las transacciones
vi.mock('mongoose', async () => {
  const originalMongoose = await vi.importActual('mongoose');
  return {
    ...originalMongoose,
    default: {
      ...originalMongoose.default,
      startSession: vi.fn(),
    },
  };
});

// 2. Mockeamos los modelos a utilizar
vi.mock('../../../models/descarte.model.js');
vi.mock('../../../models/pedido.model.js');
vi.mock('../../../models/equipo.model.js');
vi.mock('../../../models/reserva.model.js');
vi.mock('../../../models/lote.model.js');
vi.mock('../../../models/item.model.js');

// Mockeamos el servicio de historial: su lógica se prueba aparte; aquí solo
// verificamos que el descarte lo invoque con el movimiento correcto.
vi.mock('../../../services/movimientoStock.service.js', () => ({
  registrarMovimiento: vi.fn().mockResolvedValue({}),
  stockFisicoItem: vi.fn().mockResolvedValue(10),
}));

const createQueryMock = (resolvedValue) => ({
  session: vi.fn().mockResolvedValue(resolvedValue)
});

describe('revertirDescarteService', () => {
  let mockSession;

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Simulamos la API de la sesión de mongoose
    mockSession = {
      startTransaction: vi.fn(),
      commitTransaction: vi.fn(),
      abortTransaction: vi.fn(),
      endSession: vi.fn(),
    };
    mongoose.startSession.mockResolvedValue(mockSession);
  });

  it('debe arrojar un error y abortar la transacción si el pedido está Finalizado y el descarte es un material', async () => {
    const usuarioMock = { id: 'admin_1', rol: 'ADMIN' };
    
    // Configuramos el descarte mockeado como tipo 'material'
    const descarteMock = { _id: 'descarte_1', pedidoId: 'pedido_1', tipo: 'material' };
    Descarte.findById = vi.fn().mockReturnValue(createQueryMock(descarteMock));

    // Configuramos el pedido mockeado como 'Finalizado'
    const pedidoMock = { _id: 'pedido_1', estado: 'Finalizado', docente: { toString: () => 'docente_1' } };
    Pedido.findById = vi.fn().mockReturnValue(createQueryMock(pedidoMock));

    // Ejecutamos el servicio y esperamos que rechace la promesa con el mensaje específico
    await expect(revertirDescarteService('descarte_1', usuarioMock))
      .rejects
      .toThrow("No se puede revertir un descarte de material o reactivo si el pedido ya fue finalizado.");

    // Verificamos que se haya hecho rollback correctamente a la base de datos
    expect(mockSession.abortTransaction).toHaveBeenCalled();
    expect(mockSession.commitTransaction).not.toHaveBeenCalled();
    expect(mockSession.endSession).toHaveBeenCalled();
  });

  it('debe revertir el descarte de un equipo y cambiar su estado a "disponible"', async () => {
    const usuarioMock = { id: 'admin_1', rol: 'ADMIN' };
    
    // Simulamos un descarte de tipo 'equipo'
    const descarteMock = { 
      _id: 'descarte_2', 
      pedidoId: 'pedido_2', 
      tipo: 'equipo', 
      equipoId: 'equipo_1',
      deleteOne: vi.fn().mockResolvedValue(true)
    };
    Descarte.findById = vi.fn().mockReturnValue(createQueryMock(descarteMock));

    // El pedido puede estar 'Finalizado' y aún así debe permitir revertir si es un equipo
    const pedidoMock = { _id: 'pedido_2', estado: 'Finalizado', docente: { toString: () => 'docente_1' } };
    Pedido.findById = vi.fn().mockReturnValue(createQueryMock(pedidoMock));

    // Simulamos que el equipo está fuera de servicio
    const equipoMock = { _id: 'equipo_1', estado: 'fuera de servicio', save: vi.fn().mockResolvedValue(true) };
    Equipo.findById = vi.fn().mockReturnValue(createQueryMock(equipoMock));

    await revertirDescarteService('descarte_2', usuarioMock);

    // Verificamos el flujo de éxito
    expect(equipoMock.estado).toBe('disponible');
    expect(equipoMock.save).toHaveBeenCalledWith({ session: mockSession });
    expect(descarteMock.deleteOne).toHaveBeenCalledWith({ session: mockSession });
    expect(mockSession.commitTransaction).toHaveBeenCalled();
    expect(mockSession.endSession).toHaveBeenCalled();
  });

  it('al revertir un descarte de material reutilizable, repone el stock del lote', async () => {
    const usuarioMock = { id: 'admin_1', rol: 'ADMIN' };

    const descarteMock = {
      _id: 'descarte_3',
      pedidoId: 'pedido_3',
      tipo: 'material',
      itemId: 'item_1',
      lotesAfectados: [{ loteId: 'lote_1', cantidad: 2 }],
      deleteOne: vi.fn().mockResolvedValue(true),
    };
    Descarte.findById = vi.fn().mockReturnValue(createQueryMock(descarteMock));

    const pedidoMock = { _id: 'pedido_3', estado: 'Aceptado', docente: { toString: () => 'docente_1' } };
    Pedido.findById = vi.fn().mockReturnValue(createQueryMock(pedidoMock));

    // Ítem reutilizable → hubo decremento al descartar, así que debe reponerse.
    Item.findById = vi.fn().mockReturnValue(createQueryMock({ _id: 'item_1', esConsumible: false }));
    Lote.updateOne = vi.fn().mockResolvedValue({ matchedCount: 1 });

    await revertirDescarteService('descarte_3', usuarioMock);

    expect(Lote.updateOne).toHaveBeenCalledWith(
      { _id: 'lote_1' },
      { $inc: { cantidadDisponible: 2 } },
      { session: mockSession }
    );
    expect(descarteMock.deleteOne).toHaveBeenCalledWith({ session: mockSession });
    expect(mockSession.commitTransaction).toHaveBeenCalled();
  });

  it('al revertir un descarte de material consumible, NO repone stock', async () => {
    const usuarioMock = { id: 'admin_1', rol: 'ADMIN' };

    const descarteMock = {
      _id: 'descarte_4',
      pedidoId: 'pedido_4',
      tipo: 'reactivo',
      itemId: 'item_2',
      lotesAfectados: [{ loteId: 'lote_2', cantidad: 3 }],
      deleteOne: vi.fn().mockResolvedValue(true),
    };
    Descarte.findById = vi.fn().mockReturnValue(createQueryMock(descarteMock));

    const pedidoMock = { _id: 'pedido_4', estado: 'Aceptado', docente: { toString: () => 'docente_1' } };
    Pedido.findById = vi.fn().mockReturnValue(createQueryMock(pedidoMock));

    Item.findById = vi.fn().mockReturnValue(createQueryMock({ _id: 'item_2', esConsumible: true }));
    Lote.updateOne = vi.fn();

    await revertirDescarteService('descarte_4', usuarioMock);

    expect(Lote.updateOne).not.toHaveBeenCalled();
    expect(descarteMock.deleteOne).toHaveBeenCalledWith({ session: mockSession });
    expect(mockSession.commitTransaction).toHaveBeenCalled();
  });
});

describe('registrarDescarteService', () => {
  let mockSession;

  beforeEach(() => {
    vi.clearAllMocks();

    mockSession = {
      startTransaction: vi.fn(),
      commitTransaction: vi.fn(),
      abortTransaction: vi.fn(),
      endSession: vi.fn(),
    };
    mongoose.startSession.mockResolvedValue(mockSession);

    // Constructor de Descarte: instancia con .save() resuelto.
    Descarte.mockImplementation(function (data) {
      return { ...data, save: vi.fn().mockResolvedValue(true) };
    });
  });

  const baseReserva = () => ({
    _id: 'reserva_1',
    materialesReservados: [
      {
        itemId: 'item_1',
        cantidadTotal: 5,
        lotesUsados: [{ loteId: 'lote_1', cantidad: 5 }],
      },
    ],
  });

  const setupComun = ({ esConsumible, previos = [], updateResult = { matchedCount: 1 } }) => {
    Pedido.findById = vi.fn().mockReturnValue(
      createQueryMock({ _id: 'pedido_1', docente: { toString: () => 'docente_1' } })
    );
    Reserva.findOne = vi.fn().mockReturnValue(createQueryMock(baseReserva()));
    Item.findById = vi.fn().mockReturnValue(createQueryMock({ _id: 'item_1', esConsumible }));
    Descarte.find = vi.fn().mockReturnValue(createQueryMock(previos));
    Lote.updateOne = vi.fn().mockResolvedValue(updateResult);
  };

  it('reutilizable: decrementa cantidadDisponible del lote con guarda $gte y confirma', async () => {
    setupComun({ esConsumible: false });
    const usuario = { id: 'admin_1', rol: 'ADMIN' };
    const data = { pedidoId: 'pedido_1', tipo: 'material', itemId: 'item_1', cantidad: 2, motivo: 'roto' };

    await registrarDescarteService(data, usuario);

    expect(Lote.updateOne).toHaveBeenCalledWith(
      { _id: 'lote_1', cantidadDisponible: { $gte: 2 } },
      { $inc: { cantidadDisponible: -2 } },
      { session: mockSession }
    );
    // Registra un movimiento DESCARTE con el delta físico signado.
    expect(registrarMovimiento).toHaveBeenCalledWith(
      expect.objectContaining({
        itemId: 'item_1',
        tipoMovimiento: 'DESCARTE',
        cantidad: -2,
        cantidadAnterior: 10,
        cantidadNueva: 8,
      }),
      mockSession
    );
    expect(mockSession.commitTransaction).toHaveBeenCalled();
    expect(mockSession.abortTransaction).not.toHaveBeenCalled();
  });

  it('consumible: rechaza el descarte y aborta (se reporta por consumo, no por descarte)', async () => {
    setupComun({ esConsumible: true });
    const usuario = { id: 'admin_1', rol: 'ADMIN' };
    const data = { pedidoId: 'pedido_1', tipo: 'reactivo', itemId: 'item_1', cantidad: 2, motivo: 'derrame' };

    await expect(registrarDescarteService(data, usuario))
      .rejects
      .toThrow('Solo se pueden registrar descartes de ítems reutilizables. Los consumibles se reportan mediante su consumo al finalizar el pedido.');

    expect(Lote.updateOne).not.toHaveBeenCalled();
    expect(registrarMovimiento).not.toHaveBeenCalled();
    expect(mockSession.abortTransaction).toHaveBeenCalled();
    expect(mockSession.commitTransaction).not.toHaveBeenCalled();
  });

  it('reutilizable con stock físico insuficiente (matchedCount 0): lanza error y aborta', async () => {
    setupComun({ esConsumible: false, updateResult: { matchedCount: 0 } });
    const usuario = { id: 'admin_1', rol: 'ADMIN' };
    const data = { pedidoId: 'pedido_1', tipo: 'material', itemId: 'item_1', cantidad: 2, motivo: 'roto' };

    await expect(registrarDescarteService(data, usuario))
      .rejects
      .toThrow('Stock físico insuficiente en el lote para registrar el descarte.');

    expect(mockSession.abortTransaction).toHaveBeenCalled();
    expect(mockSession.commitTransaction).not.toHaveBeenCalled();
  });
});