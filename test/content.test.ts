import assert from 'node:assert/strict';
import test from 'node:test';

import {
  ADS,
  INGREDIENTS,
  MACHINES,
  PIZZAS,
  PRODUCTS,
  UPGRADES,
  STAFF_NAMES,
  recipePrice,
} from '../src/data/content.ts';
import { MISSIONS } from '../src/data/missions.ts';

/**
 * These lock the tables against the values read out of the original jar, so a
 * careless edit to the content files shows up immediately.
 */

test('pizza cost prices match var_short_arr_o from the original', () => {
  const original = [37, 71, 127, 104, 76, 111, 152, 148, 143, 188];
  assert.deepEqual(PIZZAS.map((p) => p.cost), original);
});

test('a recipe costs a hundred times the pizza it makes', () => {
  assert.equal(recipePrice(0), 3700);
  assert.equal(recipePrice(9), 18800);
});

test('content tables have the sizes the original used', () => {
  assert.equal(INGREDIENTS.length, 22);
  assert.equal(PIZZAS.length, 10);
  assert.equal(PRODUCTS.length, 12);
  assert.equal(MACHINES.length, 6);
  assert.equal(UPGRADES.length, 7);
  assert.equal(ADS.length, 10);
  assert.equal(STAFF_NAMES.length, 20);
  assert.equal(MISSIONS.length, 10);
});

test('exactly three products are alcoholic', () => {
  const alcohol = PRODUCTS.filter((p) => p.alcohol).map((p) => p.name);
  assert.deepEqual(alcohol, ['ВИНО МУСКАТ', 'КОНЬЯК АРАРАТ', 'ПИВО']);
});

test('every recipe lists one amount per ingredient and starts with dough', () => {
  for (const pizza of PIZZAS) {
    assert.equal(pizza.ingredients.length, pizza.amounts.length, pizza.name);
    assert.ok(pizza.ingredients[0] <= 2, `${pizza.name} should start with a dough`);
    for (const ing of pizza.ingredients) {
      assert.ok(ing >= 0 && ing < INGREDIENTS.length, `${pizza.name} references ingredient ${ing}`);
    }
  }
});

test('advertising day rates descend from 30000 to 2000', () => {
  assert.deepEqual(
    ADS.map((a) => a.dayCost),
    [30000, 20000, 15000, 12000, 10000, 9000, 7000, 5000, 3000, 2000],
  );
});

test('missions unlock progressively wider menus', () => {
  assert.deepEqual(MISSIONS[0].recipes, [0, 1]);
  assert.deepEqual(MISSIONS[9].recipes, [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
  assert.deepEqual(MISSIONS[0].ads, [9]);
  assert.deepEqual(MISSIONS[9].ads, [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
  for (const m of MISSIONS) {
    assert.ok(m.recipes.length > 0, `mission ${m.index} has recipes`);
    assert.ok(m.products.length > 0, `mission ${m.index} has products`);
    assert.equal(m.ads.length, m.index + 1);
  }
});

test('the two survival missions are the ones with the raised tax', () => {
  const survival = MISSIONS.filter((m) => m.goalType === 1).map((m) => m.index);
  assert.deepEqual(survival, [3, 6]);
  for (const i of survival) assert.equal(MISSIONS[i].netPct, 80);
});
