import { describe, it, expect, vi, beforeEach } from 'vitest';
import mongoose from 'mongoose';
import { revertirDescarteService } from '../../../services/descarte.service.js';
import Descarte from '../../../models/descarte.model.js';
import Pedido from '../../../models/pedido.model.js';
import Equipo from '../../../models/equipo.model.js';

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
});