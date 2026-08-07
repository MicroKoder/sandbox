/** Instrumented single-day trace: waiter utilisation and customer dwell times. */
import { bootstrap } from './harness.ts';
import { tick } from '../src/game/sim.ts';

const ctx = bootstrap({ mission: Number(process.argv[2] ?? 0) });
const s = ctx.state;
const w = ctx.world;

const waiterStates = new Map<string, number>();
let sampled = 0;
let seatedSum = 0;
let customersSum = 0;
let peakCustomers = 0;

const seen = new Set<number>();
let bouncedAtDoor = 0;
let seatedTotal = 0;
let timedOut = 0;
const timeoutLog: string[] = [];

const startDay = s.day;
let guard = 0;
while (s.day === startDay && !s.ending && guard++ < 40000) {
  const before = new Map(w.customers.map((c) => [c.id, c.state] as const));
  tick(ctx);
  for (const c of w.customers) {
    if (!seen.has(c.id)) {
      seen.add(c.id);
      if (c.state === 'leave') bouncedAtDoor++;
      else seatedTotal++;
    }
    if (before.get(c.id) === 'wait' && c.state === 'leave') {
      timedOut++;
      const waiter = w.staff.find((st) => st.type === 1);
      timeoutLog.push(`t=${s.tick} стол=${c.table} официант=${waiter ? waiter.state : 'нет'} сидят=${w.customers.filter((x) => x.state === 'wait').length} склад=${s.pizzaStock.join('/')}`);
    }
  }
  if (s.tick % 10 === 0) {
    sampled++;
    const waiter = w.staff.find((st) => st.type === 1);
    if (waiter) waiterStates.set(waiter.state, (waiterStates.get(waiter.state) ?? 0) + 1);
    const seated = w.customers.filter((c) => c.state === 'wait' || c.state === 'ordered').length;
    seatedSum += seated;
    customersSum += w.customers.length;
    peakCustomers = Math.max(peakCustomers, w.customers.length + w.staff.length);
  }
}

console.log('samples=%d', sampled);
console.log('состояния официанта:', [...waiterStates].map(([k, v]) => `${k}=${((v / sampled) * 100).toFixed(1)}%`).join(' '));
console.log('в среднем сидят=%s, всего гостей=%s, пик сущностей=%d', (seatedSum / sampled).toFixed(2), (customersSum / sampled).toFixed(2), peakCustomers);
console.log('настроения:', s.moods.join(','));
console.log(timeoutLog.slice(0, 12).join('\n'));
console.log('вошло=%d, отказ у двери=%d, село=%d, ушли не дождавшись=%d', seen.size, bouncedAtDoor, seatedTotal, timedOut);
