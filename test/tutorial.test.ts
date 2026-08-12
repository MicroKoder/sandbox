import assert from 'node:assert/strict';
import test from 'node:test';

import { PIZZAS, UPGRADE_TABLES } from '../src/data/content.ts';
import { MISSIONS } from '../src/data/missions.ts';
import { Rng } from '../src/game/rng.ts';
import {
  adjustPizzaPrice,
  adjustProductPrice,
  buyRecipe,
  buyableRecipes,
  createGame,
  hire,
  installUpgrade,
  marketOf,
  supplyIngredient,
  supplyProduct,
  unsuppliedIngredients,
} from '../src/game/state.ts';
import {
  TUTORIAL_STEPS,
  advanceTutorial,
  menuAtCost,
  tutorialHighlightTab,
  tutorialStepOf,
  tutorialText,
} from '../src/game/tutorial.ts';

function freshMission0() {
  return createGame(
    {
      playerName: 'ТЕСТ',
      difficulty: 1,
      campaign: true,
      missionIndex: 0,
    },
    new Rng(1),
  );
}

function hireBest(s: ReturnType<typeof freshMission0>, type: number): void {
  const best = [...marketOf(s, type)].sort((a, b) => b.skill + b.speed - (a.skill + a.speed))[0];
  assert.ok(best, `no candidates for staff type ${type}`);
  assert.equal(hire(s, best.slot).ok, true);
}

test('mission 0 starts on the first coach tip; other missions skip the coach', () => {
  const s0 = freshMission0();
  assert.equal(tutorialStepOf(s0), 0);
  assert.equal(tutorialHighlightTab(s0), 8);
  assert.match(tutorialText(s0) ?? '', /СТОЛЫ/);

  const s1 = createGame(
    { playerName: 'ТЕСТ', difficulty: 1, campaign: true, missionIndex: 1 },
    new Rng(1),
  );
  assert.equal(tutorialStepOf(s1), -1);
  assert.equal(tutorialText(s1), null);
});

test('coach tips stay until their goal is met, then advance in order', () => {
  const s = freshMission0();
  assert.equal(TUTORIAL_STEPS.length, 7);

  advanceTutorial(s);
  assert.equal(s.tutorialStep, 0, 'tables not bought yet');

  installUpgrade(s, UPGRADE_TABLES);
  advanceTutorial(s);
  assert.equal(s.tutorialStep, 1);
  assert.equal(tutorialHighlightTab(s), 2);

  const recipe = buyableRecipes(s)[0];
  assert.equal(typeof recipe, 'number');
  assert.equal(buyRecipe(s, recipe).ok, true);
  advanceTutorial(s);
  assert.equal(s.tutorialStep, 2);
  assert.equal(tutorialHighlightTab(s), 3);

  for (const i of unsuppliedIngredients(s)) {
    assert.equal(supplyIngredient(s, i).ok, true);
  }
  advanceTutorial(s);
  assert.equal(s.tutorialStep, 3);
  assert.equal(tutorialHighlightTab(s), 4);

  const product = MISSIONS[0].products[0];
  assert.equal(supplyProduct(s, product).ok, true);
  advanceTutorial(s);
  assert.equal(s.tutorialStep, 4);
  assert.equal(tutorialHighlightTab(s), 10);

  hireBest(s, 0);
  hireBest(s, 1);
  advanceTutorial(s);
  assert.equal(s.tutorialStep, 5);
  assert.equal(tutorialHighlightTab(s), 1);
  assert.equal(menuAtCost(s), true);

  for (let i = 0; i < s.pizzaPrice.length; i++) {
    if (s.pizzaPrice[i] > 0) adjustPizzaPrice(s, i, Math.max(1, PIZZAS[i].cost));
  }
  for (let i = 0; i < s.productPrice.length; i++) {
    if (s.productPrice[i] > 0) adjustProductPrice(s, i, 50);
  }
  assert.equal(menuAtCost(s), false);
  advanceTutorial(s);
  assert.equal(s.tutorialStep, 6);
  assert.equal(tutorialHighlightTab(s), 6);
  assert.match(tutorialText(s) ?? '', /СТАТИСТИКА/);

  advanceTutorial(s, { statsOpen: false });
  assert.equal(s.tutorialStep, 6);

  advanceTutorial(s, { statsOpen: true });
  assert.equal(s.tutorialStep, -1);
  assert.equal(tutorialText(s), null);
});
