/**
 * Game content extracted from the original `Pizza-Magnate.jar`.
 *
 * Names come from the glyph-encoded `data.str` table inside the jar; the numeric
 * tables come from the static initialiser of the obfuscated `C` class. Every
 * number below was read out of the bytecode, not invented:
 *
 *   ingredient costs      C.java:7533  (var_byte_arr_a)
 *   pizza recipes         C.java:7535  (var_short_arr_arr_b)
 *   recipe quantities     C.java:7537  (var_byte_arr_arr_e)
 *   pizza cost price      C.java:7534  (var_short_arr_o)
 *   product costs         C.java:7538  (var_short_arr_g)
 *   product alcohol flags C.java:7539  (var_boolean_arr_i)
 *   vending machine costs C.java:7541  (var_short_arr_e)
 *   upgrade costs         C.java:7511  (var_short_arr_l)
 *   advertising day rate  C.java:7543  (var_short_arr_r)
 *   recipes per mission   C.java:7536  (var_byte_arr_arr_f)
 *   products per mission  C.java:7540  (var_byte_arr_arr_g)
 */

export interface Ingredient {
  name: string;
  /** Cost of one unit, in game currency. */
  cost: number;
  desc: string;
}

export interface Pizza {
  name: string;
  /** Ingredient indices used by the recipe. */
  ingredients: number[];
  /** Units of each ingredient consumed per pizza, parallel to `ingredients`. */
  amounts: number[];
  /**
   * Cost price of one pizza. Equal to sum(amount * ingredient cost) — verified
   * against `var_short_arr_o` for all ten recipes. Also the default sell price,
   * and the recipe itself costs 100x this to buy.
   */
  cost: number;
}

export interface Product {
  name: string;
  cost: number;
  alcohol: boolean;
  desc: string;
}

export interface Machine {
  name: string;
  cost: number;
  desc: string;
}

export interface Upgrade {
  name: string;
  cost: number;
  desc: string;
}

export interface AdCampaign {
  name: string;
  /** Charged every game day while the campaign runs. */
  dayCost: number;
  desc: string;
}

// --------------------------------------------------------------- ingredients

export const INGREDIENTS: Ingredient[] = [
  { name: "ТЕСТО 'ПРЕСНОЕ'", cost: 1, desc: 'ИЗ ВЫСШИХ СОРТОВ ПШЕНИЦЫ' },
  { name: "ТЕСТО 'СДОБНОЕ'", cost: 2, desc: 'С УВЕЛИЧЕНЫМ КОЛИЧЕСТВОМ СДОБЫ' },
  { name: "ТЕСТО 'СЛОЁНОЕ'", cost: 3, desc: 'С БОЛЬШИМ КОЛИЧЕСТВОМ МАСЛА' },
  { name: "СЫР 'ЧЕСТЕР'", cost: 5, desc: 'ТВЁРДЫЙ СЫР' },
  { name: "СЫР 'АЛТАЙ'", cost: 6, desc: 'ТВЁРДЫЙ СЫР С ПЛЕСЕНЬЮ' },
  { name: "СЫР 'ПАРМЕЗАН'", cost: 7, desc: 'ИТАЛЬЯНСКИЙ СЫР' },
  { name: 'МАЙОНЕЗ', cost: 1, desc: 'С БОЛЬШИМ СОДЕРЖАНИЕМ ЖИРА' },
  { name: 'ТОМАТНЫЙ СОУС', cost: 2, desc: 'СОУС ИЗ ЛУЧШИХ СОРТОВ ПОМИДОРОВ' },
  { name: 'ОЛИВКОВЫЙ СОУС', cost: 6, desc: 'ИЗ ЛУЧШИХ СОРТОВ ОЛИВОК' },
  { name: 'МЯСО КУРИЦЫ', cost: 8, desc: 'ФИЛЕ ГРУДИНКИ' },
  { name: 'ПОМИДОРЫ', cost: 1, desc: 'ТОЛЬКО ОТБОРНЫЕ И СВЕЖИЕ' },
  { name: 'БЕЛЫЕ ГРИБЫ', cost: 20, desc: 'МАРИНОВАННЫЕ, СО СПЕЦИЯМИ' },
  { name: 'ШАМПИНЬОНЫ', cost: 6, desc: 'ОТЛИЧАЮТСЯ ТОНКИМ ВКУСОМ' },
  { name: 'ВЕТЧИНА', cost: 15, desc: "'БРЕЗАОЛА', ЗАСОЛЕННЫЙ ГОВЯЖИЙ ОКОРОК" },
  { name: 'БЕКОН', cost: 18, desc: 'СВИНОЙ БОК, КОПЧЁННЫЙ С СОЛЬЮ' },
  { name: 'КРЕВЕТКИ', cost: 23, desc: 'ВАРЕНЫЕ, ПРОСОЛЕННЫЕ' },
  { name: 'ТУНЕЦ', cost: 30, desc: 'ЗАМОРОЖЕННЫЙ ПОРЦИОННЫЙ СТЕЙК ИЗ ФИЛЕ ТУНЦА' },
  { name: 'СЁМГА', cost: 25, desc: 'СВЕЖАЯ, В БРИКЕТАХ' },
  { name: 'АНЧОУСЫ', cost: 19, desc: 'МЕЛКАЯ, ЗАСОЛЕННАЯ В БОЧКАХ С ПРЯНОСТЯМИ' },
  { name: 'КИВИ', cost: 9, desc: 'СЛАДКИЕ ЯГОДЫ ИЗ НОВОЙ ЗЕЛАНДИИ' },
  { name: 'АНАНАСЫ', cost: 11, desc: 'СОЧНЫЕ, ТЕРПКИЕ, КИСЛО-СЛАДКИЕ, АРОМАТНЫЕ ПЛОДЫ' },
  { name: 'ОЛИВКИ', cost: 15, desc: 'КОНСЕРВИРОВАННЫЕ В СОБСТВЕННОМ СОКУ БЕЗ КОСТОЧЕК' },
];

