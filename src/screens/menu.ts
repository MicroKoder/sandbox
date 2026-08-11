import type { App, Screen } from '../app/app.ts';
import { clearSave, hasSave, isUnlocked, readSave, recordWin, writeSave } from '../app/profile.ts';
import { C } from '../core/palette.ts';
import type { Painter } from '../core/painter.ts';
import { FULL, SCREEN_H, SCREEN_W } from '../core/screen.ts';
import { MISSIONS, MISSION_COUNT } from '../data/missions.ts';
import { ENDING, HELP_BOOK, S, type HelpPage } from '../data/strings.ts';
import { createGame, missionOf, type Difficulty, type GameState } from '../game/state.ts';
import type { Key } from '../ui/input.ts';
import {
  dialog,
  fieldLine,
  formatMoney,
  formatRating,
  header,
  listWindow,
  row,
  scrollbar,
  softkeys,
} from '../ui/widgets.ts';
import { drawLogoMark, menuBackground, scrollEmotionsHelp, scrollText } from './common.ts';
import { PlayScreen } from './play.ts';

// ------------------------------------------------------------------- splash

export class SplashScreen implements Screen {
  private t = 0;

  update(_app: App, dt: number): void {
    this.t += dt;
  }

  draw(app: App, p: Painter): void {
    menuBackground(p, app.clock);
    drawLogoMark(p, SCREEN_W / 2, 66, 26);

    p.textShadow(S.title, SCREEN_W / 2, 108, C.gold, 'center');
    p.text('QPLAZE / RMG · 2004', SCREEN_W / 2, 122, C.inkFaint, 'center');
    p.text('ВЕБ-РЕМЕЙК', SCREEN_W / 2, 132, C.inkFaint, 'center');

    if (Math.floor(this.t / 500) % 2 === 0) {
      p.text(S.pressAnyKey, SCREEN_W / 2, SCREEN_H - 22, C.ink, 'center');
    }
  }

  key(app: App): void {
    app.cue('select');
    app.replace(new MenuScreen());
  }

  click(app: App): void {
    this.key(app);
  }
}

// ---------------------------------------------------------------- main menu

interface MenuItem {
  label: string;
  action: (app: App) => void;
  enabled?: (app: App) => boolean;
}

export class MenuScreen implements Screen {
  private index = 0;
  private items: MenuItem[] = [
    { label: S.newGame, action: (app) => app.push(new GameTypeScreen()) },
    {
      label: S.load,
      action: (app) => {
        const state = readSave();
        if (!state) return;
        app.cue('start');
        app.beginSession(state);
        app.push(new PlayScreen());
      },
      enabled: () => hasSave(),
    },
    { label: S.records, action: (app) => app.push(new RecordsScreen()) },
    { label: S.settings, action: (app) => app.push(new SettingsScreen()) },
    { label: S.help, action: (app) => app.push(new HelpScreen(HELP_BOOK)) },
    { label: S.about, action: (app) => app.push(new AboutScreen()) },
  ];

  draw(app: App, p: Painter): void {
    menuBackground(p, app.clock);
    drawLogoMark(p, 24, 22, 13);
    p.textShadow(S.title, 46, 18, C.gold);

    const top = 46;
    this.items.forEach((item, i) => {
      const y = top + i * 19;
      const on = i === this.index;
      const disabled = item.enabled ? !item.enabled(app) : false;
      p.panel(16, y, SCREEN_W - 32, 15, { fill: on ? C.selBg : C.panel, raised: !on });
      if (on) p.stroke(16, y, SCREEN_W - 32, 15, C.gold);
      p.text(item.label, SCREEN_W / 2, y + 4, disabled ? C.inkFaint : on ? C.selInk : C.ink, 'center');
    });

    softkeys(p, undefined, S.exit, `${app.settings.playerName}`);
  }

  click(app: App, _x: number, y: number): void {
    const index = Math.floor((y - 46) / 19);
    if (index < 0 || index >= this.items.length) return;
    this.index = index;
    this.key(app, 'select');
  }

  key(app: App, key: Key): void {
    if (key === 'up') {
      this.index = (this.index + this.items.length - 1) % this.items.length;
      app.cue('select');
    } else if (key === 'down') {
      this.index = (this.index + 1) % this.items.length;
      app.cue('select');
    } else if (key === 'select') {
      const item = this.items[this.index];
      if (item.enabled && !item.enabled(app)) {
        app.cue('deny');
        return;
      }
      app.cue('select');
      item.action(app);
    }
  }
}

