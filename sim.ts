import { ORDERS_PER_STAFF } from './dataset';

export const TABLES = 14;
export const WAGE_SAR_PER_HOUR = 25;

/** Simple, transparent queue model used everywhere the restaurant is shown. */
export function simulate(orders: number, staff: number) {
  const capacity = Math.max(1, staff * ORDERS_PER_STAFF);
  const load = orders / capacity;
  const seatedNeeded = (orders * 0.6) / 2.6;
  const occupied = Math.min(TABLES, Math.round(seatedNeeded));
  const queue = Math.min(22, Math.round(Math.max(0, orders - capacity) * 0.7 + Math.max(0, seatedNeeded - TABLES) * 0.6));
  const rawWait = Math.round(6 + 6 * Math.min(load, 1) + Math.max(0, load - 1) * 45);
  const wait = Math.min(75, rawWait);
  const waitLabel = rawWait > 75 ? '‎75+ د' : `${wait} د`;
  const upset = load > 1 ? Math.round((orders - capacity) * 0.9) : 0;
  const mood = load < 0.8 ? '😊' : load < 1 ? '🙂' : load < 1.3 ? '😐' : load < 1.7 ? '😠' : '😡';
  const stars = load <= 1 ? 5 : load < 1.3 ? 4 : load < 1.7 ? 3 : load < 2.2 ? 2 : 1;
  return { capacity, load, occupied, queue, wait, waitLabel, upset, mood, stars };
}

/** Arabic count phrase for upset customers ("4 عملاء زعلانين", "14 عميل زعلان") */
export function upsetAr(n: number): string {
  if (n === 0) return 'ولا عميل زعلان';
  if (n === 1) return 'عميل زعلان واحد';
  if (n === 2) return 'عميلين زعلانين';
  if (n <= 10) return `${n} عملاء زعلانين`;
  return `${n} عميل زعلان`;
}

/** Arabic count phrase for staff ("7 موظفين", "11 موظف") */
export function staffAr(n: number): string {
  if (n === 1) return 'موظف واحد';
  if (n === 2) return 'موظفَين';
  if (n >= 3 && n <= 10) return `${n} موظفين`;
  return `${n} موظف`;
}