// -------------------------------------------------------------------- pizzas

function pizza(name: string, ingredients: number[], amounts: number[]): Pizza {
  const cost = ingredients.reduce((sum, ing, i) => sum + amounts[i] * INGREDIENTS[ing].cost, 0);
  return { name, ingredients, amounts, cost };
}

export const PIZZAS: Pizza[] = [
  pizza("'КЛАССИК'", [0, 3, 6, 10, 9], [3, 3, 1, 2, 2]),
  pizza("'МАРИОЛИ'", [0, 3, 7, 9, 19], [3, 3, 1, 3, 3]),
  pizza("'ВЕНЕЦИЯ'", [0, 4, 6, 11, 13], [3, 3, 1, 3, 3]),
  pizza("'ГРИБНАЯ'", [0, 4, 11, 12, 21], [3, 3, 1, 3, 3]),
  pizza("'ФРУКТОВАЯ'", [1, 19, 20, 21], [3, 2, 2, 2]),
  pizza("'САН-РЕМО'", [1, 3, 7, 9, 15], [3, 2, 1, 3, 3]),
  pizza("'ОЛИМП'", [1, 5, 7, 16, 20], [3, 3, 1, 3, 3]),
  pizza("'БАРИ'", [2, 4, 10, 13, 17], [3, 3, 1, 3, 3]),
  pizza("'ВОСТОЧНАЯ'", [2, 5, 8, 15, 21], [3, 2, 1, 3, 3]),
  pizza("'НЕПТУН'", [2, 5, 8, 15, 16], [3, 2, 1, 3, 3]),
];

/** Buying a recipe costs 100x the cost price of the pizza (C.java:2368, 2829). */
export const recipePrice = (pizzaIndex: number): number => 100 * PIZZAS[pizzaIndex].cost;

// ------------------------------------------------------------------ products

export const PRODUCTS: Product[] = [
  { name: 'КОЛА', cost: 12, alcohol: false, desc: 'БЕЗАЛКОГОЛЬНЫЙ ОХЛАЖДАЮЩИЙ НАПИТОК' },
  { name: 'ЛАЙТ-КОЛА', cost: 15, alcohol: false, desc: 'ТОНИЗИРУЮЩИЙ, ОХЛАЖДАЮЩИЙ БЕЗАЛКОГОЛЬНЫЙ НАПИТОК' },
  { name: "ЧАЙ 'ЛИМОННЫЙ'", cost: 25, alcohol: false, desc: 'ЧЁРНЫЙ, С ЛИМОНОМ' },
  { name: "ЧАЙ 'ГОРНЫЙ'", cost: 29, alcohol: false, desc: 'ЧЁРНЫЙ, ВЫСШИЙ СОРТ' },
  { name: 'ВИНО МУСКАТ', cost: 60, alcohol: true, desc: 'БЕЛОЕ ВИНО 5-ТИ ЛЕТНЕЙ ВЫДЕРЖКИ' },
  {
    name: 'КОНЬЯК АРАРАТ',
    cost: 80,
    alcohol: true,
    desc: 'ИЗГОТОВЛЕН ИЗ ВЫСОКОКАЧЕСТВЕННЫХ КОНЬЯЧНЫХ СПИРТОВ 6-ТИ ЛЕТНЕЙ ВЫДЕРЖКИ',
  },
  { name: 'ПИВО', cost: 49, alcohol: true, desc: 'СВЕТЛОЕ НЕФИЛЬТРОВАННОЕ' },
  { name: 'СИГАРЕТЫ', cost: 11, alcohol: false, desc: 'ЛЁГКИЕ С ДВОЙНЫМ ФИЛЬТРОМ' },
  { name: 'ЖВАЧКИ', cost: 14, alcohol: false, desc: 'МЯТНЫЙ ВКУС, СВЕЖЕСТЬ ДЫХАНИЯ.' },
  { name: 'СОК ЯБЛОЧНЫЙ', cost: 15, alcohol: false, desc: 'НАТУРАЛЬНЫЙ, БЕЗ КОНСЕРВАНТОВ.' },
  {
    name: 'СОК ФРУКТОВЫЙ',
    cost: 25,
    alcohol: false,
    desc: 'СОЧЕТАНИЕ ВИШНИ, МАЛИНЫ И СМОРОДИНЫ, УТОЛЯЮЩИЙ ЖАЖДУ.',
  },
  { name: 'МОРОЖЕНОЕ', cost: 21, alcohol: false, desc: 'ШОКОЛАДНОЕ, СО ВЗБИТЫМИ СЛИВКАМИ' },
];

