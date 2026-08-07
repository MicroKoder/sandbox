/**
 * Balance probe. Plays a mission with the scripted player from `harness.ts` and
 * prints a day-by-day trace: cash, ratings, the four profit streams and how the
 * day's visitors felt. Handy for checking a change to the simulation without
 * clicking through the game.
 *
 *   node --experimental-strip-types test/probe.ts [mission 0-9] [days] [markup]
 */
import { PIZZAS } from '../src/data/content.ts';
import { tick } from '../src/game/sim.ts';
import { hiredOf, ownedRecipes, scaleOf } from '../src/game/state.ts';
import { bootstrap, manage } from './harness.ts';

const MOOD_LABELS = ['рад', 'дорого', 'выбор', 'нетТовара', 'пьян', 'отравлен', 'испуган', 'неОбслужен'];

const mission = Number(process.argv[2] ?? 0);
const days = Number(process.argv[3] ?? 6);
const markup = Number(process.argv[4] ?? 1.8);

const ctx = bootstrap({ mission, markup });
const s = ctx.state;

console.log(`МИССИЯ ${mission + 1}  наценка x${markup}`);
console.log(
  'после подготовки: деньги=%d рейтинг=%d активы=%d множитель=%d рецепты=%s',
  s.money,
  s.rating,
  s.assets,
  scaleOf(s),
  ownedRecipes(s)
    .map((r) => PIZZAS[r].name)
    .join(','),
);
console.log(
  'персонал: повара=%d официанты=%d водители=%d уборщики=%d охрана=%d',
  hiredOf(s, 0).length,
  hiredOf(s, 1).length,
  hiredOf(s, 2).length,
  hiredOf(s, 3).length,
  hiredOf(s, 4).length,
);

for (let day = 0; day < days && !s.ending; day++) {
  const startDay = s.day;
  let guard = 0;

  // The per-day counters reset at midnight, so keep the last non-zero snapshot.
  let sold = 0;
  let profits = { ...s.profits };
  let moods = [...s.moods];

  while (s.day === startDay && !s.ending && guard++ < 40000) {
    tick(ctx);
    if (s.tick % 1200 === 0) manage(s, markup);
    if (s.soldToday > 0) sold = s.soldToday;
    if (s.profits.pizza + s.profits.product > 0) profits = { ...s.profits };
    if (s.moods.some((m) => m > 0)) moods = [...s.moods];
  }

  console.log(
    'день %d: деньги=%s рейтинг=%s соперники=%s | продано=%d пицца=%d товары=%d автоматы=%d доставка=%d | множитель=%d мусор=%d',
    startDay + 1,
    s.money.toLocaleString('ru'),
    (s.rating / 1000).toFixed(1),
    s.rivalRating.map((r) => (r / 1000).toFixed(1)).join('/'),
    sold,
    profits.pizza,
    profits.product,
    profits.machine,
    profits.delivery,
    scaleOf(s),
    s.litter.length,
  );
  console.log('   настроения: %s', MOOD_LABELS.map((label, i) => `${label}=${moods[i]}`).join(' '));
  manage(s, markup);
}

console.log('итог: %s, день %d, деньги %d, рейтинг %d', s.ending ?? 'идёт', s.day, s.money, s.rating);