// ----------------------------------------------------------------- settings

export class SettingsScreen implements Screen {
  private index = 0;

  draw(app: App, p: Painter): void {
    menuBackground(p, app.clock);
    header(p, S.settings);

    const rows: Array<[string, string]> = [
      [S.difficulty, [S.easy, S.normal, S.hard][app.settings.difficulty]],
      [S.sound, app.settings.sound ? S.on : S.off],
      [S.hints, app.settings.hints ? S.on : S.off],
      [S.yourName, app.settings.playerName],
    ];

    rows.forEach(([label, value], i) => {
      const y = 30 + i * 20;
      const on = i === this.index;
      p.panel(10, y, SCREEN_W - 20, 16, { fill: on ? C.selBg : C.panel, raised: !on });
      if (on) p.stroke(10, y, SCREEN_W - 20, 16, C.gold);
      p.text(label, 16, y + 5, on ? C.selInk : C.inkDim);
      p.text(value, SCREEN_W - 16, y + 5, C.gold, 'right');
    });

    p.paragraph('ВЛЕВО/ВПРАВО — ИЗМЕНИТЬ', 10, 122, SCREEN_W - 20, C.inkFaint, 2, 'center');
    softkeys(p, S.back);
  }

  click(app: App, _x: number, y: number): void {
    const index = Math.floor((y - 30) / 20);
    if (index < 0 || index > 3) {
      this.key(app, 'back');
      return;
    }
    this.index = index;
    this.key(app, 'select');
  }

  key(app: App, key: Key): void {
    const count = 4;
    if (key === 'up') this.index = (this.index + count - 1) % count;
    else if (key === 'down') this.index = (this.index + 1) % count;
    else if (key === 'left' || key === 'right' || key === 'select') {
      const dir = key === 'left' ? -1 : 1;
      if (this.index === 0) {
        app.settings.difficulty = (((app.settings.difficulty + dir + 3) % 3) as Difficulty);
      } else if (this.index === 1) {
        app.settings.sound = !app.settings.sound;
      } else if (this.index === 2) {
        app.settings.hints = !app.settings.hints;
      } else {
        app.push(new NameScreen(() => app.pop()));
        return;
      }
      app.persistSettings();
      app.cue('select');
    } else if (key === 'back') {
      app.persistSettings();
      app.pop();
    }
  }
}

// -------------------------------------------------------------------- about

export class AboutScreen implements Screen {
  private scroll = 0;
  private height = 0;

  private static readonly TEXT = [
    'МАГНАТ ПИЦЦЫ — ВЕБ-РЕМЕЙК МОБИЛЬНОЙ ЭКОНОМИЧЕСКОЙ СТРАТЕГИИ PIZZA MAGNATE (J2ME, 2004).',
    ' ',
    'ОРИГИНАЛ:',
    'РАЗРАБОТЧИК: QPLAZE',
    'ИЗДАТЕЛЬ: RMG',
    ' ',
    'ИГРОВАЯ ЛОГИКА, ЭКОНОМИКА, ТАБЛИЦЫ МИССИЙ И ТЕКСТЫ ВОССТАНОВЛЕНЫ ИЗ ОРИГИНАЛЬНОГО JAR-ФАЙЛА.',
    ' ',
    'ВСЯ ГРАФИКА И ЗВУК СОЗДАНЫ ЗАНОВО: ОРИГИНАЛЬНЫЕ РЕСУРСЫ НЕ ИСПОЛЬЗУЮТСЯ.',
    ' ',
    'РЕАЛИЗАЦИЯ: TYPESCRIPT + PHASER.',
  ].join('\n');

  draw(app: App, p: Painter): void {
    menuBackground(p, app.clock);
    header(p, S.about);
    this.height = scrollText(p, AboutScreen.TEXT, 8, FULL.y + 4, SCREEN_W - 18, FULL.h - 6, this.scroll);
    scrollbar(
      p,
      { x: SCREEN_W - 4, y: FULL.y + 4, w: 2, h: FULL.h - 6 },
      this.scroll,
      FULL.h - 6,
      Math.max(this.height, FULL.h),
    );
    softkeys(p, S.back);
  }

  key(app: App, key: Key): void {
    const max = Math.max(0, this.height - (FULL.h - 10));
    if (key === 'down') this.scroll = Math.min(max, this.scroll + 9);
    else if (key === 'up') this.scroll = Math.max(0, this.scroll - 9);
    else if (key === 'back' || key === 'select') app.pop();
  }