// ---------------------------------------------------------- vending machines

export const MACHINES: Machine[] = [
  { name: 'КОФЕЙНЫЙ', cost: 8000, desc: 'ПРОДАЖА РАСТВОРИМОГО КОФЕ С ДОБАВКАМИ САХАРА И СЛИВОК' },
  { name: 'ХОЛОДНЫХ НАПИТКОВ', cost: 5000, desc: 'ПРОДАЖА СЛАДКОГО СИРОПА И ГАЗИРОВАННОЙ ВОДЫ' },
  { name: 'СИГАРЕТНЫЙ', cost: 6000, desc: 'ПРОДАЖА СИГАРЕТ, СИГАР И ТАБАКА' },
  { name: 'БАНКОМАТ', cost: 7000, desc: 'СНЯТИЕ ДЕНЕГ СО СЧЁТА' },
  { name: 'ОТКРЫТОК', cost: 9000, desc: 'ПОЗДРАВИТЕЛЬНЫЕ ОТКРЫТКИ' },
  { name: 'ГОРЯЧИХ НАПИТКОВ', cost: 5000, desc: 'ПРОДАЖА ЧАЯ, КАПУЧИНО, ШОКОЛАДНОГО НАПИТКА' },
];

// ------------------------------------------------------------------ upgrades

/** Index of the "second floor" upgrade — it is special-cased in several places. */
export const UPGRADE_SECOND_FLOOR = 0;
/** Index of the "tables" upgrade — without it visitors will not come in at all. */
export const UPGRADE_TABLES = 6;

export const UPGRADES: Upgrade[] = [
  { name: '2-Й ЭТАЖ', cost: 32000, desc: 'ПОСТРОЙКА 2-ГО ЭТАЖА ДАЁТ ВОЗМОЖНОСТЬ УВЕЛИЧИТЬ ВМЕСТИМОСТЬ ПИЦЦЕРИИ' },
  {
    name: 'КОНДИЦИОНЕРЫ',
    cost: 12000,
    desc: 'ОСВЕЖАЮТ ВОЗДУХ И РЕГУЛИРУЮТ ТЕМПЕРАТУРУ, ЧТО СОЗДАЁТ УСЛОВИЯ ПОВЫШЕНОГО КОМФОРТА!',
  },
  { name: 'ВОДОСТОК', cost: 8000, desc: 'ВО ВРЕМЯ ДОЖДЛИВОЙ ПОГОДЫ ЗАЩИЩАЕТ ПОСЕТИТЕЛЕЙ ОТ ВОДЫ СТЕКАЕМОЙ С КРЫШИ.' },
  { name: 'МУСОРНИКИ', cost: 4000, desc: 'ПРЕДОТВРАЩАЮТ ЧРЕЗВЫЧАЙНОЕ ЗАМУСОРИВАНИЕ ТЕРРИТОРИИ' },
  { name: 'РАСТЕНИЯ', cost: 6000, desc: 'УЛУЧШАЮТ ОБСТАНОВКУ!\nПОЗВОЛЯЮТ ПОСЕТИТЕЛЯМ БОЛЬШЕ РАССЛАБИТЬСЯ.' },
  {
    name: 'РЕКЛАМНЫЕ ЩИТЫ',
    cost: 8000,
    desc: 'ДЕЛАЮТ ПИЦЦЕРИЮ БОЛЕЕ ЗАМЕТНОЙ СРЕДИ ДРУГИХ ЗДАНИЙ, ЧТО ПОВЫШАЕТ ПОСЕЩАЕМОСТЬ',
  },
  { name: 'СТОЛЫ', cost: 7000, desc: 'НЕОБХОДИМЫ ДЛЯ ПРЕБЫВАНИЯ ПОСЕТИТЕЛЕЙ В ПИЦЦЕРИИ' },
];

