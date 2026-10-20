import { GAME_IDS, GAME_TITLES } from '../frame/games';
import { THUMBS, type Thumb } from '../frame/layout';
import { parseAvoidWords } from '../shared/avoid';
import { dayKey } from '../shared/days';
import type { FamilyStats } from '../stats/family-stats';
import { renderFamily } from '../stats/family-view';
import { el } from '../ui/dom';
import { MAX_NAME_LENGTH, cleanName } from './name';
import { WEEKDAY_NAMES, currentLines, eventLine, eventRow, type EventEntry, type RepeatChoice } from './schedule-form';
import { START_LEVELS, type Settings, type StartLevel } from './settings';

/** A page opened by accident closes itself, as if Cancel was tapped, after this long untouched. */
const IDLE_CLOSE_MS = 5 * 60_000;

export interface SettingsPageOptions {
  /** First-time setup: "Set up Word Circle", Start playing, and no Cancel. */
  firstTime: boolean;
  /** Done or Start playing, with the new settings. */
  done(settings: Settings): void;
  /** Cancel, or left untouched for 5 minutes. Not offered the first time. */
  cancel(): void;
  /** The family's charts; null on first-time setup. */
  family: FamilyStats | null;
}

const THUMB_LABELS: Record<Thumb, string> = { left: 'Left', right: 'Right', none: 'Neither' };
const LEVEL_LABELS: Record<StartLevel, string> = { easy: 'Easy', medium: 'Medium', hard: 'Hard' };
const REPEATS: readonly RepeatChoice[] = ['once', 'daily', 'days'];
const REPEAT_LABELS: Record<RepeatChoice, string> = { once: 'Once', daily: 'Every day', days: 'Some days' };

/** The optional iPad steps that keep them in the game, from the owner's guide for Mom's iPad. Fixed text, no user input. */
const KEEP_IN_GAME = `
<h3>Lock the screen sideways</h3>
<p>Swipe down from the top-right corner to open Control Center, then tap <b>Rotation Lock</b> (a padlock inside a circular arrow).</p>
<h3>Guided Access</h3>
<p>It keeps them inside Word Circle, so swipes from the edges can't take them elsewhere.</p>
<ol>
  <li>Open <b>Settings › Accessibility › Guided Access</b> and turn it on.</li>
  <li>Tap <b>Passcode Settings › Set Guided Access Passcode</b> and choose a passcode only you know.</li>
  <li>Tap <b>Display Auto-Lock</b> and choose <b>15 Minutes</b>.</li>
  <li>Open Word Circle, quickly press the <b>top button</b> three times, then tap <b>Start</b>.</li>
</ol>
<p>To leave Guided Access, press the top button three times, enter the passcode, and tap <b>End</b>. On an iPad with a round Home button, triple-click the Home button instead.</p>
`;

function section(parent: HTMLElement, title: string): HTMLElement {
  const box = el('section', 'settings-section', parent);
  el('h2', '', box).textContent = title;
  return box;
}

function button(parent: HTMLElement, text: string, onClick: () => void, className = 'settings-button'): HTMLButtonElement {
  const node = el('button', className, parent);
  node.type = 'button';
  node.textContent = text;
  node.addEventListener('click', onClick);
  return node;
}

/** A row of buttons where one is chosen (shown pressed). */
function choices<T extends string>(
  parent: HTMLElement,
  values: readonly T[],
  label: (value: T) => string,
  current: () => T,
  choose: (value: T) => void,
): HTMLButtonElement[] {
  const row = el('div', 'settings-choices', parent);
  const buttons = values.map((value) =>
    button(
      row,
      label(value),
      () => {
        choose(value);
        mark();
      },
      'settings-choice',
    ),
  );
  const mark = () => buttons.forEach((node, i) => node.setAttribute('aria-pressed', String(values[i] === current())));
  mark();
  return buttons;
}

function field(parent: HTMLElement, label: string, type: string): HTMLInputElement {
  const box = el('label', 'settings-field', parent);
  el('span', '', box).textContent = label;
  const input = el('input', 'settings-input', box);
  input.type = type;
  return input;
}