  onScroll(_app: App, dy: number): void {
    const max = Math.max(0, this.height - (FULL.h - 10));
    this.scroll = Math.max(0, Math.min(max, this.scroll + dy));
  }
}

// --------------------------------------------------------------------- help

/**
 * The paged help book. The original had the same shape: a browser over a fixed
 * list of chapters, opened either from the main menu or with the hint key on a
 * gameplay screen, in which case it opens at that screen's chapter.
 */
export class HelpScreen implements Screen {
  private scroll = 0;
  private height = 0;
  private page: number;

  constructor(
    private readonly pages: HelpPage[],
    startPage = 0,
  ) {
    this.page = Math.max(0, Math.min(startPage, pages.length - 1));
  }

  private get current(): HelpPage {
    return this.pages[this.page];
  }

  draw(_app: App, p: Painter): void {
    p.clear(C.bg);
    header(p, S.help);

    const chapter = this.current;
    const titleY = FULL.y;
    p.gradientV(0, titleY, SCREEN_W, 11, C.panelHi, C.panel);
    p.text('←', 3, titleY + 2, this.page > 0 ? C.gold : C.inkFaint);
    p.text('→', SCREEN_W - 4, titleY + 2, this.page < this.pages.length - 1 ? C.gold : C.inkFaint, 'right');
    p.textClipped(chapter.title, 13, titleY + 2, SCREEN_W - 28, C.gold);
    p.hLine(0, titleY + 11, SCREEN_W, C.line);

    const bodyY = titleY + 14;
    const bodyH = FULL.h - 14;
    if (chapter.kind === 'emotions') {
      this.height = scrollEmotionsHelp(p, 6, bodyY, SCREEN_W - 16, bodyH, this.scroll);
    } else {
      this.height = scrollText(p, chapter.text, 6, bodyY, SCREEN_W - 16, bodyH, this.scroll);
    }
    scrollbar(
      p,
      { x: SCREEN_W - 4, y: bodyY, w: 2, h: bodyH },
      this.scroll,
      bodyH,
      Math.max(this.height, bodyH),
    );

    softkeys(p, S.back, `${this.page + 1}/${this.pages.length}`, '↑↓ ←→');
  }

  click(app: App, x: number, y: number): void {
    if (y >= SCREEN_H - 13) {
      app.pop();
      return;
    }
    if (y < FULL.y + 11) {
      this.turn(x < SCREEN_W / 2 ? -1 : 1);
      return;
    }
    this.key(app, y > SCREEN_H / 2 ? 'down' : 'up');
  }

  private turn(delta: number): void {
    const next = this.page + delta;
    if (next < 0 || next >= this.pages.length) return;
    this.page = next;
    this.scroll = 0;
  }

  key(app: App, key: Key): void {
    const bodyH = FULL.h - 14;
    const max = Math.max(0, this.height - bodyH + 6);
    if (key === 'down') this.scroll = Math.min(max, this.scroll + 9);
    else if (key === 'up') this.scroll = Math.max(0, this.scroll - 9);
    else if (key === 'left' || key === 'prevTab') this.turn(-1);
    else if (key === 'right' || key === 'nextTab') this.turn(1);
    else if (key === 'back' || key === 'select' || key === 'hint') app.pop();
  }

  onScroll(_app: App, dy: number): void {
    const bodyH = FULL.h - 14;
    const max = Math.max(0, this.height - bodyH + 6);
    this.scroll = Math.max(0, Math.min(max, this.scroll + dy));
  }
}

// ------------------------------------------------------------------ records

export class RecordsScreen implements Screen {
  private index = 0;
  private first = 0;

  draw(app: App, p: Painter): void {
    p.clear(C.bg);
    header(p, S.records);

    const rowH = 14;
    const win = listWindow(this.index, MISSION_COUNT, rowH, FULL.h - 2, this.first);
    this.first = win.first;

    for (let i = 0; i < win.visible; i++) {
      const m = win.first + i;
      if (m >= MISSION_COUNT) break;
      const y = FULL.y + 2 + i * rowH;
      const rec = app.records.missions[m];
      row(p, 2, y, SCREEN_W - 8, rowH, m === this.index);
      const locked = rec === null;
      p.text(`${m + 1}.`, 5, y + 3, locked ? C.inkFaint : C.inkDim);
      const badge = rec && rec.days > 0 ? `${rec.days} ${S.days}` : locked ? '---' : '';
      const room = SCREEN_W - 10 - 17 - (badge ? p.measure(badge) + 4 : 0);
      p.textClipped(MISSIONS[m].name, 17, y + 3, room, locked ? C.inkFaint : C.ink);
      if (badge) p.text(badge, SCREEN_W - 10, y + 3, rec && rec.days > 0 ? C.gold : C.inkFaint, 'right');
    }

    scrollbar(p, { x: SCREEN_W - 4, y: FULL.y + 2, w: 2, h: FULL.h - 4 }, win.first, win.visible, MISSION_COUNT);

    const rec = app.records.missions[this.index];
    if (rec && rec.days > 0) {
      softkeys(p, S.back, `${formatMoney(rec.money)}$`, rec.name);
    } else {
      softkeys(p, S.back);
    }
  }