// --------------------------------------------------------------- advertising

export const ADS: AdCampaign[] = [
  { name: 'ПЕРВЫЙ КАНАЛ', dayCost: 30000, desc: 'МЕЖДУНАРОДНЫЙ ШИРОКОВЕЩАТЕЛЬНЫЙ ОБЩЕОБРАЗОВАТЕЛЬНЫЙ ТЕЛЕКАНАЛ' },
  { name: 'ВТОРОЙ КАНАЛ', dayCost: 20000, desc: 'ГОСУДАРСТВЕННЫЙ ШИРОКОВЕЩАТЕЛЬНЫЙ ОБЩЕОБРАЗОВАТЕЛЬНЫЙ ТЕЛЕКАНАЛ' },
  { name: "'ТИВИ-МУЗ'", dayCost: 15000, desc: 'КАБЕЛЬНЫЙ, МУЗЫКАЛЬНЫЙ ТЕЛЕКАНАЛ' },
  { name: "'TV-ВЕДОМОСТЬ'", dayCost: 12000, desc: 'КАБЕЛЬНЫЙ ИНФОРМАЦИОННЫЙ ТЕЛЕКАНАЛ' },
  { name: "'TV-КАПРИЗ'", dayCost: 10000, desc: 'КАБЕЛЬНЫЙ РАЗВЛЕКАТЕЛЬНЫЙ ТЕЛЕКАНАЛ' },
  { name: "'ПОРТРЕТ'", dayCost: 9000, desc: 'ОБЩЕОБРАЗОВАТЕЛЬНО - ИНФОРМАЦИОННАЯ ГАЗЕТА' },
  { name: "'ПАРАГРАФ'", dayCost: 7000, desc: 'ИНФОРМАЦИОННАЯ ГАЗЕТА' },
  { name: "'ВОЛЯ'", dayCost: 5000, desc: 'ОБЩЕОБРАЗОВАТЕЛЬНАЯ РАДИОСТАНЦИЯ' },
  { name: "'МЕГА-ГРАД'", dayCost: 3000, desc: 'РАЗВЛЕКАТЕЛЬНАЯ РАДИОСТАНЦИЯ' },
  { name: "'ИНФО-КОМ15'", dayCost: 2000, desc: 'НАЦИОНАЛЬНЫЙ ИНФОРМАЦИОННЫЙ ЖУРНАЛ' },
];

// --------------------------------------------------------------------- staff

export type StaffKind = 0 | 1 | 2 | 3 | 4;

export const STAFF_KINDS = ['ПОВАРА', 'ОФИЦИАНТЫ', 'ВОДИТЕЛИ', 'УБОРЩИКИ', 'ОХРАННИКИ'] as const;
export const STAFF_KIND_SINGULAR = ['ПОВАР', 'ОФИЦИАНТ', 'ВОДИТЕЛЬ', 'УБОРЩИК', 'ОХРАННИК'] as const;

/** The twenty first names the labour exchange draws from (data.str[132..151]). */
export const STAFF_NAMES = [
  'ВОВАН',
  'АЛЕКСЕЙ',
  'МИХАИЛ',
  'БОРИС',
  'АНДРЕЙ',
  'ЮРИЙ',
  'МИАФАН',
  'ТАТЬЯНА',
  'ВИТАЛИЙ',
  'СЛАВИК',
  'СЕРГЕЙ',
  'АЛЕКСАНДР',
  'МЕРКУРИЙ',
  'ДЕНИС',
  'ЛЮДМИЛА',
  'АНТОН',
  'ИРИНА',
  'АКИМ',
  'УМПУТ',
  'ЕВГЕНИЙ',
];

/**
 * `var_boolean_arr_h` (C.java:7542). A `true` entry means the candidate rolls a
 * *low* skill band (0..2); a `false` entry rolls the high band (3..5).
 */
export const STAFF_LOW_SKILL_BAND = [
  true, true, true, true, true, true, true, false, true, true,
  true, true, true, true, false, false, false, false, false, false,
];

// ------------------------------------------------------------- pizzeria plan

/**
 * `var_byte_arr_arr_c` (C.java:7505) — the five table anchors inside the
 * pizzeria, each seating up to three visitors.
 */
export const TABLE_SLOTS: ReadonlyArray<readonly [number, number]> = [
  [1, 2],
  [1, 4],
  [3, 2],
  [3, 4],
  [5, 3],
];

export const SEATS_PER_TABLE = 3;