/** Calls `onChange` as the value changes. The iPad's date and time pickers may only report "change", when Done is tapped. */
function onValue(input: HTMLInputElement, onChange: () => void): void {
  input.addEventListener('input', onChange);
  input.addEventListener('change', onChange);
}

function checkbox(parent: HTMLElement, label: string, checked: boolean, onChange: (box: HTMLInputElement) => void): HTMLInputElement {
  const row = el('label', 'settings-check', parent);
  const box = el('input', '', row);
  box.type = 'checkbox';
  box.checked = checked;
  row.append(label);
  box.addEventListener('change', () => onChange(box));
  return box;
}

/** The caregiver's settings page: ordinary controls at a comfortable size, over everything. Removes itself when closed. */
export function openSettingsPage(root: HTMLElement, settings: Settings, options: SettingsPageOptions): void {
  const today = dayKey(new Date());
  const draft = JSON.parse(JSON.stringify(settings)) as Settings;
  if (draft.schedule.source === 'device') draft.schedule = { source: 'device', lines: currentLines(draft.schedule.lines, today) };
  const entry: EventEntry = { what: '', repeat: 'once', date: today, days: [], time: '' };

  const page = el('div', 'settings-page', root);
  const sheet = el('div', 'settings-sheet', page);
  let idle = 0;
  const close = () => {
    window.clearTimeout(idle);
    page.remove();
  };
  const keepOpen = () => {
    if (options.firstTime) return;
    window.clearTimeout(idle);
    idle = window.setTimeout(() => {
      close();
      options.cancel();
    }, IDLE_CLOSE_MS);
  };
  page.addEventListener('pointerdown', keepOpen);
  page.addEventListener('input', keepOpen);
  keepOpen();

  // Only text up here: the finger that held the clock lifts over this corner.
  el('h1', 'settings-title', sheet).textContent = options.firstTime ? 'Set up Word Circle' : 'Settings';
  if (options.firstTime) {
    el('p', 'settings-intro', sheet).textContent = 'A few questions about who will play. You can change any of this later.';
  }
  el('p', 'settings-tip', sheet).textContent = 'To come back here, hold the clock for 3 seconds.';

  const nameBox = section(sheet, 'Name');
  const name = el('input', 'settings-input', nameBox);
  name.type = 'text';
  name.placeholder = 'Their first name (optional)';
  name.maxLength = MAX_NAME_LENGTH;
  name.autocomplete = 'off';
  name.value = draft.name;

  const thumbBox = section(sheet, 'Does a thumb rest on the screen while they play?');
  const thumbButtons = choices(thumbBox, THUMBS, (thumb) => THUMB_LABELS[thumb], () => draft.thumb, (thumb) => (draft.thumb = thumb));
  thumbButtons.forEach((node, i) => {
    // A small screen with its safe zones shaded, the wide one where the thumb rests.
    const picture = document.createElement('span');
    picture.className = `thumb-pic ${THUMBS[i]}`;
    node.prepend(picture);
  });

  const gamesBox = section(sheet, 'Games');
  const warning = el('p', 'settings-warn', gamesBox);
  for (const id of GAME_IDS) {
    checkbox(gamesBox, GAME_TITLES[id], draft.games.includes(id), (box) => {
      const games = GAME_IDS.filter((game) => (game === id ? box.checked : draft.games.includes(game)));
      if (games.length === 0) {
        box.checked = true;
        warning.textContent = 'Keep at least one game';
        return;
      }
      warning.textContent = '';
      draft.games = games;
    });
  }
  gamesBox.append(warning);
  el('h3', '', gamesBox).textContent = 'Starting level (Word Circle and Word Grid)';
  choices(gamesBox, START_LEVELS, (level) => LEVEL_LABELS[level], () => draft.startLevel, (level) => (draft.startLevel = level));
  el('h3', '', gamesBox).textContent = 'Word Guess';
  checkbox(gamesBox, "Show Share after today's Wordle", draft.share, (box) => (draft.share = box.checked));

  const scheduleBox = section(sheet, 'Schedule');
  const scheduleBody = el('div', '', scheduleBox);
  const renderSchedule = (): void => {
    scheduleBody.replaceChildren();
    const schedule = draft.schedule;
    if (schedule.source === 'web') {
      el('p', 'settings-note', scheduleBody).textContent = 'Events come from schedule.txt on GitHub.';
      button(scheduleBody, 'Type them here instead', () => {
        draft.schedule = { source: 'device', lines: [] };
        renderSchedule();
      });
      return;
    }
    const list = el('ul', 'settings-events', scheduleBody);
    if (schedule.lines.length === 0) el('li', 'settings-empty', list).textContent = 'No events yet';
    schedule.lines.forEach((line, i) => {
      const item = el('li', 'settings-event', list);
      el('span', '', item).textContent = eventRow(line) ?? line;
      button(item, 'Delete', () => {
        schedule.lines.splice(i, 1);
        renderSchedule();
      });
    });

    const form = el('div', 'settings-add', scheduleBody);
    el('h3', '', form).textContent = 'Add event';
    const what = field(form, 'What', 'text');
    what.placeholder = 'For example, Supper';
    what.value = entry.what;
    choices(form, REPEATS, (repeat) => REPEAT_LABELS[repeat], () => entry.repeat, (repeat) => {
      entry.repeat = repeat;
      renderSchedule();
    });
    let update = () => {};
    if (entry.repeat === 'once') {
      const date = field(form, 'Date', 'date');
      date.min = today;
      date.value = entry.date;
      onValue(date, () => {
        entry.date = date.value;
        update();
      });
    }
    if (entry.repeat === 'days') {
      // Several days can be on at once, so each button keeps its own pressed look.
      const row = el('div', 'settings-choices', form);
      WEEKDAY_NAMES.forEach((dayName, day) => {
        const mark = () => node.setAttribute('aria-pressed', String(entry.days.includes(day)));
        const node = button(
          row,
          dayName,
          () => {
            entry.days = entry.days.includes(day) ? entry.days.filter((d) => d !== day) : [...entry.days, day];
            mark();
            update();
          },
          'settings-choice',
        );
        mark();
      });
    }
    const time = field(form, 'Time', 'time');
    time.value = entry.time;
    const add = button(form, 'Add', () => {
      const line = eventLine(entry);
      if (!line) return;
      schedule.lines.push(line);
      entry.what = '';
      entry.time = '';
      entry.days = [];
      renderSchedule();
    });
    update = () => {
      add.disabled = eventLine(entry) === null;
    };
    what.addEventListener('input', () => {
      entry.what = what.value;
      update();
    });
    onValue(time, () => {
      entry.time = time.value;
      update();
    });
    update();
  };
  renderSchedule();

  const avoidBox = section(sheet, 'Words to avoid');
  el('p', 'settings-note', avoidBox).textContent = 'Words to keep out of every game. Separate them with commas or new lines.';
  const avoid = el('textarea', 'settings-input', avoidBox);
  avoid.rows = 3;
  avoid.value = draft.avoid.join(', ');
  const count = el('p', 'settings-note', avoidBox);
  const showCount = () => {
    const n = draft.avoid.length;
    count.textContent = `${n} word${n === 1 ? '' : 's'}`;
  };
  avoid.addEventListener('input', () => {
    draft.avoid = parseAvoidWords(avoid.value);
    showCount();
  });
  showCount();

  const keep = el('details', 'settings-section settings-keep', sheet);
  el('summary', '', keep).textContent = 'Keep them in the game (optional)';
  keep.insertAdjacentHTML('beforeend', KEEP_IN_GAME);

  if (options.family) {
    const doing = el('details', 'settings-section settings-family', sheet);
    el('summary', '', doing).textContent = draft.name ? `How ${draft.name} is doing` : "How they're doing";
    renderFamily(doing, options.family);
  }

  el('p', 'settings-privacy', sheet).textContent = 'Everything on this page stays on this iPad. Visits and finished puzzles are counted with Google Analytics; never names, words or schedules.';
  const actions = el('div', 'settings-actions', sheet);
  if (!options.firstTime) {
    button(
      actions,
      'Cancel',
      () => {
        close();
        options.cancel();
      },
      'settings-cancel',
    );
  }
  button(
    actions,
    options.firstTime ? 'Start playing' : 'Done',
    () => {
      draft.name = cleanName(name.value);
      close();
      options.done(draft);
    },
    'settings-done',
  );
}