  click(app: App, _x: number, y: number): void {
    const index = this.first + Math.floor((y - (FULL.y + 2)) / 14);
    if (index >= 0 && index < MISSION_COUNT) this.index = index;
    else app.pop();
  }

  key(app: App, key: Key): void {
    if (key === 'up') this.index = (this.index + MISSION_COUNT - 1) % MISSION_COUNT;
    else if (key === 'down') this.index = (this.index + 1) % MISSION_COUNT;
    else if (key === 'back' || key === 'select') app.pop();
  }
}

// ---------------------------------------------------------------- game type

export class GameTypeScreen implements Screen {
  private index = 0;

  draw(app: App, p: Painter): void {
    menuBackground(p, app.clock);
    header(p, S.gameType);
    p.paragraph(S.chooseGameType, 10, FULL.y + 6, SCREEN_W - 20, C.inkDim, 2, 'center');

    [S.newCampaign, S.singleMission].forEach((label, i) => {
      const y = 76 + i * 22;
      const on = i === this.index;
      p.panel(16, y, SCREEN_W - 32, 17, { fill: on ? C.selBg : C.panel, raised: !on });
      if (on) p.stroke(16, y, SCREEN_W - 32, 17, C.gold);
      p.text(label, SCREEN_W / 2, y + 5, on ? C.selInk : C.ink, 'center');
    });

    softkeys(p, S.back, S.next);
  }

  click(app: App, _x: number, y: number): void {
    const index = Math.floor((y - 76) / 22);
    if (index < 0 || index > 1) return;
    this.index = index;
    this.key(app, 'select');
  }

  key(app: App, key: Key): void {
    if (key === 'up' || key === 'down') this.index = 1 - this.index;
    else if (key === 'back') app.pop();
    else if (key === 'select') {
      app.cue('select');
      const campaign = this.index === 0;
      app.push(
        new NameScreen(() => {
          app.pop();
          if (campaign) {
            const next = app.records.missions.findIndex((m, i) => m !== null && (m.days === 0 || i === MISSION_COUNT - 1));
            app.push(new BriefingScreen(Math.max(0, next), true));
          } else {
            app.push(new MissionSelectScreen());
          }
        }),
      );
    }
  }
}

// --------------------------------------------------------------------- name

export class NameScreen implements Screen {
  private value = '';

  constructor(private readonly done: () => void) {}

  enter(app: App): void {
    this.value = app.settings.playerName;
    app.input.textTarget = {
      onText: (ch) => this.typeChar(ch),
      onBackspace: () => this.eraseChar(),
    };
  }

  exit(app: App): void {
    app.input.textTarget = null;
  }

  draw(app: App, p: Painter): void {
    menuBackground(p, app.clock);
    header(p, S.yourName);
    p.paragraph(S.enterName, 10, FULL.y + 8, SCREEN_W - 20, C.inkDim, 2, 'center');

    const boxW = 100;
    const x = (SCREEN_W - boxW) / 2;
    p.panel(x, 92, boxW, 18, { fill: C.panelLo, raised: false });
    p.stroke(x, 92, boxW, 18, C.gold);
    const width = p.measure(this.value);
    const left = Math.round(SCREEN_W / 2 - (width + 4) / 2);
    p.text(this.value, left, 98, C.ink);
    if (Math.floor(app.clock / 400) % 2 === 0 && this.value.length < 8) {
      p.fill(left + width + 2, 104, 4, 1, C.gold);
    }

    softkeys(p, S.back, S.accept);
  }

  private typeChar(ch: string): void {
    if (this.value.length >= 8) return;
    if (!/[\p{L}\p{N} .\-]/u.test(ch)) return;
    this.value += ch.toUpperCase();
  }

  private eraseChar(): void {
    this.value = this.value.slice(0, -1);
  }

  click(app: App): void {
    this.key(app, 'select');
  }

