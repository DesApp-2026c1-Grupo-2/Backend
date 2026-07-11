import { describe, it, expect } from 'vitest';
import { calcularRango } from '../../../services/estadisticasEquipo.js';

// Nota: calcularRango trabaja en la zona horaria local del servidor.
// Se construyen las fechas con el constructor local (new Date(y, m, d)) para
// que las aserciones sean estables independientemente del huso.

describe('calcularRango', () => {
  describe('periodo "dia"', () => {
    it('abarca desde las 00:00 hasta las 00:00 del día siguiente', () => {
      const fecha = new Date(2026, 6, 5, 14, 30); // 5-jul-2026 14:30 local
      const { desde, hasta } = calcularRango('dia', fecha);

      expect(desde).toEqual(new Date(2026, 6, 5, 0, 0, 0, 0));
      expect(hasta).toEqual(new Date(2026, 6, 6, 0, 0, 0, 0));
    });
  });

  describe('periodo "semana" (ISO, lunes a lunes)', () => {
    it('un domingo cae en la semana que empieza el lunes anterior', () => {
      // 5-jul-2026 es domingo.
      const domingo = new Date(2026, 6, 5, 10, 0);
      const { desde, hasta } = calcularRango('semana', domingo);

      expect(desde).toEqual(new Date(2026, 5, 29, 0, 0, 0, 0)); // lunes 29-jun
      expect(hasta).toEqual(new Date(2026, 6, 6, 0, 0, 0, 0)); // lunes 6-jul
    });

    it('un lunes es el inicio de su propia semana', () => {
      // 6-jul-2026 es lunes.
      const lunes = new Date(2026, 6, 6, 23, 59);
      const { desde, hasta } = calcularRango('semana', lunes);

      expect(desde).toEqual(new Date(2026, 6, 6, 0, 0, 0, 0));
      expect(hasta).toEqual(new Date(2026, 6, 13, 0, 0, 0, 0));
    });
  });

  describe('periodo "mes"', () => {
    it('abarca desde el día 1 hasta el día 1 del mes siguiente', () => {
      const fecha = new Date(2026, 6, 15, 12, 0); // 15-jul-2026
      const { desde, hasta } = calcularRango('mes', fecha);

      expect(desde).toEqual(new Date(2026, 6, 1, 0, 0, 0, 0));
      expect(hasta).toEqual(new Date(2026, 7, 1, 0, 0, 0, 0));
    });

    it('cruza correctamente el fin de año (diciembre → enero)', () => {
      const fecha = new Date(2026, 11, 20); // 20-dic-2026
      const { desde, hasta } = calcularRango('mes', fecha);

      expect(desde).toEqual(new Date(2026, 11, 1, 0, 0, 0, 0));
      expect(hasta).toEqual(new Date(2027, 0, 1, 0, 0, 0, 0));
    });
  });

  it('lanza error ante un período inválido', () => {
    expect(() => calcularRango('trimestre', new Date())).toThrow(/Período inválido/);
  });

  it('lanza error ante una fecha inválida', () => {
    expect(() => calcularRango('dia', new Date('no-es-fecha'))).toThrow(/inválida/);
  });
});
