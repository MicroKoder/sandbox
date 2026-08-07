/**
 * The ten missions, transcribed from `var_int_arr_arr_a` (C.java:7545).
 *
 * Each row of the original table held twenty ints; the column meanings were
 * recovered by tracing every read of the array:
 *
 *   0  starting money                    10,11 map position of rival #1
 *   1  starting player rating (x1000)    12,13 map position of rival #2
 *   2  day limit / "survive N days"      14    rival #1 building sprite
 *   3  starting rating of rival #1       15    rival #2 building sprite
 *   4  rival #1 strength                 16    money goal
 *   5  starting rating of rival #2       17    rating goal (x1000)
 *   6  rival #2 strength                 18    starting asset value M
 *   7  100 - base tax percentage         19    goal type: 0 = earn, 1 = survive
 *   8,9 map position of the player
 */

export interface Mission {
  index: number;
  name: string;
  /** Briefing text, aaa.str[40 + index]. */
  brief: string;
  money: number;
  rating: number;
  days: number;
  rival1Rating: number;
  rival1Strength: number;
  rival2Rating: number;
  rival2Strength: number;
  /** 100 minus the base tax percentage. */
  netPct: number;
  pos: [number, number];
  rival1Pos: [number, number];
  rival2Pos: [number, number];
  rival1House: number;
  rival2House: number;
  goalMoney: number;
  goalRating: number;
  assets: number;
  /** 0 = reach the money and rating goals; 1 = hold the rating for N days. */
  goalType: 0 | 1;
  /** Recipe indices this mission puts on the market. */
  recipes: number[];
  /** Product indices this mission puts on the market. */
  products: number[];
  /** Advertising campaign indices available; the original uses `9 - mission`. */
  ads: number[];
}

const RAW: number[][] = [
  [65000, 85000, 6, 15000, 0, 0, 0, 99, 10, 60, 80, 50, 110, 60, 1, 2, 70000, 100000, 20000, 0],
  [80000, 50000, 6, 50000, 2, 0, 0, 97, 70, 150, 20, 100, 80, 90, 2, 3, 90000, 80000, 30000, 0],
  [100000, 40000, 5, 60000, 3, 0, 0, 95, 110, 100, 25, 90, 60, 30, 1, 3, 150000, 100000, 30000, 0],
  [110000, 50000, 4, 30000, 5, 20000, 4, 80, 37, 62, 60, 170, 135, 100, 2, 4, 10000, 50000, 0, 1],
  [120000, 45000, 7, 30000, 3, 35000, 3, 93, 90, 140, 60, 100, 140, 90, 1, 2, 300000, 100000, 40000, 0],
  [150000, 30000, 7, 35000, 5, 35000, 6, 90, 75, 90, 30, 60, 100, 185, 1, 4, 500000, 100000, 50000, 0],
  [160000, 40000, 4, 20000, 11, 40000, 10, 80, 110, 180, 25, 100, 60, 155, 1, 3, 10000, 50000, 0, 1],
  [180000, 40000, 8, 30000, 6, 30000, 5, 87, 50, 120, 20, 50, 80, 90, 2, 4, 600000, 100000, 60000, 0],
  [200000, 30000, 8, 45000, 7, 25000, 6, 85, 24, 60, 60, 105, 125, 172, 2, 3, 800000, 100000, 70000, 0],
  [210000, 40000, 9, 30000, 8, 30000, 7, 80, 60, 155, 30, 50, 110, 110, 3, 4, 1000000, 100000, 80000, 0],
];

/** `var_byte_arr_arr_f` (C.java:7536) — recipes offered per mission. */
const RECIPES: number[][] = [
  [0, 1],
  [0, 1, 2],
  [1, 2, 3],
  [0, 3, 4, 5],
  [1, 4, 5, 6],
  [2, 5, 6, 7, 8],
  [1, 2, 3, 5, 7],
  [5, 6, 7, 8, 9],
  [3, 4, 5, 6, 7, 8, 9],
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
];

/** `var_byte_arr_arr_g` (C.java:7540) — products offered per mission. */
const PRODUCTS: number[][] = [
  [0, 4, 2, 7],
  [1, 6, 8, 10, 11],
  [2, 3, 6, 7, 8, 11],
  [0, 3, 4, 5, 9, 10, 11],
  [0, 1, 4, 5, 7, 10, 11],
  [0, 2, 4, 6, 7, 8, 9, 11],
  [0, 1, 2, 3, 5, 7, 8, 9, 10],
  [0, 1, 2, 5, 6, 7, 8, 9, 10, 11],
  [0, 1, 2, 3, 4, 5, 7, 8, 9, 11],
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
];

const NAMES = [
  'ПЕРВАЯ ПРИБЫЛЬ',
  'НЕБОЛЬШОЕ НАСЛЕДСТВО',
  'МОНОПОЛИЯ',
  'КОРРУПЦИЯ ВЛАСТИ',
  'УВЕЛИЧЕНИЕ ПРОДАЖ',
  'БОЛЬШОЙ АССОРТИМЕНТ',
  'БЕШЕНЫЕ НАЛОГИ',
  'КЛИЕНТ ВСЕГДА ПРАВ',
  'БУДЬ ВПЕРЕДИ!',
  'ВСЁ БОЛЬШЕ И БОЛЬШЕ',
];

