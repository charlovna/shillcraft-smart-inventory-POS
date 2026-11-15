/** Money is always whole centavos (integers), never floats. */
export function formatPesos(centavos: number): string {
  if (!Number.isInteger(centavos)) throw new Error('Money must be integer centavos');
  const sign = centavos < 0 ? '-' : '';
  const abs = Math.abs(centavos);
  const pesos = Math.floor(abs / 100).toLocaleString('en-PH');
  return `${sign}₱${pesos}.${String(abs % 100).padStart(2, '0')}`;
}