  key(app: App, key: Key): void {
    if (key === 'select') {
      const name = this.value.trim() || 'ИГРОК';
      app.settings.playerName = name;
      app.persistSettings();
      app.cue('select');
      app.input.textTarget = null;
      this.done();
    } else if (key === 'back') {
      app.pop();
    }
  }
}

// ----------------------------------------------------------- mission select

export class MissionSelectScreen implements Screen {
  private index = 0;
  private first = 0;

  draw(app: App, p: Painter): void {
    p.clear(C.bg);
    header(p, S.singleMission);

    const rowH = 14;
    const win = listWindow(this.index, MISSION_COUNT, rowH, FULL.h - 2, this.first);
    this.first = win.first;

    for (let i = 0; i < win.visible; i++) {
      const m = win.first + i;
      if (m >= MISSION_COUNT) break;
      const y = FULL.y + 2 + i * rowH;
      const locked = !isUnlocked(app.records, m);
      row(p, 2, y, SCREEN_W - 8, rowH, m === this.index);
      p.text(`${m + 1}.`, 5, y + 3, locked ? C.inkFaint : C.inkDim);
      const badge = locked ? 'ЗАКРЫТО' : '';
      const room = SCREEN_W - 10 - 17 - (badge ? p.measure(badge) + 4 : 0);
      p.textClipped(MISSIONS[m].name, 17, y + 3, room, locked ? C.inkFaint : C.ink);
      if (badge) p.text(badge, SCREEN_W - 10, y + 3, C.inkFaint, 'right');
    }

    scrollbar(p, { x: SCREEN_W - 4, y: FULL.y + 2, w: 2, h: FULL.h - 4 }, win.first, win.visible, MISSION_COUNT);
    softkeys(p, S.back, S.next);
  }

  click(app: App, _x: number, y: number): void {
    const index = this.first + Math.floor((y - (FULL.y + 2)) / 14);
    if (index < 0 || index >= MISSION_COUNT) return;
    if (index === this.index) this.key(app, 'select');
    else this.index = index;
  }

  key(app: App, key: Key): void {
    if (key === 'up') this.index = (this.index + MISSION_COUNT - 1) % MISSION_COUNT;
    else if (key === 'down') this.index = (this.index + 1) % MISSION_COUNT;
    else if (key === 'back') app.pop();
    else if (key === 'select') {
      if (!isUnlocked(app.records, this.index)) {
        app.cue('deny');
        return;
      }
      app.cue('select');
      app.push(new BriefingScreen(this.index, false));
    }
  }
}

// ----------------------------------------------------------------- briefing

export class BriefingScreen implements Screen {
  private scroll = 0;
  private height = 0;

  constructor(
    private readonly mission: number,
    private readonly campaign: boolean,
  ) {}

  draw(_app: App, p: Painter): void {
    p.clear(C.bg);
    const m = MISSIONS[this.mission];
    header(p, `${this.campaign ? S.campaignMission : S.mission} ${this.mission + 1}`);

    p.gradientV(0, FULL.y, SCREEN_W, 12, C.panelHi, C.panel);
    p.text(m.name, SCREEN_W / 2, FULL.y + 3, C.gold, 'center');

    const bodyY = FULL.y + 15;
    const bodyH = FULL.h - 15 - 46;
    this.height = scrollText(p, m.brief, 6, bodyY, SCREEN_W - 14, bodyH, this.scroll, C.ink);
    scrollbar(p, { x: SCREEN_W - 4, y: bodyY, w: 2, h: bodyH }, this.scroll, bodyH, Math.max(this.height, bodyH));

    const boxY = SCREEN_H - 46 - 13;
    p.panel(2, boxY, SCREEN_W - 4, 46, { fill: C.panelLo, raised: false });
    p.text(S.startData, 6, boxY + 3, C.orange);
    fieldLine(p, S.money, `${formatMoney(m.money)}$`, 6, boxY + 13, SCREEN_W - 12);
    fieldLine(p, S.rating, formatRating(m.rating), 6, boxY + 22, SCREEN_W - 12);
    if (m.goalType === 1) {
      fieldLine(p, S.goalSurvive, `${m.days}`, 6, boxY + 31, SCREEN_W - 12, C.basil);
    } else {
      fieldLine(p, `${S.goalEarn} / ${S.days}`, `${formatMoney(m.goalMoney)}$ / ${m.days}`, 6, boxY + 31, SCREEN_W - 12, C.basil);
    }

    softkeys(p, S.back, S.accept);
  }

