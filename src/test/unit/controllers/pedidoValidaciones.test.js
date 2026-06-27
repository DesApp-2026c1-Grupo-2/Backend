import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { validarAnticipacionPedido } from '../../../services/pedidoValidaciones.js';

describe('validarAnticipacionPedido', () => {
  let now;

  beforeEach(() => {
    // Activamos los timers falsos de Vitest
    vi.useFakeTimers();
    
    // Fijamos una fecha y hora estática en el sistema: 10 de junio de 2026 a las 12:00:00 UTC
    now = new Date('2026-06-10T12:00:00.000Z');
    vi.setSystemTime(now);
    
    // Limpiamos la variable de entorno para probar el comportamiento por defecto primero
    delete process.env.MIN_HORAS_ANTICIPACION_PEDIDO;
  });

  afterEach(() => {
    // Restauramos el reloj real después de cada prueba
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('debe retornar false si la fecha es en el pasado', () => {
    // Restamos 1 segundo a la hora actual
    const pastDate = new Date(now.getTime() - 1000);
    expect(validarAnticipacionPedido(pastDate)).toBe(false);
  });

  it('debe retornar false si es el mismo día y faltan menos de 2 horas (por defecto)', () => {
    // Sumamos 1 hora y 59 minutos
    const closeDate = new Date(now.getTime() + (1 * 60 * 60 * 1000) + (59 * 60 * 1000));
    expect(validarAnticipacionPedido(closeDate)).toBe(false);
  });

  it('debe retornar true si es el mismo día y faltan exactamente 2 horas o más', () => {
    // Exactamente 2 horas
    const exactDate = new Date(now.getTime() + (2 * 60 * 60 * 1000));
    expect(validarAnticipacionPedido(exactDate)).toBe(true);
    
    // 3 horas
    const moreDate = new Date(now.getTime() + (3 * 60 * 60 * 1000));
    expect(validarAnticipacionPedido(moreDate)).toBe(true);
  });

  it('debe retornar true si el pedido es para un día futuro', () => {
    // Al día siguiente a las 8 AM local (garantiza que cambian los constructores .getDate())
    const futureDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 8, 0, 0);
    expect(validarAnticipacionPedido(futureDate)).toBe(true);
  });

  it('debe respetar el valor configurado en process.env.MIN_HORAS_ANTICIPACION_PEDIDO', () => {
    // Modificamos la configuración a 4 horas de mínimo
    process.env.MIN_HORAS_ANTICIPACION_PEDIDO = '4';
    
    // 3 horas en el futuro ahora debería ser inválido
    const invalidDate = new Date(now.getTime() + (3 * 60 * 60 * 1000));
    expect(validarAnticipacionPedido(invalidDate)).toBe(false);
    
    // 4 horas en el futuro sigue siendo válido
    const validDate = new Date(now.getTime() + (4 * 60 * 60 * 1000));
    expect(validarAnticipacionPedido(validDate)).toBe(true);
  });
});