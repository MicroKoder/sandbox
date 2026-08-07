/** Ad-hoc balance probe: prints a day-by-day trace of a bootstrapped mission. */
import { bootstrap, manage } from './harness.ts';
import { PIZZAS } from '../src/data/content.ts';
import { tick } from '../src/game/sim.ts';
import { hiredOf, scaleOf, ownedRecipes } from '../src/game/state.ts';

const MOOD_LABELS = ['рад', 'дорого', 'выбор', 'нетТовара', 'пьян', 'отравлен', 'испуган', 'неОбслужен'];

const mission = Number(process.argv[2] ?? 0);
const days = Number(process.argv[3] ?? 6);
const markup = Number(process.argv[4] ?? 1.8);

const ctx = bootstrap({ mission, markup });
const s = ctx.state;

console.log(`МИССИЯ ${mission + 1}  markup=x${markup}`);
console.log(
  'после подготовки: money=%d rating=%d assets=%d scale=%d recipes=%s',
  s.money,
  s.rating,
  s.assets,
  scaleOf(s),
  ownedRecipes(s).map((r) => PIZZAS[r].name).join(','),
);
console.log(
  'персонал: повара=%d официанты=%d водители=%d уборщики=%d',
  hiredOf(s, 0).length,
  hiredOf(s, 1).length,
  hiredOf(s, 2).length,
  hiredOf(s, 3).length,
);

for (let d = 0; d < days && !s.ending; d++) {
  const startDay = s.day;
  let served = 0;
  let guard = 0;
  let profits = { ...s.profits };
  let moods = [...s.moods];
  while (s.day === startDay && !s.ending && guard++ < 20000) {
    tick(ctx);
    if (s.tick % 1200 === 0) manage(s, markup);
    if (s.soldToday > 0) served = s.soldToday;
    if (s.profits.pizza + s.profits.product > 0) profits = { ...s.profits };
    if (s.moods.some((m) => m > 0)) moods = [...s.moods];
  }
  console.log(
    'день %d: money=%s rating=%s соперники=%s пицц=%d пицца=%d товары=%d автоматы=%d доставка=%d масштаб=%d мусор=%d',
    startDay + 1,
    s.money.toLocaleString('ru'),
    (s.rating / 1000).toFixed(1),
    s.rivalRating.map((r) => (r / 1000).toFixed(1)).join('/'),
    served,
    profits.pizza,
    profits.product,
    profits.machine,
    profits.delivery,
    scaleOf(s),
    s.litter.length,
  );
  console.log('   настроения: %s', MOOD_LABELS.map((l, i) => `${l}=${moods[i]}`).join(' '));
  manage(s, markup);
}

console.log('итог: ending=%s day=%d money=%d rating=%d', s.ending, s.day, s.money, s.rating);