  click(app: App, x: number, y: number): void {
    if (y >= SCREEN_H - 13) {
      this.key(app, x > SCREEN_W / 2 ? 'select' : 'back');
      return;
    }
    this.key(app, y > SCREEN_H / 2 ? 'down' : 'up');
  }

  key(app: App, key: Key): void {
    const bodyH = FULL.h - 15 - 46;
    const max = Math.max(0, this.height - bodyH + 6);
    if (key === 'down') this.scroll = Math.min(max, this.scroll + 9);
    else if (key === 'up') this.scroll = Math.max(0, this.scroll - 9);
    else if (key === 'back') app.pop();
    else if (key === 'select') {
      const state = createGame(
        {
          playerName: app.settings.playerName,
          difficulty: app.settings.difficulty,
          campaign: this.campaign,
          missionIndex: this.mission,
        },
        app.rng,
      );
      app.beginSession(state);
      app.cue('start');
      app.replace(new PlayScreen());
    }
  }

  onScroll(_app: App, dy: number): void {
    const bodyH = FULL.h - 15 - 46;
    const max = Math.max(0, this.height - bodyH + 6);
    this.scroll = Math.max(0, Math.min(max, this.scroll + dy));
  }
}

// ------------------------------------------------------------------- ending

export class EndingScreen implements Screen {
  private recorded = false;

  constructor(private readonly state: GameState) {}

  enter(app: App): void {
    if (this.recorded) return;
    this.recorded = true;
    const s = this.state;
    if (s.ending === 'win') {
      app.cue('win');
      app.records = recordWin(app.records, s.missionIndex, s.day, s.money, s.playerName);
    } else {
      app.cue('lose');
    }
    clearSave();
  }

  draw(app: App, p: Painter): void {
    const s = this.state;
    const won = s.ending === 'win';
    menuBackground(p, app.clock);
    header(p, won ? S.victory : S.defeat);

    drawLogoMark(p, SCREEN_W / 2, 44, won ? 18 : 14);

    const text =
      s.ending === 'win'
        ? ENDING.win
        : s.ending === 'time'
          ? ENDING.outOfTime
          : s.ending === 'bankrupt'
            ? ENDING.bankrupt
            : ENDING.unpopular;

    p.paragraph(text, 10, 70, SCREEN_W - 20, won ? C.gold : C.tomato, 2, 'center');

    const boxY = 118;
    p.panel(6, boxY, SCREEN_W - 12, 46, { fill: C.panelLo, raised: false });
    p.text(missionOf(s).name, SCREEN_W / 2, boxY + 3, C.orange, 'center');
    fieldLine(p, S.days, `${s.day}`, 10, boxY + 14, SCREEN_W - 20);
    fieldLine(p, S.money, `${formatMoney(s.money)}$`, 10, boxY + 23, SCREEN_W - 20);
    fieldLine(p, S.rating, formatRating(s.rating), 10, boxY + 32, SCREEN_W - 20);

    softkeys(p, S.toMenu, s.campaign && won ? S.next : undefined);
  }

  click(app: App): void {
    this.key(app, 'select');
  }

  key(app: App, key: Key): void {
    const s = this.state;
    if (key === 'select' && s.campaign && s.ending === 'win' && s.missionIndex + 1 < MISSION_COUNT) {
      app.endSession();
      app.reset(new MenuScreen());
      app.push(new BriefingScreen(s.missionIndex + 1, true));
      return;
    }
    if (key === 'select' || key === 'back') {
      app.endSession();
      app.reset(new MenuScreen());
    }
  }
}

// ------------------------------------------------------------- pause dialog

export class ConfirmScreen implements Screen {
  private index = 0;

  constructor(
    private readonly prompt: string,
    private readonly onYes: (app: App) => void,
    private readonly under: Screen,
  ) {}

  draw(app: App, p: Painter): void {
    this.under.draw(app, p);
    dialog(p, this.prompt, { yes: S.yes, no: S.cancel, selected: this.index });
  }

  click(app: App, x: number): void {
    this.index = x < SCREEN_W / 2 ? 0 : 1;
    this.key(app, 'select');
  }

  key(app: App, key: Key): void {
    if (key === 'left' || key === 'right') this.index = 1 - this.index;
    else if (key === 'back') app.pop();
    else if (key === 'select') {
      app.pop();
      if (this.index === 0) this.onYes(app);
    }
  }
}

/** Saves the current session; exposed here so the pause menu can reach it. */
export function saveSession(app: App): void {
  if (app.session) writeSave(app.session.state);
}