const BRIEFS = [
  'БОЛЬШИЕ ДЕНЬГИ ДАЮТСЯ С БОЛЬШИМ ТРУДОМ, НО ЗАРАБОТАВ ИХ, ВЫ ПОЛУЧАЕТЕ БОЛЬШЕ ВОЗМОЖНОСТЕЙ, БОЛЬШЕ СВОБОДЫ...\nИ ВОТ У ВАС ПОЯВИЛАСЬ ВОЗМОЖНОСТЬ СДЕЛАТЬ ЭТО, ЗАРАБОТАТЬ ИХ!',
  'В ВАШЕЙ ЖИЗНИ НАСТАЛИ КАРДИНАЛЬНЫЕ ПЕРЕМЕНЫ!\nВАМ СООБЩИЛИ О СМЕРТИ ВАШЕГО ДАЛЁКОГО РОДСТВЕННИКА, КОТОРЫЙ ОСТАВИЛ ВАМ В НАСЛЕДСТВО НЕБОЛЬШУЮ ПИЦЦЕРИЮ!',
  'КОНКУРЕНЦИЯ - ЭТО НОРМАЛЬНО. НО ВАС ЭТО НЕ УСТРАИВАЕТ, ВЫ ХОТИТЕ УНИЧТОЖИТЬ ВСЕХ ВАШИХ КОНКУРЕНТОВ, ЧТОБЫ ЗАХВАТИТЬ МОНОПОЛИЮ.',
  'НАСТАЛИ НЕБЛАГОПРИЯТНЫЕ ВРЕМЕНА ДЛЯ ВАШЕГО БИЗНЕСА. ВАШИ КОНКУРЕНТЫ, ИСПОЛЬЗУЯ СВЯЗИ С ЧИНОВНИКАМИ, ПЫТАЮТСЯ ОБАНКРОТИТЬ ВАС. ВАМ НУЖНО ПРОДЕРЖАТЬСЯ НЕМНОГО ВРЕМЕНИ И НЕ ПОТЕРЯТЬ СВОЙ АВТОРИТЕТ.',
  'ЧТОБЫ ВЫДЕЛИТЬСЯ НА ФОНЕ ДРУГИХ ВЫ РЕШИЛИ ПОСТАВИТЬ РЕКОРД ПО ПРОДАЖАМ ПИЦЦЫ!',
  'СО ВКУСАМИ НЕ СПОРЯТ. И ПОСЕТИТЕЛИ СЕЙЧАС СТАЛИ ОЧЕНЬ ПРИВЕРЕДЛИВЫМИ! ПОДАВАЙ ИМ, ВИДИТЕ ЛИ, БОЛЬШОЙ АССОРТИМЕНТ!',
  'ПРАВИТЕЛЬСТВО ВРЕМЕННО ПОВЫСИЛО НАЛОГИ. ВАМ НУЖНО ПЕРЕЖИТЬ ЭТОТ ПЕРИОД, НЕ ОБАНКРОТИТЬСЯ И НЕ ПОТЕРЯТЬ ПОПУЛЯРНОСТЬ.',
  'КАК ИЗВЕСТНО - КЛИЕНТ ВСЕГДА ПРАВ. ПОЭТОМУ ЛЮБАЯ ПРИХОТЬ КЛИЕНТА ДОЛЖНА БЫТЬ ИСПОЛНЕНА! ПОДНИМИТЕ ОБСЛУЖИВАНИЕ ДО ДОЛЖНОГО УРОВНЯ.',
  'ВАШИ КОНКУРЕНТЫ ЗА СЧЁТ ХОРОШЕГО СЕРВИСА УМУДРЯЮТСЯ ПРОДАВАТЬ БОЛЬШЕ ПИЦЦЫ ЧЕМ ВЫ! ВАША ЗАДАЧА - УВЕЛИЧИТЬ ДНЕВНОЙ ОБЪЁМ ПРОДАЖ ПИЦЦЫ.',
  'ВЫ ПРИОБРЕЛИ СЕТЬ ПИЦЦЕРИЙ. ТЕПЕРЬ ВАМ ОСТАЛОСЬ ТОЛЬКО ГРЕСТИ ДЕНЬГИ ЛОПАТОЙ, НО НЕ ТАК ЭТО ПРОСТО. РАЗБОГАТЕЙТЕ, ЕСЛИ СМОЖЕТЕ!',
];

export const MISSIONS: Mission[] = RAW.map((r, i) => ({
  index: i,
  name: NAMES[i],
  brief: BRIEFS[i],
  money: r[0],
  rating: r[1],
  days: r[2],
  rival1Rating: r[3],
  rival1Strength: r[4],
  rival2Rating: r[5],
  rival2Strength: r[6],
  netPct: r[7],
  pos: [r[8], r[9]],
  rival1Pos: [r[10], r[11]],
  rival2Pos: [r[12], r[13]],
  rival1House: r[14],
  rival2House: r[15],
  goalMoney: r[16],
  goalRating: r[17],
  assets: r[18],
  goalType: r[19] as 0 | 1,
  recipes: RECIPES[i],
  products: PRODUCTS[i],
  // The original builds the list as `for (i = 9 - mission; i < 10; i++)`.
  ads: Array.from({ length: i + 1 }, (_, k) => 9 - i + k),
}));

export const MISSION_COUNT = MISSIONS.length;
