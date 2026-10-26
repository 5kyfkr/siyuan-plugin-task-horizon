(function () {
    'use strict';

    function createTaskStatusRules() {
        // 只处理状态语义；不读取设置、不写任务，也不处理循环轮次。
        const defaults = [
            { id: 'todo', name: '待办', color: '#757575', marker: ' ' },
            { id: 'in_progress', name: '进行中', color: '#2196F3', marker: '/' },
            { id: 'done', name: '已完成', color: '#4CAF50', marker: 'X' },
            { id: 'cancelled', name: '放弃', color: '#9E9E9E', marker: '-' },
            { id: 'blocked', name: '阻塞', color: '#F44336', marker: ' ' },
            { id: 'review', name: '待审核', color: '#FF9800', marker: ' ' },
        ];
        const markerPattern = /^([ \t]*)(?:[-*+]|\d+[.)])[ \t]*(?:(?:\{:[ \t]*[^}\r\n]*\})[ \t]*)*\[([^\]\r\n]?)\][ \t]*/;
        function normalizeMarker(value, fallback = ' ') {
            const raw = value === '__space__' ? ' ' : String(value == null ? '' : value);
            if (raw.length === 1 && /^[\x20-\x7e]$/.test(raw) && raw !== '[' && raw !== ']') return raw === 'x' ? 'X' : raw;
            if (fallback === '') return '';
            return fallback === value ? ' ' : normalizeMarker(fallback, ' ');
        }
        function guessMarker(option) {
            const id = String(option?.id || '').trim().toLowerCase();
            const name = String(option?.name || '').trim().toLowerCase();
            const source = `${id} ${name}`;
            // 旧配置缺失 marker 时保留原有推断，避免把空格状态静默改成 /。
            if (['todo', 'undone', 'in_progress', 'blocked', 'review'].includes(id) || /待办|未完成|进行中|阻塞|审核/.test(source)) return ' ';
            return id === 'done' || name.includes('完成') ? 'X' : ' ';
        }
        function optionMarker(option) {
            return normalizeMarker(option?.marker, guessMarker(option));
        }
        function isLegacyDefaultOptions(input) {
            const legacy = [
                { id: 'todo', name: '待办', color: '#757575', marker: ' ' },
                { id: 'done', name: '已完成', color: '#4CAF50', marker: 'X' },
                { id: 'cancelled', name: '已取消', color: '#9E9E9E', marker: '-' },
                { id: 'blocked', name: '阻塞', color: '#F44336', marker: ' ' },
                { id: 'review', name: '待审核', color: '#FF9800', marker: ' ' },
            ];
            if (!Array.isArray(input) || input.length !== legacy.length) return false;
            return input.every((item, index) => {
                const expected = legacy[index];
                return item && String(item.id || item.value || '').trim() === expected.id
                    && String(item.name || item.label || '').trim() === expected.name
                    && String(item.color || '').trim().toUpperCase() === expected.color
                    && (!Object.prototype.hasOwnProperty.call(item, 'marker') || normalizeMarker(item.marker, '') === expected.marker);
            });
        }
        function isDone(marker, legacy = false) {
            const value = normalizeMarker(marker);
            return legacy ? value === 'X' : value !== ' ' && value !== '/' && value !== '-';
        }
        function isClosed(marker, legacy = false) {
            const value = normalizeMarker(marker);
            return legacy ? value === 'X' : value !== ' ' && value !== '/';
        }
        function fromMarkdown(markdown) {
            const match = markerPattern.exec(String(markdown || '').split(/\r?\n/, 1)[0]);
            return match ? normalizeMarker(match[2] || ' ') : '';
        }
        function fromElement(element) {
            if (!element?.getAttribute) return '';
            const own = normalizeMarker(element.getAttribute('data-task'), '');
            if (own) return own;
            const action = element.querySelector?.(':scope > .protyle-action--task');
            return normalizeMarker(action?.getAttribute?.('data-task'), '');
        }
        function normalizeOptions(input, legacy = false, fillNative = true) {
            const seen = new Set();
            const result = [];
            const source = !legacy && fillNative && isLegacyDefaultOptions(input)
                ? defaults
                : (Array.isArray(input) ? input : []);
            source.forEach((item) => {
                const id = String(item?.id || item?.value || '').trim();
                if (!id || seen.has(id)) return;
                seen.add(id);
                const name = String(item?.name || item?.label || id).trim() || id;
                result.push({ id, name, color: String(item?.color || '#757575'), marker: optionMarker({ ...item, id, name }) });
            });
            if (!result.length) result.push(...defaults.filter((item) => !legacy || item.marker !== '/').map((item) => ({ ...item })));
            if (!legacy && fillNative) {
                defaults.filter((item) => item.marker === '/' || item.marker === '-').forEach((preset) => {
                    if (result.some((item) => item.marker === preset.marker)) return;
                    // 固定、可重复计算的 ID；用户已占用默认 ID 时不覆盖它。
                    let id = preset.id;
                    for (let suffix = 1; result.some((item) => item.id === id); suffix++) id = `${preset.id}_native${suffix === 1 ? '' : suffix}`;
                    result.push({ ...preset, id });
                });
            }
            return result;
        }
        function resolveOption(marker, statusId, options, fallbackId = '') {
            const value = normalizeMarker(marker, '');
            const current = options.find((item) => item.id === statusId);
            if (current && (!value || optionMarker(current) === value)) return current;
            if (value === ' ') {
                const fallback = options.find((item) => item.id === fallbackId && optionMarker(item) === ' ');
                if (fallback) return fallback;
            }
            return options.find((item) => optionMarker(item) === value) || null;
        }
        function sqlMarker(expression) {
            const line = `substr(${expression}, 1, instr(${expression} || char(10), char(10)) - 1)`;
            // 只取任务自身首行的标记，避免子任务和标题中的 [x] 污染完成筛选。
            const open = `instr(${line}, '[')`;
            const token = `substr(${line}, ${open}, 3)`;
            return `(CASE WHEN ${open} > 0 AND substr(${token}, 3, 1) = ']' THEN CASE substr(${token}, 2, 1) WHEN 'x' THEN 'X' ELSE substr(${token}, 2, 1) END ELSE ' ' END)`;
        }
        function sqlDone(expression) {
            return `(${sqlMarker(expression)} NOT IN (' ', '/', '-'))`;
        }
        function conflicts(options) {
            const byMarker = new Map();
            options.forEach((item) => {
                const marker = optionMarker(item);
                if (marker === ' ') return;
                if (!byMarker.has(marker)) byMarker.set(marker, []);
                byMarker.get(marker).push(item);
            });
            return Array.from(byMarker, ([marker, items]) => ({ marker, items })).filter((item) => item.items.length > 1);
        }
        return Object.freeze({ normalizeMarker, guessMarker, optionMarker, isDone, isClosed, fromMarkdown, fromElement, normalizeOptions, resolveOption, conflicts, sqlMarker, sqlDone });
    }
    const TaskStatus = createTaskStatusRules();

    /* generated task recurrence: begin */
    // Generated by scripts/sync-kernel-recurrence.js. Edit the task runtime sources.
    const TaskRecurrence = (() => {
    // Keep the vendored runtime local to this adapter, including its MIT notice.
    const globalThis = { FSRS: (() => {
        const exports = {};
        const module = { exports };
/*!
 * ts-fsrs 5.4.1
 * MIT License
 * Copyright (c) 2026 Open Spaced Repetition
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */
(function (global, factory) {
  typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports) :
  typeof define === 'function' && define.amd ? define(['exports'], factory) :
  (global = typeof globalThis !== 'undefined' ? globalThis : global || self, factory(global.FSRS = {}));
})(this, (function (exports) { 'use strict';

  class FSRSError extends Error {
    constructor(message = "FSRS Error") {
      var _a;
      super(message);
      this.name = "FSRSError";
      (_a = Error.captureStackTrace) == null ? void 0 : _a.call(Error, this, FSRSError);
    }
  }
  class FSRSValidationError extends FSRSError {
    constructor(message) {
      var _a;
      super(message);
      this.name = "FSRSValidationError";
      (_a = Error.captureStackTrace) == null ? void 0 : _a.call(Error, this, FSRSValidationError);
    }
  }

  var State = /* @__PURE__ */ ((State2) => {
    State2[State2["New"] = 0] = "New";
    State2[State2["Learning"] = 1] = "Learning";
    State2[State2["Review"] = 2] = "Review";
    State2[State2["Relearning"] = 3] = "Relearning";
    return State2;
  })(State || {});
  var Rating = /* @__PURE__ */ ((Rating2) => {
    Rating2[Rating2["Manual"] = 0] = "Manual";
    Rating2[Rating2["Again"] = 1] = "Again";
    Rating2[Rating2["Hard"] = 2] = "Hard";
    Rating2[Rating2["Good"] = 3] = "Good";
    Rating2[Rating2["Easy"] = 4] = "Easy";
    return Rating2;
  })(Rating || {});

  var __defProp$6 = Object.defineProperty;
  var __defProps$2 = Object.defineProperties;
  var __getOwnPropDescs$2 = Object.getOwnPropertyDescriptors;
  var __getOwnPropSymbols$2 = Object.getOwnPropertySymbols;
  var __hasOwnProp$2 = Object.prototype.hasOwnProperty;
  var __propIsEnum$2 = Object.prototype.propertyIsEnumerable;
  var __defNormalProp$6 = (obj, key, value) => key in obj ? __defProp$6(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
  var __spreadValues$2 = (a, b) => {
    for (var prop in b || (b = {}))
      if (__hasOwnProp$2.call(b, prop))
        __defNormalProp$6(a, prop, b[prop]);
    if (__getOwnPropSymbols$2)
      for (var prop of __getOwnPropSymbols$2(b)) {
        if (__propIsEnum$2.call(b, prop))
          __defNormalProp$6(a, prop, b[prop]);
      }
    return a;
  };
  var __spreadProps$2 = (a, b) => __defProps$2(a, __getOwnPropDescs$2(b));
  class TypeConvert {
    static card(card) {
      return __spreadProps$2(__spreadValues$2({}, card), {
        state: TypeConvert.state(card.state),
        due: TypeConvert.time(card.due),
        last_review: card.last_review ? TypeConvert.time(card.last_review) : void 0
      });
    }
    static rating(value) {
      if (typeof value === "string") {
        const firstLetter = value.charAt(0).toUpperCase();
        const restOfString = value.slice(1).toLowerCase();
        const ret = Rating[`${firstLetter}${restOfString}`];
        if (ret === void 0) {
          throw new FSRSValidationError(`Invalid rating:[${value}]`);
        }
        return ret;
      } else if (typeof value === "number") {
        return value;
      }
      throw new FSRSValidationError(`Invalid rating:[${value}]`);
    }
    static state(value) {
      if (typeof value === "string") {
        const firstLetter = value.charAt(0).toUpperCase();
        const restOfString = value.slice(1).toLowerCase();
        const ret = State[`${firstLetter}${restOfString}`];
        if (ret === void 0) {
          throw new FSRSValidationError(`Invalid state:[${value}]`);
        }
        return ret;
      } else if (typeof value === "number") {
        return value;
      }
      throw new FSRSValidationError(`Invalid state:[${value}]`);
    }
    static time(value) {
      if (value instanceof Date) {
        return value;
      }
      const date = new Date(value);
      if (typeof value === "object" && value !== null && !Number.isNaN(Date.parse(value) || +date)) {
        return date;
      } else if (typeof value === "string") {
        const timestamp = Date.parse(value);
        if (!Number.isNaN(timestamp)) {
          return new Date(timestamp);
        } else {
          throw new FSRSValidationError(`Invalid date:[${value}]`);
        }
      } else if (typeof value === "number") {
        return new Date(value);
      }
      throw new FSRSValidationError(`Invalid date:[${value}]`);
    }
    static review_log(log) {
      return __spreadProps$2(__spreadValues$2({}, log), {
        due: TypeConvert.time(log.due),
        rating: TypeConvert.rating(log.rating),
        state: TypeConvert.state(log.state),
        review: TypeConvert.time(log.review)
      });
    }
  }

  /* istanbul ignore next -- @preserve */
  Date.prototype.scheduler = function(t, isDay) {
    return date_scheduler(this, t, isDay);
  };
  /* istanbul ignore next -- @preserve */
  Date.prototype.diff = function(pre, unit) {
    return date_diff(this, pre, unit);
  };
  /* istanbul ignore next -- @preserve */
  Date.prototype.format = function() {
    return formatDate(this);
  };
  /* istanbul ignore next -- @preserve */
  Date.prototype.dueFormat = function(last_review, unit, timeUnit) {
    return show_diff_message(this, last_review, unit, timeUnit);
  };
  function date_scheduler(now, t, isDay) {
    return new Date(
      isDay ? TypeConvert.time(now).getTime() + t * 24 * 60 * 60 * 1e3 : TypeConvert.time(now).getTime() + t * 60 * 1e3
    );
  }
  function date_diff(now, pre, unit) {
    if (!now || !pre) {
      throw new FSRSValidationError("Invalid date");
    }
    const diff = TypeConvert.time(now).getTime() - TypeConvert.time(pre).getTime();
    let r = 0;
    switch (unit) {
      case "days":
        r = Math.floor(diff / (24 * 60 * 60 * 1e3));
        break;
      case "minutes":
        r = Math.floor(diff / (60 * 1e3));
        break;
    }
    return r;
  }
  function formatDate(dateInput) {
    const date = TypeConvert.time(dateInput);
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const hours = date.getHours();
    const minutes = date.getMinutes();
    const seconds = date.getSeconds();
    return `${year}-${padZero(month)}-${padZero(day)} ${padZero(hours)}:${padZero(
    minutes
  )}:${padZero(seconds)}`;
  }
  function padZero(num) {
    return num < 10 ? `0${num}` : `${num}`;
  }
  const TIMEUNIT = [60, 60, 24, 31, 12];
  const TIMEUNITFORMAT = ["second", "min", "hour", "day", "month", "year"];
  function show_diff_message(due, last_review, unit, timeUnit = TIMEUNITFORMAT) {
    due = TypeConvert.time(due);
    last_review = TypeConvert.time(last_review);
    if (timeUnit.length !== TIMEUNITFORMAT.length) {
      timeUnit = TIMEUNITFORMAT;
    }
    let diff = due.getTime() - last_review.getTime();
    let i = 0;
    diff /= 1e3;
    for (i = 0; i < TIMEUNIT.length; i++) {
      if (diff < TIMEUNIT[i]) {
        break;
      } else {
        diff /= TIMEUNIT[i];
      }
    }
    return `${Math.floor(diff)}${unit ? timeUnit[i] : ""}`;
  }
  /* istanbul ignore next -- @preserve */
  function fixDate(value) {
    return TypeConvert.time(value);
  }
  /* istanbul ignore next -- @preserve */
  function fixState(value) {
    return TypeConvert.state(value);
  }
  /* istanbul ignore next -- @preserve */
  function fixRating(value) {
    return TypeConvert.rating(value);
  }
  const Grades = Object.freeze([
    Rating.Again,
    Rating.Hard,
    Rating.Good,
    Rating.Easy
  ]);
  const FUZZ_RANGES = [
    {
      start: 2.5,
      end: 7,
      factor: 0.15
    },
    {
      start: 7,
      end: 20,
      factor: 0.1
    },
    {
      start: 20,
      end: Infinity,
      factor: 0.05
    }
  ];
  function get_fuzz_range(interval, elapsed_days, maximum_interval) {
    let delta = 1;
    for (const range of FUZZ_RANGES) {
      delta += range.factor * Math.max(Math.min(interval, range.end) - range.start, 0);
    }
    interval = Math.min(interval, maximum_interval);
    let min_ivl = Math.max(2, Math.round(interval - delta));
    const max_ivl = Math.min(Math.round(interval + delta), maximum_interval);
    if (interval > elapsed_days) {
      min_ivl = Math.max(min_ivl, elapsed_days + 1);
    }
    min_ivl = Math.min(min_ivl, max_ivl);
    return { min_ivl, max_ivl };
  }
  function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
  }
  function roundTo(num, decimals) {
    const factor = 10 ** decimals;
    return Math.round(num * factor) / factor;
  }
  function dateDiffInDays(last, cur) {
    const utc1 = Date.UTC(
      last.getUTCFullYear(),
      last.getUTCMonth(),
      last.getUTCDate()
    );
    const utc2 = Date.UTC(
      cur.getUTCFullYear(),
      cur.getUTCMonth(),
      cur.getUTCDate()
    );
    return Math.floor(
      (utc2 - utc1) / 864e5
      /** 1000 * 60 * 60 * 24*/
    );
  }

  const ConvertStepUnitToMinutes = (step) => {
    const unit = step.slice(-1);
    const value = parseInt(step.slice(0, -1), 10);
    if (Number.isNaN(value) || !Number.isFinite(value) || value < 0) {
      throw new FSRSValidationError(`Invalid step value: ${step}`);
    }
    switch (unit) {
      case "m":
        return value;
      case "h":
        return value * 60;
      case "d":
        return value * 1440;
      default:
        throw new FSRSValidationError(
          `Invalid step unit: ${step}, expected m/h/d`
        );
    }
  };
  const BasicLearningStepsStrategy = (params, state, cur_step) => {
    const learning_steps = state === State.Relearning || state === State.Review ? params.relearning_steps : params.learning_steps;
    const steps_length = learning_steps.length;
    if (steps_length === 0 || cur_step >= steps_length) return {};
    const firstStep = learning_steps[0];
    const toMinutes = ConvertStepUnitToMinutes;
    const getAgainInterval = () => {
      return toMinutes(firstStep);
    };
    const getHardInterval = () => {
      if (steps_length === 1) return Math.round(toMinutes(firstStep) * 1.5);
      const nextStep = learning_steps[1];
      return Math.round((toMinutes(firstStep) + toMinutes(nextStep)) / 2);
    };
    const getStepInfo = (index) => {
      if (index < 0 || index >= steps_length) {
        return null;
      } else {
        return learning_steps[index];
      }
    };
    const getGoodMinutes = (step) => {
      return toMinutes(step);
    };
    const result = {};
    const step_info = getStepInfo(Math.max(0, cur_step));
    if (state === State.Review) {
      result[Rating.Again] = {
        scheduled_minutes: toMinutes(step_info),
        next_step: 0
      };
      return result;
    } else {
      result[Rating.Again] = {
        scheduled_minutes: getAgainInterval(),
        next_step: 0
      };
      result[Rating.Hard] = {
        scheduled_minutes: getHardInterval(),
        next_step: cur_step
      };
      const next_info = getStepInfo(cur_step + 1);
      if (next_info) {
        const nextMin = getGoodMinutes(next_info);
        if (nextMin) {
          result[Rating.Good] = {
            scheduled_minutes: Math.round(nextMin),
            next_step: cur_step + 1
          };
        }
      }
    }
    return result;
  };

  function DefaultInitSeedStrategy() {
    const time = this.review_time.getTime();
    const reps = this.current.reps;
    const mul = this.current.difficulty * this.current.stability;
    return `${time}_${reps}_${mul}`;
  }
  function GenSeedStrategyWithCardId(card_id_field) {
    return function() {
      var _a;
      const card_id = (_a = Reflect.get(this.current, card_id_field)) != null ? _a : 0;
      const reps = this.current.reps;
      return String(card_id + reps || 0);
    };
  }

  var StrategyMode = /* @__PURE__ */ ((StrategyMode2) => {
    StrategyMode2["SCHEDULER"] = "Scheduler";
    StrategyMode2["LEARNING_STEPS"] = "LearningSteps";
    StrategyMode2["SEED"] = "Seed";
    return StrategyMode2;
  })(StrategyMode || {});

  var __defProp$5 = Object.defineProperty;
  var __defNormalProp$5 = (obj, key, value) => key in obj ? __defProp$5(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
  var __publicField$5 = (obj, key, value) => __defNormalProp$5(obj, typeof key !== "symbol" ? key + "" : key, value);
  class AbstractScheduler {
    // init
    constructor(card, now, algorithm, strategies) {
      __publicField$5(this, "last");
      __publicField$5(this, "current");
      __publicField$5(this, "review_time");
      __publicField$5(this, "next", /* @__PURE__ */ new Map());
      __publicField$5(this, "algorithm");
      __publicField$5(this, "strategies");
      __publicField$5(this, "elapsed_days", 0);
      this.algorithm = algorithm;
      this.last = TypeConvert.card(card);
      this.current = TypeConvert.card(card);
      this.review_time = TypeConvert.time(now);
      this.strategies = strategies;
      this.init();
    }
    checkGrade(grade) {
      if (!Number.isFinite(grade) || grade < 1 || grade > 4) {
        throw new FSRSValidationError(`Invalid grade "${grade}",expected 1-4`);
      }
    }
    init() {
      const { state, last_review } = this.current;
      let interval = 0;
      if (state !== State.New && last_review) {
        interval = dateDiffInDays(last_review, this.review_time);
      }
      this.current.last_review = this.review_time;
      this.elapsed_days = interval;
      this.current.elapsed_days = interval;
      this.current.reps += 1;
      let seed_strategy = DefaultInitSeedStrategy;
      if (this.strategies) {
        const custom_strategy = this.strategies.get(StrategyMode.SEED);
        if (custom_strategy) {
          seed_strategy = custom_strategy;
        }
      }
      this.algorithm.seed = seed_strategy.call(this);
    }
    preview() {
      return {
        [Rating.Again]: this.review(Rating.Again),
        [Rating.Hard]: this.review(Rating.Hard),
        [Rating.Good]: this.review(Rating.Good),
        [Rating.Easy]: this.review(Rating.Easy),
        [Symbol.iterator]: this.previewIterator.bind(this)
      };
    }
    *previewIterator() {
      for (const grade of Grades) {
        yield this.review(grade);
      }
    }
    review(grade) {
      const { state } = this.last;
      let item;
      this.checkGrade(grade);
      switch (state) {
        case State.New:
          item = this.newState(grade);
          break;
        case State.Learning:
        case State.Relearning:
          item = this.learningState(grade);
          break;
        case State.Review:
          item = this.reviewState(grade);
          break;
      }
      return item;
    }
    buildLog(rating) {
      const { last_review, due, elapsed_days } = this.last;
      return {
        rating,
        state: this.current.state,
        due: last_review || due,
        stability: this.current.stability,
        difficulty: this.current.difficulty,
        elapsed_days: this.elapsed_days,
        last_elapsed_days: elapsed_days,
        scheduled_days: this.current.scheduled_days,
        learning_steps: this.current.learning_steps,
        review: this.review_time
      };
    }
  }

  var __defProp$4 = Object.defineProperty;
  var __defNormalProp$4 = (obj, key, value) => key in obj ? __defProp$4(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
  var __publicField$4 = (obj, key, value) => __defNormalProp$4(obj, typeof key !== "symbol" ? key + "" : key, value);
  class Alea {
    constructor(seed) {
      __publicField$4(this, "c");
      __publicField$4(this, "s0");
      __publicField$4(this, "s1");
      __publicField$4(this, "s2");
      const mash = Mash();
      this.c = 1;
      this.s0 = mash(" ");
      this.s1 = mash(" ");
      this.s2 = mash(" ");
      if (seed == null) seed = Date.now();
      this.s0 -= mash(seed);
      if (this.s0 < 0) this.s0 += 1;
      this.s1 -= mash(seed);
      if (this.s1 < 0) this.s1 += 1;
      this.s2 -= mash(seed);
      if (this.s2 < 0) this.s2 += 1;
    }
    next() {
      const t = 2091639 * this.s0 + this.c * 23283064365386963e-26;
      this.s0 = this.s1;
      this.s1 = this.s2;
      this.c = t | 0;
      this.s2 = t - this.c;
      return this.s2;
    }
    set state(state) {
      this.c = state.c;
      this.s0 = state.s0;
      this.s1 = state.s1;
      this.s2 = state.s2;
    }
    get state() {
      return {
        c: this.c,
        s0: this.s0,
        s1: this.s1,
        s2: this.s2
      };
    }
  }
  function Mash() {
    let n = 4022871197;
    return function mash(data) {
      data = String(data);
      for (let i = 0; i < data.length; i++) {
        n += data.charCodeAt(i);
        let h = 0.02519603282416938 * n;
        n = h >>> 0;
        h -= n;
        h *= n;
        n = h >>> 0;
        h -= n;
        n += h * 4294967296;
      }
      return (n >>> 0) * 23283064365386963e-26;
    };
  }
  function alea(seed) {
    const xg = new Alea(seed);
    const prng = () => xg.next();
    prng.int32 = () => xg.next() * 4294967296 | 0;
    prng.double = () => prng() + (prng() * 2097152 | 0) * 11102230246251565e-32;
    prng.state = () => xg.state;
    prng.importState = (state) => {
      xg.state = state;
      return prng;
    };
    return prng;
  }

  const version="5.4.1";

  const default_request_retention = 0.9;
  const default_maximum_interval = 36500;
  const default_enable_fuzz = false;
  const default_enable_short_term = true;
  const default_learning_steps = Object.freeze([
    "1m",
    "10m"
  ]);
  const default_relearning_steps = Object.freeze([
    "10m"
  ]);
  const FSRSVersion = `v${version} using FSRS-6.0`;
  const S_MIN = 1e-3;
  const S_MAX = 36500;
  const INIT_S_MAX = 100;
  const FSRS5_DEFAULT_DECAY = 0.5;
  const FSRS6_DEFAULT_DECAY = 0.1542;
  const default_w = Object.freeze([
    0.212,
    1.2931,
    2.3065,
    8.2956,
    6.4133,
    0.8334,
    3.0194,
    1e-3,
    1.8722,
    0.1666,
    0.796,
    1.4835,
    0.0614,
    0.2629,
    1.6483,
    0.6014,
    1.8729,
    0.5425,
    0.0912,
    0.0658,
    FSRS6_DEFAULT_DECAY
  ]);
  const W17_W18_Ceiling = 2;
  const CLAMP_PARAMETERS = (w17_w18_ceiling, enable_short_term = default_enable_short_term) => [
    [S_MIN, INIT_S_MAX],
    [S_MIN, INIT_S_MAX],
    [S_MIN, INIT_S_MAX],
    [S_MIN, INIT_S_MAX],
    [1, 10],
    [1e-3, 4],
    [1e-3, 4],
    [1e-3, 0.75],
    [0, 4.5],
    [0, 0.8],
    [1e-3, 3.5],
    [1e-3, 5],
    [1e-3, 0.25],
    [1e-3, 0.9],
    [0, 4],
    [0, 1],
    [1, 6],
    [0, w17_w18_ceiling],
    [0, w17_w18_ceiling],
    [
      enable_short_term ? 0.01 : 0,
      0.8
    ],
    [0.1, 0.8]
  ];

  const clipParameters = (parameters, numRelearningSteps, enableShortTerm = default_enable_short_term) => {
    const clip = CLAMP_PARAMETERS(W17_W18_Ceiling, enableShortTerm).slice(
      0,
      parameters.length
    );
    if (Math.max(0, numRelearningSteps) > 1) {
      const w11 = clamp(parameters[11] || 0, clip[11][0], clip[11][1]);
      const w13 = clamp(parameters[13] || 0, clip[13][0], clip[13][1]);
      const w14 = clamp(parameters[14] || 0, clip[14][0], clip[14][1]);
      const value = -(Math.log(w11) + Math.log(Math.pow(2, w13) - 1) + w14 * 0.3) / numRelearningSteps;
      const w17_w18_ceiling = clamp(
        roundTo(Math.sqrt(Math.max(value, 0)), 8),
        0.01,
        W17_W18_Ceiling
      );
      if (clip[17]) clip[17] = [clip[17][0], w17_w18_ceiling];
      if (clip[18]) clip[18] = [clip[18][0], w17_w18_ceiling];
    }
    return clip.map(
      ([min, max], index) => clamp(parameters[index] || 0, min, max)
    );
  };
  const checkParameters = (parameters) => {
    const invalid = parameters.find((param) => !Number.isFinite(param));
    if (invalid !== void 0) {
      throw new FSRSValidationError(
        `Non-finite or NaN value in parameters ${parameters}`
      );
    } else if (![17, 19, 21].includes(parameters.length)) {
      throw new FSRSValidationError(
        `Invalid parameter length: ${parameters.length}. Must be 17, 19 or 21 for FSRSv4, 5 and 6 respectively.`
      );
    }
    return parameters;
  };
  const migrateParameters = (parameters, numRelearningSteps = 0, enableShortTerm = default_enable_short_term) => {
    if (parameters === void 0) {
      return [...default_w];
    }
    switch (parameters.length) {
      case 21:
        return clipParameters(
          Array.from(parameters),
          numRelearningSteps,
          enableShortTerm
        );
      case 19:
        console.debug("[FSRS-6]auto fill w from 19 to 21 length");
        return clipParameters(
          Array.from(parameters),
          numRelearningSteps,
          enableShortTerm
        ).concat([0, FSRS5_DEFAULT_DECAY]);
      case 17: {
        const w = clipParameters(
          Array.from(parameters),
          numRelearningSteps,
          enableShortTerm
        );
        w[4] = +(w[5] * 2 + w[4]).toFixed(8);
        w[5] = +(Math.log(w[5] * 3 + 1) / 3).toFixed(8);
        w[6] = +(w[6] + 0.5).toFixed(8);
        console.debug("[FSRS-6]auto fill w from 17 to 21 length");
        return w.concat([0, 0, 0, FSRS5_DEFAULT_DECAY]);
      }
      default:
        console.warn("[FSRS]Invalid parameters length, using default parameters");
        return [...default_w];
    }
  };
  const generatorParameters = (props) => {
    var _a, _b;
    const learning_steps = Array.isArray(props == null ? void 0 : props.learning_steps) ? props.learning_steps : default_learning_steps;
    const relearning_steps = Array.isArray(props == null ? void 0 : props.relearning_steps) ? props.relearning_steps : default_relearning_steps;
    const enable_short_term = (_a = props == null ? void 0 : props.enable_short_term) != null ? _a : default_enable_short_term;
    const w = migrateParameters(
      props == null ? void 0 : props.w,
      relearning_steps.length,
      enable_short_term
    );
    return {
      request_retention: (props == null ? void 0 : props.request_retention) || default_request_retention,
      maximum_interval: (props == null ? void 0 : props.maximum_interval) || default_maximum_interval,
      w,
      enable_fuzz: (_b = props == null ? void 0 : props.enable_fuzz) != null ? _b : default_enable_fuzz,
      enable_short_term,
      learning_steps,
      relearning_steps
    };
  };
  function createEmptyCard(now, afterHandler) {
    const emptyCard = {
      due: now ? TypeConvert.time(now) : /* @__PURE__ */ new Date(),
      stability: 0,
      difficulty: 0,
      elapsed_days: 0,
      scheduled_days: 0,
      reps: 0,
      lapses: 0,
      learning_steps: 0,
      state: State.New,
      last_review: void 0
    };
    if (afterHandler && typeof afterHandler === "function") {
      return afterHandler(emptyCard);
    } else {
      return emptyCard;
    }
  }

  var __defProp$3 = Object.defineProperty;
  var __defNormalProp$3 = (obj, key, value) => key in obj ? __defProp$3(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
  var __publicField$3 = (obj, key, value) => __defNormalProp$3(obj, typeof key !== "symbol" ? key + "" : key, value);
  const computeDecayFactor = (decayOrParams) => {
    const decay = typeof decayOrParams === "number" ? -decayOrParams : -decayOrParams[20];
    const factor = Math.exp(Math.pow(decay, -1) * Math.log(0.9)) - 1;
    return { decay, factor: roundTo(factor, 8) };
  };
  function forgetting_curve(decayOrParams, elapsed_days, stability) {
    const { decay, factor } = computeDecayFactor(decayOrParams);
    return roundTo(Math.pow(1 + factor * elapsed_days / stability, decay), 8);
  }
  class FSRSAlgorithm {
    constructor(params) {
      __publicField$3(this, "param");
      __publicField$3(this, "intervalModifier");
      __publicField$3(this, "_seed");
      /**
       * The formula used is :
       * $$R(t,S) = (1 + \text{FACTOR} \times \frac{t}{9 \cdot S})^{\text{DECAY}}$$
       * @param {number} elapsed_days t days since the last review
       * @param {number} stability Stability (interval when R=90%)
       * @return {number} r Retrievability (probability of recall)
       */
      __publicField$3(this, "forgetting_curve");
      this.param = new Proxy(
        generatorParameters(params),
        this.params_handler_proxy()
      );
      this.intervalModifier = this.calculate_interval_modifier(
        this.param.request_retention
      );
      this.forgetting_curve = forgetting_curve.bind(this, this.param.w);
    }
    get interval_modifier() {
      return this.intervalModifier;
    }
    set seed(seed) {
      this._seed = seed;
    }
    /**
     * @see https://github.com/open-spaced-repetition/fsrs4anki/wiki/The-Algorithm#fsrs-5
     *
     * The formula used is: $$I(r,s) = (r^{\frac{1}{DECAY}} - 1) / FACTOR \times s$$
     * @param request_retention 0<request_retention<=1,Requested retention rate
     * @throws {Error} Requested retention rate should be in the range (0,1]
     */
    calculate_interval_modifier(request_retention) {
      if (request_retention <= 0 || request_retention > 1) {
        throw new FSRSValidationError(
          "Requested retention rate should be in the range (0,1]"
        );
      }
      const { decay, factor } = computeDecayFactor(this.param.w);
      return roundTo((Math.pow(request_retention, 1 / decay) - 1) / factor, 8);
    }
    /**
     * Get the parameters of the algorithm.
     */
    get parameters() {
      return this.param;
    }
    /**
     * Set the parameters of the algorithm.
     * @param params Partial<FSRSParameters>
     */
    set parameters(params) {
      this.update_parameters(params);
    }
    params_handler_proxy() {
      const _this = this;
      return {
        set: function(target, prop, value) {
          if (prop === "request_retention" && Number.isFinite(value)) {
            _this.intervalModifier = _this.calculate_interval_modifier(
              Number(value)
            );
          } else if (prop === "w") {
            value = migrateParameters(
              value,
              target.relearning_steps.length,
              target.enable_short_term
            );
            _this.forgetting_curve = forgetting_curve.bind(this, value);
            _this.intervalModifier = _this.calculate_interval_modifier(
              Number(target.request_retention)
            );
          }
          Reflect.set(target, prop, value);
          return true;
        }
      };
    }
    update_parameters(params) {
      const _params = generatorParameters(params);
      for (const key in _params) {
        const paramKey = key;
        this.param[paramKey] = _params[paramKey];
      }
    }
    /**
       * The formula used is :
       * $$ S_0(G) = w_{G-1}$$
       * $$S_0 = \max \lbrace S_0,0.1\rbrace $$

       * @param g Grade (rating at Anki) [1.again,2.hard,3.good,4.easy]
       * @return Stability (interval when R=90%)
       */
    init_stability(g) {
      return Math.max(this.param.w[g - 1], 0.1);
    }
    /**
     * The formula used is :
     * $$D_0(G) = w_4 - e^{(G-1) \cdot w_5} + 1 $$
     * $$D_0 = \min \lbrace \max \lbrace D_0(G),1 \rbrace,10 \rbrace$$
     * where the $$D_0(1)=w_4$$ when the first rating is good.
     *
     * @param {Grade} g Grade (rating at Anki) [1.again,2.hard,3.good,4.easy]
     * @return {number} Difficulty $$D \in [1,10]$$
     */
    init_difficulty(g) {
      const w = this.param.w;
      const d = w[4] - Math.exp((g - 1) * w[5]) + 1;
      return roundTo(d, 8);
    }
    /**
     * If fuzzing is disabled or ivl is less than 2.5, it returns the original interval.
     * @param {number} ivl - The interval to be fuzzed.
     * @param {number} elapsed_days t days since the last review
     * @return {number} - The fuzzed interval.
     **/
    apply_fuzz(ivl, elapsed_days) {
      if (!this.param.enable_fuzz || ivl < 2.5) return Math.round(ivl);
      const generator = alea(this._seed);
      const fuzz_factor = generator();
      const { min_ivl, max_ivl } = get_fuzz_range(
        ivl,
        elapsed_days,
        this.param.maximum_interval
      );
      return Math.floor(fuzz_factor * (max_ivl - min_ivl + 1) + min_ivl);
    }
    /**
     *   @see The formula used is : {@link FSRSAlgorithm.calculate_interval_modifier}
     *   @param {number} s - Stability (interval when R=90%)
     *   @param {number} elapsed_days t days since the last review
     */
    next_interval(s, elapsed_days) {
      const newInterval = Math.min(
        Math.max(1, Math.round(s * this.intervalModifier)),
        this.param.maximum_interval
      );
      return this.apply_fuzz(newInterval, elapsed_days);
    }
    /**
     * @see https://github.com/open-spaced-repetition/fsrs4anki/issues/697
     */
    linear_damping(delta_d, old_d) {
      return roundTo(delta_d * (10 - old_d) / 9, 8);
    }
    /**
     * The formula used is :
     * $$\text{delta}_d = -w_6 \cdot (g - 3)$$
     * $$\text{next}_d = D + \text{linear damping}(\text{delta}_d , D)$$
     * $$D^\prime(D,R) = w_7 \cdot D_0(4) +(1 - w_7) \cdot \text{next}_d$$
     * @param {number} d Difficulty $$D \in [1,10]$$
     * @param {Grade} g Grade (rating at Anki) [1.again,2.hard,3.good,4.easy]
     * @return {number} $$\text{next}_D$$
     */
    next_difficulty(d, g) {
      const delta_d = -this.param.w[6] * (g - 3);
      const next_d = d + this.linear_damping(delta_d, d);
      return clamp(
        this.mean_reversion(this.init_difficulty(Rating.Easy), next_d),
        1,
        10
      );
    }
    /**
     * The formula used is :
     * $$w_7 \cdot \text{init} +(1 - w_7) \cdot \text{current}$$
     * @param {number} init $$w_2 : D_0(3) = w_2 + (R-2) \cdot w_3= w_2$$
     * @param {number} current $$D - w_6 \cdot (R - 2)$$
     * @return {number} difficulty
     */
    mean_reversion(init, current) {
      const w = this.param.w;
      return roundTo(w[7] * init + (1 - w[7]) * current, 8);
    }
    /**
     * The formula used is :
     * $$S^\prime_r(D,S,R,G) = S\cdot(e^{w_8}\cdot (11-D)\cdot S^{-w_9}\cdot(e^{w_{10}\cdot(1-R)}-1)\cdot w_{15}(\text{if} G=2) \cdot w_{16}(\text{if} G=4)+1)$$
     * @param {number} d Difficulty D \in [1,10]
     * @param {number} s Stability (interval when R=90%)
     * @param {number} r Retrievability (probability of recall)
     * @param {Grade} g Grade (Rating[0.again,1.hard,2.good,3.easy])
     * @return {number} S^\prime_r new stability after recall
     */
    next_recall_stability(d, s, r, g) {
      const w = this.param.w;
      const hard_penalty = Rating.Hard === g ? w[15] : 1;
      const easy_bound = Rating.Easy === g ? w[16] : 1;
      return roundTo(
        clamp(
          s * (1 + Math.exp(w[8]) * (11 - d) * Math.pow(s, -w[9]) * (Math.exp((1 - r) * w[10]) - 1) * hard_penalty * easy_bound),
          S_MIN,
          36500
        ),
        8
      );
    }
    /**
     * The formula used is :
     * $$S^\prime_f(D,S,R) = w_{11}\cdot D^{-w_{12}}\cdot ((S+1)^{w_{13}}-1) \cdot e^{w_{14}\cdot(1-R)}$$
     * enable_short_term = true : $$S^\prime_f \in \min \lbrace \max \lbrace S^\prime_f,0.01\rbrace, \frac{S}{e^{w_{17} \cdot w_{18}}} \rbrace$$
     * enable_short_term = false : $$S^\prime_f \in \min \lbrace \max \lbrace S^\prime_f,0.01\rbrace, S \rbrace$$
     * @param {number} d Difficulty D \in [1,10]
     * @param {number} s Stability (interval when R=90%)
     * @param {number} r Retrievability (probability of recall)
     * @return {number} S^\prime_f new stability after forgetting
     */
    next_forget_stability(d, s, r) {
      const w = this.param.w;
      return roundTo(
        clamp(
          w[11] * Math.pow(d, -w[12]) * (Math.pow(s + 1, w[13]) - 1) * Math.exp((1 - r) * w[14]),
          S_MIN,
          36500
        ),
        8
      );
    }
    /**
     * The formula used is :
     * $$S^\prime_s(S,G) = S \cdot e^{w_{17} \cdot (G-3+w_{18})}$$
     * @param {number} s Stability (interval when R=90%)
     * @param {Grade} g Grade (Rating[0.again,1.hard,2.good,3.easy])
     */
    next_short_term_stability(s, g) {
      const w = this.param.w;
      const sinc = Math.pow(s, -w[19]) * Math.exp(w[17] * (g - 3 + w[18]));
      const maskedSinc = g >= Rating.Hard ? Math.max(sinc, 1) : sinc;
      return roundTo(clamp(s * maskedSinc, S_MIN, 36500), 8);
    }
    /**
     * Calculates the next state of memory based on the current state, time elapsed, and grade.
     *
     * @param memory_state - The current state of memory, which can be null.
     * @param t - The time elapsed since the last review.
     * @param {Rating} g Grade (Rating[0.Manual,1.Again,2.Hard,3.Good,4.Easy])
     * @param r - Optional retrievability value. If not provided, it will be calculated.
     * @returns The next state of memory with updated difficulty and stability.
     */
    next_state(memory_state, t, g, r) {
      const { difficulty: d, stability: s } = memory_state != null ? memory_state : {
        difficulty: 0,
        stability: 0
      };
      if (t < 0) {
        throw new FSRSValidationError(`Invalid delta_t "${t}"`);
      }
      if (g < 0 || g > 4) {
        throw new FSRSValidationError(`Invalid grade "${g}"`);
      }
      if (d === 0 && s === 0) {
        return {
          difficulty: clamp(this.init_difficulty(g), 1, 10),
          stability: this.init_stability(g)
        };
      }
      if (g === 0) {
        return {
          difficulty: d,
          stability: s
        };
      }
      if (d < 1 || s < S_MIN) {
        throw new FSRSValidationError(
          `Invalid memory state { difficulty: ${d}, stability: ${s} }`
        );
      }
      const w = this.param.w;
      r = typeof r === "number" ? r : this.forgetting_curve(t, s);
      let new_s;
      if (t === 0 && this.param.enable_short_term) {
        new_s = this.next_short_term_stability(s, g);
      } else if (g === 1) {
        const s_after_fail = this.next_forget_stability(d, s, r);
        let [w_17, w_18] = [0, 0];
        if (this.param.enable_short_term) {
          w_17 = w[17];
          w_18 = w[18];
        }
        const next_s_min = s / Math.exp(w_17 * w_18);
        new_s = clamp(roundTo(next_s_min, 8), S_MIN, s_after_fail);
      } else {
        new_s = this.next_recall_stability(d, s, r, g);
      }
      const new_d = this.next_difficulty(d, g);
      return { difficulty: new_d, stability: new_s };
    }
  }

  var __defProp$2 = Object.defineProperty;
  var __defNormalProp$2 = (obj, key, value) => key in obj ? __defProp$2(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
  var __publicField$2 = (obj, key, value) => __defNormalProp$2(obj, key + "" , value);
  class BasicScheduler extends AbstractScheduler {
    constructor(card, now, algorithm, strategies) {
      super(card, now, algorithm, strategies);
      __publicField$2(this, "learningStepsStrategy");
      let learningStepStrategy = BasicLearningStepsStrategy;
      if (this.strategies) {
        const custom_strategy = this.strategies.get(StrategyMode.LEARNING_STEPS);
        if (custom_strategy) {
          learningStepStrategy = custom_strategy;
        }
      }
      this.learningStepsStrategy = learningStepStrategy;
    }
    getLearningInfo(card, grade) {
      var _a, _b, _c, _d;
      const parameters = this.algorithm.parameters;
      card.learning_steps = card.learning_steps || 0;
      const steps_strategy = this.learningStepsStrategy(
        parameters,
        card.state,
        card.learning_steps
      );
      const scheduled_minutes = Math.max(
        0,
        (_b = (_a = steps_strategy[grade]) == null ? void 0 : _a.scheduled_minutes) != null ? _b : 0
      );
      const next_steps = Math.max(0, (_d = (_c = steps_strategy[grade]) == null ? void 0 : _c.next_step) != null ? _d : 0);
      return {
        scheduled_minutes,
        next_steps
      };
    }
    /**
     * @description This function applies the learning steps based on the current card's state and grade.
     */
    applyLearningSteps(nextCard, grade, to_state) {
      const { scheduled_minutes, next_steps } = this.getLearningInfo(
        this.current,
        grade
      );
      if (scheduled_minutes > 0 && scheduled_minutes < 1440) {
        nextCard.learning_steps = next_steps;
        nextCard.scheduled_days = 0;
        nextCard.state = to_state;
        nextCard.due = date_scheduler(
          this.review_time,
          Math.round(scheduled_minutes),
          false
          /** true:days false: minute */
        );
      } else {
        nextCard.state = State.Review;
        if (scheduled_minutes >= 1440) {
          nextCard.learning_steps = next_steps;
          nextCard.due = date_scheduler(
            this.review_time,
            Math.round(scheduled_minutes),
            false
            /** true:days false: minute */
          );
          nextCard.scheduled_days = Math.floor(scheduled_minutes / 1440);
        } else {
          nextCard.learning_steps = 0;
          const interval = this.algorithm.next_interval(
            nextCard.stability,
            this.elapsed_days
          );
          nextCard.scheduled_days = interval;
          nextCard.due = date_scheduler(this.review_time, interval, true);
        }
      }
    }
    newState(grade) {
      const exist = this.next.get(grade);
      if (exist) {
        return exist;
      }
      const next = this.next_ds(this.elapsed_days, grade);
      this.applyLearningSteps(next, grade, State.Learning);
      const item = {
        card: next,
        log: this.buildLog(grade)
      };
      this.next.set(grade, item);
      return item;
    }
    learningState(grade) {
      const exist = this.next.get(grade);
      if (exist) {
        return exist;
      }
      const next = this.next_ds(this.elapsed_days, grade);
      this.applyLearningSteps(
        next,
        grade,
        this.last.state
        /** Learning or Relearning */
      );
      const item = {
        card: next,
        log: this.buildLog(grade)
      };
      this.next.set(grade, item);
      return item;
    }
    reviewState(grade) {
      const exist = this.next.get(grade);
      if (exist) {
        return exist;
      }
      const interval = this.elapsed_days;
      const retrievability = this.algorithm.forgetting_curve(
        interval,
        this.current.stability
      );
      const next_again = this.next_ds(interval, Rating.Again, retrievability);
      const next_hard = this.next_ds(interval, Rating.Hard, retrievability);
      const next_good = this.next_ds(interval, Rating.Good, retrievability);
      const next_easy = this.next_ds(interval, Rating.Easy, retrievability);
      this.next_interval(next_hard, next_good, next_easy, interval);
      this.next_state(next_hard, next_good, next_easy);
      this.applyLearningSteps(next_again, Rating.Again, State.Relearning);
      next_again.lapses += 1;
      const item_again = {
        card: next_again,
        log: this.buildLog(Rating.Again)
      };
      const item_hard = {
        card: next_hard,
        log: super.buildLog(Rating.Hard)
      };
      const item_good = {
        card: next_good,
        log: super.buildLog(Rating.Good)
      };
      const item_easy = {
        card: next_easy,
        log: super.buildLog(Rating.Easy)
      };
      this.next.set(Rating.Again, item_again);
      this.next.set(Rating.Hard, item_hard);
      this.next.set(Rating.Good, item_good);
      this.next.set(Rating.Easy, item_easy);
      return this.next.get(grade);
    }
    /**
     * Review next_ds
     */
    next_ds(t, g, r) {
      const next_state = this.algorithm.next_state(
        {
          difficulty: this.current.difficulty,
          stability: this.current.stability
        },
        t,
        g,
        r
      );
      const card = TypeConvert.card(this.current);
      card.difficulty = next_state.difficulty;
      card.stability = next_state.stability;
      return card;
    }
    /**
     * Review next_interval
     */
    next_interval(next_hard, next_good, next_easy, interval) {
      let hard_interval, good_interval;
      hard_interval = this.algorithm.next_interval(next_hard.stability, interval);
      good_interval = this.algorithm.next_interval(next_good.stability, interval);
      hard_interval = Math.min(hard_interval, good_interval);
      good_interval = Math.max(good_interval, hard_interval + 1);
      const easy_interval = Math.max(
        this.algorithm.next_interval(next_easy.stability, interval),
        good_interval + 1
      );
      next_hard.scheduled_days = hard_interval;
      next_hard.due = date_scheduler(this.review_time, hard_interval, true);
      next_good.scheduled_days = good_interval;
      next_good.due = date_scheduler(this.review_time, good_interval, true);
      next_easy.scheduled_days = easy_interval;
      next_easy.due = date_scheduler(this.review_time, easy_interval, true);
    }
    /**
     * Review next_state
     */
    next_state(next_hard, next_good, next_easy) {
      next_hard.state = State.Review;
      next_hard.learning_steps = 0;
      next_good.state = State.Review;
      next_good.learning_steps = 0;
      next_easy.state = State.Review;
      next_easy.learning_steps = 0;
    }
  }

  class LongTermScheduler extends AbstractScheduler {
    newState(grade) {
      const exist = this.next.get(grade);
      if (exist) {
        return exist;
      }
      this.current.scheduled_days = 0;
      this.current.elapsed_days = 0;
      const first_interval = 0;
      const next_again = this.next_ds(first_interval, Rating.Again);
      const next_hard = this.next_ds(first_interval, Rating.Hard);
      const next_good = this.next_ds(first_interval, Rating.Good);
      const next_easy = this.next_ds(first_interval, Rating.Easy);
      this.next_interval(
        next_again,
        next_hard,
        next_good,
        next_easy,
        first_interval
      );
      this.next_state(next_again, next_hard, next_good, next_easy);
      this.update_next(next_again, next_hard, next_good, next_easy);
      return this.next.get(grade);
    }
    next_ds(t, g, r) {
      const next_state = this.algorithm.next_state(
        {
          difficulty: this.current.difficulty,
          stability: this.current.stability
        },
        t,
        g,
        r
      );
      const card = TypeConvert.card(this.current);
      card.difficulty = next_state.difficulty;
      card.stability = next_state.stability;
      return card;
    }
    /**
     * @see https://github.com/open-spaced-repetition/ts-fsrs/issues/98#issuecomment-2241923194
     */
    learningState(grade) {
      return this.reviewState(grade);
    }
    reviewState(grade) {
      const exist = this.next.get(grade);
      if (exist) {
        return exist;
      }
      const interval = this.elapsed_days;
      const retrievability = this.algorithm.forgetting_curve(
        interval,
        this.current.stability
      );
      const next_again = this.next_ds(interval, Rating.Again, retrievability);
      const next_hard = this.next_ds(interval, Rating.Hard, retrievability);
      const next_good = this.next_ds(interval, Rating.Good, retrievability);
      const next_easy = this.next_ds(interval, Rating.Easy, retrievability);
      this.next_interval(next_again, next_hard, next_good, next_easy, interval);
      this.next_state(next_again, next_hard, next_good, next_easy);
      next_again.lapses += 1;
      this.update_next(next_again, next_hard, next_good, next_easy);
      return this.next.get(grade);
    }
    /**
     * Review/New next_interval
     */
    next_interval(next_again, next_hard, next_good, next_easy, interval) {
      let again_interval, hard_interval, good_interval, easy_interval;
      again_interval = this.algorithm.next_interval(
        next_again.stability,
        interval
      );
      hard_interval = this.algorithm.next_interval(next_hard.stability, interval);
      good_interval = this.algorithm.next_interval(next_good.stability, interval);
      easy_interval = this.algorithm.next_interval(next_easy.stability, interval);
      again_interval = Math.min(again_interval, hard_interval);
      hard_interval = Math.max(hard_interval, again_interval + 1);
      good_interval = Math.max(good_interval, hard_interval + 1);
      easy_interval = Math.max(easy_interval, good_interval + 1);
      next_again.scheduled_days = again_interval;
      next_again.due = date_scheduler(this.review_time, again_interval, true);
      next_hard.scheduled_days = hard_interval;
      next_hard.due = date_scheduler(this.review_time, hard_interval, true);
      next_good.scheduled_days = good_interval;
      next_good.due = date_scheduler(this.review_time, good_interval, true);
      next_easy.scheduled_days = easy_interval;
      next_easy.due = date_scheduler(this.review_time, easy_interval, true);
    }
    /**
     * Review/New next_state
     */
    next_state(next_again, next_hard, next_good, next_easy) {
      next_again.state = State.Review;
      next_again.learning_steps = 0;
      next_hard.state = State.Review;
      next_hard.learning_steps = 0;
      next_good.state = State.Review;
      next_good.learning_steps = 0;
      next_easy.state = State.Review;
      next_easy.learning_steps = 0;
    }
    update_next(next_again, next_hard, next_good, next_easy) {
      const item_again = {
        card: next_again,
        log: this.buildLog(Rating.Again)
      };
      const item_hard = {
        card: next_hard,
        log: super.buildLog(Rating.Hard)
      };
      const item_good = {
        card: next_good,
        log: super.buildLog(Rating.Good)
      };
      const item_easy = {
        card: next_easy,
        log: super.buildLog(Rating.Easy)
      };
      this.next.set(Rating.Again, item_again);
      this.next.set(Rating.Hard, item_hard);
      this.next.set(Rating.Good, item_good);
      this.next.set(Rating.Easy, item_easy);
    }
  }

  var __defProp$1 = Object.defineProperty;
  var __defProps$1 = Object.defineProperties;
  var __getOwnPropDescs$1 = Object.getOwnPropertyDescriptors;
  var __getOwnPropSymbols$1 = Object.getOwnPropertySymbols;
  var __hasOwnProp$1 = Object.prototype.hasOwnProperty;
  var __propIsEnum$1 = Object.prototype.propertyIsEnumerable;
  var __defNormalProp$1 = (obj, key, value) => key in obj ? __defProp$1(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
  var __spreadValues$1 = (a, b) => {
    for (var prop in b || (b = {}))
      if (__hasOwnProp$1.call(b, prop))
        __defNormalProp$1(a, prop, b[prop]);
    if (__getOwnPropSymbols$1)
      for (var prop of __getOwnPropSymbols$1(b)) {
        if (__propIsEnum$1.call(b, prop))
          __defNormalProp$1(a, prop, b[prop]);
      }
    return a;
  };
  var __spreadProps$1 = (a, b) => __defProps$1(a, __getOwnPropDescs$1(b));
  var __publicField$1 = (obj, key, value) => __defNormalProp$1(obj, key + "" , value);
  class Reschedule {
    /**
     * Creates an instance of the `Reschedule` class.
     * @param fsrs - An instance of the FSRS class used for scheduling.
     */
    constructor(fsrs) {
      __publicField$1(this, "fsrs");
      this.fsrs = fsrs;
    }
    /**
     * Replays a review for a card and determines the next review date based on the given rating.
     * @param card - The card being reviewed.
     * @param reviewed - The date the card was reviewed.
     * @param rating - The grade given to the card during the review.
     * @returns A `RecordLogItem` containing the updated card and review log.
     */
    replay(card, reviewed, rating) {
      return this.fsrs.next(card, reviewed, rating);
    }
    /**
     * Processes a manual review for a card, allowing for custom state, stability, difficulty, and due date.
     * @param card - The card being reviewed.
     * @param state - The state of the card after the review.
     * @param reviewed - The date the card was reviewed.
     * @param elapsed_days - The number of days since the last review.
     * @param stability - (Optional) The stability of the card.
     * @param difficulty - (Optional) The difficulty of the card.
     * @param due - (Optional) The due date for the next review.
     * @returns A `RecordLogItem` containing the updated card and review log.
     * @throws Will throw an error if the state or due date is not provided when required.
     */
    handleManualRating(card, state, reviewed, elapsed_days, stability, difficulty, due) {
      if (typeof state === "undefined") {
        throw new FSRSValidationError(
          "reschedule: state is required for manual rating"
        );
      }
      let log;
      let next_card;
      if (state === State.New) {
        log = {
          rating: Rating.Manual,
          state,
          due: due != null ? due : reviewed,
          stability: card.stability,
          difficulty: card.difficulty,
          elapsed_days,
          last_elapsed_days: card.elapsed_days,
          scheduled_days: card.scheduled_days,
          learning_steps: card.learning_steps,
          review: reviewed
        };
        next_card = createEmptyCard(reviewed);
        next_card.last_review = reviewed;
      } else {
        if (typeof due === "undefined") {
          throw new FSRSValidationError(
            "reschedule: due is required for manual rating"
          );
        }
        const scheduled_days = date_diff(due, reviewed, "days");
        log = {
          rating: Rating.Manual,
          state: card.state,
          due: card.last_review || card.due,
          stability: card.stability,
          difficulty: card.difficulty,
          elapsed_days,
          last_elapsed_days: card.elapsed_days,
          scheduled_days: card.scheduled_days,
          learning_steps: card.learning_steps,
          review: reviewed
        };
        next_card = __spreadProps$1(__spreadValues$1({}, card), {
          state,
          due,
          last_review: reviewed,
          stability: stability || card.stability,
          difficulty: difficulty || card.difficulty,
          elapsed_days,
          scheduled_days,
          reps: card.reps + 1
        });
      }
      return { card: next_card, log };
    }
    /**
     * Reschedules a card based on its review history.
     *
     * @param current_card - The card to be rescheduled.
     * @param reviews - An array of review history objects.
     * @returns An array of record log items representing the rescheduling process.
     */
    reschedule(current_card, reviews) {
      const collections = [];
      let cur_card = createEmptyCard(current_card.due);
      for (const review of reviews) {
        let item;
        review.review = TypeConvert.time(review.review);
        if (review.rating === Rating.Manual) {
          let interval = 0;
          if (cur_card.state !== State.New && cur_card.last_review) {
            interval = date_diff(review.review, cur_card.last_review, "days");
          }
          item = this.handleManualRating(
            cur_card,
            review.state,
            review.review,
            interval,
            review.stability,
            review.difficulty,
            review.due ? TypeConvert.time(review.due) : void 0
          );
        } else {
          item = this.replay(cur_card, review.review, review.rating);
        }
        collections.push(item);
        cur_card = item.card;
      }
      return collections;
    }
    calculateManualRecord(current_card, now, record_log_item, update_memory) {
      if (!record_log_item) {
        return null;
      }
      const { card: reschedule_card, log } = record_log_item;
      const cur_card = TypeConvert.card(current_card);
      if (cur_card.due.getTime() === reschedule_card.due.getTime()) {
        return null;
      }
      cur_card.scheduled_days = date_diff(
        reschedule_card.due,
        cur_card.due,
        "days"
      );
      return this.handleManualRating(
        cur_card,
        reschedule_card.state,
        TypeConvert.time(now),
        log.elapsed_days,
        update_memory ? reschedule_card.stability : void 0,
        update_memory ? reschedule_card.difficulty : void 0,
        reschedule_card.due
      );
    }
  }

  var __defProp = Object.defineProperty;
  var __defProps = Object.defineProperties;
  var __getOwnPropDescs = Object.getOwnPropertyDescriptors;
  var __getOwnPropSymbols = Object.getOwnPropertySymbols;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __propIsEnum = Object.prototype.propertyIsEnumerable;
  var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
  var __spreadValues = (a, b) => {
    for (var prop in b || (b = {}))
      if (__hasOwnProp.call(b, prop))
        __defNormalProp(a, prop, b[prop]);
    if (__getOwnPropSymbols)
      for (var prop of __getOwnPropSymbols(b)) {
        if (__propIsEnum.call(b, prop))
          __defNormalProp(a, prop, b[prop]);
      }
    return a;
  };
  var __spreadProps = (a, b) => __defProps(a, __getOwnPropDescs(b));
  var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);
  function applyAfterHandler(value, afterHandler) {
    return typeof afterHandler === "function" ? afterHandler(value) : value;
  }
  class FSRS extends FSRSAlgorithm {
    constructor(param) {
      super(param);
      __publicField(this, "strategyHandler", /* @__PURE__ */ new Map());
      __publicField(this, "Scheduler");
      const { enable_short_term } = this.parameters;
      this.Scheduler = enable_short_term ? BasicScheduler : LongTermScheduler;
    }
    params_handler_proxy() {
      const _this = this;
      return {
        set: function(target, prop, value) {
          if (prop === "request_retention" && Number.isFinite(value)) {
            _this.intervalModifier = _this.calculate_interval_modifier(
              Number(value)
            );
          } else if (prop === "enable_short_term") {
            _this.Scheduler = value === true ? BasicScheduler : LongTermScheduler;
          } else if (prop === "w") {
            value = migrateParameters(
              value,
              target.relearning_steps.length,
              target.enable_short_term
            );
            _this.forgetting_curve = forgetting_curve.bind(this, value);
            _this.intervalModifier = _this.calculate_interval_modifier(
              Number(target.request_retention)
            );
          }
          Reflect.set(target, prop, value);
          return true;
        }
      };
    }
    useStrategy(mode, handler) {
      this.strategyHandler.set(mode, handler);
      return this;
    }
    clearStrategy(mode) {
      if (mode) {
        this.strategyHandler.delete(mode);
      } else {
        this.strategyHandler.clear();
      }
      return this;
    }
    getScheduler(card, now) {
      const schedulerStrategy = this.strategyHandler.get(
        StrategyMode.SCHEDULER
      );
      const Scheduler = schedulerStrategy || this.Scheduler;
      const instance = new Scheduler(card, now, this, this.strategyHandler);
      return instance;
    }
    /**
     * Display the collection of cards and logs for the four scenarios after scheduling the card at the current time.
     * @param card Card to be processed
     * @param now Current time or scheduled time
     * @param afterHandler Convert the result to another type. (Optional)
     * @example
     * ```typescript
     * const card: Card = createEmptyCard(new Date());
     * const f = fsrs();
     * const recordLog = f.repeat(card, new Date());
     * ```
     * @example
     * ```typescript
     * interface RevLogUnchecked
     *   extends Omit<ReviewLog, "due" | "review" | "state" | "rating"> {
     *   cid: string;
     *   due: Date | number;
     *   state: StateType;
     *   review: Date | number;
     *   rating: RatingType;
     * }
     *
     * interface RepeatRecordLog {
     *   card: CardUnChecked; //see method: createEmptyCard
     *   log: RevLogUnchecked;
     * }
     *
     * function repeatAfterHandler(recordLog: RecordLog) {
     *     const record: { [key in Grade]: RepeatRecordLog } = {} as {
     *       [key in Grade]: RepeatRecordLog;
     *     };
     *     for (const grade of Grades) {
     *       record[grade] = {
     *         card: {
     *           ...(recordLog[grade].card as Card & { cid: string }),
     *           due: recordLog[grade].card.due.getTime(),
     *           state: State[recordLog[grade].card.state] as StateType,
     *           last_review: recordLog[grade].card.last_review
     *             ? recordLog[grade].card.last_review!.getTime()
     *             : null,
     *         },
     *         log: {
     *           ...recordLog[grade].log,
     *           cid: (recordLog[grade].card as Card & { cid: string }).cid,
     *           due: recordLog[grade].log.due.getTime(),
     *           review: recordLog[grade].log.review.getTime(),
     *           state: State[recordLog[grade].log.state] as StateType,
     *           rating: Rating[recordLog[grade].log.rating] as RatingType,
     *         },
     *       };
     *     }
     *     return record;
     * }
     * const card: Card = createEmptyCard(new Date(), cardAfterHandler); //see method:  createEmptyCard
     * const f = fsrs();
     * const recordLog = f.repeat(card, new Date(), repeatAfterHandler);
     * ```
     */
    repeat(card, now, afterHandler) {
      const instance = this.getScheduler(card, now);
      const recordLog = instance.preview();
      return applyAfterHandler(recordLog, afterHandler);
    }
    /**
     * Display the collection of cards and logs for the card scheduled at the current time, after applying a specific grade rating.
     * @param card Card to be processed
     * @param now Current time or scheduled time
     * @param grade Rating of the review (Again, Hard, Good, Easy)
     * @param afterHandler Convert the result to another type. (Optional)
     * @example
     * ```typescript
     * const card: Card = createEmptyCard(new Date());
     * const f = fsrs();
     * const recordLogItem = f.next(card, new Date(), Rating.Again);
     * ```
     * @example
     * ```typescript
     * interface RevLogUnchecked
     *   extends Omit<ReviewLog, "due" | "review" | "state" | "rating"> {
     *   cid: string;
     *   due: Date | number;
     *   state: StateType;
     *   review: Date | number;
     *   rating: RatingType;
     * }
     *
     * interface NextRecordLog {
     *   card: CardUnChecked; //see method: createEmptyCard
     *   log: RevLogUnchecked;
     * }
     *
    function nextAfterHandler(recordLogItem: RecordLogItem) {
      const recordItem = {
        card: {
          ...(recordLogItem.card as Card & { cid: string }),
          due: recordLogItem.card.due.getTime(),
          state: State[recordLogItem.card.state] as StateType,
          last_review: recordLogItem.card.last_review
            ? recordLogItem.card.last_review!.getTime()
            : null,
        },
        log: {
          ...recordLogItem.log,
          cid: (recordLogItem.card as Card & { cid: string }).cid,
          due: recordLogItem.log.due.getTime(),
          review: recordLogItem.log.review.getTime(),
          state: State[recordLogItem.log.state] as StateType,
          rating: Rating[recordLogItem.log.rating] as RatingType,
        },
      };
      return recordItem
    }
     * const card: Card = createEmptyCard(new Date(), cardAfterHandler); //see method:  createEmptyCard
     * const f = fsrs();
     * const recordLogItem = f.repeat(card, new Date(), Rating.Again, nextAfterHandler);
     * ```
     */
    next(card, now, grade, afterHandler) {
      const instance = this.getScheduler(card, now);
      const g = TypeConvert.rating(grade);
      if (g === Rating.Manual) {
        throw new FSRSValidationError("Cannot review a manual rating");
      }
      const recordLogItem = instance.review(g);
      return applyAfterHandler(recordLogItem, afterHandler);
    }
    /**
     * Get the retrievability of the card
     * @param card  Card to be processed
     * @param now  Current time or scheduled time
     * @param format  default:true , Convert the result to another type. (Optional)
     * @returns  The retrievability of the card,if format is true, the result is a string, otherwise it is a number
     */
    get_retrievability(card, now, format = true) {
      const processedCard = TypeConvert.card(card);
      now = now ? TypeConvert.time(now) : /* @__PURE__ */ new Date();
      const t = processedCard.state !== State.New ? Math.max(date_diff(now, processedCard.last_review, "days"), 0) : 0;
      const r = processedCard.state !== State.New ? this.forgetting_curve(t, +processedCard.stability.toFixed(8)) : 0;
      return format ? `${(r * 100).toFixed(2)}%` : r;
    }
    /**
     *
     * @param card Card to be processed
     * @param log last review log
     * @param afterHandler Convert the result to another type. (Optional)
     * @example
     * ```typescript
     * const now = new Date();
     * const f = fsrs();
     * const emptyCardFormAfterHandler = createEmptyCard(now);
     * const repeatFormAfterHandler = f.repeat(emptyCardFormAfterHandler, now);
     * const { card, log } = repeatFormAfterHandler[Rating.Hard];
     * const rollbackFromAfterHandler = f.rollback(card, log);
     * ```
     *
     * @example
     * ```typescript
     * const now = new Date();
     * const f = fsrs();
     * const emptyCardFormAfterHandler = createEmptyCard(now, cardAfterHandler);  //see method: createEmptyCard
     * const repeatFormAfterHandler = f.repeat(emptyCardFormAfterHandler, now, repeatAfterHandler); //see method: fsrs.repeat()
     * const { card, log } = repeatFormAfterHandler[Rating.Hard];
     * const rollbackFromAfterHandler = f.rollback(card, log, cardAfterHandler);
     * ```
     */
    rollback(card, log, afterHandler) {
      const processedCard = TypeConvert.card(card);
      const processedLog = TypeConvert.review_log(log);
      if (processedLog.rating === Rating.Manual) {
        throw new FSRSValidationError("Cannot rollback a manual rating");
      }
      let last_due;
      let last_review;
      let last_lapses;
      switch (processedLog.state) {
        case State.New:
          last_due = processedLog.due;
          last_review = void 0;
          last_lapses = 0;
          break;
        case State.Learning:
        case State.Relearning:
        case State.Review:
          last_due = processedLog.review;
          last_review = processedLog.due;
          last_lapses = processedCard.lapses - (processedLog.rating === Rating.Again && processedLog.state === State.Review ? 1 : 0);
          break;
      }
      const prevCard = __spreadProps(__spreadValues({}, processedCard), {
        due: last_due,
        stability: processedLog.stability,
        difficulty: processedLog.difficulty,
        elapsed_days: processedLog.last_elapsed_days,
        scheduled_days: processedLog.scheduled_days,
        reps: Math.max(0, processedCard.reps - 1),
        lapses: Math.max(0, last_lapses),
        learning_steps: processedLog.learning_steps,
        state: processedLog.state,
        last_review
      });
      return applyAfterHandler(prevCard, afterHandler);
    }
    /**
     *
     * @param card Card to be processed
     * @param now Current time or scheduled time
     * @param reset_count Should the review count information(reps,lapses) be reset. (Optional)
     * @param afterHandler Convert the result to another type. (Optional)
     * @example
     * ```typescript
     * const now = new Date();
     * const f = fsrs();
     * const emptyCard = createEmptyCard(now);
     * const scheduling_cards = f.repeat(emptyCard, now);
     * const { card, log } = scheduling_cards[Rating.Hard];
     * const forgetCard = f.forget(card, new Date(), true);
     * ```
     *
     * @example
     * ```typescript
     * interface RepeatRecordLog {
     *   card: CardUnChecked; //see method: createEmptyCard
     *   log: RevLogUnchecked; //see method: fsrs.repeat()
     * }
     *
     * function forgetAfterHandler(recordLogItem: RecordLogItem): RepeatRecordLog {
     *     return {
     *       card: {
     *         ...(recordLogItem.card as Card & { cid: string }),
     *         due: recordLogItem.card.due.getTime(),
     *         state: State[recordLogItem.card.state] as StateType,
     *         last_review: recordLogItem.card.last_review
     *           ? recordLogItem.card.last_review!.getTime()
     *           : null,
     *       },
     *       log: {
     *         ...recordLogItem.log,
     *         cid: (recordLogItem.card as Card & { cid: string }).cid,
     *         due: recordLogItem.log.due.getTime(),
     *         review: recordLogItem.log.review.getTime(),
     *         state: State[recordLogItem.log.state] as StateType,
     *         rating: Rating[recordLogItem.log.rating] as RatingType,
     *       },
     *     };
     * }
     * const now = new Date();
     * const f = fsrs();
     * const emptyCardFormAfterHandler = createEmptyCard(now, cardAfterHandler); //see method:  createEmptyCard
     * const repeatFormAfterHandler = f.repeat(emptyCardFormAfterHandler, now, repeatAfterHandler); //see method: fsrs.repeat()
     * const { card } = repeatFormAfterHandler[Rating.Hard];
     * const forgetFromAfterHandler = f.forget(card, date_scheduler(now, 1, true), false, forgetAfterHandler);
     * ```
     */
    forget(card, now, reset_count = false, afterHandler) {
      const processedCard = TypeConvert.card(card);
      now = TypeConvert.time(now);
      const scheduled_days = processedCard.state === State.New ? 0 : date_diff(now, processedCard.due, "days");
      const forget_log = {
        rating: Rating.Manual,
        state: processedCard.state,
        due: processedCard.due,
        stability: processedCard.stability,
        difficulty: processedCard.difficulty,
        elapsed_days: 0,
        last_elapsed_days: processedCard.elapsed_days,
        scheduled_days,
        learning_steps: processedCard.learning_steps,
        review: now
      };
      const forget_card = __spreadProps(__spreadValues({}, processedCard), {
        due: now,
        stability: 0,
        difficulty: 0,
        elapsed_days: 0,
        scheduled_days: 0,
        reps: reset_count ? 0 : processedCard.reps,
        lapses: reset_count ? 0 : processedCard.lapses,
        learning_steps: 0,
        state: State.New,
        last_review: processedCard.last_review
      });
      const recordLogItem = { card: forget_card, log: forget_log };
      return applyAfterHandler(recordLogItem, afterHandler);
    }
    /**
     * Reschedules the current card and returns the rescheduled collections and reschedule item.
     *
     * @template T - The type of the record log item.
     * @param {CardInput | Card} current_card - The current card to be rescheduled.
     * @param {Array<FSRSHistory>} reviews - The array of FSRSHistory objects representing the reviews.
     * @param {Partial<RescheduleOptions<T>>} options - The optional reschedule options.
     * @returns {IReschedule<T>} - The rescheduled collections and reschedule item.
     *
     * @example
     * ```typescript
     * const f = fsrs()
     * const grades: Grade[] = [Rating.Good, Rating.Good, Rating.Good, Rating.Good]
     * const reviews_at = [
     *   new Date(2024, 8, 13),
     *   new Date(2024, 8, 13),
     *   new Date(2024, 8, 17),
     *   new Date(2024, 8, 28),
     * ]
     *
     * const reviews: FSRSHistory[] = []
     * for (let i = 0; i < grades.length; i++) {
     *   reviews.push({
     *     rating: grades[i],
     *     review: reviews_at[i],
     *   })
     * }
     *
     * const results_short = scheduler.reschedule(
     *   createEmptyCard(),
     *   reviews,
     *   {
     *     skipManual: false,
     *   }
     * )
     * console.log(results_short)
     * ```
     */
    reschedule(current_card, reviews = [], options = {}) {
      const {
        recordLogHandler,
        reviewsOrderBy,
        skipManual = true,
        now = /* @__PURE__ */ new Date(),
        update_memory_state: updateMemoryState = false
      } = options;
      if (reviewsOrderBy && typeof reviewsOrderBy === "function") {
        reviews.sort(reviewsOrderBy);
      }
      if (skipManual) {
        reviews = reviews.filter((review) => review.rating !== Rating.Manual);
      }
      const rescheduleSvc = new Reschedule(this);
      const collections = rescheduleSvc.reschedule(
        options.first_card || createEmptyCard(),
        reviews
      );
      const len = collections.length;
      const cur_card = TypeConvert.card(current_card);
      const manual_item = rescheduleSvc.calculateManualRecord(
        cur_card,
        now,
        len ? collections[len - 1] : void 0,
        updateMemoryState
      );
      return {
        collections: typeof recordLogHandler === "function" ? collections.map(recordLogHandler) : collections,
        reschedule_item: manual_item ? applyAfterHandler(manual_item, recordLogHandler) : null
      };
    }
  }
  const fsrs = (params) => {
    return new FSRS(params || {});
  };

  exports.AbstractScheduler = AbstractScheduler;
  exports.BasicLearningStepsStrategy = BasicLearningStepsStrategy;
  exports.CLAMP_PARAMETERS = CLAMP_PARAMETERS;
  exports.ConvertStepUnitToMinutes = ConvertStepUnitToMinutes;
  exports.DefaultInitSeedStrategy = DefaultInitSeedStrategy;
  exports.FSRS = FSRS;
  exports.FSRS5_DEFAULT_DECAY = FSRS5_DEFAULT_DECAY;
  exports.FSRS6_DEFAULT_DECAY = FSRS6_DEFAULT_DECAY;
  exports.FSRSAlgorithm = FSRSAlgorithm;
  exports.FSRSVersion = FSRSVersion;
  exports.GenSeedStrategyWithCardId = GenSeedStrategyWithCardId;
  exports.Grades = Grades;
  exports.INIT_S_MAX = INIT_S_MAX;
  exports.Rating = Rating;
  exports.S_MAX = S_MAX;
  exports.S_MIN = S_MIN;
  exports.State = State;
  exports.StrategyMode = StrategyMode;
  exports.TypeConvert = TypeConvert;
  exports.W17_W18_Ceiling = W17_W18_Ceiling;
  exports.checkParameters = checkParameters;
  exports.clamp = clamp;
  exports.clipParameters = clipParameters;
  exports.computeDecayFactor = computeDecayFactor;
  exports.createEmptyCard = createEmptyCard;
  exports.dateDiffInDays = dateDiffInDays;
  exports.date_diff = date_diff;
  exports.date_scheduler = date_scheduler;
  exports.default_enable_fuzz = default_enable_fuzz;
  exports.default_enable_short_term = default_enable_short_term;
  exports.default_learning_steps = default_learning_steps;
  exports.default_maximum_interval = default_maximum_interval;
  exports.default_relearning_steps = default_relearning_steps;
  exports.default_request_retention = default_request_retention;
  exports.default_w = default_w;
  exports.fixDate = fixDate;
  exports.fixRating = fixRating;
  exports.fixState = fixState;
  exports.forgetting_curve = forgetting_curve;
  exports.formatDate = formatDate;
  exports.fsrs = fsrs;
  exports.generatorParameters = generatorParameters;
  exports.get_fuzz_range = get_fuzz_range;
  exports.migrateParameters = migrateParameters;
  exports.roundTo = roundTo;
  exports.show_diff_message = show_diff_message;

}));
//# sourceMappingURL=index.umd.js.map

        return module.exports;
    })() };
    function __tmBuildTaskRepeatRuleMetaPatch(taskInput, ruleInput) {
        const task = (taskInput && typeof taskInput === 'object') ? taskInput : {};
        const nextRule = __tmNormalizeTaskRepeatRule(ruleInput, {
            startDate: task?.startDate,
            completionTime: task?.completionTime,
        });
        const currentRule = __tmNormalizeTaskRepeatRule(task?.repeatRule, {
            startDate: task?.startDate,
            completionTime: task?.completionTime,
        });
        const currentState = __tmNormalizeTaskRepeatState(task?.repeatState);
        const scheduleChanged = __tmGetTaskRepeatScheduleSignature(currentRule) !== __tmGetTaskRepeatScheduleSignature(nextRule);
        const occurrenceReset = scheduleChanged || (nextRule.maxOccurrences > 0 && currentRule.maxOccurrences <= 0);
        let occurrenceCount = currentState.occurrenceCount;
        if (occurrenceReset) {
            occurrenceCount = 1;
        } else if (nextRule.maxOccurrences > 0 && nextRule.maxOccurrences < occurrenceCount) {
            throw new Error(`结束次数不能小于当前第 ${occurrenceCount} 次`);
        }
        let nextState = __tmNormalizeTaskRepeatState({
            ...currentState,
            occurrenceCount,
            lastInstanceStart: __tmNormalizeDateOnly(task?.startDate || ''),
            lastInstanceDue: __tmNormalizeDateOnly(task?.completionTime || ''),
            pendingNativeDoneReset: (!nextRule.enabled || nextRule.type === 'none' || nextRule.trigger === 'checkin')
                ? false
                : currentState.pendingNativeDoneReset,
            fsrsCard: nextRule.type === 'fsrs' ? currentState.fsrsCard : null,
            ...((occurrenceReset || !currentState.tomatoBaselineSet)
                ? __tmBuildTaskTomatoBaselinePatch(task)
                : {}),
        });
        const patch = {
            repeatRule: nextRule,
            repeatState: nextState,
        };
        // Check-in schedules own their dates through anchorDate.
        if (nextRule.enabled && nextRule.trigger === 'checkin') {
            patch.completionTime = '';
            nextState.lastInstanceDue = '';
        }
        if (scheduleChanged && nextRule.trigger !== 'checkin' && __tmMonthRepeatCore?.isExplicit(nextRule)) {
            const currentKey = __tmNormalizeDateOnly(task.completionTime || task.startDate || nextRule.anchorDate);
            const firstKey = __tmMonthRepeatCore.nextDateKey(nextRule, currentKey, true);
            if (!firstKey) throw new Error('月循环没有有效日期，请检查日期和结束条件');
            nextRule.anchorDate = firstKey;
            patch.completionTime = firstKey;
            nextState.lastInstanceDue = patch.completionTime || '';
        }
        if (nextRule.type === 'fsrs') {
            const dueKey = __tmNormalizeDateOnly(task?.completionTime || task?.startDate || new Date());
            const fsrsTask = {
                ...task,
                completionTime: dueKey,
                repeatState: nextState,
            };
            if (scheduleChanged || !nextState.fsrsCard) {
                nextState = __tmBuildFsrsInitialState(fsrsTask, nextState);
                patch.repeatState = nextState;
            }
            if (!__tmNormalizeDateOnly(task?.completionTime || '')) patch.completionTime = dueKey;
        }
        if (nextRule.enabled && nextRule.type !== 'none') {
            patch.startDate = '';
            nextState.lastInstanceStart = '';
        }
        return patch;
    }

    function __tmNormalizeTaskRepeatRule(value, options = {}) {
        const opts = (options && typeof options === 'object') ? options : {};
        const valueText = typeof value === 'string' ? String(value || '').trim() : '';
        if (!value || (typeof value === 'string' && !valueText)) {
            return {
                version: 1,
                enabled: false,
                trigger: __tmNormalizeTaskRepeatTrigger(opts.trigger || ''),
                type: 'none',
                every: 1,
                weekdays: [],
                monthlyMode: 'date',
                calendarMode: 'solar',
                until: '',
                maxOccurrences: 0,
                anchorDate: __tmNormalizeDateOnly(
                    opts.anchorDate
                    || opts.startDate
                    || opts.completionTime
                    || new Date()
                ),
            };
        }
        const raw = __tmParseTaskRepeatJson(value) || {};
        const type = __tmNormalizeTaskRepeatType(raw.type || raw.repeatType || raw.interval || '');
        const enabledRaw = raw.enabled;
        const enabled = enabledRaw === undefined
            ? (type !== 'none')
            : !!enabledRaw;
        const fallbackAnchor = __tmNormalizeDateOnly(
            opts.anchorDate
            || raw.anchorDate
            || opts.startDate
            || opts.completionTime
            || new Date()
        );
        const maxOccurrences = enabled && type !== 'fsrs' ? __tmNormalizeTaskRepeatMaxOccurrences(raw.maxOccurrences) : 0;
        const trigger = type === 'fsrs' ? 'complete' : __tmNormalizeTaskRepeatTrigger(raw.trigger || opts.trigger || '');
        const completionBased = trigger === 'complete';
        return {
            version: 1,
            enabled: enabled && type !== 'none',
            trigger,
            type: enabled ? type : 'none',
            every: __tmNormalizeTaskRepeatEvery(raw.every, type),
            weekdays: enabled && !completionBased && type === 'weekly'
                ? __tmNormalizeTaskRepeatWeekdays(raw.weekdays ?? raw.weekDays ?? raw.weekday, fallbackAnchor)
                : [],
            monthlyMode: completionBased ? 'date' : __tmNormalizeTaskRepeatMonthlyMode(raw.monthlyMode, type),
            ...(!completionBased && type === 'monthly' && __tmNormalizeTaskRepeatMonthlyMode(raw.monthlyMode, type) === 'date'
                && __tmNormalizeTaskRepeatCalendarMode(raw.calendarMode || raw.repeatCalendarMode, type) !== 'lunar'
                && raw.monthDays !== undefined ? { monthDays: __tmMonthRepeatCore.normalizeDays(raw.monthDays) } : {}),
            ...(!completionBased && type === 'monthly' && raw.monthlyMode === 'weekday' && raw.monthWeek && raw.calendarMode !== 'lunar'
                ? { monthWeek: __tmMonthRepeatCore.weekdayRule(raw.monthWeek, fallbackAnchor) } : {}),
            calendarMode: completionBased ? 'solar' : __tmNormalizeTaskRepeatCalendarMode(raw.calendarMode || raw.repeatCalendarMode, type),
            until: enabled && type !== 'fsrs' && maxOccurrences === 0 ? __tmNormalizeTaskRepeatUntil(raw.until || raw.repeatUntil || '') : '',
            maxOccurrences,
            anchorDate: fallbackAnchor,
        };
    }

    function __tmNormalizeTaskRepeatTrigger(value) {
        const raw = String(value || '').trim().toLowerCase();
        if (raw === 'checkin' || raw === 'check-in' || raw === 'check_in' || raw === '打卡') return 'checkin';
        return raw === 'complete' ? 'complete' : 'due';
    }

    function __tmNormalizeDateOnly(value) {
        const s = String(value || '').trim();
        if (!s) return '';
        if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
        if (/^\d{4}-\d{2}-\d{2}T/.test(s)) return s.slice(0, 10);
        if (/^\d{4}-\d{2}-\d{2}\s/.test(s)) return s.slice(0, 10);
        const d = new Date(s);
        if (Number.isNaN(d.getTime())) return '';
        const pad = (n) => String(n).padStart(2, '0');
        return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    }

    function __tmParseTaskRepeatJson(value) {
        if (!value) return null;
        if (typeof value === 'string') {
            const raw = String(value || '').trim();
            if (!raw) return null;
            try { return JSON.parse(raw); } catch (e) { return null; }
        }
        return (typeof value === 'object' && !Array.isArray(value)) ? value : null;
    }

    function __tmNormalizeTaskRepeatType(value) {
        const raw = String(value || '').trim().toLowerCase();
        if (!raw || raw === 'none' || raw === 'once') return 'none';
        if (raw === 'weekday' || raw === 'weekdays') return 'workday';
        if (raw === 'everyday') return 'daily';
        if (raw === 'daily' || raw === 'workday' || raw === 'weekly' || raw === 'monthly' || raw === 'yearly' || raw === 'fsrs') return raw;
        return 'none';
    }

    function __tmNormalizeTaskRepeatMaxOccurrences(value) {
        const parsed = parseInt(value, 10);
        if (!Number.isFinite(parsed) || parsed <= 0) return 0;
        return Math.max(1, Math.min(200, parsed));
    }

    function __tmNormalizeTaskRepeatEvery(value, repeatType) {
        if (__tmNormalizeTaskRepeatType(repeatType) === 'none') return 1;
        const n = parseInt(value, 10);
        if (!Number.isFinite(n) || n <= 0) return 1;
        return Math.min(3650, Math.max(1, n));
    }

    function __tmNormalizeTaskRepeatWeekdays(value, fallbackDate = '') {
        let values = [];
        if (Array.isArray(value)) {
            values = value;
        } else if (typeof value === 'number') {
            values = [value];
        } else if (typeof value === 'string' && String(value || '').trim()) {
            const text = String(value || '').trim();
            try {
                const parsed = JSON.parse(text);
                values = Array.isArray(parsed) ? parsed : [parsed];
            } catch (e) {
                values = text.split(',');
            }
        }
        const normalized = Array.from(new Set(values
            .map((item) => Number(item))
            .filter((item) => Number.isInteger(item) && item >= 0 && item <= 6)))
            .sort((left, right) => left - right);
        return normalized;
    }

    function __tmNormalizeTaskRepeatMonthlyMode(value, repeatType) {
        if (__tmNormalizeTaskRepeatType(repeatType) !== 'monthly') return 'date';
        return String(value || '').trim().toLowerCase() === 'weekday' ? 'weekday' : 'date';
    }

    function __tmNormalizeTaskRepeatCalendarMode(value, repeatType) {
        const type = __tmNormalizeTaskRepeatType(repeatType);
        if (type !== 'monthly' && type !== 'yearly') return 'solar';
        const raw = String(value || '').trim().toLowerCase();
        return raw === 'lunar' || raw === '农历' ? 'lunar' : 'solar';
    }

    function __tmNormalizeTaskRepeatUntil(value) {
        return __tmNormalizeDateOnly(value);
    }

    function __tmNormalizeTaskRepeatState(value) {
        const raw = __tmParseTaskRepeatJson(value) || {};
        const fsrsCard = __tmNormalizeFsrsCardState(raw.fsrsCard || raw.fsrs_card || null);
        const checkinHistory = (Array.isArray(raw.checkinHistory) ? raw.checkinHistory : (Array.isArray(raw.checkin_history) ? raw.checkin_history : []))
            .map((entry) => ({
                scheduledDate: __tmNormalizeDateOnly(entry?.scheduledDate || entry?.scheduled_date || entry?.date || ''),
                checkedAt: String(entry?.checkedAt || entry?.checked_at || '').trim(),
                source: String(entry?.source || '').trim(),
            }))
            .filter((entry) => entry.scheduledDate && entry.checkedAt)
            .reduce((out, entry) => {
                const previous = out.byDate.get(entry.scheduledDate);
                if (!previous || String(entry.checkedAt) >= String(previous.checkedAt)) {
                    out.byDate.set(entry.scheduledDate, entry);
                }
                return out;
            }, { byDate: new Map() });
        const normalizedCheckinHistory = Array.from(checkinHistory.byDate.values())
            .sort((a, b) => a.scheduledDate.localeCompare(b.scheduledDate));
        const hasBaselineFlag = Object.prototype.hasOwnProperty.call(raw, 'tomatoBaselineSet')
            || Object.prototype.hasOwnProperty.call(raw, 'tomato_baseline_set');
        const tomatoBaselineSet = hasBaselineFlag
            ? (raw.tomatoBaselineSet === true || raw.tomato_baseline_set === true)
            : (Object.prototype.hasOwnProperty.call(raw, 'tomatoBaselineMinutes')
                || Object.prototype.hasOwnProperty.call(raw, 'tomato_baseline_minutes')
                || Object.prototype.hasOwnProperty.call(raw, 'tomatoBaselineHours')
                || Object.prototype.hasOwnProperty.call(raw, 'tomato_baseline_hours')
                || Object.prototype.hasOwnProperty.call(raw, 'tomatoBaselineCount')
                || Object.prototype.hasOwnProperty.call(raw, 'tomato_baseline_count'));
        return {
            version: fsrsCard ? 2 : 1,
            ...(raw.occurrenceId ? { occurrenceId: String(raw.occurrenceId) } : {}),
            ...(raw.lastCompletionId ? { lastCompletionId: String(raw.lastCompletionId) } : {}),
            ...(raw.lastRestoredCompletionId ? { lastRestoredCompletionId: String(raw.lastRestoredCompletionId) } : {}),
            ...(raw.planOverride && typeof raw.planOverride === 'object' ? { planOverride: {
                startDate: __tmNormalizeDateOnly(raw.planOverride.startDate || ''),
                completionTime: __tmNormalizeDateOnly(raw.planOverride.completionTime || ''),
            } } : {}),
            occurrenceCount: Math.max(1, parseInt(raw.occurrenceCount, 10) || 1),
            lastCompletedAt: String(raw.lastCompletedAt || '').trim(),
            lastAdvancedAt: String(raw.lastAdvancedAt || '').trim(),
            lastInstanceStart: __tmNormalizeDateOnly(raw.lastInstanceStart || ''),
            lastInstanceDue: __tmNormalizeDateOnly(raw.lastInstanceDue || ''),
            pendingNativeDoneReset: raw.pendingNativeDoneReset === true || raw.pending_native_done_reset === true,
            tomatoBaselineMinutes: __tmNormalizeTaskTomatoAmount(raw.tomatoBaselineMinutes ?? raw.tomato_baseline_minutes),
            tomatoBaselineHours: __tmNormalizeTaskTomatoAmount(raw.tomatoBaselineHours ?? raw.tomato_baseline_hours),
            tomatoBaselineCount: __tmNormalizeTaskTomatoCount(raw.tomatoBaselineCount ?? raw.tomato_baseline_count),
            tomatoBaselineSet,
            checkinHistory: normalizedCheckinHistory,
            fsrsCard,
        };
    }

    function __tmNormalizeFsrsCardState(value) {
        const raw = (value && typeof value === 'object' && !Array.isArray(value)) ? value : null;
        if (!raw) return null;
        const due = new Date(raw.due || '');
        if (Number.isNaN(due.getTime())) return null;
        const lastReview = raw.last_review ? new Date(raw.last_review) : null;
        return {
            due: due.toISOString(),
            stability: Math.max(0, Number(raw.stability) || 0),
            difficulty: Math.max(0, Number(raw.difficulty) || 0),
            elapsed_days: Math.max(0, parseInt(raw.elapsed_days, 10) || 0),
            scheduled_days: Math.max(0, parseInt(raw.scheduled_days, 10) || 0),
            reps: Math.max(0, parseInt(raw.reps, 10) || 0),
            lapses: Math.max(0, parseInt(raw.lapses, 10) || 0),
            state: Math.max(0, Math.min(3, parseInt(raw.state, 10) || 0)),
            last_review: lastReview && !Number.isNaN(lastReview.getTime()) ? lastReview.toISOString() : '',
        };
    }

    function __tmNormalizeTaskTomatoAmount(value) {
        const number = Number(value);
        return Number.isFinite(number) && number > 0 ? Math.round(number * 100) / 100 : 0;
    }

    function __tmNormalizeTaskTomatoCount(value) {
        const number = Number(value);
        return Number.isFinite(number) && number > 0 ? Math.floor(number) : 0;
    }

    function __tmGetTaskRepeatScheduleSignature(ruleInput) {
        const rule = __tmNormalizeTaskRepeatRule(ruleInput);
        return JSON.stringify([
            rule.enabled,
            rule.trigger,
            rule.type,
            rule.every,
            rule.weekdays,
            rule.monthlyMode,
            rule.monthDays,
            rule.monthWeek,
            rule.calendarMode,
            rule.anchorDate,
        ]);
    }

    function __tmBuildTaskTomatoBaselinePatch(taskLike) {
        const values = __tmGetTaskTomatoCumulativeValues(taskLike);
        return {
            tomatoBaselineMinutes: values.tomatoMinutes,
            tomatoBaselineHours: values.tomatoHours,
            tomatoBaselineCount: values.tomatoCount,
            tomatoBaselineSet: true,
        };
    }

    function __tmGetTaskTomatoCumulativeValues(taskLike) {
        const task = (taskLike && typeof taskLike === 'object') ? taskLike : {};
        return {
            tomatoMinutes: __tmNormalizeTaskTomatoAmount(task?.tomatoMinutes ?? task?.tomato_minutes),
            tomatoHours: __tmNormalizeTaskTomatoAmount(task?.tomatoHours ?? task?.tomato_hours),
            tomatoCount: __tmNormalizeTaskTomatoCount(task?.tomatoCount ?? task?.tomato_count),
        };
    }

    function __tmBuildFsrsInitialState(taskLike, stateInput = null) {
        const task = (taskLike && typeof taskLike === 'object') ? taskLike : {};
        const state = __tmNormalizeTaskRepeatState(stateInput || task?.repeatState);
        const dueKey = __tmNormalizeDateOnly(task?.completionTime || task?.startDate || new Date());
        return __tmNormalizeTaskRepeatState({
            ...state,
            version: 2,
            lastInstanceStart: __tmNormalizeDateOnly(task?.startDate || ''),
            lastInstanceDue: dueKey,
            fsrsCard: __tmCreateFsrsCard(dueKey),
        });
    }

    function __tmCreateFsrsCard(dueDateLike = new Date()) {
        const runtime = __tmRequireFsrsRuntime();
        const card = runtime.createEmptyCard(__tmFsrsDateForDateKey(dueDateLike, new Date()));
        return __tmSerializeFsrsCard(card);
    }

    function __tmRequireFsrsRuntime() {
        const runtime = globalThis.FSRS;
        if (!runtime || typeof runtime.fsrs !== 'function' || typeof runtime.createEmptyCard !== 'function') {
            throw new Error('FSRS 调度器未加载');
        }
        return runtime;
    }

    function __tmFsrsDateForDateKey(value, fallback = null) {
        const key = __tmNormalizeDateOnly(value);
        const date = key ? __tmBuildLocalNoonDateFromKey(key) : null;
        return date || __tmFsrsDate(fallback);
    }

    function __tmBuildLocalNoonDateFromKey(value) {
        const key = __tmNormalizeDateOnly(value);
        if (!key) return null;
        const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key);
        if (!m) return null;
        const dt = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12, 0, 0, 0);
        return Number.isNaN(dt.getTime()) ? null : dt;
    }

    function __tmFsrsDate(value, fallback = null) {
        const date = value instanceof Date ? new Date(value.getTime()) : new Date(value || '');
        if (!Number.isNaN(date.getTime())) return date;
        if (fallback instanceof Date && !Number.isNaN(fallback.getTime())) return new Date(fallback.getTime());
        return new Date();
    }

    function __tmSerializeFsrsCard(cardInput) {
        const card = (cardInput && typeof cardInput === 'object') ? cardInput : null;
        if (!card) return null;
        const due = __tmFsrsDate(card.due, null);
        if (Number.isNaN(due.getTime())) return null;
        const lastReview = card.last_review ? __tmFsrsDate(card.last_review, null) : null;
        return {
            due: due.toISOString(),
            stability: Math.max(0, Number(card.stability) || 0),
            difficulty: Math.max(0, Number(card.difficulty) || 0),
            elapsed_days: Math.max(0, Number.parseInt(card.elapsed_days, 10) || 0),
            scheduled_days: Math.max(0, Number.parseInt(card.scheduled_days, 10) || 0),
            reps: Math.max(0, Number.parseInt(card.reps, 10) || 0),
            lapses: Math.max(0, Number.parseInt(card.lapses, 10) || 0),
            state: Math.max(0, Math.min(3, Number.parseInt(card.state, 10) || 0)),
            last_review: lastReview && !Number.isNaN(lastReview.getTime()) ? lastReview.toISOString() : '',
        };
    }

    function __tmGetTaskRepeatSummary(ruleInput, options = {}) {
        const rule = __tmNormalizeTaskRepeatRule(ruleInput, options);
        if (!rule.enabled || rule.type === 'none') return '';
        if (rule.type === 'fsrs') return 'FSRS 间隔重复';
        const triggerText = rule.trigger === 'complete' ? '完成后' : (rule.trigger === 'checkin' ? '打卡' : '到期后');
        const unitText = __tmGetTaskRepeatCalendarUnitLabel(rule.type, rule.every, rule.calendarMode);
        const untilText = rule.until ? ` · 至 ${rule.until}` : '';
        const countText = rule.maxOccurrences > 0 ? ` · 共 ${rule.maxOccurrences} 次` : '';
        const weekdayText = rule.type === 'weekly' && rule.weekdays.length > 0
            ? `（${[1, 2, 3, 4, 5, 6, 0].filter((weekday) => rule.weekdays.includes(weekday)).map((weekday) => ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][weekday]).join('、')}）`
            : '';
        const monthDayText = __tmMonthRepeatCore?.isExplicit(rule)
            ? `（${rule.monthlyMode === 'weekday' ? __tmMonthRepeatCore.weekdayLabel(rule.monthWeek, rule.anchorDate) : __tmMonthRepeatCore.label(rule.monthDays)}）` : '';
        return `${triggerText}${unitText}${weekdayText}${monthDayText}${untilText}${countText}`;
    }

    function __tmGetTaskRepeatCalendarUnitLabel(type, every, calendarMode) {
        const repeatType = __tmNormalizeTaskRepeatType(type);
        const mode = __tmNormalizeTaskRepeatCalendarMode(calendarMode, repeatType);
        const n = __tmNormalizeTaskRepeatEvery(every, repeatType);
        if (mode !== 'lunar') return __tmGetTaskRepeatUnitLabel(repeatType, n);
        if (repeatType === 'monthly') return n > 1 ? `每${n}个农历月` : '农历每月';
        if (repeatType === 'yearly') return n > 1 ? `每${n}个农历年` : '农历每年';
        return __tmGetTaskRepeatUnitLabel(repeatType, n);
    }

    function __tmGetTaskRepeatUnitLabel(type, every) {
        const repeatType = __tmNormalizeTaskRepeatType(type);
        const n = __tmNormalizeTaskRepeatEvery(every, repeatType);
        if (repeatType === 'daily') return n > 1 ? `每${n}天` : '每天';
        if (repeatType === 'workday') return n > 1 ? `每${n}个工作日` : '每个工作日';
        if (repeatType === 'weekly') return n > 1 ? `每${n}周` : '每周';
        if (repeatType === 'monthly') return n > 1 ? `每${n}个月` : '每月';
        if (repeatType === 'yearly') return n > 1 ? `每${n}年` : '每年';
        if (repeatType === 'fsrs') return 'FSRS 间隔重复';
        return '不循环';
    }

    function __tmBuildTaskCompletionPlan(task, intent, context) {
        const rule = __tmGetTaskRepeatRule(task);
        const recurring = rule.enabled && rule.type !== 'none' && rule.trigger !== 'checkin';
        const repeatState = __tmNormalizeTaskRepeatState(task.repeatState);
        const history = __tmNormalizeTaskRepeatHistory(task.repeatHistory);
        const occurrenceId = __tmGetTaskOccurrenceId(task);
        const existing = history.find((entry) => entry.id === context.operationId);
        const requestedOccurrence = String(intent.occurrenceId || occurrenceId);
        const previousDone = intent.nativeObserved
            ? intent.nativeObserved.previousDone === true
            : context.previousDone === true;
        const receipt = {
            outcome: 'committed', operationId: context.operationId, taskId: task.id,
            occurrenceId: requestedOccurrence, completionId: '', completedAt: '',
            completedOccurrence: false, recurring: !!recurring, advanced: false,
        };
        if (intent.source === 'task-repeat-native-reset') {
            const resetDateKey = __tmGetRecurringNativeDoneResetDateKey(task);
            if (!recurring || !__tmIsRecurringNativeDoneHeld(task)
                || !__tmIsSameTaskOccurrenceRound(requestedOccurrence, occurrenceId)
                || !resetDateKey || __tmNormalizeDateOnly(new Date(context.now)) < resetDateKey) {
                return { patch: {}, receipt: { ...receipt, outcome: 'alreadyApplied' } };
            }
            return { patch: {
                ...context.undoneStatus, done: false, taskCompleteAt: '',
                repeatState: __tmNormalizeTaskRepeatState({ ...repeatState, pendingNativeDoneReset: false }),
            }, receipt };
        }
        if (intent.restorePatch) {
            const restore = intent.restorePatch;
            const clean = (patch) => Object.fromEntries(Object.entries(patch || {}).filter(([key]) => !['markdown', 'taskMarker', 'task_marker', 'title', 'content', 'raw_content'].includes(key)));
            for (const [key, value] of Object.entries(clean(restore.expected))) {
                if (JSON.stringify(task[key] ?? '') !== JSON.stringify(value ?? '')) throw new Error('任务已有后续修改，不能覆盖新的状态');
            }
            return { patch: clean(restore.patch), receipt: { ...receipt, restoredState: true } };
        }
        const applied = (entry) => ({ patch: {}, receipt: {
            ...receipt, outcome: 'alreadyApplied', completionId: entry.id || '', completedAt: entry.completedAt,
            occurrenceId: entry.occurrenceId || requestedOccurrence,
            previousDates: { startDate: entry.sourceStart, completionTime: entry.sourceDue },
            nextDates: { startDate: entry.nextStart, completionTime: entry.nextDue },
            nextOccurrenceId: task.repeatState?.occurrenceId || '', origin: entry.origin || null,
        } });
        if (existing && intent.done === true) return applied(existing);
        if (intent.restoreState) {
            const restore = intent.restoreState;
            const entry = restore.historyEntry;
            if (entry?.id && history.some(item => item.id === entry.id)) return applied(entry);
            if (!entry || !__tmIsSameTaskOccurrenceRound(occurrenceId, restore.expectedOccurrenceId)
                || (entry.ruleSignature && entry.ruleSignature !== __tmGetTaskRepeatScheduleSignature(rule))) throw new Error('任务已有后续修改，不能恢复该次完成');
            return { patch: { ...restore.patch, repeatHistory: __tmNormalizeTaskRepeatHistory([entry, ...history]) },
                receipt: { ...applied(entry).receipt, outcome: 'committed', reappliedCompletionId: entry.id || entry.completedAt } };
        }
        let restoreId = String(intent.restoreCompletionId || '');
        if (recurring && intent.done === true) {
            const prior = __tmFindTaskRepeatHistoryEntryByOccurrence(history, requestedOccurrence);
            if (prior) return applied(prior);
        }
        if (!restoreId && recurring && intent.done === false && previousDone && __tmIsSameTaskOccurrenceRound(history[0]?.occurrenceId, occurrenceId)) {
            restoreId = history[0].id || history[0].completedAt;
        }
        if (recurring && requestedOccurrence !== occurrenceId) {
            const previous = __tmFindTaskRepeatHistoryEntryByOccurrence(history, requestedOccurrence);
            if (previous && intent.done === true) return applied(previous);
            if (previous && intent.done === false) restoreId = previous.id || previous.completedAt;
            // The same round can arrive with an id rendered by a different build
            // (legacy ids used to carry the view-date anchor). Only a round that
            // really moved on is a conflict; blocking the click is not a repair.
            else if (!restoreId && !__tmIsSameTaskOccurrenceRound(requestedOccurrence, occurrenceId)) throw new Error('任务轮次已变化，请刷新后重试');
        }
        if (!restoreId && intent.done === false && intent.nativeObserved?.previousDone === true && intent.nativeObserved.targetMarker === ' '
            && repeatState.pendingNativeDoneReset) restoreId = repeatState.lastCompletionId || repeatState.lastCompletedAt;
        if (restoreId) {
            let index = history.findIndex((entry) => entry.id === restoreId);
            if (index < 0) {
                const matching = history.map((entry, i) => entry.completedAt === restoreId ? i : -1).filter(i => i >= 0);
                if (matching.length > 1) throw new Error('存在同一时间的多条记录，请选择具体完成记录');
                index = matching[0] ?? -1;
            }
            if (index < 0) {
                if (repeatState.lastRestoredCompletionId === restoreId) return { patch: {}, receipt: { ...receipt, outcome: 'alreadyApplied', restoredCompletionId: restoreId } };
                throw new Error('未找到可撤销的完成记录');
            }
            const entry = history[index];
            if (index !== 0 || (entry.ruleSignature && entry.ruleSignature !== __tmGetTaskRepeatScheduleSignature(rule))) {
                throw new Error('任务已有后续完成或循环规则已修改，不能回退该记录');
            }
            const advanced = !!(entry.nextDue || entry.nextStart);
            const expectedDue = advanced ? entry.nextDue : entry.sourceDue;
            const expectedStart = advanced ? entry.nextStart : entry.sourceStart;
            if (String(task.completionTime || '') !== expectedDue || String(task.startDate || '') !== expectedStart) throw new Error('任务已改期，不能覆盖新的日期');
            const nextHistory = history.filter((_, i) => i !== index);
            const before = entry.before;
            const rollback = before ? {
                done: before.done, customStatus: before.customStatus,
                taskCompleteAt: before.taskCompleteAt,
                startDate: before.startDate, completionTime: before.completionTime,
                repeatState: __tmNormalizeTaskRepeatState(before.repeatState),
            } : {
                ...__tmBuildRecurringTaskRollbackPatch(task, entry, nextHistory),
                done: false, taskCompleteAt: '', ...context.undoneStatus,
            };
            rollback.repeatState = __tmNormalizeTaskRepeatState({ ...rollback.repeatState,
                occurrenceId: context.nextOccurrenceId || context.operationId + '-restored', lastRestoredCompletionId: entry.id || entry.completedAt });
            return {
                patch: { ...rollback, repeatHistory: nextHistory },
                receipt: { ...receipt, restoredCompletionId: entry.id || entry.completedAt, origin: entry.origin || null },
            };
        }
        const completedAt = String(context.completedAt || '').trim();
        const sameMarker = (intent.nativeObserved?.taskMarker || context.previousMarker) === (intent.nativeObserved?.targetMarker || context.targetMarker);
        const patch = {
            ...((intent.additionalPatch && typeof intent.additionalPatch === 'object') ? intent.additionalPatch : {}),
            ...(intent.done ? context.doneStatus : context.undoneStatus),
            done: intent.done === true,
            taskCompleteAt: context.targetClosed
                ? (sameMarker ? task.taskCompleteAt || completedAt : completedAt)
                : '',
        };
        if (!intent.done && repeatState.pendingNativeDoneReset) patch.repeatState = __tmNormalizeTaskRepeatState({ ...repeatState, pendingNativeDoneReset: false });
        if (!intent.done || previousDone) return { patch, receipt: { ...receipt, completedAt: patch.taskCompleteAt } };
        receipt.completedOccurrence = true;
        receipt.completedAt = completedAt;
        if (!recurring) return { patch, receipt };
        const fsrs = rule.type === 'fsrs';
        const rating = Number(intent.fsrsRating) || 0;
        if (fsrs && rating < 2) throw new Error('FSRS 任务需要选择困难、良好或简单；重来请使用复习菜单');
        const next = fsrs
            ? __tmBuildFsrsReviewPatch(task, rating, { completedAt, reviewedAt: completedAt })
            : __tmBuildTaskRepeatAdvancePatch(task, rule, { completedAt, advancedAt: context.now });
        if (!next && !(rule.maxOccurrences > 0 && repeatState.occurrenceCount >= rule.maxOccurrences)
            && !__tmBuildTaskRepeatAdvancePatch(task, { ...rule, until: '', maxOccurrences: 0 }, { completedAt })) {
            throw new Error('循环规则没有有效的下一日期，请检查规则和支持的日期范围');
        }
        const keepNativeDone = !!next && context.keepNativeDone === true;
        const focus = __tmGetTaskTomatoFocusValues(task);
        const cumulative = __tmGetTaskTomatoCumulativeValues(task);
        const beforeTask = intent.nativeObserved ? { ...task, ...intent.nativeObserved } : task;
        const entry = {
            id: context.operationId, occurrenceId, completedAt,
            ruleSignature: __tmGetTaskRepeatScheduleSignature(rule),
            occurrenceNumber: repeatState.occurrenceCount, totalOccurrences: rule.maxOccurrences,
            sourceStart: task.startDate || '', sourceDue: task.completionTime || '',
            nextStart: next?.startDate || '', nextDue: next?.completionTime || '',
            content: task.content || task.raw_content || '', docId: task.root_id || task.docId || '',
            docName: task.docName || task.doc_name || '', h2: task.h2 || '', h2Id: task.h2Id || '', h2Path: task.h2Path || '',
            priority: task.priority || '', customStatus: task.customStatus || '', duration: task.duration || '', remark: task.remark || '', docSeq: task.docSeq,
            tomatoMinutes: String(cumulative.tomatoMinutes), tomatoHours: String(cumulative.tomatoHours), tomatoCount: String(cumulative.tomatoCount),
            tomatoOccurrenceMinutes: String(focus.tomatoMinutes), tomatoOccurrenceHours: String(focus.tomatoHours), tomatoOccurrenceCount: String(focus.tomatoCount),
            rating: fsrs ? rating : 0, fsrsBefore: next?.review?.beforeCard || null, fsrsAfter: next?.review?.afterCard || null,
            before: {
                done: beforeTask.done === true, customStatus: beforeTask.customStatus || '', taskCompleteAt: beforeTask.taskCompleteAt || '',
                startDate: task.startDate || '', completionTime: task.completionTime || '', repeatState,
            },
            origin: intent.origin || (intent.scheduleId ? { scheduleId: intent.scheduleId } : null),
        };
        Object.assign(patch, {
            ...(next ? { startDate: next.startDate, completionTime: next.completionTime } : {}),
            repeatState: __tmNormalizeTaskRepeatState({
                ...(next?.repeatState || repeatState),
                occurrenceId: next ? (context.nextOccurrenceId || context.operationId + '-next') : occurrenceId,
                lastCompletionId: context.operationId, lastCompletedAt: completedAt,
                lastAdvancedAt: context.now, pendingNativeDoneReset: keepNativeDone,
                ...__tmBuildTaskTomatoBaselinePatch(task),
            }),
            repeatHistory: __tmNormalizeTaskRepeatHistory([entry, ...history]),
            ...((!next || keepNativeDone) ? context.doneStatus : context.undoneStatus),
            done: !next || keepNativeDone,
            taskCompleteAt: (!next || keepNativeDone) ? completedAt : '',
        });
        return { patch, receipt: {
            ...receipt, completionId: entry.id, advanced: !!next,
            nextOccurrenceId: patch.repeatState.occurrenceId,
            previousDates: { startDate: task.startDate || '', completionTime: task.completionTime || '' },
            nextDates: { startDate: patch.startDate || task.startDate || '', completionTime: patch.completionTime || task.completionTime || '' },
            origin: entry.origin,
        } };
    }

    function __tmGetTaskRepeatRule(taskLike, options = {}) {
        const task = (taskLike && typeof taskLike === 'object') ? taskLike : {};
        return __tmNormalizeTaskRepeatRule(task.repeatRule || task.repeat_rule || '', {
            startDate: task?.startDate,
            completionTime: task?.completionTime,
            ...((options && typeof options === 'object') ? options : {}),
        });
    }

    function __tmNormalizeTaskRepeatHistory(value) {
        const raw = (() => {
            if (Array.isArray(value)) return value;
            if (typeof value === 'string') {
                const text = String(value || '').trim();
                if (!text) return [];
                try {
                    const parsed = JSON.parse(text);
                    return Array.isArray(parsed) ? parsed : [];
                } catch (e) {
                    return [];
                }
            }
            return [];
        })();
        const normalized = raw.map((item) => {
            const entry = (item && typeof item === 'object' && !Array.isArray(item)) ? item : {};
            return {
                ...(entry.id ? { id: String(entry.id) } : {}),
                ...(entry.occurrenceId ? { occurrenceId: String(entry.occurrenceId) } : {}),
                ...(entry.ruleSignature ? { ruleSignature: String(entry.ruleSignature) } : {}),
                ...(entry.before && typeof entry.before === 'object' ? { before: {
                    done: entry.before.done === true,
                    customStatus: String(entry.before.customStatus || ''),
                    taskCompleteAt: String(entry.before.taskCompleteAt || ''),
                    startDate: __tmNormalizeDateOnly(entry.before.startDate || ''),
                    completionTime: __tmNormalizeDateOnly(entry.before.completionTime || ''),
                    repeatState: __tmNormalizeTaskRepeatState(entry.before.repeatState),
                } } : {}),
                ...(entry.origin && typeof entry.origin === 'object' ? { origin: { ...entry.origin } } : {}),
                completedAt: String(entry.completedAt || '').trim(),
                occurrenceNumber: Math.max(0, parseInt(entry.occurrenceNumber, 10) || 0),
                totalOccurrences: __tmNormalizeTaskRepeatMaxOccurrences(entry.totalOccurrences),
                sourceStart: __tmNormalizeDateOnly(entry.sourceStart || ''),
                sourceDue: __tmNormalizeDateOnly(entry.sourceDue || ''),
                nextStart: __tmNormalizeDateOnly(entry.nextStart || ''),
                nextDue: __tmNormalizeDateOnly(entry.nextDue || ''),
                content: String(entry.content || '').trim(),
                docId: String(entry.docId || '').trim(),
                docName: String(entry.docName || '').trim(),
                h2: String(entry.h2 || '').trim(),
                h2Id: String(entry.h2Id || '').trim(),
                h2Path: String(entry.h2Path || '').trim(),
                priority: String(entry.priority || '').trim(),
                customStatus: String(entry.customStatus || '').trim(),
                duration: String(entry.duration || '').trim(),
                tomatoMinutes: String(entry.tomatoMinutes ?? entry.tomato_minutes ?? '').trim(),
                tomatoHours: String(entry.tomatoHours ?? entry.tomato_hours ?? '').trim(),
                tomatoCount: String(entry.tomatoCount ?? entry.tomato_count ?? '').trim(),
                tomatoOccurrenceMinutes: String(entry.tomatoOccurrenceMinutes ?? entry.tomato_occurrence_minutes ?? '').trim(),
                tomatoOccurrenceHours: String(entry.tomatoOccurrenceHours ?? entry.tomato_occurrence_hours ?? '').trim(),
                tomatoOccurrenceCount: String(entry.tomatoOccurrenceCount ?? entry.tomato_occurrence_count ?? '').trim(),
                remark: String(entry.remark || '').trim(),
                docSeq: Number.isFinite(Number(entry.docSeq)) ? Number(entry.docSeq) : Number.NaN,
                rating: Math.max(0, Math.min(4, parseInt(entry.rating, 10) || 0)),
                fsrsBefore: __tmNormalizeFsrsCardState(entry.fsrsBefore || null),
                fsrsAfter: __tmNormalizeFsrsCardState(entry.fsrsAfter || null),
            };
        }).filter((item) => item.completedAt || item.sourceStart || item.sourceDue || item.nextStart || item.nextDue);
        normalized.forEach((item, index) => {
            const previous = normalized[index + 1] || null;
            if (!item.tomatoOccurrenceMinutes) {
                item.tomatoOccurrenceMinutes = String(__tmSubtractTaskTomatoValue(
                    item.tomatoMinutes,
                    previous?.tomatoMinutes,
                    __tmNormalizeTaskTomatoAmount,
                ));
            }
            if (!item.tomatoOccurrenceHours) {
                item.tomatoOccurrenceHours = String(__tmSubtractTaskTomatoValue(
                    item.tomatoHours,
                    previous?.tomatoHours,
                    __tmNormalizeTaskTomatoAmount,
                ));
            }
            if (!item.tomatoOccurrenceCount) {
                item.tomatoOccurrenceCount = String(__tmSubtractTaskTomatoValue(
                    item.tomatoCount,
                    previous?.tomatoCount,
                    __tmNormalizeTaskTomatoCount,
                ));
            }
        });
        return normalized;
    }

    function __tmSubtractTaskTomatoValue(total, baseline, normalizer) {
        const current = normalizer(total);
        const start = normalizer(baseline);
        return current >= start ? normalizer(current - start) : current;
    }

    function __tmGetTaskOccurrenceId(taskLike) {
        const task = taskLike || {};
        const repeatState = __tmNormalizeTaskRepeatState(task.repeatState || task.repeat_state);
        return repeatState.occurrenceId || 'legacy-' + encodeURIComponent(JSON.stringify([
            String(task.id || ''), repeatState.occurrenceCount,
            repeatState.lastAdvancedAt, repeatState.lastCompletedAt,
        ]));
    }

    function __tmGetRecurringNativeDoneResetDateKey(taskLike) {
        const task = (taskLike && typeof taskLike === 'object') ? taskLike : {};
        if (!__tmIsRecurringNativeDoneHeld(task)) return '';
        const repeatState = __tmNormalizeTaskRepeatState(task?.repeatState || task?.repeat_state || '');
        const completedDate = __tmNormalizeDateOnly(repeatState.lastCompletedAt || __tmResolveTaskCompletedAtRaw(task, { completedOnly: false }));
        if (!completedDate) return '';
        const earliestResetDate = __tmShiftTaskRepeatDateKey(completedDate, 1);
        const nextOccurrenceDate = __tmNormalizeDateOnly(task?.completionTime || '')
            || __tmNormalizeDateOnly(task?.startDate || '');
        if (!nextOccurrenceDate) return earliestResetDate;
        return nextOccurrenceDate < earliestResetDate ? earliestResetDate : nextOccurrenceDate;
    }

    function __tmIsRecurringNativeDoneHeld(taskLike) {
        const task = (taskLike && typeof taskLike === 'object') ? taskLike : {};
        if (typeof __tmIsCheckinTask === 'function' && __tmIsCheckinTask(task)) return false;
        const repeatState = __tmNormalizeTaskRepeatState(task?.repeatState || task?.repeat_state || '');
        if (repeatState.pendingNativeDoneReset !== true) return false;
        const marker = typeof __tmResolveTaskMarker === 'function' ? __tmResolveTaskMarker(task) : (task.taskMarker ?? task.task_marker);
        if (marker === '/' || marker === '-') return false;
        const completedAt = __tmNormalizeTaskCompleteAtValue(
            task.taskCompleteAt
            ?? task.task_complete_at
            ?? __tmResolveTaskCompletedAtRaw(task, { completedOnly: false })
        );
        return !!completedAt && completedAt === __tmNormalizeTaskCompleteAtValue(repeatState.lastCompletedAt);
    }

    function __tmIsCheckinTask(taskLike) {
        const task = (taskLike && typeof taskLike === 'object') ? taskLike : {};
        const rule = __tmNormalizeTaskRepeatRule(task.repeatRule || task.repeat_rule || '', {
            startDate: task?.startDate,
            completionTime: task?.completionTime,
        });
        return rule.enabled === true && rule.type !== 'none' && rule.trigger === 'checkin';
    }

    function __tmNormalizeTaskCompleteAtValue(value) {
        const raw = String(value ?? '').trim();
        if (!raw) return '';
        const ts = __tmParseTimeToTs(raw);
        if (Number.isFinite(ts) && ts > 0) {
            try {
                const normalized = __tmFormatTsToChinaTimezoneIso(ts);
                if (normalized) return normalized;
            } catch (e) {}
        }
        return raw;
    }

    function __tmParseTimeToTs(value) {
        const s = String(value || '').trim();
        if (!s) return 0;
        if (/^\d{14}$/.test(s)) {
            const y = Number(s.slice(0, 4));
            const mon = Number(s.slice(4, 6)) - 1;
            const d = Number(s.slice(6, 8));
            const hh = Number(s.slice(8, 10));
            const mm = Number(s.slice(10, 12));
            const ss = Number(s.slice(12, 14));
            const dt = new Date(y, mon, d, hh, mm, ss, 0);
            return Number.isNaN(dt.getTime()) ? 0 : dt.getTime();
        }
        if (/^\d{8}$/.test(s)) {
            const y = Number(s.slice(0, 4));
            const mon = Number(s.slice(4, 6)) - 1;
            const d = Number(s.slice(6, 8));
            const dt = new Date(y, mon, d, 12, 0, 0, 0);
            return Number.isNaN(dt.getTime()) ? 0 : dt.getTime();
        }
        if (/^\d+$/.test(s)) {
            const n = Number(s);
            if (!Number.isFinite(n) || n <= 0) return 0;
            const ts = n < 1e12 ? n * 1000 : n;
            return ts;
        }
        if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
            const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
            const y = Number(m[1]);
            const mon = Number(m[2]) - 1;
            const d = Number(m[3]);
            const dt = new Date(y, mon, d, 12, 0, 0, 0);
            return Number.isNaN(dt.getTime()) ? 0 : dt.getTime();
        }
        const t = new Date(s).getTime();
        return Number.isNaN(t) ? 0 : t;
    }

    function __tmFormatTsToChinaTimezoneIso(ts) {
        const num = Number(ts);
        if (!Number.isFinite(num) || num <= 0) return '';
        const dt = new Date(num + __TM_CHINA_TZ_OFFSET_MINUTES * 60000);
        if (Number.isNaN(dt.getTime())) return '';
        const pad = (value, size = 2) => String(value).padStart(size, '0');
        return `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}T${pad(dt.getUTCHours())}:${pad(dt.getUTCMinutes())}:${pad(dt.getUTCSeconds())}.${pad(dt.getUTCMilliseconds(), 3)}${__TM_CHINA_TZ_SUFFIX}`;
    }

    function __tmShiftTaskRepeatDateKey(dateKey, days) {
        const date = __tmBuildLocalNoonDateFromKey(dateKey);
        if (!(date instanceof Date) || Number.isNaN(date.getTime())) return '';
        date.setDate(date.getDate() + Number(days || 0));
        return __tmFormatDateKeyFromDate(date);
    }

    function __tmFormatDateKeyFromDate(date) {
        if (!(date instanceof Date) || Number.isNaN(date.getTime())) return '';
        const pad = (n) => String(n).padStart(2, '0');
        return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
    }

    function __tmIsSameTaskOccurrenceRound(left, right) {
        const a = String(left || '').trim();
        const b = String(right || '').trim();
        if (!a || !b) return false;
        if (a === b) return true;
        const leftKey = __tmBuildTaskOccurrenceRoundKey(a);
        return !!leftKey && leftKey === __tmBuildTaskOccurrenceRoundKey(b);
    }

    function __tmBuildTaskOccurrenceRoundKey(value) {
        const raw = String(value || '').trim();
        if (!raw.startsWith('legacy-')) return '';
        try {
            const parsed = JSON.parse(decodeURIComponent(raw.slice('legacy-'.length)));
            if (!Array.isArray(parsed) || parsed.length < 4) return '';
            return JSON.stringify(parsed.slice(0, 4).map((part) => String(part ?? '')));
        } catch (e) {
            return '';
        }
    }

    function __tmFindTaskRepeatHistoryEntryByOccurrence(history, occurrenceId) {
        const target = String(occurrenceId || '').trim();
        if (!target || !Array.isArray(history)) return null;
        return history.find((entry) => !!entry && __tmIsSameTaskOccurrenceRound(entry.occurrenceId, target)) || null;
    }

    function __tmBuildRecurringTaskRollbackPatch(task, removedEntry, nextHistory = []) {
        const removed = (removedEntry && typeof removedEntry === 'object') ? removedEntry : null;
        if (!removed) return null;
        const nextHead = Array.isArray(nextHistory) && nextHistory.length > 0 ? nextHistory[0] : null;
        const rollbackStart = __tmNormalizeDateOnly(
            removed.sourceStart
            || nextHead?.nextStart
            || nextHead?.sourceStart
            || removed.nextStart
            || task?.startDate
            || ''
        );
        const rollbackDue = __tmNormalizeDateOnly(
            removed.sourceDue
            || nextHead?.nextDue
            || nextHead?.sourceDue
            || removed.nextDue
            || task?.completionTime
            || ''
        );
        if (!rollbackStart && !rollbackDue) return null;
        const carryCompletedAt = String(nextHead?.completedAt || '').trim();
        const currentState = __tmNormalizeTaskRepeatState(task?.repeatState);
        const removedCumulative = __tmGetTaskTomatoCumulativeValues(removed);
        const rollbackBaseline = nextHead ? {
            tomatoBaselineMinutes: nextHead.tomatoMinutes,
            tomatoBaselineHours: nextHead.tomatoHours,
            tomatoBaselineCount: nextHead.tomatoCount,
            tomatoBaselineSet: true,
        } : {
            tomatoBaselineMinutes: Math.max(0, removedCumulative.tomatoMinutes - __tmNormalizeTaskTomatoAmount(removed.tomatoOccurrenceMinutes)),
            tomatoBaselineHours: Math.max(0, removedCumulative.tomatoHours - __tmNormalizeTaskTomatoAmount(removed.tomatoOccurrenceHours)),
            tomatoBaselineCount: Math.max(0, removedCumulative.tomatoCount - __tmNormalizeTaskTomatoCount(removed.tomatoOccurrenceCount)),
            tomatoBaselineSet: true,
        };
        return {
            startDate: rollbackStart,
            completionTime: rollbackDue,
            repeatState: __tmNormalizeTaskRepeatState({
                ...currentState,
                occurrenceCount: Math.max(1, currentState.occurrenceCount - 1),
                lastCompletedAt: carryCompletedAt,
                lastAdvancedAt: carryCompletedAt,
                lastInstanceStart: rollbackStart,
                lastInstanceDue: rollbackDue,
                pendingNativeDoneReset: false,
                ...rollbackBaseline,
                fsrsCard: removed.fsrsBefore || currentState.fsrsCard,
            }),
        };
    }

    function __tmBuildTaskRepeatAdvancePatch(taskLike, ruleInput, options = {}) {
        const task = (taskLike && typeof taskLike === 'object') ? taskLike : {};
        const rule = __tmNormalizeTaskRepeatRule(ruleInput, {
            startDate: task?.startDate,
            completionTime: task?.completionTime,
        });
        if (!rule.enabled || rule.type === 'none' || rule.type === 'fsrs' || rule.trigger === 'checkin') return null;
        const currentState = __tmNormalizeTaskRepeatState(task?.repeatState);
        if (rule.maxOccurrences > 0 && currentState.occurrenceCount >= rule.maxOccurrences) return null;
        const prevStart = __tmNormalizeDateOnly(task?.startDate || '');
        const prevDue = __tmNormalizeDateOnly(task?.completionTime || '');
        const plannedAnchor = currentState.planOverride
            ? (currentState.planOverride.completionTime || currentState.planOverride.startDate)
            : '';
        const fallbackBase = prevDue || prevStart || rule.anchorDate || __tmNormalizeDateOnly(new Date());
        let nextStart = '';
        let nextDue = '';
        {
            const previousAnchor = prevDue || prevStart || fallbackBase;
            const completionKey = rule.trigger === 'complete'
                ? __tmNormalizeDateOnly(__tmNormalizeTaskCompleteAtValue(options.completedAt || task.taskCompleteAt || task.task_complete_at || ''))
                : '';
            if (rule.trigger === 'complete' && !completionKey) return null;
            const nextAnchor = __tmAdvanceTaskRepeatDateKey(completionKey || plannedAnchor || previousAnchor, rule);
            if (nextAnchor) {
                const deltaDays = __tmGetTaskRepeatLocalDayOrdinal(nextAnchor) - __tmGetTaskRepeatLocalDayOrdinal(previousAnchor);
                if (Number.isFinite(deltaDays)) {
                    nextStart = prevStart ? __tmShiftTaskRepeatDateKey(prevStart, deltaDays) : '';
                    nextDue = prevDue ? __tmShiftTaskRepeatDateKey(prevDue, deltaDays) : '';
                    if (!prevStart && !prevDue) nextDue = nextAnchor;
                }
            }
        }
        if (rule.trigger !== 'complete' && !nextDue && !prevStart && !prevDue && fallbackBase) {
            nextDue = __tmAdvanceTaskRepeatDateKey(fallbackBase, rule);
        }
        if (!nextStart && !nextDue) return null;
        if (prevStart && !nextStart) return null;
        if (prevDue && !nextDue) return null;
        const nowIso = String(options.advancedAt || new Date().toISOString()).trim();
        const repeatState = __tmNormalizeTaskRepeatState({
            ...currentState,
            planOverride: null,
            occurrenceCount: currentState.occurrenceCount + 1,
            lastCompletedAt: String(options.completedAt || task.taskCompleteAt || task.task_complete_at || '').trim() || String(task?.repeatState?.lastCompletedAt || '').trim(),
            lastAdvancedAt: nowIso,
            lastInstanceStart: nextStart,
            lastInstanceDue: nextDue,
        });
        return {
            startDate: nextStart,
            completionTime: nextDue,
            repeatState,
        };
    }

    function __tmAdvanceTaskRepeatDateKey(dateKey, ruleInput) {
        const key = __tmNormalizeDateOnly(dateKey);
        if (!key) return '';
        const rule = __tmNormalizeTaskRepeatRule(ruleInput, {
            startDate: key,
            completionTime: key,
        });
        if (!rule.enabled || rule.type === 'none') return key;
        if (rule.trigger === 'complete') return __tmMonthRepeatCore.afterCompletion(rule, key);
        const base = __tmBuildLocalNoonDateFromKey(key);
        if (!(base instanceof Date) || Number.isNaN(base.getTime())) return key;
        let next = null;
        if (rule.type === 'daily') {
            next = new Date(base.getTime());
            next.setDate(next.getDate() + rule.every);
        } else if (rule.type === 'workday') {
            next = new Date(base.getTime());
            let remaining = rule.every;
            while (remaining > 0) {
                next.setDate(next.getDate() + 1);
                const weekday = next.getDay();
                if (weekday !== 0 && weekday !== 6) remaining -= 1;
            }
        } else if (rule.type === 'weekly') {
            next = __tmFindTaskRepeatNextWeeklyDate(base, rule);
        } else if (rule.type === 'monthly') {
            if (__tmMonthRepeatCore?.isExplicit(rule)) return __tmMonthRepeatCore.nextDateKey(rule, key);
            next = rule.calendarMode === 'lunar'
                ? __tmFindTaskRepeatNextLunarMonthlyDate(base, rule)
                : rule.monthlyMode === 'weekday'
                ? (() => {
                    // A month may not contain the requested fifth weekday. Skip
                    // that interval and continue to the next scheduled month.
                    for (let step = Math.max(1, Number(rule.every) || 1), guard = 0; guard < 120; guard += 1, step += Math.max(1, Number(rule.every) || 1)) {
                        const candidate = __tmBuildTaskRepeatMonthlyWeekdayDate(base, step);
                        if (candidate) return candidate;
                    }
                    return null;
                })()
                : __tmBuildTaskRepeatMonthlyDate(base, rule.every, rule.anchorDate);
        } else if (rule.type === 'yearly') {
            next = rule.calendarMode === 'lunar'
                ? __tmFindTaskRepeatNextLunarYearlyDate(base, rule)
                : __tmBuildTaskRepeatYearlyDate(base, rule.every, rule.anchorDate);
        }
        const nextKey = __tmFormatDateKeyFromDate(next);
        // A missing calendar occurrence must terminate the sequence. Returning
        // the current key here makes monthly weekday rules loop forever when a
        // target month has no matching ordinal weekday.
        if (!nextKey || nextKey <= key) return '';
        if (rule.until && nextKey > rule.until) return '';
        return nextKey;
    }

    function __tmFindTaskRepeatNextWeeklyDate(baseDate, rule) {
        const base = baseDate instanceof Date ? new Date(baseDate.getTime()) : __tmBuildLocalNoonDateFromKey(baseDate);
        if (!(base instanceof Date) || Number.isNaN(base.getTime())) return null;
        const anchor = __tmBuildLocalNoonDateFromKey(rule?.anchorDate) || base;
        const baseWeek = __tmGetTaskRepeatMondayStart(base);
        const anchorWeek = __tmGetTaskRepeatMondayStart(anchor);
        if (!baseWeek || !anchorWeek) return null;
        const weekdays = __tmNormalizeTaskRepeatWeekdays(rule?.weekdays, rule?.anchorDate || __tmFormatDateKeyFromDate(anchor));
        const every = Math.max(1, Number(rule?.every) || 1);
        if (!weekdays.length) {
            const next = new Date(base.getTime());
            next.setDate(next.getDate() + every * 7);
            return next;
        }
        const offsets = weekdays.map((weekday) => (weekday + 6) % 7).sort((left, right) => left - right);
        const diffWeeks = Math.round((__tmGetTaskRepeatLocalDayOrdinal(baseWeek) - __tmGetTaskRepeatLocalDayOrdinal(anchorWeek)) / 7);
        let candidateWeek = diffWeeks < 0 ? new Date(anchorWeek.getTime()) : new Date(baseWeek.getTime());
        if (diffWeeks >= 0) {
            const remainder = diffWeeks % every;
            if (remainder !== 0) candidateWeek.setDate(candidateWeek.getDate() + (every - remainder) * 7);
        }
        for (let guard = 0; guard < 2; guard += 1) {
            for (const dayOffset of offsets) {
                const candidate = new Date(candidateWeek.getTime());
                candidate.setDate(candidate.getDate() + dayOffset);
                if (candidate.getTime() > base.getTime() && candidate.getTime() >= anchor.getTime()) return candidate;
            }
            candidateWeek.setDate(candidateWeek.getDate() + every * 7);
        }
        return null;
    }

    function __tmGetTaskRepeatMondayStart(dateLike) {
        const date = dateLike instanceof Date ? new Date(dateLike.getTime()) : __tmBuildLocalNoonDateFromKey(dateLike);
        if (!(date instanceof Date) || Number.isNaN(date.getTime())) return null;
        date.setDate(date.getDate() - ((date.getDay() + 6) % 7));
        date.setHours(12, 0, 0, 0);
        return date;
    }

    function __tmGetTaskRepeatLocalDayOrdinal(dateLike) {
        const date = dateLike instanceof Date ? dateLike : __tmBuildLocalNoonDateFromKey(dateLike);
        if (!(date instanceof Date) || Number.isNaN(date.getTime())) return Number.NaN;
        return Math.floor(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86400000);
    }

    function __tmFindTaskRepeatNextLunarMonthlyDate(baseDate, rule) {
        const base = (baseDate instanceof Date) ? new Date(baseDate.getTime()) : __tmBuildLocalNoonDateFromKey(baseDate);
        const anchor = __tmBuildLocalNoonDateFromKey(rule?.anchorDate) || base;
        const anchorInfo = __tmGetLunarDateInfo(anchor);
        if (!(base instanceof Date) || Number.isNaN(base.getTime()) || !anchorInfo) return null;
        const anchorIndex = __tmGetLunarMonthIndex(anchorInfo);
        if (!Number.isFinite(anchorIndex)) return null;
        const every = Math.max(1, Number(rule?.every) || 1);
        const cursor = new Date(base.getTime());
        cursor.setDate(cursor.getDate() + 1);
        cursor.setHours(12, 0, 0, 0);
        const guardLimit = Math.min(130000, Math.max(800, (every + 2) * 34 + 400));
        for (let i = 0; i < guardLimit; i += 1) {
            const info = __tmGetLunarDateInfo(cursor);
            if (info
                && info.day === anchorInfo.day
                && (!info.isLeap || anchorInfo.isLeap)) {
                const diffMonths = __tmGetLunarMonthIndex(info) - anchorIndex;
                if (diffMonths > 0 && diffMonths % every === 0) return new Date(cursor.getTime());
            }
            cursor.setDate(cursor.getDate() + 1);
        }
        return null;
    }

    function __tmGetLunarDateInfo(dateLike) {
        const dt = (dateLike instanceof Date) ? new Date(dateLike.getTime()) : __tmBuildLocalNoonDateFromKey(dateLike);
        if (!(dt instanceof Date) || Number.isNaN(dt.getTime())) return null;
        dt.setHours(12, 0, 0, 0);
        const tableInfo = __tmGetTableLunarDateInfo(dt);
        if (tableInfo) return tableInfo;
        const formatter = __tmGetChineseCalendarFormatter();
        if (!formatter) return null;
        try {
            const parts = formatter.formatToParts(dt);
            const getPart = (type) => String((parts.find((part) => part.type === type) || {}).value || '').trim();
            const monthText = getPart('month');
            const dayText = getPart('day');
            const relatedYearText = getPart('relatedYear') || getPart('year');
            const relatedYear = parseInt(relatedYearText, 10);
            const month = __tmParseLunarMonthText(monthText);
            const day = __tmParseLunarChineseNumber(dayText);
            const isLeap = /^闰/.test(monthText);
            if (!Number.isFinite(relatedYear) || !month || !day) return null;
            return { relatedYear, month, day, isLeap };
        } catch (e) {
            return null;
        }
    }

    function __tmGetTableLunarDateInfo(date) {
        const year = date.getFullYear();
        if (year < 1900 || year > 2049) return null;
        const lunarYearDays = (lunarYear) => {
            const value = __TM_LUNAR_INFO_1900_2049[lunarYear - 1900];
            if (!Number.isFinite(value)) return 0;
            let total = 348;
            for (let mask = 0x8000; mask > 0x8; mask >>= 1) total += (value & mask) ? 1 : 0;
            const leapMonth = value & 0xf;
            return total + (leapMonth ? ((value & 0x10000) ? 30 : 29) : 0);
        };
        const leapDays = (lunarYear) => {
            const value = __TM_LUNAR_INFO_1900_2049[lunarYear - 1900];
            return (value & 0xf) ? ((value & 0x10000) ? 30 : 29) : 0;
        };
        const monthDays = (lunarYear, month) => {
            const value = __TM_LUNAR_INFO_1900_2049[lunarYear - 1900];
            return (value & (0x10000 >> month)) ? 30 : 29;
        };
        const base = new Date(1900, 0, 31, 12, 0, 0, 0);
        let offset = Math.floor((date.getTime() - base.getTime()) / 86400000);
        if (offset < 0) return null;
        let relatedYear = 1900;
        while (relatedYear < 2049 && offset >= lunarYearDays(relatedYear)) {
            offset -= lunarYearDays(relatedYear);
            relatedYear += 1;
        }
        const leapMonth = __TM_LUNAR_INFO_1900_2049[relatedYear - 1900] & 0xf;
        let month = 1;
        let isLeap = false;
        for (let calendarMonth = 1; calendarMonth <= 12 || isLeap; calendarMonth += 1) {
            const days = isLeap ? leapDays(relatedYear) : monthDays(relatedYear, calendarMonth);
            if (offset < days) return { relatedYear, month, day: offset + 1, isLeap };
            offset -= days;
            if (leapMonth === calendarMonth && !isLeap) isLeap = true;
            else {
                if (isLeap) isLeap = false;
                month += 1;
            }
        }
        return null;
    }

    function __tmGetChineseCalendarFormatter() {
        if (__tmChineseCalendarFormatter) return __tmChineseCalendarFormatter;
        try {
            __tmChineseCalendarFormatter = new Intl.DateTimeFormat('zh-CN-u-ca-chinese', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
            });
        } catch (e) {
            __tmChineseCalendarFormatter = null;
        }
        return __tmChineseCalendarFormatter;
    }

    function __tmParseLunarMonthText(text) {
        const raw = String(text || '').trim().replace(/^闰/, '').replace(/月$/u, '');
        if (!raw) return 0;
        if (/^\d+$/.test(raw)) return parseInt(raw, 10) || 0;
        return __TM_LUNAR_MONTH_TEXT_MAP[raw] || __tmParseLunarChineseNumber(raw);
    }

    function __tmParseLunarChineseNumber(text) {
        const raw = String(text || '').trim();
        if (!raw) return 0;
        if (/^\d+$/.test(raw)) return parseInt(raw, 10) || 0;
        const s = raw.replace(/[月日号]/g, '').replace(/^初/, '');
        const digitMap = { 零: 0, 〇: 0, 一: 1, 二: 2, 两: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9 };
        if (s.startsWith('廿')) return 20 + (digitMap[s.slice(1)] || 0);
        if (s.startsWith('卅')) return 30 + (digitMap[s.slice(1)] || 0);
        if (s === '十') return 10;
        if (s.startsWith('十')) return 10 + (digitMap[s.slice(1)] || 0);
        if (s.includes('十')) {
            const parts = s.split('十');
            return (digitMap[parts[0]] || 0) * 10 + (digitMap[parts[1]] || 0);
        }
        return digitMap[s] || 0;
    }

    function __tmGetLunarMonthIndex(info) {
        if (!info || !Number.isFinite(Number(info.relatedYear)) || !Number.isFinite(Number(info.month))) return Number.NaN;
        return Number(info.relatedYear) * 12 + Number(info.month) - 1;
    }

    function __tmBuildTaskRepeatMonthlyWeekdayDate(baseDate, deltaMonths) {
        const base = (baseDate instanceof Date) ? new Date(baseDate.getTime()) : __tmBuildLocalNoonDateFromKey(baseDate);
        if (!(base instanceof Date) || Number.isNaN(base.getTime())) return null;
        const months = Number(deltaMonths) || 0;
        const total = base.getFullYear() * 12 + base.getMonth() + months;
        const year = Math.floor(total / 12);
        const month = ((total % 12) + 12) % 12;
        const weekday = base.getDay();
        const ordinal = __tmGetTaskRepeatMonthWeekOrdinal(base);
        const firstDay = new Date(year, month, 1, 12, 0, 0, 0);
        const firstWeekday = firstDay.getDay();
        const offset = (weekday - firstWeekday + 7) % 7;
        const day = 1 + offset + (ordinal - 1) * 7;
        const lastDay = new Date(year, month + 1, 0, 12, 0, 0, 0).getDate();
        if (day > lastDay) return null;
        return new Date(year, month, day, 12, 0, 0, 0);
    }

    function __tmGetTaskRepeatMonthWeekOrdinal(dateLike) {
        const dt = (dateLike instanceof Date) ? dateLike : __tmBuildLocalNoonDateFromKey(dateLike);
        if (!(dt instanceof Date) || Number.isNaN(dt.getTime())) return 1;
        return Math.max(1, Math.min(5, Math.floor((dt.getDate() - 1) / 7) + 1));
    }

    function __tmBuildTaskRepeatMonthlyDate(baseDate, deltaMonths, anchorDateLike = '') {
        const base = (baseDate instanceof Date) ? new Date(baseDate.getTime()) : __tmBuildLocalNoonDateFromKey(baseDate);
        if (!(base instanceof Date) || Number.isNaN(base.getTime())) return null;
        const anchor = __tmBuildLocalNoonDateFromKey(anchorDateLike);
        const months = Number(deltaMonths) || 0;
        const total = base.getFullYear() * 12 + base.getMonth() + months;
        const year = Math.floor(total / 12);
        const month = ((total % 12) + 12) % 12;
        const lastDay = new Date(year, month + 1, 0, 12, 0, 0, 0).getDate();
        const preferredDay = (anchor instanceof Date && !Number.isNaN(anchor.getTime()))
            ? anchor.getDate()
            : base.getDate();
        const day = Math.min(preferredDay, lastDay);
        return new Date(year, month, day, 12, 0, 0, 0);
    }

    function __tmFindTaskRepeatNextLunarYearlyDate(baseDate, rule) {
        const base = (baseDate instanceof Date) ? new Date(baseDate.getTime()) : __tmBuildLocalNoonDateFromKey(baseDate);
        const anchor = __tmBuildLocalNoonDateFromKey(rule?.anchorDate) || base;
        const anchorInfo = __tmGetLunarDateInfo(anchor);
        if (!(base instanceof Date) || Number.isNaN(base.getTime()) || !anchorInfo) return null;
        const baseInfo = __tmGetLunarDateInfo(base) || anchorInfo;
        const every = Math.max(1, Number(rule?.every) || 1);
        let diffYears = Math.max(0, Number(baseInfo.relatedYear) - Number(anchorInfo.relatedYear));
        const mod = diffYears % every;
        if (mod !== 0) diffYears += (every - mod);
        let relatedYear = Number(anchorInfo.relatedYear) + diffYears;
        for (let i = 0; i < 30; i += 1) {
            const candidate = __tmFindTaskRepeatLunarYearDate(relatedYear, anchorInfo);
            if (candidate && candidate.getTime() > base.getTime()) return candidate;
            relatedYear += every;
        }
        return null;
    }

    function __tmFindTaskRepeatLunarYearDate(relatedYear, anchorInfo) {
        const year = Math.trunc(Number(relatedYear));
        if (!Number.isFinite(year) || !anchorInfo) return null;
        const start = new Date(year, 0, 1, 12, 0, 0, 0);
        for (let i = 0; i < 430; i += 1) {
            const info = __tmGetLunarDateInfo(start);
            if (info
                && info.relatedYear === year
                && info.month === anchorInfo.month
                && info.day === anchorInfo.day
                && info.isLeap === anchorInfo.isLeap) {
                return new Date(start.getTime());
            }
            start.setDate(start.getDate() + 1);
        }
        return null;
    }

    function __tmBuildTaskRepeatYearlyDate(baseDate, deltaYears, anchorDateLike = '') {
        const base = (baseDate instanceof Date) ? new Date(baseDate.getTime()) : __tmBuildLocalNoonDateFromKey(baseDate);
        if (!(base instanceof Date) || Number.isNaN(base.getTime())) return null;
        const anchor = __tmBuildLocalNoonDateFromKey(anchorDateLike) || base;
        const year = base.getFullYear() + (Number(deltaYears) || 0);
        const month = anchor.getMonth();
        const lastDay = new Date(year, month + 1, 0, 12, 0, 0, 0).getDate();
        const day = Math.min(anchor.getDate(), lastDay);
        return new Date(year, month, day, 12, 0, 0, 0);
    }

    function __tmGetTaskTomatoFocusValues(taskLike) {
        const task = (taskLike && typeof taskLike === 'object') ? taskLike : {};
        const cumulative = __tmGetTaskTomatoCumulativeValues(task);
        if (task.isRecurringInstance === true || String(task?.id || '').startsWith('repeatinst:')) {
            return {
                tomatoMinutes: __tmNormalizeTaskTomatoAmount(task?.tomatoOccurrenceMinutes ?? task?.tomato_occurrence_minutes ?? cumulative.tomatoMinutes),
                tomatoHours: __tmNormalizeTaskTomatoAmount(task?.tomatoOccurrenceHours ?? task?.tomato_occurrence_hours ?? cumulative.tomatoHours),
                tomatoCount: __tmNormalizeTaskTomatoCount(task?.tomatoOccurrenceCount ?? task?.tomato_occurrence_count ?? cumulative.tomatoCount),
            };
        }
        const rule = __tmNormalizeTaskRepeatRule(task?.repeatRule || task?.repeat_rule || '', {
            startDate: task?.startDate,
            completionTime: task?.completionTime,
        });
        if (!rule.enabled || rule.type === 'none') return cumulative;
        const state = __tmNormalizeTaskRepeatState(task?.repeatState || task?.repeat_state);
        let baseline = state;
        if (!state.tomatoBaselineSet) {
            const latestHistory = __tmNormalizeTaskRepeatHistory(task?.repeatHistory || task?.repeat_history || '')[0] || null;
            if (latestHistory) {
                baseline = {
                    tomatoBaselineMinutes: latestHistory.tomatoMinutes,
                    tomatoBaselineHours: latestHistory.tomatoHours,
                    tomatoBaselineCount: latestHistory.tomatoCount,
                };
            }
        }
        return {
            tomatoMinutes: __tmSubtractTaskTomatoValue(cumulative.tomatoMinutes, baseline.tomatoBaselineMinutes, __tmNormalizeTaskTomatoAmount),
            tomatoHours: __tmSubtractTaskTomatoValue(cumulative.tomatoHours, baseline.tomatoBaselineHours, __tmNormalizeTaskTomatoAmount),
            tomatoCount: __tmSubtractTaskTomatoValue(cumulative.tomatoCount, baseline.tomatoBaselineCount, __tmNormalizeTaskTomatoCount),
        };
    }

    function __tmNowInChinaTimezoneIso() {
        return __tmFormatTsToChinaTimezoneIso(Date.now());
    }

    function __tmSemanticHasReminderIntent(text) {
        return /(提醒|通知)/.test(String(text || ''));
    }

    function __createMonthRepeatCore() {
        const normalizeDays = (value) => Array.from(new Set((Array.isArray(value) ? value : [])
            .map(Number).filter((day) => Number.isInteger(day) && (day === -1 || (day >= 1 && day <= 31)))))
            .sort((left, right) => (left === -1 ? 32 : left) - (right === -1 ? 32 : right));
        const monthLength = (year, month) => month === 2
            ? (year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0) ? 29 : 28)
            : ([4, 6, 9, 11].includes(month) ? 30 : 31);
        const dateKey = (year, month, day) => [String(year).padStart(4, '0'), String(month).padStart(2, '0'), String(day).padStart(2, '0')].join('-');
        const parseKey = (value) => {
            const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || ''));
            if (!match) return null;
            const [year, month, day] = match.slice(1).map(Number);
            if (year < 1 || month < 1 || month > 12 || day < 1 || day > monthLength(year, month)) return null;
            return { year, month, day, index: year * 12 + month - 1, key: dateKey(year, month, day) };
        };
        const weekdayRule = (value, anchorKey = '') => {
            const anchor = parseKey(anchorKey);
            const date = anchor ? new Date(anchor.key + 'T12:00:00') : new Date();
            const ordinal = Number(value?.ordinal);
            const weekday = Number(value?.weekday);
            return {
                ordinal: Number.isInteger(ordinal) && (ordinal === -1 || (ordinal >= 1 && ordinal <= 5)) ? ordinal : Math.ceil(date.getDate() / 7),
                weekday: Number.isInteger(weekday) && weekday >= 0 && weekday <= 6 ? weekday : date.getDay(),
            };
        };
        const isExplicit = (rule) => rule?.type === 'monthly' && rule.enabled !== false && rule.trigger !== 'complete' && rule.calendarMode !== 'lunar'
            && (rule.monthlyMode === 'weekday' ? !!rule.monthWeek && typeof rule.monthWeek === 'object' : Array.isArray(rule.monthDays));
        const interval = (rule) => Math.max(1, Math.min(3650, Math.trunc(Number(rule?.every) || 1)));
        const candidates = (rule, monthIndex) => {
            const anchor = parseKey(rule?.anchorDate);
            if (!isExplicit(rule) || !anchor || monthIndex < anchor.index || (monthIndex - anchor.index) % interval(rule) !== 0) return [];
            const year = Math.floor(monthIndex / 12);
            const month = monthIndex % 12 + 1;
            if (year < 1 || year > 9999) return [];
            const last = monthLength(year, month);
            if (rule.monthlyMode === 'weekday') {
                const pattern = weekdayRule(rule.monthWeek, anchor.key);
                const firstWeekday = new Date(dateKey(year, month, 1) + 'T12:00:00').getDay();
                const lastWeekday = (firstWeekday + last - 1) % 7;
                const day = pattern.ordinal === -1 ? last - (lastWeekday - pattern.weekday + 7) % 7
                    : 1 + (pattern.weekday - firstWeekday + 7) % 7 + (pattern.ordinal - 1) * 7;
                const key = dateKey(year, month, day);
                return day <= last && key >= anchor.key && (!rule.until || key <= rule.until) ? [key] : [];
            }
            return Array.from(new Set(normalizeDays(rule.monthDays).map((day) => day === -1 ? last : day)
                .filter((day) => day <= last))).sort((left, right) => left - right)
                .map((day) => dateKey(year, month, day))
                .filter((key) => key >= anchor.key && (!rule.until || key <= rule.until));
        };
        const seek = (rule, cursorKey, direction, inclusive = false) => {
            const anchor = parseKey(rule?.anchorDate);
            let cursor = parseKey(cursorKey);
            if (!isExplicit(rule) || !anchor || !cursor || (rule.monthlyMode !== 'weekday' && normalizeDays(rule.monthDays).length === 0)) return '';
            if (direction > 0 && cursor.key < anchor.key) { cursor = anchor; inclusive = true; }
            if (direction < 0 && rule.until && cursor.key > rule.until) { cursor = parseKey(rule.until); inclusive = true; }
            if (!cursor || (direction > 0 && rule.until && cursor.key > rule.until) || (direction < 0 && cursor.key < anchor.key)) return '';
            const every = interval(rule);
            const delta = (cursor.index - anchor.index) / every;
            let monthIndex = anchor.index + (direction > 0 ? Math.ceil(delta) : Math.floor(delta)) * every;
            for (let guard = 0; guard <= 4800; guard += 1, monthIndex += direction * every) {
                if (monthIndex < anchor.index || monthIndex > 119999) return '';
                if (direction > 0 && rule.until && monthIndex > (parseKey(rule.until)?.index ?? 119999)) return '';
                const keys = candidates(rule, monthIndex);
                if (direction < 0) keys.reverse();
                const found = keys.find((key) => direction > 0
                    ? (inclusive ? key >= cursor.key : key > cursor.key)
                    : (inclusive ? key <= cursor.key : key < cursor.key));
                if (found) return found;
            }
            return '';
        };
        const nextDateKey = (rule, cursor, inclusive = false) => seek(rule, cursor, 1, inclusive);
        const previousDateKey = (rule, cursor, inclusive = false) => seek(rule, cursor, -1, inclusive);
        const ordinal = (rule, key) => {
            const target = parseKey(key);
            const anchor = parseKey(rule?.anchorDate);
            if (!target || !anchor || !candidates(rule, target.index).includes(key)) return 0;
            let count = 0;
            for (let monthIndex = anchor.index; monthIndex <= target.index; monthIndex += interval(rule)) {
                count += candidates(rule, monthIndex).filter((candidate) => candidate <= key).length;
            }
            return count;
        };
        const iterate = (rule, options = {}) => {
            const from = String(options.fromDateKey || rule?.anchorDate || '');
            const to = String(options.toDateKey || from);
            if (!parseKey(from) || !parseKey(to) || to < from) return [];
            const limit = Math.max(1, Math.min(2400, Math.trunc(Number(options.limit) || 2400)));
            let current = nextDateKey(rule, from, true);
            let number = current ? ordinal(rule, current) : 0;
            const result = [];
            while (current && current <= to && result.length < limit && (!rule.maxOccurrences || number <= rule.maxOccurrences)) {
                result.push({ dateKey: current, ordinal: number });
                current = nextDateKey(rule, current);
                number += 1;
            }
            return result;
        };
        const afterCompletion = (rule, completedKey) => {
            const completed = parseKey(completedKey);
            if (!completed || rule?.enabled === false) return '';
            const every = interval(rule);
            let nextKey = '';
            if (rule.type === 'monthly' || rule.type === 'yearly') {
                const monthIndex = completed.index + every * (rule.type === 'yearly' ? 12 : 1);
                const year = Math.floor(monthIndex / 12);
                const month = monthIndex % 12 + 1;
                if (year > 9999) return '';
                nextKey = dateKey(year, month, Math.min(completed.day, monthLength(year, month)));
            } else if (['daily', 'weekly', 'workday'].includes(rule.type)) {
                const next = new Date(completed.key + 'T12:00:00');
                if (rule.type === 'workday') {
                    let remaining = every;
                    while (remaining > 0) {
                        next.setDate(next.getDate() + 1);
                        if (next.getDay() !== 0 && next.getDay() !== 6) remaining -= 1;
                    }
                } else {
                    next.setDate(next.getDate() + every * (rule.type === 'weekly' ? 7 : 1));
                }
                nextKey = dateKey(next.getFullYear(), next.getMonth() + 1, next.getDate());
            }
            return parseKey(nextKey) && nextKey > completed.key && (!rule.until || nextKey <= rule.until) ? nextKey : '';
        };
        const label = (value) => {
            const days = normalizeDays(value);
            const dates = days.filter((day) => day > 0);
            return [dates.length ? dates.join('、') + '日' : '', days.includes(-1) ? '最后一天' : ''].filter(Boolean).join('、');
        };
        const weekdayLabel = (value, anchorKey = '') => {
            const pattern = weekdayRule(value, anchorKey);
            return (pattern.ordinal === -1 ? '最后一个' : ['第一个', '第二个', '第三个', '第四个', '第五个'][pattern.ordinal - 1])
                + ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][pattern.weekday];
        };
        const weekdayPickerHTML = (value, anchorKey = '') => {
            const pattern = weekdayRule(value, anchorKey);
            const ordinals = [[1, '第一个'], [2, '第二个'], [3, '第三个'], [4, '第四个'], [5, '第五个'], [-1, '最后一个']];
            const weekdays = [[0, '周日'], [1, '周一'], [2, '周二'], [3, '周三'], [4, '周四'], [5, '周五'], [6, '周六']];
            const select = (field, label, values, selected) => '<select data-tm-month-week="' + field + '" aria-label="' + label + '" style="flex:1;min-width:0;height:36px;padding:0 10px;border:1px solid var(--tm-border-color,var(--b3-theme-surface-light));border-radius:6px;background:var(--tm-bg-color,var(--b3-theme-background));color:var(--tm-text-color,var(--b3-theme-on-background));font:inherit;">'
                + values.map(([key, text]) => '<option value="' + key + '"' + (key === selected ? ' selected' : '') + '>' + text + '</option>').join('') + '</select>';
            return '<div style="display:flex;gap:8px;width:100%;min-width:0;">' + select('ordinal', '每月第几个星期', ordinals, pattern.ordinal) + select('weekday', '星期几', weekdays, pattern.weekday) + '</div>';
        };
        const pickerHTML = (value, anchorKey = '') => {
            const days = value === undefined ? [parseKey(anchorKey)?.day || 1] : normalizeDays(value);
            const buttons = Array.from({ length: 32 }, (_, index) => index < 31 ? index + 1 : -1).map((day) => {
                const selected = days.includes(day);
                const title = day === -1 ? '最后一天' : String(day);
                return '<button type="button" class="tm-repeat-month-day' + (selected ? ' is-selected' : '') + '" data-tm-month-day="' + day + '" aria-pressed="' + selected + '" aria-label="每月' + (day === -1 ? title : title + '日') + '">' + title + '</button>';
            }).join('');
            return '<style>.tm-repeat-month-days{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:4px;width:100%;min-width:0}.tm-repeat-month-day{position:relative;z-index:0;min-width:0;height:36px;padding:0;border:0;border-radius:6px;background:transparent;color:var(--tm-text-color,var(--b3-theme-on-background));font:inherit;font-size:12px;font-weight:750;cursor:pointer}.tm-repeat-month-day::after{content:"";position:absolute;z-index:-1;pointer-events:none;width:28px;height:28px;left:50%;top:50%;transform:translate(-50%,-50%);border-radius:999px}.tm-repeat-month-day:hover::after{background:var(--tm-hover-bg,var(--b3-theme-surface-light))}.tm-repeat-month-day.is-selected{color:var(--tm-primary-color,var(--b3-theme-primary))}.tm-repeat-month-day.is-selected::after{background:color-mix(in srgb,var(--tm-primary-color,var(--b3-theme-primary)) 20%,var(--tm-card-bg,var(--b3-theme-background)) 80%)}.tm-repeat-month-day:focus-visible{outline:2px solid var(--tm-primary-color,var(--b3-theme-primary));outline-offset:1px}.tm-repeat-month-day[data-tm-month-day="-1"]{grid-column:span 2;font-weight:500}.tm-repeat-month-day[data-tm-month-day="-1"]::after{width:calc(100% - 8px);border-radius:6px}.tm-repeat-month-days-note{margin:6px 0 0;color:var(--tm-secondary-text,var(--b3-theme-on-surface-light));font-size:12px;line-height:1.5}@media(pointer:coarse){.tm-repeat-month-day{height:44px}.tm-repeat-month-day::after{width:32px;height:32px}}</style><div class="tm-repeat-month-days" role="group" aria-label="每月日期，可多选">' + buttons + '</div><p class="tm-repeat-month-days-note">' + (value === undefined ? '可多选；未修改时保留原有月末规则。' : '当月不存在的日期跳过；最后一天随月份变化。') + '</p>';
        };
        return Object.freeze({ version: 1, normalizeDays, weekdayRule, weekdayLabel, weekdayPickerHTML, isExplicit, candidates, nextDateKey, previousDateKey, ordinal, iterate, afterCompletion, label, pickerHTML });
    }
    const __tmMonthRepeatCore = __createMonthRepeatCore();
    const __TM_LUNAR_MONTH_TEXT_MAP = {
        '正': 1, '一': 1, '二': 2, '三': 3, '四': 4, '五': 5, '六': 6,
        '七': 7, '八': 8, '九': 9, '十': 10, '十一': 11, '冬': 11,
        '十二': 12, '腊': 12,
    };
    const __TM_LUNAR_INFO_1900_2049 = Object.freeze([
        0x04bd8, 0x04ae0, 0x0a570, 0x054d5, 0x0d260, 0x0d950, 0x16554, 0x056a0, 0x09ad0, 0x055d2,
        0x04ae0, 0x0a5b6, 0x0a4d0, 0x0d250, 0x1d255, 0x0b540, 0x0d6a0, 0x0ada2, 0x095b0, 0x14977,
        0x04970, 0x0a4b0, 0x0b4b5, 0x06a50, 0x06d40, 0x1ab54, 0x02b60, 0x09570, 0x052f2, 0x04970,
        0x06566, 0x0d4a0, 0x0ea50, 0x06e95, 0x05ad0, 0x02b60, 0x186e3, 0x092e0, 0x1c8d7, 0x0c950,
        0x0d4a0, 0x1d8a6, 0x0b550, 0x056a0, 0x1a5b4, 0x025d0, 0x092d0, 0x0d2b2, 0x0a950, 0x0b557,
        0x06ca0, 0x0b550, 0x15355, 0x04da0, 0x0a5d0, 0x14573, 0x052d0, 0x0a9a8, 0x0e950, 0x06aa0,
        0x0aea6, 0x0ab50, 0x04b60, 0x0aae4, 0x0a570, 0x05260, 0x0f263, 0x0d950, 0x05b57, 0x056a0,
        0x096d0, 0x04dd5, 0x04ad0, 0x0a4d0, 0x0d4d4, 0x0d250, 0x0d558, 0x0b540, 0x0b5a0, 0x195a6,
        0x095b0, 0x049b0, 0x0a974, 0x0a4b0, 0x0b27a, 0x06a50, 0x06d40, 0x0af46, 0x0ab60, 0x09570,
        0x04af5, 0x04970, 0x064b0, 0x074a3, 0x0ea50, 0x06b58, 0x055c0, 0x0ab60, 0x096d5, 0x092e0,
        0x0c960, 0x0d954, 0x0d4a0, 0x0da50, 0x07552, 0x056a0, 0x0abb7, 0x025d0, 0x092d0, 0x0cab5,
        0x0a950, 0x0b4a0, 0x0baa4, 0x0ad50, 0x055d9, 0x04ba0, 0x0a5b0, 0x15176, 0x052b0, 0x0a930,
        0x07954, 0x06aa0, 0x0ad50, 0x05b52, 0x04b60, 0x0a6e6, 0x0a4e0, 0x0d260, 0x0ea65, 0x0d530,
        0x05aa0, 0x076a3, 0x096d0, 0x04bd7, 0x04ad0, 0x0a4d0, 0x1d0b6, 0x0d250, 0x0d520, 0x0dd45,
        0x0b5a0, 0x056d0, 0x055b2, 0x049b0, 0x0a577, 0x0a4b0, 0x0aa50, 0x1b255, 0x06d20, 0x0ada0,
    ]);
    let __tmChineseCalendarFormatter = null;
    const __TM_CHINA_TZ_OFFSET_MINUTES = 8 * 60;
    const __TM_CHINA_TZ_SUFFIX = '+08:00';
    const __tmResolveTaskCompletedAtRaw = task => task.taskCompleteAt || task.task_complete_at || '';
    const __tmResolveTaskMarker = task => TaskStatus.fromMarkdown(task.markdown);
    const __tmBuildFsrsReviewPatch = () => { throw new Error('FSRS 评分请使用任务详情中的复习入口'); };
    return Object.freeze({ rulePatch: __tmBuildTaskRepeatRuleMetaPatch, signature: __tmGetTaskRepeatScheduleSignature, summary: __tmGetTaskRepeatSummary, completionPlan: __tmBuildTaskCompletionPlan, occurrenceId: __tmGetTaskOccurrenceId, normalizeState: __tmNormalizeTaskRepeatState, now: __tmNowInChinaTimezoneIso, hasReminderIntent: __tmSemanticHasReminderIntent });
    })();
    /* generated task recurrence: end */

    const PLUGIN_VERSION = '1';
    const SETTINGS_FILE = 'task-settings.json';
    const TASK_ATTR_STORAGE_FILE = 'task-attr-storage.json';
    const TASK_ATTR_ITEM_STORAGE_VERSION = 1;
    const MCP_CONFIG_FILE = 'agent-mcp-config.json';
    const SCHEDULE_FILE = 'calendar-events.json';
    const SCHEDULE_SNAPSHOT_TTL_MS = 30000;
    const AGENT_SCHEDULE_FILE = 'agent-scheduled-events.json';
    const SCHEDULE_REMINDER_MODES = Object.freeze(['inherit', 'custom']);
    const SCHEDULE_REMINDER_OFFSETS = Object.freeze([0, 5, 10, 15, 30, 60]);
    const POLICY_FILE = 'ai-policy-config.json';
    const POLICY_CONFIG_FIELDS = Object.freeze(['weeklyAvailability', 'fixedOccupancy', 'deadlinePriority', 'defaultCalendarID', 'customInstructions']);
    const DURATION_DEFAULT_MINUTES_MIN = 15;
    const DURATION_DEFAULT_MINUTES_MAX = 480;
    const ATTR_OWNER = 'custom-task-horizon-attr-host-owner';
    const ATTR_UPDATED_AT = 'custom-task-horizon-attr-host-updated-at';
    const ATTACHMENT_ATTR_PREFIX = 'custom-data-assets-th-';
    const ATTACHMENT_META_ATTR = 'custom-data-assets-th-meta';
    const REMINDER_ATTR = 'custom-tomato-reminder';
    const REMINDER_REPEAT_MODE_FOLLOW_TASK = 'followTaskRepeat';
    const REMINDER_REPEAT_MODE_MANUAL = 'manual';
    const REPEAT_ATTRS = Object.freeze(['custom-task-repeat-rule', 'custom-task-repeat-state', 'custom-task-repeat-history']);
    const ID_RE = /^[0-9]{14}-[A-Za-z0-9]+$/;
    const VIRTUAL_TASK_ID_RE = /^repeatinst:([0-9]{14}-[A-Za-z0-9]+):([^:]+)$/;
    const SAFE_ATTR_RE = /^custom-[A-Za-z0-9_-]+$/;
    const DELETE_TOKEN_TTL = 10 * 60 * 1000;
    const PREVIEW_TOKEN_TTL = 10 * 60 * 1000;
    const TASK_SCOPE_TOKEN_TTL = 10 * 60 * 1000;
    const TASK_SCOPE_MAX_ENTRIES = 64;
    const UNDO_RECORD_TTL = 30 * 60 * 1000;
    const UNDO_RECORD_MAX_ENTRIES = 64;

    const MCP_TOOL_GROUPS = Object.freeze([
        {
            id: 'tasks',
            label: '任务',
            description: '查询、新建、修改、移动和删除任务。',
            tools: [
                ['list_task_scopes', '列出任务范围'],
                ['get_task', '读取任务详情'],
                ['query_tasks', '筛选任务'],
                ['create_task', '新建任务'],
                ['update_task', '更新任务'],
                ['move_task', '移动任务'],
                ['delete_task', '删除任务'],
                ['batch_tasks', '批量处理任务'],
            ],
        },
        {
            id: 'schedules',
            label: '日程',
            description: '查询和管理任务日程。',
            tools: [
                ['query_schedules', '查询日程'],
                ['create_schedule', '新建日程'],
                ['update_schedule', '更新日程'],
                ['delete_schedule', '删除日程'],
                ['batch_schedules', '批量处理日程'],
            ],
        },
        {
            id: 'operations',
            label: '组合操作',
            description: '在一次确认中协调任务和日程修改。',
            tools: [
                ['apply_task_operation_plan', '执行任务与日程计划'],
            ],
        },
        {
            id: 'reminders',
            label: '提醒与自动化',
            description: '设置任务提醒和 AI 定时任务。',
            tools: [
                ['configure_task_reminder', '设置任务提醒'],
                ['manage_agent_schedules', '管理 AI 定时任务'],
            ],
        },
        {
            id: 'policy',
            label: '安排规则',
            description: '读取、预览和修改任务规划规则。',
            tools: [
                ['get_task_policy', '读取安排规则'],
                ['preview_task_policy_patch', '预览规则修改'],
                ['apply_task_policy_patch', '应用规则修改'],
            ],
        },
        {
            id: 'stats',
            label: '统计复盘',
            description: '聚合任务完成情况和时间投入。',
            tools: [
                ['aggregate_task_stats', '任务完成统计'],
                ['aggregate_time_usage', '时间投入统计'],
                ['query_focus_statistics', '专注统计'],
                ['query_routine_statistics', '日常统计'],
                ['list_focus_sessions', '专注明细'],
            ],
        },
    ]);
    const MCP_TOOL_NAMES = Object.freeze(MCP_TOOL_GROUPS.flatMap((group) => group.tools.map((tool) => tool[0])));
    const MCP_READ_ONLY_TOOLS = new Set([
        'list_task_scopes', 'get_task', 'query_tasks', 'query_schedules',
        'get_task_policy', 'preview_task_policy_patch', 'aggregate_task_stats', 'aggregate_time_usage',
        'query_focus_statistics', 'query_routine_statistics', 'list_focus_sessions',
    ]);
    const MCP_ACTION_EFFECTS = Object.freeze({
        manage_agent_schedules: Object.freeze({
            list: Object.freeze({ localRead: true }),
            create: Object.freeze({ localWrite: true }),
            update: Object.freeze({ localWrite: true }),
            delete: Object.freeze({ localWrite: true }),
        }),
        delete_task: Object.freeze({
            get: Object.freeze({ localRead: true }),
            delete: Object.freeze({ localWrite: true }),
        }),
        batch_tasks: Object.freeze({
            get: Object.freeze({ localRead: true }),
            apply: Object.freeze({ localWrite: true }),
        }),
        delete_schedule: Object.freeze({
            get: Object.freeze({ localRead: true }),
            delete: Object.freeze({ localWrite: true }),
        }),
        batch_schedules: Object.freeze({
            get: Object.freeze({ localRead: true }),
            apply: Object.freeze({ localWrite: true }),
        }),
    });

    const ERROR = Object.freeze({
        INVALID_ARGUMENT: 'INVALID_ARGUMENT',
        NOT_FOUND: 'NOT_FOUND',
        CONFLICT: 'CONFLICT',
        CONFIRMATION_REQUIRED: 'CONFIRMATION_REQUIRED',
        STALE_REVISION: 'STALE_REVISION',
        STORAGE_MISSING: 'STORAGE_MISSING',
        STORAGE_CORRUPT: 'STORAGE_CORRUPT',
        STORAGE_ERROR: 'STORAGE_ERROR',
        UNSUPPORTED: 'UNSUPPORTED',
    });

    const BUILTIN_FIELDS = Object.freeze([
        { id: 'priority', label: '重要性', type: 'string', attr: 'custom-priority', writable: true },
        { id: 'customStatus', label: '状态', type: 'string', attr: 'custom-status', writable: true },
        { id: 'startDate', label: '开始日期', type: 'date', attr: 'custom-start-date', writable: true, mirror: true },
        { id: 'completionTime', label: '截止日期', type: 'date', attr: 'custom-completion-time', writable: true, mirror: true },
        { id: 'dateMode', label: '日期模式', type: 'string', attr: 'custom-task-date-mode', writable: true },
        { id: 'taskCompleteAt', label: '完成时间', type: 'datetime', attr: 'custom-task-complete-at', writable: false, system: true },
        { id: 'duration', label: '预估时长', type: 'duration', attr: 'custom-duration', writable: true },
        { id: 'remark', label: '备注', type: 'string', attr: 'custom-remark', writable: true },
        { id: 'taskDateColor', label: '任务日期颜色', type: 'color', attr: 'custom-task-date-color', writable: true, mirror: true },
        { id: 'customTime', label: '自定义时间', type: 'string', attr: 'custom-time', writable: true, mirror: true },
        { id: 'milestone', label: '里程碑', type: 'boolean', attr: 'custom-milestone-event', writable: true },
        { id: 'pinned', label: '置顶', type: 'boolean', attr: 'custom-pinned', writable: true },
        { id: 'allDayBottom', label: '全天置底', type: 'boolean', attr: 'custom-all-day-bottom', writable: true },
        { id: 'tomatoEstimateCount', label: '预计番茄数', type: 'number', attr: 'custom-tomato-estimate-count', writable: true },
        { id: 'tomatoCount', label: '实际番茄数', type: 'number', attr: 'custom-tomato-count', writable: false, system: true },
        { id: 'tomatoMinutes', label: '实际专注分钟', type: 'number', attr: 'custom-tomato-minutes', writable: false, system: true },
        { id: 'tomatoHours', label: '实际专注小时', type: 'number', attr: 'custom-tomato-time', writable: false, system: true },
    ]);
    const DEFAULT_STATUS_OPTIONS = Object.freeze([
        { id: 'todo', name: '待办', color: '#757575', marker: ' ' },
        { id: 'in_progress', name: '进行中', color: '#2196F3', marker: '/' },
        { id: 'done', name: '已完成', color: '#4CAF50', marker: 'X' },
        { id: 'cancelled', name: '放弃', color: '#9E9E9E', marker: '-' },
        { id: 'blocked', name: '阻塞', color: '#F44336', marker: ' ' },
        { id: 'review', name: '待审核', color: '#FF9800', marker: ' ' },
    ]);
    const PRIORITY_DEFINITIONS = Object.freeze([
        { id: 'high', name: '高' },
        { id: 'medium', name: '中' },
        { id: 'low', name: '低' },
        { id: 'none', name: '未设置' },
    ]);
    const TASK_READ_FIELDS = Object.freeze([
        'markdown', 'parentListID', 'parentTaskID', 'documentName', 'documentPath', 'created', 'updated',
        'attrHostID', 'attrHostState',
        ...BUILTIN_FIELDS.map((field) => field.id),
        'priorityScore', 'priorityName', 'customStatusName',
        'attachments', 'attachmentCount', 'reminder', 'hasReminder', 'repeatRule', 'repeatState', 'repeatHistory', 'occurrenceId',
        'customFieldValues', 'virtualTask', 'virtualType', 'readOnly', 'sourceTaskID',
    ]);

    class DomainError extends Error {
        constructor(code, message, details) {
            super(String(message || code));
            this.code = code || ERROR.STORAGE_ERROR;
            this.details = details || null;
        }
    }

    const state = {
        mcpEnabled: false,
        mcpAuthorized: false,
        mcpDesiredEnabled: false,
        mcpTools: Object.create(null),
        registeredTools: new Set(),
        taskLanes: new Map(),
        scheduleLane: Promise.resolve(),
        scheduleSnapshot: {
            status: 'cold',
            items: null,
            loadedAt: 0,
            inflight: null,
        },
        agentScheduleLane: Promise.resolve(),
        deleteTokens: new Map(),
        reminderTokens: new Map(),
        policyTokens: new Map(),
        operationTokens: new Map(),
        taskScopes: new Map(),
        documentGroupSnapshot: null,
        undoRecords: new Map(),
        undoSequence: 0,
        lastUndo: null,
    };

    function nowIso() {
        return new Date().toISOString();
    }

    function text(value) {
        return String(value == null ? '' : value).trim();
    }

    function own(obj, key) {
        return !!obj && Object.prototype.hasOwnProperty.call(obj, key);
    }

    function clampInt(value, min, max, fallback) {
        const parsed = Math.floor(Number(value));
        if (!Number.isFinite(parsed)) return fallback;
        return Math.max(min, Math.min(max, parsed));
    }

    function uniqueStrings(values) {
        const seen = new Set();
        const out = [];
        (Array.isArray(values) ? values : []).forEach((value) => {
            const item = text(value);
            if (!item || seen.has(item)) return;
            seen.add(item);
            out.push(item);
        });
        return out;
    }

    function requireID(value, label) {
        const id = text(value);
        if (!ID_RE.test(id)) throw new DomainError(ERROR.INVALID_ARGUMENT, `${label || 'ID'} 格式无效`);
        return id;
    }

    function escapeSql(value) {
        return String(value == null ? '' : value).replace(/'/g, "''");
    }

    function stableJson(value) {
        if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
        if (value && typeof value === 'object') {
            return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(',')}}`;
        }
        return JSON.stringify(value);
    }

    function token(prefix) {
        return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 12)}`;
    }

    function newNodeID() {
        const now = new Date();
        const stamp = [
            now.getFullYear(),
            String(now.getMonth() + 1).padStart(2, '0'),
            String(now.getDate()).padStart(2, '0'),
            String(now.getHours()).padStart(2, '0'),
            String(now.getMinutes()).padStart(2, '0'),
            String(now.getSeconds()).padStart(2, '0'),
        ].join('');
        const suffix = Math.random().toString(36).slice(2, 9).padEnd(7, '0');
        return `${stamp}-${suffix}`;
    }

    function success(data, meta) {
        return { ok: true, data: data == null ? null : data, error: null, meta: meta || {} };
    }

    function failure(error) {
        const err = error instanceof DomainError
            ? error
            : new DomainError(ERROR.STORAGE_ERROR, text(error && error.message) || '操作失败');
        return {
            ok: false,
            data: null,
            error: { code: err.code, message: err.message, details: err.details || null },
            meta: {},
        };
    }

    async function asResult(handler) {
        const startedAt = Date.now();
        try {
            const value = await handler();
            rememberUndo(state.lastUndo);
            if (value && typeof value === 'object' && typeof value.ok === 'boolean') return value;
            return success(value, { durationMs: Date.now() - startedAt });
        } catch (error) {
            const result = failure(error);
            result.meta.durationMs = Date.now() - startedAt;
            return result;
        }
    }

    async function asAgentCapabilityResult(handler, args) {
        const result = await handler(args);
        if (result?.ok === false) {
            const error = new Error(text(result.error?.message) || '任务工具调用失败');
            error.code = text(result.error?.code) || ERROR.STORAGE_ERROR;
            error.details = result.error?.details || null;
            throw error;
        }
        return result;
    }

    async function api(path, body) {
        const response = await siyuan.client.fetch(path, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body || {}),
        });
        let payload;
        try {
            payload = await response.json();
        } catch (error) {
            throw new DomainError(ERROR.STORAGE_ERROR, `思源接口返回无效数据: ${path}`);
        }
        if (!response.ok || !payload || Number(payload.code) !== 0) {
            const message = text(payload && payload.msg) || `思源接口调用失败: ${path}`;
            const code = /not found|不存在/i.test(message) ? ERROR.NOT_FOUND : ERROR.STORAGE_ERROR;
            throw new DomainError(code, message, {
                path,
                status: response.status,
                kernelCode: payload && payload.code,
                data: payload && payload.data,
            });
        }
        return payload.data;
    }

    async function sql(statement) {
        const rows = await api('/api/query/sql', { stmt: statement });
        return Array.isArray(rows) ? rows : [];
    }

    function jsonStorageError(path, record) {
        const status = text(record && record.status) || 'unavailable';
        const cause = text(record && record.error && record.error.message);
        if (status === 'missing') {
            return new DomainError(ERROR.STORAGE_MISSING, `未找到 ${path}`, { path, status, cause });
        }
        if (status === 'corrupt') {
            return new DomainError(ERROR.STORAGE_CORRUPT, `${path} 内容损坏`, { path, status, cause });
        }
        return new DomainError(ERROR.STORAGE_ERROR, `读取 ${path} 失败`, { path, status, cause });
    }

    async function readJsonState(path) {
        try {
            const content = await siyuan.storage.get(path);
            const raw = await content.text();
            if (!text(raw)) {
                return { status: 'corrupt', value: null, error: new Error('empty file') };
            }
            try {
                return { status: 'valid', value: JSON.parse(raw), error: null };
            } catch (error) {
                return { status: 'corrupt', value: null, error };
            }
        } catch (error) {
            const message = text(error && error.message);
            const missing = /(?:not\s+found|not\s+exist|cannot\s+find|enoent|找不到|不存在)/i.test(message);
            return { status: missing ? 'missing' : 'unavailable', value: null, error };
        }
    }

    async function readJson(path, fallback) {
        const record = await readJsonState(path);
        return record.status === 'valid' ? record.value : fallback;
    }

    async function writeJson(path, value) {
        let serialized;
        try {
            serialized = JSON.stringify(value, null, 2);
            await siyuan.storage.put(path, serialized);
        } catch (error) {
            throw new DomainError(ERROR.STORAGE_ERROR, `保存 ${path} 失败`, { cause: text(error && error.message) });
        }
        const verified = await readJsonState(path);
        let expected;
        try { expected = JSON.parse(serialized); }
        catch (error) {
            throw new DomainError(ERROR.STORAGE_ERROR, `保存 ${path} 后无法校验`, { cause: text(error && error.message) });
        }
        if (verified.status !== 'valid' || stableJson(verified.value) !== stableJson(expected)) {
            throw new DomainError(ERROR.STORAGE_ERROR, `保存 ${path} 后回读不一致`, {
                path,
                status: verified.status,
                cause: text(verified.error && verified.error.message),
            });
        }
    }

    async function getSettings() {
        const settings = await readJson(SETTINGS_FILE, {});
        return settings && typeof settings === 'object' && !Array.isArray(settings) ? settings : {};
    }

    function normalizeAttrKey(value, fallback) {
        const candidate = text(value);
        if (candidate && SAFE_ATTR_RE.test(candidate)) return candidate;
        return SAFE_ATTR_RE.test(text(fallback)) ? text(fallback) : '';
    }

    function normalizeCustomFieldID(value) {
        return text(value).toLowerCase()
            .replace(/\s+/g, '-')
            .replace(/[^a-z0-9-]/g, '-')
            .replace(/-+/g, '-')
            .replace(/^-+|-+$/g, '');
    }

    function customFieldAttr(field) {
        const id = normalizeCustomFieldID(field && field.id) || 'field';
        let name = text(field && field.attrKey);
        if (name.indexOf('custom-tm-') === 0) name = name.slice('custom-tm-'.length);
        name = normalizeCustomFieldID(name) || id;
        return `custom-tm-${name}`;
    }

    function normalizeCustomValue(field, value) {
        const type = text(field && field.type);
        const options = Array.isArray(field && field.options) ? field.options : [];
        const findName = (candidate) => {
            const tokenValue = text(candidate);
            const option = options.find((item) => text(item && item.id) === tokenValue || text(item && item.name) === tokenValue);
            return text(option && option.name) || tokenValue;
        };
        if (type === 'multi') {
            const values = Array.isArray(value) ? value : String(value == null ? '' : value).split(',');
            return uniqueStrings(values.map(findName)).join(', ');
        }
        if (type === 'text') return text(value);
        return findName(value);
    }

    async function getFieldRegistry() {
        const settings = await getSettings();
        const keyOverrides = settings.taskMetaAttrKeys && typeof settings.taskMetaAttrKeys === 'object'
            ? settings.taskMetaAttrKeys
            : {};
        const aliasOverrides = settings.taskMetaAttrKeyAliases && typeof settings.taskMetaAttrKeyAliases === 'object'
            ? settings.taskMetaAttrKeyAliases
            : {};
        const defs = BUILTIN_FIELDS.map((field) => {
            let fallback = field.attr;
            if (field.id === 'tomatoEstimateCount') fallback = text(settings.tomatoEstimateAttrKey) || fallback;
            if (field.id === 'tomatoCount') fallback = text(settings.tomatoCountAttrKey) || fallback;
            if (field.id === 'tomatoMinutes') fallback = text(settings.tomatoSpentAttrKeyMinutes) || fallback;
            if (field.id === 'tomatoHours') fallback = text(settings.tomatoSpentAttrKeyHours) || fallback;
            const attr = normalizeAttrKey(keyOverrides[field.id], fallback) || fallback;
            const aliases = uniqueStrings([
                ...(Array.isArray(aliasOverrides[field.id]) ? aliasOverrides[field.id] : []),
                field.attr,
            ].map((key) => normalizeAttrKey(key, '')).filter(Boolean)).filter((key) => key !== attr);
            return { ...field, attr, aliases };
        });
        const customFields = (Array.isArray(settings.customFieldDefs) ? settings.customFieldDefs : [])
            .map((field) => {
                const id = text(field && field.id);
                if (!id) return null;
                return {
                    ...field,
                    id,
                    label: text(field.name) || id,
                    type: text(field.type) || 'single',
                    attr: customFieldAttr(field),
                    aliases: [],
                    writable: field.agentWritable !== false,
                    custom: true,
                };
            })
            .filter(Boolean);
        const configuredStatusOptions = (Array.isArray(settings.customStatusOptions) ? settings.customStatusOptions : DEFAULT_STATUS_OPTIONS)
            .map((option) => ({
                id: text(option && (option.id || option.value)),
                name: text(option && (option.name || option.label || option.id || option.value)),
                color: text(option && option.color),
                ...(option && Object.prototype.hasOwnProperty.call(option, 'marker') ? { marker: String(option.marker ?? '') } : {}),
            }))
            .filter((option) => option.id);
        const statusOptions = TaskStatus.normalizeOptions(configuredStatusOptions, settings.legacyWin7CompatMode === true);
        const all = defs.concat(customFields);
        return {
            settings,
            fields: all,
            byId: new Map(all.map((field) => [field.id, field])),
            statusOptions,
            statusById: new Map(statusOptions.map((option) => [option.id, option])),
        };
    }

    function isStrictDateKey(value) {
        const matched = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
        if (!matched) return false;
        const year = Number(matched[1]);
        const month = Number(matched[2]);
        const day = Number(matched[3]);
        const date = new Date(Date.UTC(year, month - 1, day));
        return date.getUTCFullYear() === year
            && date.getUTCMonth() === month - 1
            && date.getUTCDate() === day;
    }

    function normalizeDateValue(value, field) {
        const raw = text(value);
        if (!raw) return '';
        if (!/^\d{4}-\d{2}-\d{2}(?:[ T]\d{2}:\d{2}(?::\d{2})?(?:\.\d{3})?(?:Z|[+-]\d{2}:?\d{2})?)?$/.test(raw)) {
            throw new DomainError(ERROR.INVALID_ARGUMENT, `${field} 日期格式无效`);
        }
        if (!isStrictDateKey(raw.slice(0, 10))) {
            throw new DomainError(ERROR.INVALID_ARGUMENT, `${field} 日期不存在`);
        }
        return raw;
    }

    function normalizeBoolean(value) {
        if (value === true || value === false) return value;
        const raw = text(value).toLowerCase();
        if (raw === '1' || raw === 'true' || raw === 'yes') return true;
        if (!raw || raw === '0' || raw === 'false' || raw === 'no') return false;
        throw new DomainError(ERROR.INVALID_ARGUMENT, '布尔字段格式无效');
    }

    async function normalizeTaskPatch(input, options) {
        const source = input && typeof input === 'object' && !Array.isArray(input) ? input : {};
        const opts = options && typeof options === 'object' ? options : {};
        if (opts.agentWrite === true) validateAgentTaskRecurrence(source);
        const registry = await getFieldRegistry();
        const out = {};
        if (own(source, 'title')) {
            const title = text(source.title);
            if (!title) throw new DomainError(ERROR.INVALID_ARGUMENT, '任务标题不能为空');
            out.title = title;
        }
        if (own(source, 'done')) out.done = normalizeBoolean(source.done);
        for (const field of registry.fields) {
            if (field.custom || !own(source, field.id)) continue;
            if (!field.writable && opts.allowSystem !== true) {
                throw new DomainError(ERROR.INVALID_ARGUMENT, `${field.id} 为只读字段`);
            }
            const value = source[field.id];
            if (field.type === 'boolean') out[field.id] = normalizeBoolean(value);
            else if (field.type === 'number') {
                if (text(value) === '') out[field.id] = '';
                else {
                    const number = Number(value);
                    if (!Number.isFinite(number) || number < 0) throw new DomainError(ERROR.INVALID_ARGUMENT, `${field.id} 必须是非负数`);
                    out[field.id] = String(number);
                }
            } else if (field.type === 'date' || field.type === 'datetime') out[field.id] = normalizeDateValue(value, field.id);
            else out[field.id] = text(value);
        }
        if (own(out, 'dateMode') && !['manual', 'rollup'].includes(out.dateMode)) {
            throw new DomainError(ERROR.INVALID_ARGUMENT, '日期模式必须为 manual 或 rollup');
        }
        if (own(source, 'customFieldValues')) {
            const values = source.customFieldValues;
            if (!values || typeof values !== 'object' || Array.isArray(values)) {
                throw new DomainError(ERROR.INVALID_ARGUMENT, 'customFieldValues 必须是对象');
            }
            const custom = {};
            Object.keys(values).forEach((fieldID) => {
                const field = registry.byId.get(fieldID);
                if (!field || !field.custom || !field.writable) {
                    throw new DomainError(ERROR.INVALID_ARGUMENT, `未注册或不可写的自定义字段: ${fieldID}`);
                }
                custom[fieldID] = normalizeCustomValue(field, values[fieldID]);
            });
            out.customFieldValues = custom;
        }
        if (own(source, 'attachments')) {
            if (!Array.isArray(source.attachments)) throw new DomainError(ERROR.INVALID_ARGUMENT, 'attachments 必须是数组');
            out.attachments = uniqueStrings(source.attachments.map((item) => text(item?.path || item?.assetPath || item)));
        }
        ['repeatRule', 'repeatState', 'repeatHistory', 'reminder', 'followReminder', 'expectedOccurrenceId'].forEach((key) => {
            if (own(source, key)) out[key] = source[key] == null || source[key] === '' ? null : source[key];
        });
        const allowed = new Set([
            'title', 'done', 'customFieldValues', 'attachments', 'repeatRule', 'repeatState', 'repeatHistory', 'reminder', 'followReminder', 'expectedOccurrenceId',
            ...registry.fields.map((field) => field.id),
        ]);
        const unknown = Object.keys(source).filter((key) => !allowed.has(key));
        if (unknown.length) throw new DomainError(ERROR.INVALID_ARGUMENT, `不支持的任务字段: ${unknown.join(', ')}`);
        return { patch: out, registry };
    }

    function validateAgentTaskRecurrence(patch) {
        if (['repeatState', 'repeatHistory', 'reminder'].some(key => own(patch, key))) {
            throw new DomainError(ERROR.INVALID_ARGUMENT, '循环状态和历史由任务管理器维护；设置跟随提醒请使用 followReminder');
        }
        if (own(patch, 'repeatRule')) {
            const rule = patch.repeatRule;
            if (!rule || typeof rule !== 'object' || Array.isArray(rule)) throw new DomainError(ERROR.INVALID_ARGUMENT, '循环规则必须是对象');
            const unknown = Object.keys(rule).filter(key => !['version', 'enabled', 'type', 'trigger', 'every', 'weekdays', 'monthDays', 'monthWeek', 'monthlyMode', 'calendarMode', 'anchorDate', 'until', 'maxOccurrences'].includes(key));
            if (unknown.length) throw new DomainError(ERROR.INVALID_ARGUMENT, `不支持的循环字段: ${unknown.join(', ')}`);
            if (!['none', 'daily', 'workday', 'weekly', 'monthly', 'yearly', 'fsrs'].includes(rule.type)) throw new DomainError(ERROR.INVALID_ARGUMENT, '请选择天、工作日、周、月、年或 FSRS 循环');
            if (own(rule, 'trigger') && !['due', 'complete', 'checkin'].includes(rule.trigger)) throw new DomainError(ERROR.INVALID_ARGUMENT, '循环触发方式必须为 due、complete 或 checkin');
            if (own(rule, 'enabled') && typeof rule.enabled !== 'boolean') throw new DomainError(ERROR.INVALID_ARGUMENT, '循环开关必须为布尔值');
            for (const [key, minimum, maximum] of [['every', 1, 3650], ['maxOccurrences', 0, 200]]) {
                if (own(rule, key) && (!Number.isInteger(rule[key]) || rule[key] < minimum || rule[key] > maximum)) throw new DomainError(ERROR.INVALID_ARGUMENT, `${key} 必须为 ${minimum} 到 ${maximum} 的整数`);
            }
            for (const key of ['anchorDate', 'until']) {
                if (rule[key] && !isStrictDateKey(rule[key])) throw new DomainError(ERROR.INVALID_ARGUMENT, `${key} 必须是有效日期 YYYY-MM-DD`);
            }
            if (rule.until && rule.maxOccurrences > 0) throw new DomainError(ERROR.INVALID_ARGUMENT, '结束日期与结束次数只能设置一项');
            for (const [key, valid] of [['weekdays', value => Number.isInteger(value) && value >= 0 && value <= 6], ['monthDays', value => Number.isInteger(value) && (value === -1 || value >= 1 && value <= 31)]]) {
                if (own(rule, key) && (!Array.isArray(rule[key]) || key === 'monthDays' && !rule[key].length || !rule[key].every(valid))) throw new DomainError(ERROR.INVALID_ARGUMENT, `${key} 包含无效日期`);
            }
            if (rule.monthlyMode && !['date', 'weekday'].includes(rule.monthlyMode)) throw new DomainError(ERROR.INVALID_ARGUMENT, '月循环方式无效');
            if (rule.calendarMode && !['solar', 'lunar'].includes(rule.calendarMode)) throw new DomainError(ERROR.INVALID_ARGUMENT, '循环历法无效');
            if (rule.monthWeek && (!Number.isInteger(rule.monthWeek.ordinal) || ![-1, 1, 2, 3, 4, 5].includes(rule.monthWeek.ordinal) || !Number.isInteger(rule.monthWeek.weekday) || rule.monthWeek.weekday < 0 || rule.monthWeek.weekday > 6)) throw new DomainError(ERROR.INVALID_ARGUMENT, '月循环星期规则无效');
        }
        if (own(patch, 'followReminder')) {
            const reminder = patch.followReminder;
            if (!reminder || typeof reminder !== 'object' || Array.isArray(reminder)) throw new DomainError(ERROR.INVALID_ARGUMENT, '跟随提醒必须是对象');
            const intent = text(reminder.intentText);
            if (!TaskRecurrence.hasReminderIntent(intent) || /(?:不(?:要|用|必|需|再)?|无需|别|取消|关闭).{0,3}(?:提醒|通知)/.test(intent)) throw new DomainError(ERROR.INVALID_ARGUMENT, '用户明确要求提醒或通知时才添加提醒');
            normalizeReminderTimes(reminder.times);
        }
    }

    function prepareAgentTaskRecurrence(before, patch, registry) {
        let completion = null;
        const nativeTask = value => ({ ...value, content: value.title, root_id: value.documentID });
        if (own(patch, 'repeatRule')) {
            const previous = TaskRecurrence.signature(before.repeatRule);
            const built = TaskRecurrence.rulePatch(nativeTask({ ...before, ...patch, repeatRule: before.repeatRule }), patch.repeatRule);
            if (previous !== TaskRecurrence.signature(built.repeatRule)
                || built.repeatState.occurrenceCount !== TaskRecurrence.normalizeState(before.repeatState).occurrenceCount) {
                built.repeatState.occurrenceId = token('round');
                delete built.repeatState.planOverride;
            }
            Object.assign(patch, built);
            const checkin = patch.repeatRule.trigger === 'checkin';
            if (patch.repeatRule.enabled && !checkin && !text(patch.completionTime || before.completionTime)) patch.completionTime = patch.repeatRule.anchorDate;
            const firstDate = checkin ? patch.repeatRule.anchorDate : text(patch.completionTime || before.completionTime).slice(0, 10);
            if (patch.repeatRule.until && patch.repeatRule.until < firstDate) throw new DomainError(ERROR.INVALID_ARGUMENT, '循环结束日期不能早于首次日期');
        }
        const candidate = nativeTask({ ...before, ...patch, done: before.done, customStatus: before.customStatus, taskCompleteAt: before.taskCompleteAt });
        const recurring = candidate.repeatRule?.enabled && candidate.repeatRule.type !== 'none';
        const status = own(patch, 'customStatus') ? registry.statusById.get(patch.customStatus) : null;
        const requestedDone = status ? isTaskMarkerDone(statusOptionMarker(status)) : patch.done;
        const specialRule = candidate.repeatRule?.trigger === 'checkin' || candidate.repeatRule?.type === 'fsrs';
        if (specialRule && own(patch, 'repeatRule') && patch.done === false && before.done === false && !status) delete patch.done;
        const expectedOccurrenceId = text(patch.expectedOccurrenceId);
        delete patch.expectedOccurrenceId;
        if (recurring && (own(patch, 'done') || status && requestedDone)) {
            if (candidate.repeatRule.trigger === 'checkin' || candidate.repeatRule.type === 'fsrs') throw new DomainError(ERROR.UNSUPPORTED, '打卡或 FSRS 请使用任务详情中的完成入口');
            if (requestedDone && !expectedOccurrenceId) throw new DomainError(ERROR.INVALID_ARGUMENT, '完成循环任务前请读取 repeatState.occurrenceId，并传入 expectedOccurrenceId');
            const doneStatus = registry.statusById.get(registry.settings?.checkboxDoneStatusId || 'done') || registry.statusOptions.find(item => isTaskMarkerDone(statusOptionMarker(item)));
            const undoneStatus = registry.statusById.get(registry.settings?.checkboxUndoneStatusId || 'todo') || registry.statusOptions.find(item => statusOptionMarker(item) === ' ');
            const plan = TaskRecurrence.completionPlan(candidate, { done: requestedDone === true, occurrenceId: expectedOccurrenceId || undefined }, {
                operationId: token('completion'), now: nowIso(), completedAt: TaskRecurrence.now(),
                previousDone: before.done && !before.repeatState?.pendingNativeDoneReset,
                previousMarker: TaskStatus.fromMarkdown(before.markdown), targetMarker: requestedDone ? 'X' : ' ', targetClosed: requestedDone === true,
                doneStatus: { customStatus: doneStatus?.id || '', done: true }, undoneStatus: { customStatus: undoneStatus?.id || '', done: false },
                keepNativeDone: registry.settings?.recurringTaskKeepNativeDoneUntilNextOccurrence === true,
            });
            delete patch.done;
            delete patch.customStatus;
            Object.assign(patch, plan.patch);
            completion = plan.receipt;
        }
        const next = { ...before, ...patch };
        if (patch.followReminder) {
            patch.reminder = buildFollowTaskReminder({ follow: { date: next.completionTime, times: patch.followReminder.times } }, {
                task: next, binding: { primaryHostID: before.attrHostID || before.id }, reminder: before.reminder,
            });
            delete patch.followReminder;
        } else if (before.reminder?.repeatMode === REMINDER_REPEAT_MODE_FOLLOW_TASK
            && ['repeatRule', 'repeatState', 'completionTime', 'done'].some(key => own(patch, key))) {
            patch.reminder = {
                ...before.reminder,
                taskCompletionTime: next.completionTime || '', startDate: next.repeatRule?.trigger === 'checkin' ? next.repeatRule.anchorDate : text(next.completionTime).slice(0, 10),
                taskRepeatRule: next.repeatRule?.enabled ? next.repeatRule : null,
                taskRepeatState: next.repeatRule?.enabled ? next.repeatState : null,
                completed: next.repeatRule?.trigger !== 'checkin' && next.done === true && !next.repeatState?.pendingNativeDoneReset,
                done: next.repeatRule?.trigger !== 'checkin' && next.done === true && !next.repeatState?.pendingNativeDoneReset,
                updatedAt: nowIso(),
            };
        }
        return completion;
    }

    function buildAttrPayload(patch, registry, taskID) {
        const attrs = {};
        Object.keys(patch || {}).forEach((fieldID) => {
            if (fieldID === 'title' || fieldID === 'done' || fieldID === 'customFieldValues') return;
            const field = registry.byId.get(fieldID);
            if (!field || !field.attr) return;
            const value = patch[fieldID];
            attrs[field.attr] = field.type === 'boolean' ? (value ? '1' : '') : String(value == null ? '' : value);
            // These fields have one effective value. A legacy alias must not
            // revive an old date after rollup clears an endpoint or changes mode.
            if (['dateMode', 'startDate', 'completionTime'].includes(fieldID)) {
                (field.aliases || []).forEach(key => { attrs[key] = ''; });
            }
        });
        const custom = patch && patch.customFieldValues;
        if (custom && typeof custom === 'object') {
            Object.keys(custom).forEach((fieldID) => {
                const field = registry.byId.get(fieldID);
                if (field && field.custom && field.attr) attrs[field.attr] = String(custom[fieldID] == null ? '' : custom[fieldID]);
            });
        }
        if (own(patch, 'repeatRule')) attrs[REPEAT_ATTRS[0]] = patch.repeatRule == null ? '' : JSON.stringify(patch.repeatRule);
        if (own(patch, 'repeatState')) attrs[REPEAT_ATTRS[1]] = patch.repeatState == null ? '' : JSON.stringify(patch.repeatState);
        if (own(patch, 'repeatHistory')) attrs[REPEAT_ATTRS[2]] = patch.repeatHistory == null ? '' : JSON.stringify(patch.repeatHistory);
        if (own(patch, 'reminder')) attrs[REMINDER_ATTR] = patch.reminder == null ? '' : JSON.stringify(patch.reminder);
        if (Object.keys(attrs).length) {
            attrs[ATTR_OWNER] = taskID;
            attrs[ATTR_UPDATED_AT] = String(Date.now());
        }
        return attrs;
    }

    async function appendAttachmentAttrPayload(taskID, patch, attrs) {
        if (!own(patch, 'attachments')) return attrs;
        const current = await readAttrs(taskID);
        Object.keys(current).forEach((key) => {
            if (key.startsWith(ATTACHMENT_ATTR_PREFIX)
                && /^\d+$/.test(key.slice(ATTACHMENT_ATTR_PREFIX.length))) attrs[key] = '';
        });
        const paths = Array.isArray(patch.attachments) ? patch.attachments : [];
        paths.forEach((path, index) => { attrs[`${ATTACHMENT_ATTR_PREFIX}${index + 1}`] = text(path); });
        attrs[ATTACHMENT_META_ATTR] = paths.length
            ? JSON.stringify(paths.map((path) => ({ path: text(path), addedAt: Date.now() })))
            : '';
        return attrs;
    }

    function parseDone(markdown) {
        return TaskStatus.isDone(TaskStatus.fromMarkdown(markdown));
    }

    const TASK_MARKER_PATTERN = /^([ \t]*)((?:[-*+]|\d+[.)]))[ \t]*(?:(?:\{:[ \t]*[^}\r\n]*\})[ \t]*)*\[([^\]\r\n]?)\][ \t]*/;

    function locateTaskOwnTitle(row) {
        const markdown = String(row && row.markdown || '');
        const lines = markdown.split(/\r?\n/);
        const firstLine = String(lines[0] || '');
        const markerMatch = TASK_MARKER_PATTERN.exec(firstLine);
        if (!markerMatch) {
            return { lines, markerMatch: null, lineIndex: 0, title: text(firstLine) };
        }

        const inlineTitle = text(firstLine.slice(markerMatch[0].length));
        if (inlineTitle) {
            return { lines, markerMatch, lineIndex: 0, title: inlineTitle };
        }

        const markerIndent = markerMatch[1].replace(/\t/g, '    ').length;
        for (let index = 1; index < lines.length; index += 1) {
            const line = String(lines[index] || '');
            const trimmed = line.trim();
            if (!trimmed || /^\{:[ \t]*[^}]*\}$/.test(trimmed)) continue;

            const indentation = (line.match(/^[ \t]*/) || [''])[0];
            if (indentation.replace(/\t/g, '    ').length <= markerIndent) break;
            const content = line.slice(indentation.length);
            if (/^(?:[-*+]|\d+[.)])(?:[ \t]+|$)/.test(content)) break;
            return { lines, markerMatch, lineIndex: index, indentation, title: text(content) };
        }
        return { lines, markerMatch, lineIndex: -1, title: '' };
    }

    function taskOwnTitle(row) {
        const located = locateTaskOwnTitle(row);
        if (located.title || located.markerMatch) return located.title;
        return text(row && row.raw_content);
    }

    function normalizeReminderTaskLookupTitle(value) {
        return text(value)
            .normalize('NFKC')
            .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
            .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
            .replace(/\\([\\`*_[\]{}()#+\-.!>])/g, '$1')
            .replace(/(?:\*\*|__|~~|`)/g, '')
            .replace(/\s+/g, ' ')
            .trim()
            .toLocaleLowerCase();
    }

    function reminderTaskTitleDistance(leftValue, rightValue) {
        const left = Array.from(normalizeReminderTaskLookupTitle(leftValue));
        const right = Array.from(normalizeReminderTaskLookupTitle(rightValue));
        if (!left.length) return right.length;
        if (!right.length) return left.length;
        let previous = Array.from({ length: right.length + 1 }, (_, index) => index);
        for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
            const current = [leftIndex];
            for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
                current[rightIndex] = Math.min(
                    current[rightIndex - 1] + 1,
                    previous[rightIndex] + 1,
                    previous[rightIndex - 1] + (left[leftIndex - 1] === right[rightIndex - 1] ? 0 : 1),
                );
            }
            previous = current;
        }
        return previous[right.length];
    }

    function reminderTaskFuzzyTerms(value) {
        const characters = Array.from(normalizeReminderTaskLookupTitle(value).replace(/\s+/g, ''));
        if (characters.length < 3) return [];
        const size = characters.length >= 4 ? 2 : 1;
        const terms = [];
        for (let index = 0; index <= characters.length - size; index += 1) {
            const term = characters.slice(index, index + size).join('');
            if (term && !terms.includes(term)) terms.push(term);
        }
        return terms.slice(0, 16);
    }

    function reminderTaskFuzzyDistanceLimit(leftValue, rightValue) {
        const length = Math.max(
            Array.from(normalizeReminderTaskLookupTitle(leftValue)).length,
            Array.from(normalizeReminderTaskLookupTitle(rightValue)).length,
        );
        return length < 3 ? 0 : Math.min(3, Math.max(1, Math.floor(length * 0.2)));
    }

    async function readBlockDOM(blockID) {
        const id = requireID(blockID, '块 ID');
        const result = await api('/api/block/getBlockDOM', { id });
        const dom = String(result?.dom || '').trim();
        if (!dom || !dom.includes(`data-node-id="${id}"`)) {
            throw new DomainError(ERROR.STORAGE_ERROR, '读取到的任务块 DOM 与任务 ID 不一致', { taskID: id });
        }
        return dom;
    }

    function normalizeTaskMarker(value, fallback = ' ') {
        return TaskStatus.normalizeMarker(value, fallback);
    }

    function guessStatusMarker(option) {
        const source = `${text(option?.id)} ${text(option?.name)}`.toLowerCase();
        if (/\bdone\b|完成/.test(source)) return 'X';
        return ' ';
    }

    function statusOptionMarker(option) {
        const fallback = guessStatusMarker(option);
        return normalizeTaskMarker(option?.marker, fallback);
    }

    function isTaskMarkerDone(marker) {
        return TaskStatus.isDone(marker);
    }

    function replaceTaskDOMMarker(dom, marker) {
        let next = String(dom || '');
        const nextMarker = normalizeTaskMarker(marker, ' ');
        const done = nextMarker !== ' '; // 思源 DOM 的勾选格式与业务完成语义不同。
        if (/\bdata-task="[^"]*"/.test(next)) next = next.replace(/\bdata-task="[^"]*"/, `data-task="${nextMarker}"`);
        else next = next.replace(/(<div\b[^>]*\bdata-type="NodeListItem"[^>]*)(>)/, `$1 data-task="${nextMarker}"$2`);
        next = next.replace(/(<div\b[^>]*\bdata-type="NodeListItem"[^>]*\bclass=")([^"]*)(")/, (all, before, classes, after) => {
            const tokens = String(classes || '').split(/\s+/).filter((name) => name && name !== 'protyle-task--done');
            if (done) tokens.push('protyle-task--done');
            return `${before}${Array.from(new Set(tokens)).join(' ')}${after}`;
        });
        next = next.replace(/#icon(?:Uncheck|Check)/, done ? '#iconCheck' : '#iconUncheck');
        return next;
    }

    function replaceTaskDOMDone(dom, done) {
        return replaceTaskDOMMarker(dom, done ? 'X' : ' ');
    }

    function escapeTaskDOMText(value) {
        return String(value == null ? '' : value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function replaceTaskDOMTitle(dom, title) {
        const source = String(dom || '');
        const pattern = /(<div\b[^>]*\bdata-type="NodeParagraph"[^>]*>)[\s\S]*?(<div\b[^>]*\bclass="[^"]*protyle-attr[^"]*"[^>]*>[\s\S]*?<\/div>\s*<\/div>)/;
        if (!pattern.test(source)) {
            throw new DomainError(ERROR.STORAGE_ERROR, '任务块中未找到可更新的标题段落');
        }
        const content = `<div contenteditable="true">${escapeTaskDOMText(title)}</div>`;
        return source.replace(pattern, `$1${content}$2`);
    }

    async function verifyTaskDirect(taskID, expected = {}) {
        const id = requireID(taskID, '任务 ID');
        const source = expected && typeof expected === 'object' ? expected : {};
        if (own(source, 'marker')) {
            const dom = await readBlockDOM(id);
            const matched = dom.match(/\bdata-task="([^"]*)"/);
            const actualMarker = normalizeTaskMarker(matched?.[1], ' ');
            const expectedMarker = normalizeTaskMarker(source.marker, ' ');
            const checkboxMarkerMatches = String(actualMarker || '').toUpperCase() === 'X'
                && String(expectedMarker || '').toUpperCase() === 'X';
            if (actualMarker !== expectedMarker && !checkboxMarkerMatches) {
                throw new DomainError(ERROR.CONFLICT, '任务状态标记写入后校验失败', {
                    taskID: id,
                    expectedMarker,
                    actualMarker,
                });
            }
        }
        const attrs = source.attrs && typeof source.attrs === 'object' ? source.attrs : null;
        if (attrs && Object.keys(attrs).length) {
            const actual = await readAttrs(id);
            const mismatch = Object.entries(attrs).find(([key, value]) => String(actual[key] == null ? '' : actual[key]) !== String(value == null ? '' : value));
            if (mismatch) {
                throw new DomainError(ERROR.CONFLICT, '任务字段写入后校验失败', { taskID: id, field: mismatch[0] });
            }
        }
        return true;
    }

    async function getTaskRow(taskID) {
        const id = requireID(taskID, '任务 ID');
        const rows = await sql(`
            SELECT
                task.id,
                task.markdown,
                task.content AS raw_content,
                task.parent_id,
                task.root_id,
                task.box,
                task.path AS block_path,
                task.sort AS block_sort,
                task.created,
                task.updated,
                COALESCE(doc.content, '') AS doc_name,
                COALESCE(doc.hpath, '') AS doc_path,
                COALESCE(parent.type, '') AS parent_type,
                COALESCE(CASE WHEN list_parent.type = 'i' AND list_parent.subtype = 't' THEN list_parent.id ELSE '' END, '') AS parent_task_id,
                (SELECT s.id FROM blocks s
                    WHERE s.parent_id = task.parent_id AND s.id <> task.id
                    AND (s.sort < task.sort OR (s.sort = task.sort AND s.created < task.created)
                        OR (s.sort = task.sort AND s.created = task.created AND s.id < task.id))
                    ORDER BY s.sort DESC, s.created DESC, s.id DESC LIMIT 1) AS previous_sibling_id,
                (SELECT s.id FROM blocks s
                    WHERE s.parent_id = task.parent_id AND s.id <> task.id
                    AND (s.sort > task.sort OR (s.sort = task.sort AND s.created > task.created)
                        OR (s.sort = task.sort AND s.created = task.created AND s.id > task.id))
                    ORDER BY s.sort ASC, s.created ASC, s.id ASC LIMIT 1) AS next_sibling_id,
                (SELECT COUNT(*) FROM blocks s WHERE s.parent_id = task.parent_id AND s.type = 'i' AND s.subtype = 't') AS parent_task_count,
                (SELECT id FROM blocks s WHERE s.parent_id = task.parent_id AND s.type = 'i' AND s.subtype = 't' ORDER BY s.sort ASC, s.created ASC, s.id ASC LIMIT 1) AS first_task_id
            FROM blocks task
            LEFT JOIN blocks doc ON doc.id = task.root_id
            LEFT JOIN blocks parent ON parent.id = task.parent_id
            LEFT JOIN blocks list_parent ON list_parent.id = parent.parent_id
            WHERE task.id = '${escapeSql(id)}' AND task.type = 'i' AND task.subtype = 't'
            LIMIT 1
        `);
        if (!rows.length) throw new DomainError(ERROR.NOT_FOUND, '未找到任务', { taskID: id });
        return rows[0];
    }

    async function getBlockRole(blockID, label) {
        const id = requireID(blockID, label || '块 ID');
        const rows = await sql(`SELECT id, parent_id, root_id, type, subtype FROM blocks WHERE id = '${escapeSql(id)}' LIMIT 1`);
        if (!rows.length) throw new DomainError(ERROR.NOT_FOUND, `未找到${label || '块'}`, { blockID: id });
        const row = rows[0];
        return {
            id,
            parentID: text(row.parent_id),
            rootID: text(row.root_id),
            type: text(row.type).toLowerCase(),
            subtype: text(row.subtype).toLowerCase(),
        };
    }

    async function requireDocumentBlock(documentID) {
        const block = await getBlockRole(documentID, '目标文档');
        if (block.type !== 'd') {
            throw new DomainError(ERROR.INVALID_ARGUMENT, '目标文档 ID 必须指向文档块', { blockID: block.id, actualType: block.type });
        }
        return block;
    }

    function buildAttrContext(row) {
        const taskID = text(row && row.id);
        const parentID = text(row && row.parent_id);
        const parentType = text(row && row.parent_type).toLowerCase();
        const count = Number(row && row.parent_task_count);
        const firstTaskID = text(row && row.first_task_id);
        if (parentType !== 'l') {
            return {
                taskID,
                parentListID: '',
                state: 'invalid-list-item',
                primaryHostID: taskID,
                legacyHostIDs: [],
                mirrorHostIDs: [],
            };
        }
        if (parentType === 'l' && count === 1 && (!firstTaskID || firstTaskID === taskID)) {
            return {
                taskID,
                parentListID: parentID,
                state: 'state1-parent',
                primaryHostID: taskID,
                legacyHostIDs: [],
                mirrorHostIDs: [],
            };
        }
        if (parentType === 'l' && count > 1 && firstTaskID === taskID) {
            return {
                taskID,
                parentListID: parentID,
                state: 'state3-list-item',
                primaryHostID: taskID,
                legacyHostIDs: [],
                mirrorHostIDs: [],
            };
        }
        return {
            taskID,
            parentListID: parentID,
            state: 'state2-list-item',
            primaryHostID: taskID,
            // A parent-list attribute could only ever belong to its first task.
            // Letting later siblings read it leaks legacy metadata across tasks.
            legacyHostIDs: [],
            mirrorHostIDs: [],
        };
    }

    async function resolveTaskBinding(blockID, control = {}) {
        let current = requireID(blockID, '块 ID');
        for (let depth = 0; depth < 30; depth += 1) {
            assertFocusStatsDeadline(control, 'task-binding-resolve');
            const row = await getBlockRole(current, '块');
            const type = row.type;
            const subtype = row.subtype;
            if (type === 'i' && subtype === 't') {
                const task = await getTaskRow(row.id);
                const context = buildAttrContext(task);
                return { taskID: task.id, task, ...context };
            }
            if (type === 'l') {
                const tasks = await sql(`SELECT id FROM blocks WHERE parent_id = '${escapeSql(row.id)}' AND type = 'i' AND subtype = 't' ORDER BY sort ASC, created ASC, id ASC LIMIT 2`);
                if (tasks.length) {
                    const task = await getTaskRow(tasks[0].id);
                    const context = buildAttrContext(task);
                    return { taskID: task.id, task, ...context };
                }
            }
            const parentID = row.parentID;
            if (!parentID || parentID === current) break;
            current = parentID;
        }
        throw new DomainError(ERROR.NOT_FOUND, '该块不属于任务');
    }

    async function readAttrs(blockID) {
        const data = await api('/api/attr/getBlockAttrs', { id: requireID(blockID, '属性宿主 ID') });
        return data && typeof data === 'object' && !Array.isArray(data) ? data : {};
    }

    async function setAttrs(blockID, attrs) {
        if (!attrs || !Object.keys(attrs).length) return;
        await api('/api/attr/setBlockAttrs', { id: requireID(blockID, '属性宿主 ID'), attrs });
    }

    async function readTaskAttributes(binding, registry) {
        const primaryAttrs = await readAttrs(binding.taskID);
        return decodeTaskAttributes(primaryAttrs, registry);
    }

    function decodeTaskAttributes(primaryAttrsInput, registry) {
        const primaryAttrs = primaryAttrsInput && typeof primaryAttrsInput === 'object' ? primaryAttrsInput : {};
        const secondaryAttrs = null;
        const hostAttrs = primaryAttrs;
        const fields = {};
        const customFieldValues = {};
        registry.fields.forEach((field) => {
            const keys = uniqueStrings([field.attr].concat(field.aliases || []));
            let value = '';
            const sources = [primaryAttrs];
            for (const source of sources) {
                if (!source) continue;
                for (const key of keys) {
                    if (own(source, key) && String(source[key] == null ? '' : source[key]) !== '') {
                        value = String(source[key]);
                        break;
                    }
                }
                if (value !== '') break;
            }
            if (field.custom) customFieldValues[field.id] = value;
            else if (field.type === 'boolean') fields[field.id] = value === '1' || value === 'true';
            else if (field.type === 'number') fields[field.id] = value === '' ? null : Number(value);
            else fields[field.id] = value;
        });
        fields.customFieldValues = customFieldValues;
        fields.dateMode = fields.dateMode === 'rollup' ? 'rollup' : 'manual';
        const readOwnedValue = (key) => {
            if (own(primaryAttrs, key)) return String(primaryAttrs[key] == null ? '' : primaryAttrs[key]);
            if (secondaryAttrs && own(secondaryAttrs, key)) return String(secondaryAttrs[key] == null ? '' : secondaryAttrs[key]);
            return '';
        };
        const parseStructuredValue = (value) => {
            const raw = text(value);
            if (!raw) return null;
            try { return JSON.parse(raw); } catch (error) { return raw; }
        };
        const attachmentKeys = uniqueStrings(Object.keys(primaryAttrs).concat(Object.keys(secondaryAttrs || {})))
            .filter((key) => key.startsWith(ATTACHMENT_ATTR_PREFIX) && /^\d+$/.test(key.slice(ATTACHMENT_ATTR_PREFIX.length)))
            .sort((left, right) => Number(left.slice(ATTACHMENT_ATTR_PREFIX.length)) - Number(right.slice(ATTACHMENT_ATTR_PREFIX.length)));
        const attachmentMeta = parseStructuredValue(readOwnedValue(ATTACHMENT_META_ATTR));
        const attachmentMetaItems = Array.isArray(attachmentMeta)
            ? attachmentMeta
            : (Array.isArray(attachmentMeta && attachmentMeta.items) ? attachmentMeta.items : []);
        const attachmentAddedAt = new Map(attachmentMetaItems.map((item) => [text(item && (item.path || item.assetPath || item.value)), Number(item && (item.addedAt || item.added_at || item.ts)) || 0]));
        fields.attachments = attachmentKeys.map((key) => readOwnedValue(key)).map(text).filter(Boolean).map((path) => ({
            path,
            name: (() => {
                const clean = path.replace(/^block:/, '').split(/[?#]/)[0];
                const parts = clean.split(/[\\/]+/).filter(Boolean);
                try { return decodeURIComponent(parts[parts.length - 1] || clean); } catch (error) { return parts[parts.length - 1] || clean; }
            })(),
            kind: path.startsWith('block:') ? 'block-ref' : (path.startsWith('file:') ? 'local-path' : 'asset'),
            addedAt: attachmentAddedAt.get(path) || 0,
        }));
        fields.attachmentCount = fields.attachments.length;
        fields.reminder = parseStructuredValue(readOwnedValue('custom-tomato-reminder'));
        fields.hasReminder = fields.reminder != null;
        fields.repeatRule = parseStructuredValue(readOwnedValue('custom-task-repeat-rule'));
        fields.repeatState = parseStructuredValue(readOwnedValue('custom-task-repeat-state'));
        fields.repeatHistory = parseStructuredValue(readOwnedValue('custom-task-repeat-history'));
        return fields;
    }

    function customFieldDefinitions(registry) {
        return registry.fields.filter((field) => field.custom).map((field) => {
            const options = (Array.isArray(field.options) ? field.options : []).map((option) => {
                const id = text(option && option.id);
                return {
                    id,
                    label: text(option && (option.name || option.label)) || id,
                    parentID: text(option && (option.parentID || option.parentId)),
                    archived: option?.archived === true,
                };
            }).filter((option) => option.id);
            const optionByID = new Map(options.map((option) => [option.id, option]));
            const parentByID = new Map(options.map((option) => [
                option.id,
                option.parentID && option.parentID !== option.id && optionByID.has(option.parentID) ? option.parentID : '',
            ]));
            const cyclicIDs = new Set();
            options.forEach((option) => {
                const chain = [];
                const positions = new Map();
                let currentID = option.id;
                while (currentID && optionByID.has(currentID) && !positions.has(currentID)) {
                    positions.set(currentID, chain.length);
                    chain.push(currentID);
                    currentID = parentByID.get(currentID) || '';
                }
                if (currentID && positions.has(currentID)) {
                    chain.slice(positions.get(currentID)).forEach((id) => cyclicIDs.add(id));
                }
            });
            cyclicIDs.forEach((id) => parentByID.set(id, ''));
            const serializedOptions = options.map((option) => {
                const lineage = [];
                let current = option;
                while (current) {
                    lineage.unshift(current);
                    current = optionByID.get(parentByID.get(current.id) || '') || null;
                }
                const ancestorIDs = lineage.slice(0, -1).map((item) => item.id);
                return {
                    id: option.id,
                    label: option.label,
                    parentID: parentByID.get(option.id) || '',
                    depth: ancestorIDs.length,
                    path: lineage.map((item) => item.label).join(' / '),
                    ancestorIDs,
                    archived: option.archived,
                    effectiveArchived: lineage.some((item) => item.archived),
                };
            });
            return {
                id: field.id,
                label: text(field.label || field.name) || field.id,
                type: text(field.type) || 'single',
                attr: text(field.attr),
                maxDepth: 3,
                options: serializedOptions,
            };
        });
    }

    function statusDefinitions(registry) {
        return (Array.isArray(registry && registry.statusOptions) ? registry.statusOptions : []).map((option) => ({
            id: text(option.id),
            name: text(option.name) || text(option.id),
            color: text(option.color),
            marker: statusOptionMarker(option),
        }));
    }

    function priorityDefinitions() {
        return PRIORITY_DEFINITIONS.map((item) => ({ ...item }));
    }

    function resolveStatusName(value, registry) {
        const id = text(value);
        if (!id) return '未设置';
        return text(registry?.statusById?.get(id)?.name) || id;
    }

    function resolvePriorityName(value) {
        const id = text(value).toLowerCase();
        if (!id || id === 'none') return '未设置';
        const matched = PRIORITY_DEFINITIONS.find((item) => item.id === id);
        return matched ? matched.name : text(value);
    }

    function applyTaskDisplayNames(dto, registry) {
        if (dto.repeatRule?.enabled) dto.occurrenceId = TaskRecurrence.occurrenceId(dto);
        const task = dto && typeof dto === 'object' ? dto : {};
        task.customStatusName = resolveStatusName(task.customStatus, registry);
        task.priorityName = resolvePriorityName(task.priority);
        return task;
    }

    function shouldIncludeTaskFieldMetadata(fields, fieldID, nameFieldID) {
        return !Array.isArray(fields) || !fields.length || fields.includes(fieldID) || fields.includes(nameFieldID);
    }

    function projectTaskDTO(dto, fields, extraAlways) {
        if (!Array.isArray(fields) || !fields.length) return { ...dto };
        const always = new Set(['id', 'title', 'done', 'documentID'].concat(Array.isArray(extraAlways) ? extraAlways : []));
        if (fields.includes('customStatus')) always.add('customStatusName');
        if (fields.includes('priority')) always.add('priorityName');
        const selected = {};
        Object.keys(dto || {}).forEach((key) => {
            if (always.has(key) || fields.includes(key)) selected[key] = dto[key];
        });
        return selected;
    }

    async function taskDTO(rowOrID, fields, registryInput) {
        const row = typeof rowOrID === 'string' ? await getTaskRow(rowOrID) : rowOrID;
        const context = buildAttrContext(row);
        const registry = registryInput || await getFieldRegistry();
        const attrs = await readTaskAttributes({ taskID: row.id, ...context }, registry);
        const dto = {
            id: text(row.id),
            title: taskOwnTitle(row),
            markdown: String(row.markdown || ''),
            done: parseDone(row.markdown),
            parentListID: text(row.parent_id),
            parentTaskID: text(row.parent_task_id),
            parentType: text(row.parent_type),
            previousSiblingID: text(row.previous_sibling_id),
            nextSiblingID: text(row.next_sibling_id),
            firstTaskID: text(row.first_task_id),
            documentID: text(row.root_id),
            documentName: text(row.doc_name),
            documentPath: text(row.doc_path),
            created: text(row.created),
            updated: text(row.updated),
            attrHostID: context.primaryHostID,
            attrHostState: context.state,
            priorityScore: null,
            ...attrs,
        };
        const marker = TaskStatus.fromMarkdown(dto.markdown);
        const matched = TaskStatus.resolveOption(marker, dto.customStatus, registry.statusOptions, registry.settings?.checkboxUndoneStatusId || 'todo');
        if (matched) dto.customStatus = matched.id;
        return projectTaskDTO(applyTaskDisplayNames(dto, registry), fields);
    }

    async function taskPlacementDTO(rowOrID) {
        const taskID = typeof rowOrID === 'string' ? rowOrID : rowOrID?.id;
        const source = rowOrID && typeof rowOrID === 'object' ? rowOrID : {};
        const parentType = text(source.parent_type || source.parentType).toLowerCase();
        const preferredListID = text(source.parentListID || source.parentListId)
            || (parentType === 'l' || parentType === 'nodelist' ? text(source.parent_id || source.parentID) : '');
        return readTaskPlacementFromTree(taskID, preferredListID);
    }

    function applyScopedTaskValues(dto, taskID, fields, scope) {
        const value = scope && scope.taskValues instanceof Map ? scope.taskValues.get(text(taskID)) : null;
        const includes = (field) => !Array.isArray(fields) || !fields.length || fields.includes(field);
        if (includes('priorityScore')) dto.priorityScore = value && Number.isFinite(Number(value.priorityScore)) ? Number(value.priorityScore) : null;
        ['tomatoMinutes', 'tomatoHours', 'tomatoCount'].forEach((field) => {
            if (includes(field) && value && Number.isFinite(Number(value[field]))) dto[field] = Number(value[field]);
        });
        return dto;
    }

    async function getTaskDTO(taskID, fields, scopeToken) {
        const registry = await getFieldRegistry();
        const dto = await taskDTO(taskID, fields, registry);
        const scope = text(scopeToken) ? normalizeTaskScope({ scopeToken }) : null;
        if (scope) {
            const inTaskSet = scope.taskIDs.includes(dto.id);
            const inDocumentSet = scope.scopeMode === 'documents' && scope.documentIDs.includes(dto.documentID);
            if (!inTaskSet && !inDocumentSet) throw new DomainError(ERROR.NOT_FOUND, '任务不属于指定范围');
        }
        applyScopedTaskValues(dto, dto.id, fields, scope);
        if (!Array.isArray(fields) || !fields.length || fields.includes('customFieldValues')) {
            dto.customFieldDefinitions = customFieldDefinitions(registry);
        }
        if (shouldIncludeTaskFieldMetadata(fields, 'customStatus', 'customStatusName')) dto.statusDefinitions = statusDefinitions(registry);
        if (shouldIncludeTaskFieldMetadata(fields, 'priority', 'priorityName')) dto.priorityDefinitions = priorityDefinitions();
        return dto;
    }

    async function getTaskDTOByReference(taskID, fields, scopeToken) {
        const rawID = text(taskID);
        if (VIRTUAL_TASK_ID_RE.test(rawID)) {
            if (!text(scopeToken)) throw new DomainError(ERROR.NOT_FOUND, '循环虚拟任务需要有效的任务范围令牌');
            const scope = normalizeTaskScope({ scopeToken });
            const virtualTask = scope.virtualTaskMap.get(rawID);
            if (!virtualTask) throw new DomainError(ERROR.NOT_FOUND, '循环虚拟任务不属于指定范围');
            const registry = await getFieldRegistry();
            const dto = projectTaskDTO(applyTaskDisplayNames({ ...virtualTask }, registry), fields, ['virtualTask', 'virtualType', 'readOnly', 'sourceTaskID']);
            if (!Array.isArray(fields) || !fields.length || fields.includes('customFieldValues')) {
                dto.customFieldDefinitions = customFieldDefinitions(registry);
            }
            if (shouldIncludeTaskFieldMetadata(fields, 'customStatus', 'customStatusName')) dto.statusDefinitions = statusDefinitions(registry);
            if (shouldIncludeTaskFieldMetadata(fields, 'priority', 'priorityName')) dto.priorityDefinitions = priorityDefinitions();
            return dto;
        }
        const binding = await resolveTaskBinding(rawID);
        return getTaskDTO(binding.taskID, fields, scopeToken);
    }

    function runTaskLane(taskID, handler) {
        const id = text(taskID);
        const previous = state.taskLanes.get(id) || Promise.resolve();
        const next = previous.catch(() => null).then(handler);
        state.taskLanes.set(id, next);
        const cleanup = () => {
            if (state.taskLanes.get(id) === next) state.taskLanes.delete(id);
        };
        next.then(cleanup, cleanup);
        return next;
    }

    function runTaskLanes(taskIDs, handler) {
        const ids = uniqueStrings(taskIDs).sort();
        if (!ids.length) return Promise.resolve().then(handler);
        const previous = ids.map((id) => state.taskLanes.get(id) || Promise.resolve());
        const next = Promise.all(previous.map((item) => item.catch(() => null))).then(handler);
        ids.forEach((id) => state.taskLanes.set(id, next));
        const cleanup = () => {
            ids.forEach((id) => {
                if (state.taskLanes.get(id) === next) state.taskLanes.delete(id);
            });
        };
        next.then(cleanup, cleanup);
        return next;
    }

    function runScheduleLane(handler) {
        const next = state.scheduleLane.catch(() => null).then(handler);
        state.scheduleLane = next;
        return next;
    }

    async function persistTaskAttrs(binding, attrs) {
        if (!Object.keys(attrs || {}).length) return;
        const operations = await buildTaskAttrWriteOperations(binding, attrs);
        await pushTaskTransaction(operations);
    }

    function taskOwnedAttrKeys(registry) {
        const keys = new Set([ATTACHMENT_META_ATTR, REMINDER_ATTR, ...REPEAT_ATTRS]);
        registry.fields.forEach((field) => {
            if (field.attr) keys.add(field.attr);
            (Array.isArray(field.aliases) ? field.aliases : []).forEach((key) => keys.add(key));
        });
        return keys;
    }

    function activeAttrValue(attrs, key) {
        return own(attrs, key) ? String(attrs[key] == null ? '' : attrs[key]) : '';
    }

    function activeAttachmentAttrs(attrs) {
        const out = {};
        Object.keys(attrs || {}).sort().forEach((key) => {
            if (!key.startsWith(ATTACHMENT_ATTR_PREFIX)) return;
            const value = activeAttrValue(attrs, key);
            if (value !== '') out[key] = value;
        });
        return out;
    }

    async function listTaskAttrMigrationCandidates(registry) {
        const exactKeys = Array.from(taskOwnedAttrKeys(registry));
        const conditions = exactKeys.map((key) => `a.name = '${escapeSql(key)}'`);
        conditions.push(`a.name LIKE '${escapeSql(ATTACHMENT_ATTR_PREFIX)}%'`);
        const candidates = [];
        const pageSize = 500;
        for (let offset = 0; ; offset += pageSize) {
            const rows = await sql(`
                SELECT DISTINCT a.block_id AS id
                FROM attributes a
                JOIN blocks b ON b.id = a.block_id
                WHERE b.type = 'l' AND (${conditions.join(' OR ')})
                ORDER BY a.block_id
                LIMIT ${pageSize} OFFSET ${offset}
            `);
            candidates.push(...rows.map((row) => text(row.id)).filter(Boolean));
            if (rows.length < pageSize) break;
        }
        return uniqueStrings(candidates);
    }

    function planSingleAttrMigration(sourceAttrs, itemAttrs, key, itemPatch, parentPatch, conflicts) {
        const sourceValue = activeAttrValue(sourceAttrs, key);
        if (sourceValue === '') return { copied: 0, cleared: 0 };
        if (!own(itemAttrs, key)) {
            itemPatch[key] = sourceValue;
            parentPatch[key] = '';
            return { copied: 1, cleared: 1 };
        }
        if (activeAttrValue(itemAttrs, key) === sourceValue) {
            parentPatch[key] = '';
            return { copied: 0, cleared: 1 };
        }
        conflicts.push(key);
        return { copied: 0, cleared: 0 };
    }

    async function migrateListTaskAttrs(listID, registry) {
        const sourceAttrs = await readAttrs(listID);
        const taskRows = await sql(`
            SELECT id FROM blocks
            WHERE parent_id = '${escapeSql(listID)}' AND type = 'i' AND subtype = 't'
            ORDER BY sort ASC, created ASC, id ASC LIMIT 2
        `);
        if (!taskRows.length) return { status: 'skipped-empty' };

        const taskID = requireID(taskRows[0].id, '迁移目标任务 ID');
        const owner = text(sourceAttrs[ATTR_OWNER]);
        if (taskRows.length === 1) {
            if (owner && owner !== taskID) return { status: 'skipped-owner', taskID, owner };
        } else if (!owner || owner !== taskID) {
            return { status: owner ? 'skipped-owner' : 'skipped-ambiguous', taskID, owner };
        }

        const itemAttrs = await readAttrs(taskID);
        const itemPatch = {};
        const parentPatch = {};
        const conflicts = [];
        let copied = 0;
        let cleared = 0;
        const exactKeys = Array.from(taskOwnedAttrKeys(registry)).filter((key) => (
            key !== ATTACHMENT_META_ATTR && key !== REMINDER_ATTR
        ));
        exactKeys.forEach((key) => {
            const result = planSingleAttrMigration(sourceAttrs, itemAttrs, key, itemPatch, parentPatch, conflicts);
            copied += result.copied;
            cleared += result.cleared;
        });

        const sourceAttachments = activeAttachmentAttrs(sourceAttrs);
        const itemAttachments = activeAttachmentAttrs(itemAttrs);
        const sourceAttachmentKeys = Object.keys(sourceAttachments);
        if (sourceAttachmentKeys.length) {
            if (!Object.keys(itemAttachments).length) {
                Object.assign(itemPatch, sourceAttachments);
                sourceAttachmentKeys.forEach((key) => { parentPatch[key] = ''; });
                copied += sourceAttachmentKeys.length;
                cleared += sourceAttachmentKeys.length;
            } else if (stableJson(itemAttachments) === stableJson(sourceAttachments)) {
                sourceAttachmentKeys.forEach((key) => { parentPatch[key] = ''; });
                cleared += sourceAttachmentKeys.length;
            } else {
                conflicts.push('attachments');
            }
        }

        const reminderItemPatch = {};
        const reminderParentPatch = {};
        const reminderConflicts = [];
        const reminderResult = planSingleAttrMigration(
            sourceAttrs,
            itemAttrs,
            REMINDER_ATTR,
            reminderItemPatch,
            reminderParentPatch,
            reminderConflicts,
        );
        const sourceReminder = activeAttrValue(sourceAttrs, REMINDER_ATTR);
        let bookmarkResult = { copied: 0, cleared: 0 };
        if (sourceReminder && activeAttrValue(sourceAttrs, 'bookmark') === '⏰') {
            bookmarkResult = planSingleAttrMigration(
                sourceAttrs,
                itemAttrs,
                'bookmark',
                reminderItemPatch,
                reminderParentPatch,
                reminderConflicts,
            );
        }
        if (reminderConflicts.length) {
            conflicts.push(...reminderConflicts);
        } else {
            Object.assign(itemPatch, reminderItemPatch);
            Object.assign(parentPatch, reminderParentPatch);
            copied += reminderResult.copied + bookmarkResult.copied;
            cleared += reminderResult.cleared + bookmarkResult.cleared;
        }

        const simulatedParentAttrs = { ...sourceAttrs, ...parentPatch };
        const remainingManaged = Array.from(taskOwnedAttrKeys(registry)).some((key) => (
            key !== ATTACHMENT_META_ATTR
            && activeAttrValue(simulatedParentAttrs, key) !== ''
        )) || Object.keys(activeAttachmentAttrs(simulatedParentAttrs)).length > 0;
        if (!remainingManaged) {
            if (own(sourceAttrs, ATTR_OWNER)) parentPatch[ATTR_OWNER] = '';
            if (own(sourceAttrs, ATTR_UPDATED_AT)) parentPatch[ATTR_UPDATED_AT] = '';
        }
        if (copied > 0) {
            itemPatch[ATTR_OWNER] = taskID;
            itemPatch[ATTR_UPDATED_AT] = String(Date.now());
        }

        const operations = [];
        if (Object.keys(itemPatch).length) {
            operations.push({ action: 'setAttrs', id: taskID, data: JSON.stringify(itemPatch) });
        }
        if (Object.keys(parentPatch).length) {
            operations.push({ action: 'setAttrs', id: listID, data: JSON.stringify(parentPatch) });
        }
        if (operations.length) await pushTaskTransaction(operations);
        return {
            status: operations.length ? 'migrated' : (conflicts.length ? 'conflict' : 'unchanged'),
            taskID,
            copied,
            cleared,
            conflicts: uniqueStrings(conflicts),
        };
    }

    async function ensureTaskAttrItemStorageMigration() {
        const current = await readJson(TASK_ATTR_STORAGE_FILE, null);
        if (current && Number(current.version) >= TASK_ATTR_ITEM_STORAGE_VERSION) return current;

        const registry = await getFieldRegistry();
        const candidateIDs = await listTaskAttrMigrationCandidates(registry);
        const report = {
            version: 0,
            targetVersion: TASK_ATTR_ITEM_STORAGE_VERSION,
            status: 'running',
            startedAt: nowIso(),
            completedAt: '',
            candidates: candidateIDs.length,
            migrated: 0,
            copied: 0,
            cleared: 0,
            conflicts: [],
            skippedOwner: [],
            skippedAmbiguous: [],
            skippedEmpty: [],
            failures: [],
        };
        for (const listID of candidateIDs) {
            try {
                const result = await migrateListTaskAttrs(listID, registry);
                if (result.status === 'migrated') report.migrated += 1;
                report.copied += Number(result.copied) || 0;
                report.cleared += Number(result.cleared) || 0;
                if (result.conflicts && result.conflicts.length) {
                    report.conflicts.push({ listID, taskID: result.taskID, keys: result.conflicts });
                }
                if (result.status === 'skipped-owner') {
                    report.skippedOwner.push({ listID, taskID: result.taskID, owner: result.owner });
                } else if (result.status === 'skipped-ambiguous') {
                    report.skippedAmbiguous.push({ listID, taskID: result.taskID });
                } else if (result.status === 'skipped-empty') {
                    report.skippedEmpty.push(listID);
                }
            } catch (error) {
                report.failures.push({ listID, message: text(error && error.message) || String(error) });
            }
        }
        report.completedAt = nowIso();
        report.status = report.failures.length ? 'failed' : 'complete';
        if (!report.failures.length) report.version = TASK_ATTR_ITEM_STORAGE_VERSION;
        await writeJson(TASK_ATTR_STORAGE_FILE, report);
        if (report.failures.length) {
            throw new DomainError(ERROR.STORAGE_ERROR, '任务属性迁移未完成', { failures: report.failures });
        }
        return report;
    }

    async function buildCanonicalTaskAttrs(binding, patchAttrs, registry) {
        const taskID = requireID(binding.taskID, '任务 ID');
        const out = {};
        const allowed = taskOwnedAttrKeys(registry);
        const sourceAttrs = await readAttrs(taskID);
        Object.entries(sourceAttrs).forEach(([key, value]) => {
            const attachmentSlot = key.startsWith(ATTACHMENT_ATTR_PREFIX)
                && /^\d+$/.test(key.slice(ATTACHMENT_ATTR_PREFIX.length));
            if (!allowed.has(key) && !attachmentSlot) return;
            out[key] = String(value == null ? '' : value);
        });
        Object.assign(out, patchAttrs || {});
        if (Object.keys(out).length) {
            out[ATTR_OWNER] = taskID;
            out[ATTR_UPDATED_AT] = String(Date.now());
        }
        return out;
    }

    async function buildTaskAttrWriteOperations(binding, attrs) {
        if (!Object.keys(attrs || {}).length) return [];
        const taskID = requireID(binding.taskID, '任务 ID');
        return [{ action: 'setAttrs', id: taskID, data: JSON.stringify(attrs) }];
    }

    async function pushTaskTransaction(doOperations) {
        const operations = (Array.isArray(doOperations) ? doOperations : []).filter(Boolean);
        if (!operations.length) return false;
        await api('/api/transactions', {
            reqId: Date.now(),
            transactions: [{ doOperations: operations }],
        });
        return true;
    }

    async function buildTaskAttrPreservationOperation(row, registryInput) {
        const context = buildAttrContext(row);
        if (!context.taskID) return null;
        const registry = registryInput || await getFieldRegistry();
        const patch = await buildCanonicalTaskAttrs(context, {}, registry);
        if (!Object.keys(patch).length) return null;
        return { action: 'setAttrs', id: context.taskID, data: JSON.stringify(patch) };
    }

    async function preserveTaskAttrsOnOwnBlockBeforeMove(row) {
        const operation = await buildTaskAttrPreservationOperation(row);
        if (!operation) return false;
        await pushTaskTransaction([operation]);
        return true;
    }

    async function reconcileTaskAttrHostsNow(taskIDs, registryInput) {
        const requestedIDs = uniqueStrings(taskIDs).map((id) => requireID(id, '任务 ID'));
        if (!requestedIDs.length) return { taskIDs: [], reconciled: 0, writtenHosts: [] };
        const registry = registryInput || await getFieldRegistry();
        const items = [];
        for (const taskID of requestedIDs) {
            let row;
            try {
                row = await getTaskRow(taskID);
            } catch (error) {
                if (text(error && error.code) === ERROR.NOT_FOUND) continue;
                throw error;
            }
            row = await ensureTaskListMutationTarget(taskID, registry, row);
            const context = buildAttrContext(row);
            items.push({
                taskID,
                state: context.state,
                attrHostID: taskID,
                mirrorHostIDs: [],
                writtenHosts: [],
            });
        }
        return {
            taskIDs: items.map((item) => item.taskID),
            reconciled: items.length,
            writtenHosts: uniqueStrings(items.flatMap((item) => item.writtenHosts)),
            items,
        };
    }

    async function reconcileTaskAttrHosts(taskIDs) {
        const ids = uniqueStrings(taskIDs).map((id) => requireID(id, '任务 ID'));
        return runTaskLanes(ids, () => reconcileTaskAttrHostsNow(ids));
    }

    async function persistReminderAttrs(binding, attrs) {
        if (!Object.keys(attrs || {}).length) return;
        await setAttrs(binding.taskID, attrs);
    }

    async function captureAttrSnapshots(binding, keys) {
        const hostIDs = [requireID(binding.taskID, '任务 ID')];
        const snapshots = [];
        for (const hostID of hostIDs) {
            const current = await readAttrs(hostID);
            const attrs = {};
            keys.forEach((key) => { attrs[key] = own(current, key) ? String(current[key] ?? '') : ''; });
            snapshots.push({ hostID, attrs });
        }
        return snapshots;
    }

    async function restoreAttrSnapshots(snapshots) {
        const failures = [];
        for (const snapshot of snapshots || []) {
            try { await setAttrs(snapshot.hostID, snapshot.attrs); }
            catch (error) { failures.push({ hostID: snapshot.hostID, error: text(error && error.message) || String(error) }); }
        }
        return failures;
    }

    async function normalizeUiAttrPayload(rawAttrs) {
        const source = rawAttrs && typeof rawAttrs === 'object' && !Array.isArray(rawAttrs) ? rawAttrs : {};
        const registry = await getFieldRegistry();
        const allowed = new Set([ATTR_OWNER, ATTR_UPDATED_AT, ATTACHMENT_META_ATTR, ...REPEAT_ATTRS]);
        registry.fields.forEach((field) => {
            if (field.attr) allowed.add(field.attr);
            (Array.isArray(field.aliases) ? field.aliases : []).forEach((key) => allowed.add(key));
        });
        const out = {};
        Object.entries(source).forEach(([rawKey, value]) => {
            const key = text(rawKey);
            const attachmentSlot = key.startsWith(ATTACHMENT_ATTR_PREFIX)
                && /^\d+$/.test(key.slice(ATTACHMENT_ATTR_PREFIX.length));
            if (!allowed.has(key) && !attachmentSlot) {
                throw new DomainError(ERROR.INVALID_ARGUMENT, `不支持的任务属性: ${key || '(empty)'}`);
            }
            out[key] = String(value == null ? '' : value);
        });
        return out;
    }

    async function persistUiTaskAttrs(taskID, rawAttrs, options) {
        const id = requireID(taskID, '任务 ID');
        const laneID = text(options?.laneID || options?.laneId) || id;
        return runTaskLane(laneID, async () => {
            const attrs = await normalizeUiAttrPayload(rawAttrs);
            const registry = await getFieldRegistry();
            const row = await ensureTaskListMutationTarget(id, registry);
            const context = buildAttrContext(row);
            await guardTaskDateAttrWrite(id, attrs);
            const canonicalAttrs = await buildCanonicalTaskAttrs({ taskID: id, ...context }, attrs, registry);
            if (!Object.keys(canonicalAttrs).length) {
                return { taskID: id, attrHostID: context.primaryHostID, mirrorHostIDs: context.mirrorHostIDs, written: 0 };
            }
            const operations = await buildTaskAttrWriteOperations({ taskID: id, ...context }, canonicalAttrs);
            await pushTaskTransaction(operations);
            return {
                taskID: id,
                attrHostID: context.primaryHostID,
                mirrorHostIDs: context.mirrorHostIDs,
                written: Object.keys(canonicalAttrs).length,
            };
        });
    }

    const REMINDER_INTERVALS = Object.freeze(['once', 'daily', 'workday', 'weekly', 'monthly', 'yearly']);
    const REMINDER_CONTROLLED_KEYS = Object.freeze([
        'blockId', 'taskId', 'blockName', 'blockContent', 'rootId', 'enabled',
        'repeatMode', 'interval', 'every', 'times', 'startDate', 'endDate', 'maxOccurrences',
        'monthlyMode', 'calendarMode', 'syncTaskDone', 'taskStartDate',
        'taskCompletionTime', 'taskRepeatRule', 'taskRepeatState',
        'completedOccurrences', 'completed', 'done', 'followAnchor', 'followDayOffset',
        'time', 'timeKey', 'reminderTime', 'notifyTime', 'at', 'dateTime', 'datetime',
        'remindAt', 'scheduledAt', 'date', 'dateKey', 'day', 'startDateKey', 'until',
        'repeatUntil', 'repeatType', 'repeat_type', 'type', 'repeat', 'monthly_mode',
        'repeatMonthlyMode', 'repeat_calendar_mode', 'repeatCalendarMode',
        'sync_task_done', 'followTaskRepeat', 'task_repeat_rule', 'task_repeat_state',
    ]);

    function reminderConfigurationFingerprint(value) {
        if (!value) return stableJson(null);
        // Notification delivery and completion receipts are maintained by Tomato
        // after the task transaction; user edits to the schedule still conflict.
        const derived = new Set(['completedOccurrences']);
        return stableJson(Object.fromEntries(REMINDER_CONTROLLED_KEYS
            .filter(key => !derived.has(key) && own(value, key)).map(key => [key, value[key]])));
    }

    function parseJsonObject(value) {
        const raw = text(value);
        if (!raw) return null;
        try {
            const parsed = JSON.parse(raw);
            return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null;
        } catch (error) {
            return null;
        }
    }

    function normalizeReminderDate(value, label, required) {
        const raw = text(value);
        if (!raw) {
            if (required) throw new DomainError(ERROR.INVALID_ARGUMENT, `${label}不能为空`);
            return '';
        }
        const key = raw.slice(0, 10);
        if (!isStrictDateKey(key)) {
            throw new DomainError(ERROR.INVALID_ARGUMENT, `${label}格式无效，应为 YYYY-MM-DD`);
        }
        return key;
    }

    function normalizeReminderTimes(value) {
        if (!Array.isArray(value) || !value.length) throw new DomainError(ERROR.INVALID_ARGUMENT, '提醒时间不能为空');
        const times = uniqueStrings(value.map((item) => text(item))).map((item) => {
            const matched = item.match(/^(\d{2}):(\d{2})$/);
            const hour = matched ? Number(matched[1]) : NaN;
            const minute = matched ? Number(matched[2]) : NaN;
            if (!matched || hour < 0 || hour > 23 || minute < 0 || minute > 59) {
                throw new DomainError(ERROR.INVALID_ARGUMENT, `提醒时间无效: ${item || '(empty)'}`);
            }
            return item;
        }).sort();
        if (times.length > 12) throw new DomainError(ERROR.INVALID_ARGUMENT, '单个任务最多设置 12 个提醒时间');
        return times;
    }

    function normalizeReminderEvery(value) {
        const every = value == null || text(value) === '' ? 1 : Number(value);
        if (!Number.isInteger(every) || every < 1 || every > 365) {
            throw new DomainError(ERROR.INVALID_ARGUMENT, '提醒间隔必须是 1 到 365 的整数');
        }
        return every;
    }

    async function readReminderTaskState(taskID) {
        const row = await getTaskRow(taskID);
        const binding = buildAttrContext(row);
        const primaryAttrs = await readAttrs(binding.taskID);
        const raw = String(primaryAttrs[REMINDER_ATTR] == null ? '' : primaryAttrs[REMINDER_ATTR]);
        const reminderSourceHostID = raw ? binding.taskID : '';
        const task = await taskDTO(row);
        const relevant = {
            reminder: raw,
            attrHostID: binding.taskID,
            attrHostState: binding.state,
            reminderSourceHostID,
            title: task.title,
            documentID: task.documentID,
            startDate: task.startDate,
            completionTime: task.completionTime,
            repeatRule: task.repeatRule,
            repeatState: task.repeatState,
        };
        return {
            row,
            task,
            binding,
            primaryAttrs,
            reminderRaw: raw,
            reminder: parseJsonObject(raw),
            reminderSourceHostID,
            fingerprint: stableJson(relevant),
        };
    }

    function reminderBaseRecord(current, taskState) {
        const previous = current && typeof current === 'object' ? { ...current } : {};
        REMINDER_CONTROLLED_KEYS.forEach((key) => { delete previous[key]; });
        const now = nowIso();
        return {
            ...previous,
            blockId: taskState.binding.primaryHostID,
            taskId: taskState.task.id,
            blockName: taskState.task.title || '任务',
            blockContent: taskState.task.title || '任务',
            rootId: taskState.task.documentID,
            enabled: true,
            createdAt: text(current && current.createdAt) || now,
            updatedAt: now,
        };
    }

    function buildFollowTaskReminder(args, taskState) {
        const follow = args.follow && typeof args.follow === 'object' && !Array.isArray(args.follow) ? args.follow : {};
        const taskStartDate = normalizeReminderDate(taskState.task.startDate, '任务开始日期', false);
        const repeatRule = taskState.task.repeatRule && typeof taskState.task.repeatRule === 'object'
            ? taskState.task.repeatRule
            : null;
        const repeatEnabled = !!(repeatRule && repeatRule.enabled !== false && text(repeatRule.type) !== 'none');
        const checkin = repeatEnabled && repeatRule.trigger === 'checkin';
        const taskCompletionTime = checkin ? '' : normalizeReminderDate(follow.date || taskState.task.completionTime, '跟随提醒日期', true);
        return {
            ...reminderBaseRecord(taskState.reminder, taskState),
            repeatMode: REMINDER_REPEAT_MODE_FOLLOW_TASK,
            interval: 'once',
            every: 1,
            times: normalizeReminderTimes(follow.times),
            startDate: checkin ? repeatRule.anchorDate : taskCompletionTime,
            endDate: '',
            monthlyMode: 'date',
            calendarMode: 'solar',
            syncTaskDone: true,
            taskStartDate,
            taskCompletionTime,
            taskRepeatRule: repeatEnabled ? repeatRule : null,
            taskRepeatState: repeatEnabled && taskState.task.repeatState && typeof taskState.task.repeatState === 'object'
                ? taskState.task.repeatState
                : null,
            completedOccurrences: [],
            followAnchor: 'completionTime',
            followDayOffset: 0,
        };
    }

    function buildIndependentReminder(args, taskState) {
        const schedule = args.schedule && typeof args.schedule === 'object' && !Array.isArray(args.schedule) ? args.schedule : {};
        const interval = text(schedule.interval) || 'once';
        if (!REMINDER_INTERVALS.includes(interval)) {
            throw new DomainError(ERROR.INVALID_ARGUMENT, `不支持的提醒重复方式: ${interval}`);
        }
        const startDate = normalizeReminderDate(schedule.startDate, '提醒开始日期', true);
        const endDate = normalizeReminderDate(schedule.endDate, '提醒结束日期', false);
        if (endDate && endDate < startDate) throw new DomainError(ERROR.INVALID_ARGUMENT, '提醒结束日期不能早于开始日期');
        return {
            ...reminderBaseRecord(taskState.reminder, taskState),
            repeatMode: REMINDER_REPEAT_MODE_MANUAL,
            interval,
            every: normalizeReminderEvery(schedule.every),
            times: normalizeReminderTimes(schedule.times),
            startDate,
            endDate,
            monthlyMode: text(schedule.monthlyMode) === 'weekday' ? 'weekday' : 'date',
            calendarMode: (interval === 'monthly' || interval === 'yearly') && text(schedule.calendarMode) === 'lunar' ? 'lunar' : 'solar',
            syncTaskDone: false,
            taskStartDate: '',
            taskCompletionTime: '',
            taskRepeatRule: null,
            taskRepeatState: null,
            completedOccurrences: [],
            followAnchor: '',
            followDayOffset: 0,
        };
    }

    function normalizeReminderOperation(args, taskState) {
        const operation = text(args && args.operation);
        if (operation !== 'set' && operation !== 'clear') {
            throw new DomainError(ERROR.INVALID_ARGUMENT, '提醒操作必须是 set 或 clear');
        }
        if (operation === 'clear') return { operation, mode: '', reminder: null };
        const mode = text(args && args.mode);
        if (mode !== 'follow_task' && mode !== 'independent') {
            throw new DomainError(ERROR.INVALID_ARGUMENT, '提醒模式必须是 follow_task 或 independent');
        }
        const reminder = mode === 'follow_task'
            ? buildFollowTaskReminder(args, taskState)
            : buildIndependentReminder(args, taskState);
        return { operation, mode, reminder };
    }

    function reminderPreviewData(taskState, normalized, previewToken, expiresAt) {
        return {
            previewToken,
            expiresAt: new Date(expiresAt).toISOString(),
            requiresConfirmation: true,
            taskID: taskState.task.id,
            taskTitle: taskState.task.title,
            operation: normalized.operation,
            mode: normalized.mode,
            current: taskState.reminder,
            next: normalized.reminder,
            consequence: normalized.operation === 'clear'
                ? { hasReminder: false, syncTaskDone: false, completionCleared: false }
                : {
                    hasReminder: true,
                    syncTaskDone: normalized.reminder.syncTaskDone === true,
                    startDate: normalized.reminder.startDate,
                    times: normalized.reminder.times,
                    interval: normalized.reminder.interval,
                },
        };
    }

    async function previewTaskReminder(args) {
        pruneTokens(state.reminderTokens);
        const binding = await resolveTaskBinding(args && args.taskID);
        const taskState = await readReminderTaskState(binding.taskID);
        const normalized = normalizeReminderOperation(args, taskState);
        const previewToken = token('reminder');
        const expiresAt = Date.now() + PREVIEW_TOKEN_TTL;
        state.reminderTokens.set(previewToken, {
            taskID: taskState.task.id,
            fingerprint: taskState.fingerprint,
            normalized,
            expiresAt,
        });
        return reminderPreviewData(taskState, normalized, previewToken, expiresAt);
    }

    async function persistTaskReminder(binding, taskState, normalized) {
        const registry = await getFieldRegistry();
        const completionField = registry.byId.get('completionTime');
        if (!completionField || !completionField.attr) throw new DomainError(ERROR.STORAGE_ERROR, '任务截止日期字段不可写');

        const previousReminder = taskState.reminder && typeof taskState.reminder === 'object' ? taskState.reminder : null;
        const previousFollowDate = previousReminder && previousReminder.repeatMode === REMINDER_REPEAT_MODE_FOLLOW_TASK
            ? text(previousReminder.taskCompletionTime || previousReminder.startDate).slice(0, 10)
            : '';
        const currentCompletion = normalizeReminderDate(taskState.task.completionTime, '任务截止日期', false);
        let completionTime = currentCompletion;
        let completionChanged = false;
        const completionCleared = false;
        if (normalized.operation === 'set' && normalized.mode === 'follow_task' && normalized.reminder) {
            completionTime = normalized.reminder.taskCompletionTime;
            completionChanged = currentCompletion !== completionTime;
        }

        if (completionChanged && taskState.task.dateMode === 'rollup') {
            throw new DomainError(ERROR.INVALID_ARGUMENT, '日期由子任务汇总，请先切换为手动设置');
        }
        const deadlineAttrs = completionChanged
            ? buildAttrPayload({ completionTime }, registry, binding.taskID)
            : {};
        const reminderAttrs = {
            [REMINDER_ATTR]: normalized.reminder ? JSON.stringify(normalized.reminder) : '',
            bookmark: normalized.reminder ? '⏰' : '',
            [ATTR_OWNER]: binding.taskID,
            [ATTR_UPDATED_AT]: String(Date.now()),
        };
        const snapshotKeys = uniqueStrings(Object.keys(deadlineAttrs).concat(Object.keys(reminderAttrs)));
        const snapshots = await captureAttrSnapshots(taskState.binding, snapshotKeys);
        try {
            if (completionChanged) {
                await persistTaskAttrs({ taskID: binding.taskID, ...taskState.binding }, deadlineAttrs);
                const persistedTask = await taskDTO(binding.taskID, ['completionTime']);
                if (persistedTask.completionTime !== completionTime) {
                    throw new DomainError(ERROR.STORAGE_ERROR, '任务截止日期写入后回读校验失败');
                }
            }
            await persistReminderAttrs({ taskID: binding.taskID, ...taskState.binding }, reminderAttrs);
            const persistedAttrs = await readAttrs(taskState.binding.primaryHostID);
            const persistedReminder = parseJsonObject(persistedAttrs[REMINDER_ATTR]);
            const reminderPersisted = normalized.reminder
                ? !!persistedReminder && stableJson(persistedReminder) === stableJson(normalized.reminder)
                : !text(persistedAttrs[REMINDER_ATTR]);
            if (!reminderPersisted) throw new DomainError(ERROR.STORAGE_ERROR, '提醒写入后回读校验失败');
            const task = await taskDTO(binding.taskID);
            return {
                taskID: binding.taskID,
                taskTitle: taskState.task.title,
                task,
                attrHostID: taskState.binding.primaryHostID,
                operation: normalized.operation,
                mode: normalized.mode || (previousFollowDate ? 'follow_task' : 'independent'),
                hasReminder: !!normalized.reminder,
                reminder: normalized.reminder,
                completionTime,
                completionChanged,
                completionCleared,
                refresh: taskMutationRefresh('reminder', [binding.taskID], [task.documentID]),
            };
        } catch (error) {
            const rollbackFailures = await restoreAttrSnapshots(snapshots);
            if (rollbackFailures.length) {
                throw new DomainError(ERROR.STORAGE_ERROR, '提醒写入失败，且属性回滚未完全成功', {
                    cause: text(error && error.message) || String(error),
                    rollbackFailures,
                });
            }
            throw error;
        }
    }

    async function findReminderTaskByExactTitle(taskTitle) {
        const title = text(taskTitle);
        if (!title) return '';
        const lookupTitle = normalizeReminderTaskLookupTitle(title);
        const rows = await sql(`
            SELECT task.id, task.markdown, task.content AS raw_content, task.updated
            FROM blocks task
            WHERE task.type = 'i'
              AND task.subtype = 't'
              AND (
                instr(lower(task.markdown), lower('${escapeSql(lookupTitle)}')) > 0
                OR instr(lower(task.content), lower('${escapeSql(lookupTitle)}')) > 0
              )
            ORDER BY task.updated DESC, task.created DESC, task.sort ASC, task.id ASC
        `);
        const matches = rows.filter((row) => normalizeReminderTaskLookupTitle(taskOwnTitle(row)) === lookupTitle);
        return text(matches.find((row) => !parseDone(row.markdown))?.id || matches[0]?.id);
    }

    async function findReminderTaskByFuzzyTitle(taskTitle) {
        const lookupTitle = normalizeReminderTaskLookupTitle(taskTitle);
        const terms = reminderTaskFuzzyTerms(lookupTitle);
        if (!terms.length) return null;
        const conditions = terms.map((term) => {
            const value = escapeSql(term);
            return `(instr(lower(task.markdown), lower('${value}')) > 0 OR instr(lower(task.content), lower('${value}')) > 0)`;
        });
        const rows = await sql(`
            SELECT task.id, task.markdown, task.content AS raw_content, task.updated
            FROM blocks task
            WHERE task.type = 'i'
              AND task.subtype = 't'
              AND (${conditions.join(' OR ')})
            ORDER BY task.updated DESC, task.created DESC, task.sort ASC, task.id ASC
        `);
        const matches = rows.map((row) => {
            const matchedTitle = taskOwnTitle(row);
            return {
                id: text(row.id),
                matchedTitle,
                done: parseDone(row.markdown),
                distance: reminderTaskTitleDistance(lookupTitle, matchedTitle),
            };
        }).filter((item) => item.id && item.distance <= reminderTaskFuzzyDistanceLimit(lookupTitle, item.matchedTitle));
        matches.sort((left, right) => left.distance - right.distance || Number(left.done) - Number(right.done));
        const match = matches[0];
        return match ? {
            taskID: match.id,
            matchType: match.distance === 0 ? 'exact' : 'fuzzy',
            matchDistance: match.distance,
            matchedTitle: match.matchedTitle,
        } : null;
    }

    async function findReminderTaskByTitle(taskTitle) {
        const exactTaskID = await findReminderTaskByExactTitle(taskTitle);
        if (exactTaskID) return { taskID: exactTaskID, matchType: 'exact', matchDistance: 0 };
        return await findReminderTaskByFuzzyTitle(taskTitle);
    }

    async function applyTaskReminder(args) {
        const source = args && typeof args === 'object' ? args : {};
        let taskID = text(source.taskID || source.taskId);
        let created = null;
        let taskReused = false;
        let taskMatchType = '';
        let taskMatchDistance = null;
        if (!taskID) {
            if (text(source.operation) !== 'set') throw new DomainError(ERROR.INVALID_ARGUMENT, '清除提醒时必须提供任务 ID');
            const taskTitle = text(source.taskTitle || source.title);
            const documentID = text(source.documentID || source.documentId);
            if (!taskTitle) throw new DomainError(ERROR.INVALID_ARGUMENT, '没有绑定任务时必须提供提醒对应的任务标题');
            const taskMatch = await findReminderTaskByTitle(taskTitle);
            taskID = text(taskMatch?.taskID);
            taskReused = !!taskID;
            taskMatchType = taskReused ? text(taskMatch?.matchType) : '';
            taskMatchDistance = taskReused && Number.isFinite(Number(taskMatch?.matchDistance)) ? Number(taskMatch.matchDistance) : null;
            if (!taskID) {
                if (!documentID) throw new DomainError(ERROR.INVALID_ARGUMENT, '没有匹配任务时必须提供插件默认新建位置的文档 ID');
                created = await createTask({ title: taskTitle, documentID });
                taskID = text(created?.task?.id);
            }
        }
        try {
            const binding = await resolveTaskBinding(taskID);
            const result = await runTaskLane(binding.taskID, async () => {
                const taskState = await readReminderTaskState(binding.taskID);
                const normalized = normalizeReminderOperation(source, taskState);
                return persistTaskReminder(binding, taskState, normalized);
            });
            return {
                ...result,
                taskCreated: !!created,
                taskReused,
                taskMatchType,
                taskMatchDistance,
                createdDocumentID: created ? text(created.task?.documentID) : '',
            };
        } catch (error) {
            if (created && taskID) {
                try { await api('/api/block/deleteBlock', { id: text(created.insertedBlockID) || taskID }); } catch (rollbackError) {}
                state.lastUndo = null;
            }
            throw error;
        }
    }

    async function executeTaskReminder(args) {
        pruneTokens(state.reminderTokens);
        const previewToken = text(args && args.previewToken);
        const preview = state.reminderTokens.get(previewToken);
        if (!preview) throw new DomainError(ERROR.CONFIRMATION_REQUIRED, '请先预览提醒变更并使用有效确认令牌');
        const binding = await resolveTaskBinding(args && args.taskID);
        const requestedOperation = text(args && args.operation);
        if (binding.taskID !== preview.taskID || (requestedOperation && requestedOperation !== preview.normalized.operation)) {
            throw new DomainError(ERROR.CONFIRMATION_REQUIRED, '提醒确认令牌与当前操作不匹配');
        }
        return runTaskLane(binding.taskID, async () => {
            const taskState = await readReminderTaskState(binding.taskID);
            if (taskState.fingerprint !== preview.fingerprint) {
                state.reminderTokens.delete(previewToken);
                throw new DomainError(ERROR.STALE_REVISION, '任务或提醒在预览后已发生变化，请重新预览');
            }
            const normalized = preview.normalized.operation === 'set'
                ? normalizeReminderOperation({
                    ...args,
                    operation: preview.normalized.operation,
                    mode: preview.normalized.mode,
                    follow: preview.normalized.mode === 'follow_task' ? {
                        date: preview.normalized.reminder.taskCompletionTime,
                        times: preview.normalized.reminder.times,
                    } : undefined,
                    schedule: preview.normalized.mode === 'independent' ? {
                        startDate: preview.normalized.reminder.startDate,
                        endDate: preview.normalized.reminder.endDate,
                        times: preview.normalized.reminder.times,
                        interval: preview.normalized.reminder.interval,
                        every: preview.normalized.reminder.every,
                        monthlyMode: preview.normalized.reminder.monthlyMode,
                        calendarMode: preview.normalized.reminder.calendarMode,
                    } : undefined,
                }, taskState)
                : preview.normalized;
            const result = await persistTaskReminder(binding, taskState, normalized);
            state.reminderTokens.delete(previewToken);
            return result;
        });
    }

    async function configureTaskReminder(args) {
        let result;
        if (!text(args && args.phase)) {
            requireAction(args, 'apply');
            result = await applyTaskReminder(args);
        } else {
            requirePhaseAction(args, 'apply');
            if (args.phase === 'preview') return previewTaskReminder(args);
            result = await executeTaskReminder(args);
        }
        if (result.completionChanged) {
            try { result.dateRollupUpdates = await reconcileTaskDateRollups(result.refresh?.documentIDs || []); }
            catch (error) { result.dateRollupError = text(error.message) || '父任务日期汇总失败'; }
        }
        return result;
    }

    const AGENT_SCHEDULE_KINDS = Object.freeze(['once', 'daily', 'weekdays', 'weekly']);
    const AGENT_SCHEDULE_LEASE_MS = 15 * 60 * 1000;
    const AGENT_SCHEDULE_RETRY_DELAYS = Object.freeze([60 * 1000, 5 * 60 * 1000]);
    const AGENT_SCHEDULE_TERMINAL_STATUSES = new Set(['succeeded', 'skipped_empty', 'blocked', 'config_error']);
    const AGENT_SCHEDULE_FINISH_STATUSES = new Set([...AGENT_SCHEDULE_TERMINAL_STATUSES, 'failed']);

    function cloneAgentSchedule(value) {
        return value == null ? value : JSON.parse(JSON.stringify(value));
    }

    function normalizeAgentScheduleTime(value) {
        const match = text(value).match(/^(\d{2}):(\d{2})$/);
        const hour = match ? Number(match[1]) : NaN;
        const minute = match ? Number(match[2]) : NaN;
        if (!match || hour < 0 || hour > 23 || minute < 0 || minute > 59) {
            throw new DomainError(ERROR.INVALID_ARGUMENT, 'AI 定时任务时间无效，应为 HH:mm');
        }
        return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
    }

    function normalizeAgentScheduleEvent(input, current) {
        const source = input && typeof input === 'object' && !Array.isArray(input) ? input : {};
        const previous = current && typeof current === 'object' && !Array.isArray(current) ? current : {};
        const schedule = source.schedule && typeof source.schedule === 'object' && !Array.isArray(source.schedule)
            ? source.schedule
            : (previous.schedule || {});
        const output = source.output && typeof source.output === 'object' && !Array.isArray(source.output)
            ? source.output
            : (previous.output || {});
        const kind = text(schedule.kind || previous.schedule && previous.schedule.kind);
        if (!AGENT_SCHEDULE_KINDS.includes(kind)) throw new DomainError(ERROR.INVALID_ARGUMENT, 'AI 定时任务重复方式无效');
        const date = kind === 'once' ? normalizeReminderDate(schedule.date || previous.schedule && previous.schedule.date, 'AI 定时任务日期', true) : '';
        const name = text(source.name || previous.name).slice(0, 120);
        const prompt = text(source.prompt || previous.prompt).slice(0, 20000);
        if (!name || !prompt) throw new DomainError(ERROR.INVALID_ARGUMENT, 'AI 定时任务名称和指令不能为空');
        const id = text(source.id || previous.id) || token('agent_schedule');
        const now = Date.now();
        const outputMode = text(output.mode || previous.output && previous.output.mode);
        const event = {
            id,
            type: 'agent_prompt',
            createdAt: Number(previous.createdAt || source.createdAt) || now,
            updatedAt: Number(source.updatedAt || previous.updatedAt) || now,
            name,
            enabled: source.enabled == null ? previous.enabled !== false : source.enabled !== false,
            prompt,
            includeInternalPrompt: source.includeInternalPrompt == null
                ? previous.includeInternalPrompt !== false
                : source.includeInternalPrompt !== false,
            conversationId: text(source.conversationId || previous.conversationId),
            conversationUpdatedAt: Math.max(0, Number(source.conversationUpdatedAt) || 0),
            conversationTitle: text(source.conversationTitle).slice(0, 160),
            condition: text(source.condition || previous.condition) === 'today_has_completed_tasks' ? 'today_has_completed_tasks' : 'always',
            schedule: {
                kind,
                date,
                weekday: kind === 'weekly' ? clampInt(schedule.weekday == null ? previous.schedule && previous.schedule.weekday : schedule.weekday, 0, 6, 1) : 0,
                time: normalizeAgentScheduleTime(schedule.time || previous.schedule && previous.schedule.time),
            },
            output: {
                mode: outputMode === 'document'
                    ? 'document'
                    : outputMode === 'daily_note'
                        ? 'daily_note'
                        : 'notification',
                documentId: text(output.documentId || previous.output && previous.output.documentId),
                documentMode: text(output.documentMode || previous.output && previous.output.documentMode) === 'monthly_child' ? 'monthly_child' : 'target',
                insertPosition: text(output.insertPosition || previous.output && previous.output.insertPosition) === 'top' ? 'top' : 'bottom',
            },
            lastOccurrence: source.lastOccurrence && typeof source.lastOccurrence === 'object'
                ? cloneAgentSchedule(source.lastOccurrence)
                : cloneAgentSchedule(previous.lastOccurrence || {}),
            lastRun: source.lastRun && typeof source.lastRun === 'object'
                ? cloneAgentSchedule(source.lastRun)
                : cloneAgentSchedule(previous.lastRun || {}),
        };
        if (event.output.mode === 'document' && !event.output.documentId) {
            throw new DomainError(ERROR.INVALID_ARGUMENT, 'AI 定时任务写入文档时必须指定文档 ID');
        }
        return event;
    }

    async function loadAgentSchedules(options) {
        const record = await readJsonState(AGENT_SCHEDULE_FILE);
        if (record.status === 'missing' && options?.allowMissing !== false) return [];
        if (record.status !== 'valid') throw jsonStorageError(AGENT_SCHEDULE_FILE, record);
        const stored = record.value;
        const source = Array.isArray(stored) ? stored : (Array.isArray(stored && stored.events) ? stored.events : []);
        if (!Array.isArray(stored) && !Array.isArray(stored && stored.events)) {
            throw jsonStorageError(AGENT_SCHEDULE_FILE, {
                status: 'corrupt',
                error: new Error('scheduled event list is invalid'),
            });
        }
        const seen = new Set();
        const items = [];
        for (const item of source) {
            try {
                const normalized = normalizeAgentScheduleEvent(item, item);
                if (!seen.has(normalized.id)) {
                    seen.add(normalized.id);
                    items.push(normalized);
                }
            } catch (error) {}
        }
        return items;
    }

    function runAgentScheduleLane(task) {
        const run = state.agentScheduleLane.then(task, task);
        state.agentScheduleLane = run.catch(() => {});
        return run;
    }

    async function resolveAgentScheduleOutputDocument(input) {
        const source = input && typeof input === 'object' && !Array.isArray(input) ? input : {};
        const parentDocumentID = requireID(source.parentDocumentID || source.parentDocumentId, '父文档 ID');
        const month = text(source.month);
        if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
            throw new DomainError(ERROR.INVALID_ARGUMENT, '月度子文档月份无效，应为 YYYY-MM');
        }
        return runAgentScheduleLane(async () => {
            const parentRows = await sql(`SELECT id, box, path, hpath FROM blocks WHERE id = '${escapeSql(parentDocumentID)}' AND type = 'd' LIMIT 1`);
            const parent = parentRows[0];
            if (!parent) throw new DomainError(ERROR.NOT_FOUND, 'AI 定时任务父文档不存在');
            const box = text(parent.box);
            const parentPath = text(parent.path);
            const parentHPath = text(parent.hpath).replace(/\/$/, '');
            if (!box || !parentPath.endsWith('.sy') || !parentHPath) {
                throw new DomainError(ERROR.STORAGE_ERROR, '无法解析 AI 定时任务父文档路径');
            }
            const childPathPrefix = `${parentPath.slice(0, -3)}/`;
            const rows = await sql(`
                SELECT id, path FROM blocks
                WHERE type = 'd'
                  AND box = '${escapeSql(box)}'
                  AND content = '${escapeSql(month)}'
                  AND path LIKE '${escapeSql(childPathPrefix)}%'
                ORDER BY created ASC, id ASC
            `);
            const existing = rows.find((row) => {
                const childPath = text(row && row.path);
                const relative = childPath.startsWith(childPathPrefix) ? childPath.slice(childPathPrefix.length) : '';
                return relative.endsWith('.sy') && !relative.slice(0, -3).includes('/');
            });
            if (existing) return { documentID: requireID(existing.id, '月度子文档 ID'), created: false, month };
            const created = await api('/api/filetree/createDocWithMd', {
                notebook: box,
                path: `${parentHPath}/${month}`,
                parentID: parentDocumentID,
                markdown: '',
            });
            return { documentID: requireID(created, '月度子文档 ID'), created: true, month };
        });
    }

    async function saveAgentSchedule(input) {
        return runAgentScheduleLane(async () => {
            const requestedID = text(input && input.id);
            const items = await loadAgentSchedules({ allowMissing: !requestedID });
            const index = requestedID ? items.findIndex((item) => item.id === requestedID) : -1;
            const current = index >= 0 ? items[index] : null;
            const event = preserveAgentScheduleRuntime(normalizeAgentScheduleEvent(input, current), current);
            event.updatedAt = Date.now();
            if (index >= 0) items[index] = event;
            else items.push(event);
            await writeJson(AGENT_SCHEDULE_FILE, items);
            return cloneAgentSchedule(event);
        });
    }

    function preserveAgentScheduleRuntime(event, current) {
        if (!current) return event;
        const currentLedger = current.lastOccurrence && typeof current.lastOccurrence === 'object' ? current.lastOccurrence : {};
        const incomingLedger = event.lastOccurrence && typeof event.lastOccurrence === 'object' ? event.lastOccurrence : {};
        const ownsRunningOccurrence = text(currentLedger.status) === 'running'
            && text(incomingLedger.status) === 'running'
            && text(currentLedger.occurrenceKey) === text(incomingLedger.occurrenceKey)
            && text(currentLedger.ownerId)
            && text(currentLedger.ownerId) === text(incomingLedger.ownerId);
        if (!ownsRunningOccurrence) {
            event.lastOccurrence = cloneAgentSchedule(current.lastOccurrence || {});
            event.lastRun = cloneAgentSchedule(current.lastRun || {});
        }
        if (text(current.conversationId)) {
            const differentConversation = event.conversationId !== current.conversationId;
            event.conversationId = current.conversationId;
            if (differentConversation || current.conversationUpdatedAt > event.conversationUpdatedAt) {
                event.conversationUpdatedAt = current.conversationUpdatedAt;
                event.conversationTitle = current.conversationTitle;
            } else if (!event.conversationTitle) {
                event.conversationTitle = current.conversationTitle;
            }
        }
        return event;
    }

    async function replaceAgentSchedules(input) {
        const source = Array.isArray(input) ? input : (Array.isArray(input && input.events) ? input.events : null);
        if (!source) throw new DomainError(ERROR.INVALID_ARGUMENT, 'AI 定时任务列表格式无效');
        if (source.length > 500) throw new DomainError(ERROR.INVALID_ARGUMENT, 'AI 定时任务最多保留 500 条');
        return runAgentScheduleLane(async () => {
            const currentItems = await loadAgentSchedules({ allowMissing: true });
            const currentByID = new Map(currentItems.map((event) => [event.id, event]));
            const seen = new Set();
            const next = source.map((item) => {
                const requestedID = text(item && item.id);
                if (requestedID && seen.has(requestedID)) {
                    throw new DomainError(ERROR.INVALID_ARGUMENT, `AI 定时任务 ID 重复: ${requestedID}`);
                }
                const current = requestedID ? currentByID.get(requestedID) : null;
                const event = preserveAgentScheduleRuntime(normalizeAgentScheduleEvent(item, current), current);
                if (seen.has(event.id)) throw new DomainError(ERROR.INVALID_ARGUMENT, `AI 定时任务 ID 重复: ${event.id}`);
                seen.add(event.id);
                return event;
            });
            await writeJson(AGENT_SCHEDULE_FILE, next);
            return cloneAgentSchedule(next);
        });
    }

    async function deleteAgentSchedule(scheduleID) {
        const id = text(scheduleID);
        if (!id) throw new DomainError(ERROR.INVALID_ARGUMENT, '缺少 AI 定时任务 ID');
        return runAgentScheduleLane(async () => {
            const items = await loadAgentSchedules();
            const next = items.filter((item) => item.id !== id);
            if (next.length === items.length) throw new DomainError(ERROR.NOT_FOUND, 'AI 定时任务不存在');
            await writeJson(AGENT_SCHEDULE_FILE, next);
            return { id, deleted: true };
        });
    }

    async function claimAgentScheduleOccurrence(input) {
        const source = input && typeof input === 'object' && !Array.isArray(input) ? input : {};
        const scheduleID = text(source.scheduleID || source.id);
        const occurrenceKey = text(source.occurrenceKey);
        const manual = source.manual === true;
        const preserveResult = source.preserveResult === true;
        if (!scheduleID || !occurrenceKey) throw new DomainError(ERROR.INVALID_ARGUMENT, '缺少 AI 定时任务 ID 或发生键');
        return runAgentScheduleLane(async () => {
            const items = await loadAgentSchedules();
            const index = items.findIndex((item) => item.id === scheduleID);
            if (index < 0) throw new DomainError(ERROR.NOT_FOUND, 'AI 定时任务不存在');
            const event = items[index];
            const ledger = event.lastOccurrence && typeof event.lastOccurrence === 'object' ? event.lastOccurrence : {};
            const now = Date.now();
            if (!manual && text(ledger.occurrenceKey) === occurrenceKey) {
                if (AGENT_SCHEDULE_TERMINAL_STATUSES.has(text(ledger.status))) {
                    return { claimed: false, reason: 'terminal', event: cloneAgentSchedule(event) };
                }
                if (text(ledger.status) === 'running' && Number(ledger.leaseUntil) > now) {
                    return { claimed: false, reason: 'running', event: cloneAgentSchedule(event) };
                }
                if (text(ledger.status) === 'failed' && (Number(ledger.attempts) >= 3 || Number(ledger.nextAttemptAt) > now)) {
                    return { claimed: false, reason: Number(ledger.attempts) >= 3 ? 'retry_exhausted' : 'retry_wait', event: cloneAgentSchedule(event) };
                }
            }
            const ownerID = token('runner');
            const attempts = !manual && text(ledger.occurrenceKey) === occurrenceKey ? Number(ledger.attempts) || 0 : 0;
            if (!manual) {
                event.lastOccurrence = {
                    occurrenceKey,
                    status: 'running',
                    ownerId: ownerID,
                    leaseUntil: now + AGENT_SCHEDULE_LEASE_MS,
                    attempts: attempts + 1,
                    nextAttemptAt: 0,
                    startedAt: now,
                    finishedAt: 0,
                    error: '',
                };
            }
            event.lastRun = preserveResult
                ? { ...(event.lastRun || {}), occurrenceKey, status: 'running', error: '', finishedAt: 0 }
                : {
                    occurrenceKey,
                    status: 'running',
                    startedAt: now,
                    finishedAt: 0,
                    title: '',
                    markdown: '',
                    blockId: '',
                    error: '',
                    deliveryPending: false,
                };
            items[index] = event;
            await writeJson(AGENT_SCHEDULE_FILE, items);
            return { claimed: true, ownerID, event: cloneAgentSchedule(event) };
        });
    }

    async function renewAgentScheduleOccurrence(input) {
        const source = input && typeof input === 'object' && !Array.isArray(input) ? input : {};
        const scheduleID = text(source.scheduleID || source.id);
        const occurrenceKey = text(source.occurrenceKey);
        const ownerID = text(source.ownerID || source.ownerId);
        if (!scheduleID || !occurrenceKey || !ownerID) throw new DomainError(ERROR.INVALID_ARGUMENT, '缺少 AI 定时任务续租参数');
        return runAgentScheduleLane(async () => {
            const items = await loadAgentSchedules();
            const index = items.findIndex((item) => item.id === scheduleID);
            if (index < 0) throw new DomainError(ERROR.NOT_FOUND, 'AI 定时任务不存在');
            const event = items[index];
            const ledger = event.lastOccurrence && typeof event.lastOccurrence === 'object' ? event.lastOccurrence : {};
            if (text(ledger.status) !== 'running'
                || text(ledger.occurrenceKey) !== occurrenceKey
                || text(ledger.ownerId) !== ownerID) {
                throw new DomainError(ERROR.CONFLICT, 'AI 定时任务执行权已失效');
            }
            const leaseUntil = Date.now() + AGENT_SCHEDULE_LEASE_MS;
            event.lastOccurrence = { ...ledger, leaseUntil };
            items[index] = event;
            await writeJson(AGENT_SCHEDULE_FILE, items);
            return { leaseUntil, event: cloneAgentSchedule(event) };
        });
    }

    async function finishAgentScheduleOccurrence(input) {
        const source = input && typeof input === 'object' && !Array.isArray(input) ? input : {};
        const scheduleID = text(source.scheduleID || source.id);
        const occurrenceKey = text(source.occurrenceKey);
        const ownerID = text(source.ownerID || source.ownerId);
        const status = text(source.status);
        const manual = source.manual === true;
        const patch = source.patch && typeof source.patch === 'object' && !Array.isArray(source.patch) ? source.patch : {};
        if (!scheduleID || !occurrenceKey) throw new DomainError(ERROR.INVALID_ARGUMENT, '缺少 AI 定时任务 ID 或发生键');
        if (!AGENT_SCHEDULE_FINISH_STATUSES.has(status)) throw new DomainError(ERROR.INVALID_ARGUMENT, 'AI 定时任务完成状态无效');
        return runAgentScheduleLane(async () => {
            const items = await loadAgentSchedules();
            const index = items.findIndex((item) => item.id === scheduleID);
            if (index < 0) throw new DomainError(ERROR.NOT_FOUND, 'AI 定时任务不存在');
            const event = items[index];
            const ledger = event.lastOccurrence && typeof event.lastOccurrence === 'object' ? event.lastOccurrence : {};
            if (!manual && (text(ledger.occurrenceKey) !== occurrenceKey || !ownerID || text(ledger.ownerId) !== ownerID)) {
                throw new DomainError(ERROR.CONFLICT, 'AI 定时任务执行权已失效');
            }
            const now = Date.now();
            if (!manual) {
                const attempts = Number(ledger.attempts) || 1;
                event.lastOccurrence = {
                    ...ledger,
                    occurrenceKey,
                    status,
                    leaseUntil: 0,
                    nextAttemptAt: status === 'failed' && attempts < 3
                        ? now + AGENT_SCHEDULE_RETRY_DELAYS[Math.min(attempts - 1, AGENT_SCHEDULE_RETRY_DELAYS.length - 1)]
                        : 0,
                    finishedAt: now,
                    error: text(patch.error).slice(0, 2000),
                };
            }
            event.lastRun = {
                ...(event.lastRun || {}),
                ...cloneAgentSchedule(patch),
                occurrenceKey,
                status,
                finishedAt: now,
            };
            if (!manual && event.schedule.kind === 'once' && AGENT_SCHEDULE_TERMINAL_STATUSES.has(status)) event.enabled = false;
            items[index] = event;
            await writeJson(AGENT_SCHEDULE_FILE, items);
            return cloneAgentSchedule(event);
        });
    }

    async function manageAgentSchedules(args) {
        const action = text(args && args.action);
        if (action === 'list') return { items: await loadAgentSchedules() };
        if (action === 'create') return saveAgentSchedule({ ...(args.event || {}), id: '' });
        if (action === 'update') {
            const id = text(args && (args.scheduleID || args.id));
            if (!id) throw new DomainError(ERROR.INVALID_ARGUMENT, '缺少 AI 定时任务 ID');
            const current = (await loadAgentSchedules()).find((item) => item.id === id);
            if (!current) throw new DomainError(ERROR.NOT_FOUND, 'AI 定时任务不存在');
            return saveAgentSchedule({ ...current, ...(args.patch || {}), id });
        }
        if (action === 'delete') return deleteAgentSchedule(args && (args.scheduleID || args.id));
        throw new DomainError(ERROR.INVALID_ARGUMENT, 'AI 定时任务操作必须是 list、create、update 或 delete');
    }

    function normalizeExplicitAttrs(rawAttrs) {
        const source = rawAttrs && typeof rawAttrs === 'object' && !Array.isArray(rawAttrs) ? rawAttrs : {};
        const out = {};
        Object.entries(source).forEach(([rawKey, value]) => {
            const key = text(rawKey);
            if (key !== 'alias' && key !== 'bookmark' && !SAFE_ATTR_RE.test(key)) {
                throw new DomainError(ERROR.INVALID_ARGUMENT, `属性名无效: ${key || '(empty)'}`);
            }
            out[key] = String(value == null ? '' : value);
        });
        return out;
    }

    async function persistUiBlockOperationNow(input) {
        const source = input && typeof input === 'object' && !Array.isArray(input) ? input : {};
        const action = text(source.action);
        if (action === 'setAttrs') {
            const id = requireID(source.id, '块 ID');
            const attrs = normalizeExplicitAttrs(source.attrs);
            await guardTaskDateAttrWrite(id, attrs);
            await setAttrs(id, attrs);
            return { id, written: Object.keys(attrs).length };
        }
        if (action === 'batchSetAttrs') {
            const entries = Array.isArray(source.entries) ? source.entries.slice(0, 200) : [];
            const blockAttrs = entries.map((entry) => ({
                id: requireID(entry && entry.id, '块 ID'),
                attrs: normalizeExplicitAttrs(entry && entry.attrs),
            })).filter((entry) => Object.keys(entry.attrs).length > 0);
            for (const entry of blockAttrs) await guardTaskDateAttrWrite(entry.id, entry.attrs);
            if (blockAttrs.length > 0) {
                await api('/api/attr/batchSetBlockAttrs', { blockAttrs });
            }
            return { written: entries.length };
        }
        if (action === 'updateBlock') {
            const id = requireID(source.id, '块 ID');
            const data = String(source.data == null ? '' : source.data);
            const dataType = text(source.dataType) === 'dom' ? 'dom' : 'markdown';
            const result = await api('/api/block/updateBlock', { id, data, dataType });
            return { id: extractInsertedID(result) || id };
        }
        if (action === 'insertBlock' || action === 'appendBlock' || action === 'prependBlock') {
            const parentID = requireID(source.parentID || source.parentId, '父块 ID');
            const requestedID = text(source.requestedID || source.requestedId);
            if (requestedID) {
                requireID(requestedID, '预生成块 ID');
                const existing = await sql(`SELECT id FROM blocks WHERE id = '${escapeSql(requestedID)}' LIMIT 1`);
                if (existing.length) return { id: requestedID, recovered: true };
            }
            const dataType = text(source.dataType) === 'dom' ? 'dom' : 'markdown';
            const payload = { parentID, data: String(source.data == null ? '' : source.data), dataType };
            if (action === 'insertBlock') {
                if (text(source.nextID || source.nextId)) payload.nextID = requireID(source.nextID || source.nextId, '后一块 ID');
                if (text(source.previousID || source.previousId)) payload.previousID = requireID(source.previousID || source.previousId, '前一块 ID');
            }
            const endpoint = action === 'insertBlock'
                ? '/api/block/insertBlock'
                : action === 'prependBlock'
                    ? '/api/block/prependBlock'
                    : '/api/block/appendBlock';
            const result = await api(endpoint, payload);
            const id = requestedID || extractInsertedID(result);
            if (!id) throw new DomainError(ERROR.STORAGE_ERROR, '写入块后未返回块 ID');
            return { id };
        }
        if (action === 'createSubtask') {
            const parentTaskID = requireID(source.parentTaskID || source.parentTaskId, '父任务 ID');
            const taskID = requireID(source.taskID || source.taskId, '子任务 ID');
            const listID = requireID(source.listID || source.listId, '子列表 ID');
            let listData = String(source.listData == null ? '' : source.listData).trim();
            let itemData = String(source.itemData == null ? '' : source.itemData).trim();
            if ((source.inheritedDateFields || []).length) {
                const parent = await taskDTO(parentTaskID);
                if (parent.dateMode === 'rollup') {
                    const registry = await getFieldRegistry();
                    for (const fieldID of source.inheritedDateFields) {
                        if (!['startDate', 'completionTime'].includes(fieldID)) continue;
                        const field = registry.byId.get(fieldID);
                        for (const key of [field.attr, ...field.aliases]) {
                            const pattern = new RegExp(`\\s${key}="[^"]*"`, 'g');
                            listData = listData.replace(pattern, '');
                            itemData = itemData.replace(pattern, '');
                        }
                    }
                }
            }
            const requestedPreviousID = text(source.previousTaskID || source.previousTaskId);
            if (requestedPreviousID) requireID(requestedPreviousID, '前一子任务 ID');
            if (!listData || !itemData) throw new DomainError(ERROR.INVALID_ARGUMENT, '子任务 DOM 不能为空');
            if (!listData.includes(`data-node-id="${listID}"`)
                || !listData.includes(`data-node-id="${taskID}"`)
                || !itemData.includes(`data-node-id="${taskID}"`)) {
                throw new DomainError(ERROR.STORAGE_ERROR, '子任务 DOM 与预生成块 ID 不一致');
            }
            const readBlockDOM = async (id) => {
                try {
                    const result = await api('/api/block/getBlockDOM', { id });
                    return String(result?.dom || '').trim();
                } catch (e) {
                    return '';
                }
            };
            const resolveLastChildID = async (id) => {
                try {
                    const children = await api('/api/block/getChildBlocks', { id });
                    const rows = Array.isArray(children) ? children : [];
                    const direct = rows
                        .map((row) => text(row?.id))
                        .filter((childID) => childID && childID !== taskID);
                    if (direct.length) return direct[direct.length - 1];
                } catch (e) {}
                try {
                    const rows = await sql(`SELECT id FROM blocks WHERE parent_id = '${escapeSql(id)}' ORDER BY sort ASC, created ASC, id ASC`);
                    const direct = rows.map((row) => text(row?.id)).filter((childID) => childID && childID !== taskID);
                    return direct.length ? direct[direct.length - 1] : '';
                } catch (e) {}
                return '';
            };
            const taskRows = await sql(`SELECT id, parent_id, type, subtype FROM blocks WHERE id = '${escapeSql(taskID)}' LIMIT 1`);
            if (taskRows.length) {
                const taskRow = taskRows[0];
                const listRows = await sql(`SELECT id, parent_id, type FROM blocks WHERE id = '${escapeSql(listID)}' LIMIT 1`);
                if (listRows.length
                    && text(taskRow.parent_id) === listID
                    && text(listRows[0].parent_id) === parentTaskID
                    && text(listRows[0].type).toLowerCase() === 'l') {
                    return { id: taskID, listID, recovered: true, authoritative: true };
                }
                const listDOM = await readBlockDOM(listID);
                const parentDOM = listDOM ? await readBlockDOM(parentTaskID) : '';
                if (listDOM.includes(`data-node-id="${taskID}"`)
                    && parentDOM.includes(`data-node-id="${listID}"`)) {
                    return { id: taskID, listID, recovered: true, authoritative: true };
                }
                throw new DomainError(ERROR.CONFLICT, '预生成子任务 ID 已被其他块占用');
            }
            const listRows = await sql(`SELECT id, parent_id, type FROM blocks WHERE id = '${escapeSql(listID)}' LIMIT 1`);
            if (listRows.length) {
                if (text(listRows[0].parent_id) !== parentTaskID || text(listRows[0].type).toLowerCase() !== 'l') {
                    throw new DomainError(ERROR.CONFLICT, '预生成子列表 ID 已被其他块占用');
                }
                const previousID = requestedPreviousID || await resolveLastChildID(listID);
                await api('/api/transactions', {
                    reqId: Date.now(),
                    transactions: [{
                        doOperations: [{
                            action: 'insert',
                            id: taskID,
                            parentID: listID,
                            ...(previousID ? { previousID } : {}),
                            data: itemData,
                        }],
                    }],
                });
                return { id: taskID, listID, previousID, authoritative: true };
            }
            // The document transaction is durable before the SQL task index catches
            // up. Inspect the DOM once before retrying an operation after a crash so
            // the same stable IDs recover instead of creating duplicate blocks.
            const existingListDOM = await readBlockDOM(listID);
            if (existingListDOM) {
                const parentDOM = await readBlockDOM(parentTaskID);
                if (!parentDOM.includes(`data-node-id="${listID}"`)) {
                    throw new DomainError(ERROR.CONFLICT, '预生成子列表已存在于其他父任务');
                }
                if (existingListDOM.includes(`data-node-id="${taskID}"`)) {
                    return { id: taskID, listID, recovered: true, authoritative: true };
                }
                const previousID = requestedPreviousID || await resolveLastChildID(listID);
                await api('/api/transactions', {
                    reqId: Date.now(),
                    transactions: [{
                        doOperations: [{
                            action: 'insert',
                            id: taskID,
                            parentID: listID,
                            ...(previousID ? { previousID } : {}),
                            data: itemData,
                        }],
                    }],
                });
                return { id: taskID, listID, previousID, recoveredList: true, authoritative: true };
            }
            const parentPreviousID = await resolveLastChildID(parentTaskID);
            await api('/api/transactions', {
                reqId: Date.now(),
                transactions: [{
                    doOperations: [{
                        action: 'insert',
                        id: listID,
                        parentID: parentTaskID,
                        ...(parentPreviousID ? { previousID: parentPreviousID } : {}),
                        data: listData,
                    }],
                }],
            });
            return { id: taskID, listID, previousID: parentPreviousID, atomic: true, authoritative: true };
        }
        if (action === 'moveBlock') {
            const id = requireID(source.id, '块 ID');
            const payload = { id };
            if (text(source.previousID || source.previousId)) payload.previousID = requireID(source.previousID || source.previousId, '前一块 ID');
            const nextID = text(source.nextID || source.nextId);
            if (!payload.previousID && nextID) {
                requireID(nextID, '后一块 ID');
                const nextRows = await sql(`SELECT id, parent_id FROM blocks WHERE id = '${escapeSql(nextID)}' LIMIT 1`);
                if (!nextRows.length) throw new DomainError(ERROR.NOT_FOUND, '后一块不存在');
                const parentID = text(nextRows[0].parent_id);
                const siblings = await sql(`SELECT id FROM blocks WHERE parent_id = '${escapeSql(parentID)}' ORDER BY sort ASC, created ASC, id ASC`);
                const ordered = siblings.map((item) => text(item.id)).filter((itemID) => itemID && itemID !== id);
                const nextIndex = ordered.indexOf(nextID);
                if (nextIndex < 0) throw new DomainError(ERROR.CONFLICT, '后一块的位置已经变化');
                if (nextIndex > 0) payload.previousID = ordered[nextIndex - 1];
                else payload.parentID = requireID(parentID, '父块 ID');
            } else if (text(source.parentID || source.parentId)) {
                payload.parentID = requireID(source.parentID || source.parentId, '父块 ID');
            }
            if (Object.keys(payload).length === 1) throw new DomainError(ERROR.INVALID_ARGUMENT, '移动块缺少目标位置');
            await api('/api/block/moveBlock', payload);
            return { id };
        }
        if (action === 'deleteBlock') {
            const id = requireID(source.id, '块 ID');
            await api('/api/sqlite/flushTransaction', {});
            const existing = await sql(`SELECT id FROM blocks WHERE id = '${escapeSql(id)}' LIMIT 1`);
            if (!existing.length) return { id, recovered: true };
            await api('/api/block/deleteBlock', { id });
            await api('/api/sqlite/flushTransaction', {});
            return { id };
        }
        if (action === 'updateMarker') {
            const id = requireID(source.id, '任务 ID');
            const marker = String(source.marker == null ? '' : source.marker);
            if (marker.length !== 1) throw new DomainError(ERROR.INVALID_ARGUMENT, '任务状态标记必须是单个字符');
            await ensureTaskListMutationTarget(id);
            await api('/api/block/updateTaskListItemMarker', { id, marker });
            // Confirm against the same block tree that accepted the write. The
            // UI must not perform a second, race-prone kramdown readback.
            await verifyTaskDirect(id, { marker });
            return { id, marker, verified: true };
        }
        if (action === 'batchUpdateMarker') {
            const items = (Array.isArray(source.items) ? source.items : []).slice(0, 200).map((item) => {
                const id = requireID(item && item.id, '任务 ID');
                const marker = String(item?.marker == null ? '' : item.marker);
                if (marker.length !== 1) throw new DomainError(ERROR.INVALID_ARGUMENT, '任务状态标记必须是单个字符');
                return { id, marker };
            });
            if (!items.length) return { items: [] };
            for (const id of uniqueStrings(items.map((item) => item.id))) {
                await ensureTaskListMutationTarget(id);
            }
            await api('/api/block/batchUpdateTaskListItemMarker', { items });
            return { items };
        }
        throw new DomainError(ERROR.INVALID_ARGUMENT, `不支持的 UI 块操作: ${action || '(empty)'}`);
    }

    async function persistUiBlockOperation(input) {
        const source = input && typeof input === 'object' && !Array.isArray(input) ? input : {};
        const laneID = text(
            source.laneID
            || source.laneId
            || source.id
            || source.requestedID
            || source.requestedId
            || source.parentID
            || source.parentId
            || (Array.isArray(source.items) ? source.items[0]?.id : '')
            || (Array.isArray(source.entries) ? source.entries[0]?.id : '')
            || 'global'
        );
        return runTaskLane(`ui-block:${laneID}`, () => persistUiBlockOperationNow(source));
    }

    function taskMutationRefresh(action, taskIDs, documentIDs) {
        const unique = (values) => Array.from(new Set((Array.isArray(values) ? values : [])
            .map((value) => text(value))
            .filter(Boolean)));
        return {
            kind: 'task-mutation',
            action: text(action),
            taskIDs: unique(taskIDs),
            documentIDs: unique(documentIDs),
        };
    }

    function taskSupportsDateRollup(task) {
        const rule = task?.repeatRule;
        return !(rule && rule.enabled !== false && text(rule.type) && rule.type !== 'none');
    }

    async function guardTaskDateAttrWrite(taskID, attrs) {
        const registry = await getFieldRegistry();
        const fields = ['dateMode', 'startDate', 'completionTime'].map(id => registry.byId.get(id));
        if (!fields.some(field => [field.attr, ...field.aliases].some(key => own(attrs, key)))) return;
        let task;
        try { task = await taskDTO(taskID, null, registry); }
        catch (error) { if (error.code === ERROR.NOT_FOUND) return; throw error; }
        const modeKey = [fields[0].attr, ...fields[0].aliases].find(key => own(attrs, key));
        const requestedMode = modeKey ? attrs[modeKey] : undefined;
        if (requestedMode && requestedMode !== 'manual') throw new DomainError(ERROR.INVALID_ARGUMENT, '请通过日期模式命令启用子任务汇总');
        if (task.dateMode === 'rollup' && requestedMode !== 'manual'
            && fields.slice(1).some(field => [field.attr, ...field.aliases].some(key => own(attrs, key)))) {
            throw new DomainError(ERROR.INVALID_ARGUMENT, '日期由子任务汇总，请先切换为手动设置');
        }
    }

    async function readTaskDateTree(documentIDs, registry) {
        const ids = uniqueStrings(documentIDs);
        if (!ids.length) return [];
        const statement = `SELECT task.id, task.root_id AS documentID,
            CASE WHEN parent.type = 'i' AND parent.subtype = 't' THEN parent.id ELSE '' END AS parentTaskID,
            ${taskFieldAttrExpression(registry, 'dateMode', 'task')} AS dateMode,
            ${taskFieldAttrExpression(registry, 'startDate', 'task')} AS startDate,
            ${taskFieldAttrExpression(registry, 'completionTime', 'task')} AS completionTime,
            ${completionAttrExpression(['custom-task-repeat-rule'], 'task')} AS repeatRule
            FROM blocks task
            LEFT JOIN blocks list ON list.id = task.parent_id
            LEFT JOIN blocks parent ON parent.id = list.parent_id
            WHERE task.type = 'i' AND task.subtype = 't'
                AND task.root_id IN (${ids.map(id => `'${escapeSql(id)}'`).join(',')})`;
        const tasks = [];
        const pageSize = 500;
        // SiYuan otherwise applies search.limit, even when scalar subqueries
        // contain LIMIT 1. Always page the outer SELECT in a stable order.
        for (let offset = 0; ; offset += pageSize) {
            const page = await sql(`${statement} ORDER BY task.id LIMIT ${pageSize} OFFSET ${offset}`);
            tasks.push(...page);
            if (page.length < pageSize) return tasks;
        }
    }

    // The persisted task dates are the effective dates in both modes. Compute
    // bottom-up from the complete document, never from a view's filtered tree.
    function calculateTaskDateRollups(rows) {
        const byID = new Map(rows.map(row => {
            let repeatRule = row.repeatRule;
            if (typeof repeatRule === 'string') { try { repeatRule = JSON.parse(repeatRule); } catch (e) {} }
            return [row.id, { ...row, repeatRule }];
        }));
        const children = new Map();
        byID.forEach(task => {
            if (!children.has(task.parentTaskID)) children.set(task.parentTaskID, []);
            children.get(task.parentTaskID).push(task);
        });
        const visited = new Set();
        const visiting = new Set();
        const ordered = [];
        const dateKey = value => isStrictDateKey(text(value).slice(0, 10)) ? text(value).slice(0, 10) : '';
        const visit = task => {
            if (visited.has(task.id)) return task;
            if (visiting.has(task.id)) throw new DomainError(ERROR.CONFLICT, '任务层级存在循环，无法汇总日期');
            visiting.add(task.id);
            if (task.dateMode === 'rollup' && taskSupportsDateRollup(task)) {
                const starts = [], ends = [];
                (children.get(task.id) || []).forEach(child => {
                    if (!taskSupportsDateRollup(child)) return;
                    visit(child);
                    const start = dateKey(child.startDate), end = dateKey(child.completionTime);
                    if (start) starts.push(start);
                    if (end) ends.push(end);
                });
                task.startDate = starts.length ? starts.reduce((a, b) => a < b ? a : b) : '';
                task.completionTime = ends.length ? ends.reduce((a, b) => a > b ? a : b) : '';
                ordered.push(task);
            }
            visiting.delete(task.id);
            visited.add(task.id);
            return task;
        };
        byID.forEach(visit);
        return ordered;
    }

    async function reconcileTaskDateRollups(documentIDs) {
        const ids = uniqueStrings(documentIDs);
        if (!ids.length) return [];
        return runTaskLanes(ids.map(id => `date-rollup:${id}`), async () => {
            const registry = await getFieldRegistry();
            await api('/api/sqlite/flushTransaction', {});
            const mode = registry.byId.get('dateMode');
            const modeKeys = [mode.attr, ...mode.aliases].map(key => `'${escapeSql(key)}'`).join(',');
            const candidates = await sql(`SELECT DISTINCT task.root_id FROM attributes modeAttr
                JOIN blocks task ON task.id = modeAttr.block_id
                WHERE task.type = 'i' AND task.subtype = 't'
                AND modeAttr.name IN (${modeKeys}) AND modeAttr.value = 'rollup'
                AND task.root_id IN (${ids.map(id => `'${escapeSql(id)}'`).join(',')})
                AND ${taskFieldAttrExpression(registry, 'dateMode', 'task')} = 'rollup'
                ORDER BY task.root_id LIMIT ${ids.length}`);
            if (!candidates.length) return [];
            const rows = await readTaskDateTree(candidates.map(row => row.root_id), registry);
            const updates = [];
            for (const derived of calculateTaskDateRollups(rows)) {
                await runTaskLane(derived.id, async () => {
                    let current;
                    try { current = await taskDTO(derived.id, null, registry); }
                    catch (error) { if (error.code === ERROR.NOT_FOUND) return; throw error; }
                    // A queued manual-mode switch or deletion wins over this snapshot.
                    if (current.dateMode !== 'rollup' || !taskSupportsDateRollup(current)) return;
                    const patch = { startDate: derived.startDate, completionTime: derived.completionTime };
                    if (Object.keys(patch).every(key => text(current[key]) === patch[key])) return;
                    const attrs = await buildCanonicalTaskAttrs({ taskID: derived.id }, buildAttrPayload(patch, registry, derived.id), registry);
                    await pushTaskTransaction(await buildTaskAttrWriteOperations({ taskID: derived.id }, attrs));
                    await verifyTaskDirect(derived.id, { attrs });
                    updates.push({ taskID: derived.id, documentID: derived.documentID, patch: { ...patch, dateMode: 'rollup' } });
                });
            }
            return updates;
        });
    }

    async function taskDateMutationDocuments(source) {
        const action = text(source.action || source.kind || source.type);
        if (action === 'patch' && !['dateMode', 'startDate', 'completionTime', 'repeatRule'].some(key => own(source.patch || {}, key))) return [];
        if (!['patch', 'attrs', 'create', 'move', 'batchMove', 'delete', 'blockOperation'].includes(action)) return [];
        const op = source.operation || {};
        const blockIDs = uniqueStrings([source.taskID, source.taskId, ...(source.taskIDs || source.taskIds || []),
            source.parentTaskID, source.parentTaskId, source.targetTaskID, source.targetTaskId,
            source.previousID, source.nextID, op.id, op.parentID, op.parentId, op.parentTaskID, op.taskID,
            op.previousID, op.nextID, ...(op.entries || []).map(entry => entry.id)]);
        const rows = blockIDs.length ? await sql(`SELECT DISTINCT root_id FROM blocks WHERE id IN (${blockIDs.map(id => `'${escapeSql(id)}'`).join(',')}) LIMIT ${blockIDs.length}`) : [];
        return uniqueStrings([...(source.documentIDs || []), source.documentID, source.documentId,
            source.targetDocumentID, source.targetDocumentId, ...rows.map(row => row.root_id)]);
    }

    function taskCommandChangeSet(action, value, input) {
        const source = input && typeof input === 'object' ? input : {};
        const result = value && typeof value === 'object' ? value : {};
        if (action === 'reconcileAttrs') {
            return {
                upsertedTaskIds: uniqueStrings(result.taskIDs || source.taskIDs || source.taskIds),
                deletedTaskIds: [],
                fieldChanges: [],
                placementChanges: [],
                affectedGroupIds: [],
                affectedDocumentIds: [],
            };
        }
        if (action === 'batchMove') {
            const results = Array.isArray(result.results) ? result.results : [];
            const taskIDs = uniqueStrings(result.taskIDs || source.taskIDs || source.taskIds);
            return {
                upsertedTaskIds: taskIDs,
                deletedTaskIds: [],
                fieldChanges: [],
                placementChanges: results.map((item, index) => ({
                    taskID: text(item?.placement?.taskID || item?.placement?.taskId || taskIDs[index]),
                    placement: item?.placement || null,
                    previousPlacement: item?.previousPlacement || null,
                })).filter((item) => item.taskID),
                affectedGroupIds: uniqueStrings([
                    source.parentTaskID,
                    source.parentTaskId,
                    source.targetTaskID,
                    source.targetTaskId,
                    result.parentTaskID,
                    ...results.flatMap((item) => [
                        item?.placement?.parentTaskID,
                        item?.previousPlacement?.parentTaskID,
                    ]),
                ]),
                affectedDocumentIds: uniqueStrings([
                    ...(Array.isArray(result.refresh?.documentIDs) ? result.refresh.documentIDs : []),
                    ...results.flatMap((item) => [
                        item?.placement?.documentID,
                        item?.previousPlacement?.documentID,
                    ]),
                ]),
            };
        }
        const task = result.task && typeof result.task === 'object'
            ? result.task
            : (result.id && result.title ? result : null);
        const taskID = text(
            task?.id
            || result.deletedTaskID
            || result.taskID
            || result.realId
            || source.taskID
            || source.taskId
            || source.requestedTaskID
            || source.requestedTaskId
        );
        const placement = result.placement && typeof result.placement === 'object'
            ? result.placement
            : null;
        const refresh = result.refresh && typeof result.refresh === 'object'
            ? result.refresh
            : {};
        const documentIDs = uniqueStrings([
            ...(Array.isArray(refresh.documentIDs) ? refresh.documentIDs : []),
            task?.documentID,
            placement?.documentID,
            source.documentID,
            source.documentId,
            source.targetDocumentID,
            source.targetDocumentId,
        ]);
        const deleted = action === 'delete'
            ? uniqueStrings([taskID, ...(Array.isArray(result?.deletedTaskIDs) ? result.deletedTaskIDs : [])])
            : [];
        const upserted = action !== 'delete' && taskID ? [taskID] : [];
        const fieldChanges = (action === 'patch' || action === 'attrs') && taskID
            ? [{ taskID, fields: Object.keys(source.patch || source.attrs || {}) }]
            : [];
        const placementChanges = action === 'move' && taskID
            ? [{ taskID, placement: placement || null, previousPlacement: result.previousPlacement || null }]
            : [];
        return {
            upsertedTaskIds: upserted,
            deletedTaskIds: deleted,
            fieldChanges,
            placementChanges,
            affectedGroupIds: uniqueStrings([
                source.parentTaskID,
                source.parentTaskId,
                source.targetTaskID,
                source.targetTaskId,
                placement?.parentTaskID,
                result.previousPlacement?.parentTaskID,
            ]),
            affectedDocumentIds: documentIDs,
        };
    }

    function taskCommandFailureOutcome(error) {
        const code = text(error && error.code) || ERROR.STORAGE_ERROR;
        if (code === ERROR.CONFLICT || code === ERROR.STALE_REVISION) return 'conflict';
        if (code === ERROR.INVALID_ARGUMENT || code === ERROR.NOT_FOUND || code === ERROR.UNSUPPORTED) return 'rejected';
        return 'unknown';
    }

    async function executeTaskCommand(input) {
        const source = input && typeof input === 'object' && !Array.isArray(input) ? input : {};
        const action = text(source.action || source.kind || source.type);
        const commandID = text(source.commandID || source.commandId) || token('taskcmd');
        const laneID = text(source.laneID || source.laneId || source.taskID || source.taskId || source.parentTaskID || source.parentTaskId || commandID);
        const run = async () => {
            const dateDocuments = await taskDateMutationDocuments(source);
            let value;
            if (action === 'patch') {
                const taskID = requireID(source.taskID || source.taskId, '任务 ID');
                value = await applyTaskPatch(taskID, source.patch || {}, {
                    ...(source.options && typeof source.options === 'object' ? source.options : {}),
                    laneID,
                    recordUndo: source.recordUndo !== false,
                });
            } else if (action === 'attrs') {
                const taskID = requireID(source.taskID || source.taskId, '任务 ID');
                value = await persistUiTaskAttrs(taskID, source.attrs || {}, { laneID });
            } else if (action === 'reconcileAttrs') {
                value = await reconcileTaskAttrHosts(source.taskIDs || source.taskIds || []);
            } else if (action === 'reconcileDates') {
                value = { dateRollupUpdates: await reconcileTaskDateRollups(source.documentIDs || []) };
            } else if (action === 'create') {
                value = await createTask({ ...source, laneID });
            } else if (action === 'move') {
                value = await moveTask({ ...source, laneID }, { recordUndo: source.recordUndo !== false });
            } else if (action === 'batchMove') {
                value = await batchMoveTasks({ ...source, laneID });
            } else if (action === 'delete') {
                value = await deleteTaskNow(source.taskID || source.taskId);
            } else if (action === 'blockOperation') {
                value = await persistUiBlockOperation({ ...(source.operation || {}), laneID });
            } else {
                throw new DomainError(ERROR.INVALID_ARGUMENT, `不支持的任务命令: ${action || '(empty)'}`);
            }
            const dateRollupUpdates = action === 'reconcileDates' ? value.dateRollupUpdates : [];
            if (dateDocuments.length) {
                const docs = uniqueStrings([...dateDocuments, ...(value?.refresh?.documentIDs || [])]);
                try { dateRollupUpdates.push(...await reconcileTaskDateRollups(docs)); }
                catch (error) {
                    // The user's command is already committed. Report the derived
                    // write separately; a later authoritative refresh reconciles it.
                    value.dateRollupError = text(error.message) || '父任务日期汇总失败';
                }
            }
            const ownUpdate = dateRollupUpdates.find(update => update.taskID === (value?.task?.id || source.taskID));
            if (ownUpdate && value?.task) Object.assign(value.task, ownUpdate.patch);
            const task = value?.task && typeof value.task === 'object'
                ? value.task
                : ((value && value.id && value.title) ? value : null);
            return {
                commandID,
                action,
                outcome: 'committed',
                task,
                value,
                dateRollupUpdates,
                dateRollupError: value?.dateRollupError || '',
                changeSet: taskCommandChangeSet(action, value, source),
            };
        };
        try {
            // Existing finite command handlers own their task lanes. The gateway
            // is the sole dispatch boundary and must not nest a second lane.
            return await run();
        } catch (error) {
            const failed = failure(error);
            return {
                commandID,
                action,
                outcome: taskCommandFailureOutcome(error),
                task: null,
                value: null,
                changeSet: taskCommandChangeSet(action, null, source),
                error: failed.error,
            };
        }
    }

    async function executeTaskCommandValue(input) {
        const receipt = await executeTaskCommand(input);
        if (receipt.outcome === 'committed') return receipt.value;
        throw new DomainError(
            text(receipt.error?.code) || ERROR.STORAGE_ERROR,
            text(receipt.error?.message) || '任务命令未提交',
            receipt.error?.details || null,
        );
    }

    async function applyTaskPatch(taskID, rawPatch, options) {
        const id = requireID(taskID, '任务 ID');
        const laneID = text(options?.laneID || options?.laneId) || id;
        return runTaskLane(laneID, async () => {
            let row = await getTaskRow(id);
            const normalized = await normalizeTaskPatch(rawPatch, options);
            const patch = normalized.patch;
            if (!Object.keys(patch).length) return taskDTO(row);
            row = await ensureTaskListMutationTarget(id, normalized.registry, row);
            const context = buildAttrContext(row);
            const before = await taskDTO(row);
            const completion = options?.agentWrite === true ? prepareAgentTaskRecurrence(before, patch, normalized.registry) : null;
            if (!Object.keys(patch).length) return { task: before, completion, changes: {}, undoID: '', refresh: taskMutationRefresh('update', [id], [before.documentID]) };
            if (options?.expected && typeof options.expected === 'object') {
                for (const [field, value] of Object.entries(options.expected)) {
                    if (stableJson(before[field] ?? null) !== stableJson(value)) {
                        throw new DomainError(ERROR.CONFLICT, '任务已变化，请刷新后重试', { taskID: id, field });
                    }
                }
            }
            if ((options?.inheritedDateFields || []).length && before.parentTaskID) {
                const parent = await taskDTO(before.parentTaskID);
                if (parent.dateMode === 'rollup') {
                    for (const field of options.inheritedDateFields) {
                        if (field === 'startDate' || field === 'completionTime') delete patch[field];
                    }
                }
            }
            const dateMode = patch.dateMode || before.dateMode;
            if (dateMode === 'rollup') {
                if (!taskSupportsDateRollup({ ...before, ...patch })) throw new DomainError(ERROR.INVALID_ARGUMENT, '循环和打卡任务不支持子任务日期汇总');
                if (own(patch, 'dateMode')) {
                    await api('/api/sqlite/flushTransaction', {});
                    const rows = await readTaskDateTree([before.documentID], normalized.registry);
                    const parent = rows.find(item => item.id === id);
                    if (parent) parent.dateMode = 'rollup';
                    const derived = calculateTaskDateRollups(rows).find(item => item.id === id);
                    if (!derived) throw new DomainError(ERROR.CONFLICT, '无法读取完整子任务日期');
                    patch.startDate = derived.startDate;
                    patch.completionTime = derived.completionTime;
                } else if (own(patch, 'startDate') || own(patch, 'completionTime')) {
                    throw new DomainError(ERROR.INVALID_ARGUMENT, '日期由子任务汇总，请先在日期中心切换为手动设置');
                }
            }
            let taskMarker = null;
            if (own(patch, 'customStatus') && patch.customStatus) {
                const statusOption = normalized.registry.statusById.get(patch.customStatus);
                if (!statusOption) {
                    throw new DomainError(ERROR.INVALID_ARGUMENT, `未配置的任务状态: ${patch.customStatus}`);
                }
                taskMarker = statusOptionMarker(statusOption);
                if (normalized.registry.settings?.legacyWin7CompatMode === true && taskMarker !== 'X') taskMarker = ' ';
                patch.done = isTaskMarkerDone(taskMarker);
                if (!patch.done && !own(patch, 'repeatState') && before.repeatState?.pendingNativeDoneReset) patch.repeatState = { ...before.repeatState, pendingNativeDoneReset: false };
            } else if (own(patch, 'done')) {
                taskMarker = patch.done ? 'X' : ' ';
            }
            if (taskMarker !== null && !own(patch, 'taskCompleteAt')) {
                const previousMarker = TaskStatus.fromMarkdown(before.markdown);
                patch.taskCompleteAt = TaskStatus.isClosed(taskMarker, normalized.registry.settings?.legacyWin7CompatMode === true)
                    ? (previousMarker === taskMarker && before.taskCompleteAt ? before.taskCompleteAt : nowIso())
                    : '';
            }
            const patchAttrs = await appendAttachmentAttrPayload(id, patch, buildAttrPayload(patch, normalized.registry, id));
            if (own(patch, 'reminder')) patchAttrs.bookmark = patch.reminder ? '⏰' : '';
            const attrs = await buildCanonicalTaskAttrs({ taskID: id, ...context }, patchAttrs, normalized.registry);
            const operations = [];
            if (own(patch, 'title') || taskMarker !== null) {
                let dom = await readBlockDOM(id);
                if (own(patch, 'title')) dom = replaceTaskDOMTitle(dom, patch.title);
                if (taskMarker !== null) dom = replaceTaskDOMMarker(dom, taskMarker);
                operations.push({ action: 'update', id, data: dom });
            }
            if (Object.keys(attrs).length) {
                operations.push(...await buildTaskAttrWriteOperations({ taskID: id, ...context }, attrs));
            }
            await pushTaskTransaction(operations);
            await verifyTaskDirect(id, { ...(taskMarker !== null ? { marker: taskMarker } : {}), attrs });
            const after = applyTaskDisplayNames({
                ...before,
                ...patch,
                ...(own(patch, 'reminder') ? { hasReminder: !!patch.reminder } : {}),
                id,
                title: own(patch, 'title') ? patch.title : before.title,
                done: own(patch, 'done') ? !!patch.done : before.done,
                markdown: taskMarker !== null ? before.markdown.replace(/^(.*?\[)[^\]\r\n]?(\])/, (_, prefix, suffix) => prefix + taskMarker + suffix) : before.markdown,
                customFieldValues: own(patch, 'customFieldValues')
                    ? { ...(before.customFieldValues || {}), ...(patch.customFieldValues || {}) }
                    : before.customFieldValues,
                updated: nowIso(),
                attrHostID: context.primaryHostID,
            }, normalized.registry);
            let undoID = '';
            if (!options || options.recordUndo !== false) {
                const inverse = {};
                const expected = {};
                Object.keys(patch).forEach((key) => {
                    if (key === 'taskCompleteAt') return;
                    if (key === 'title') {
                        inverse.title = before.title;
                        expected.title = after.title;
                    } else if (key === 'done') {
                        inverse.done = before.done;
                        expected.done = after.done;
                    } else if (key === 'customFieldValues') {
                        inverse.customFieldValues = {};
                        expected.customFieldValues = {};
                        Object.keys(patch.customFieldValues || {}).forEach((fieldID) => {
                            inverse.customFieldValues[fieldID] = before.customFieldValues?.[fieldID] ?? '';
                            expected.customFieldValues[fieldID] = after.customFieldValues?.[fieldID] ?? '';
                        });
                    } else {
                        inverse[key] = before[key];
                        expected[key] = after[key];
                    }
                });
                state.lastUndo = {
                    id: token('undo'),
                    createdAt: Date.now(),
                    label: `更新任务：${after.title}`,
                    verify: async () => {
                        const current = await taskDTO(id);
                        return Object.keys(expected).every((key) => {
                            if (key === 'reminder') return reminderConfigurationFingerprint(current.reminder) === reminderConfigurationFingerprint(expected.reminder);
                            if (key !== 'customFieldValues') return stableJson(current[key]) === stableJson(expected[key]);
                            return Object.keys(expected.customFieldValues || {}).every((fieldID) => (
                                stableJson(current.customFieldValues?.[fieldID] ?? '') === stableJson(expected.customFieldValues[fieldID])
                            ));
                        });
                    },
                    execute: async () => {
                        const undoPatch = { ...inverse };
                        if (inverse.reminder && typeof inverse.reminder === 'object') {
                            const current = (await taskDTO(id)).reminder || {};
                            undoPatch.reminder = { ...current };
                            for (const key of [...REMINDER_CONTROLLED_KEYS, 'taskCompletionOwner']) {
                                if (own(inverse.reminder, key)) undoPatch.reminder[key] = inverse.reminder[key];
                                else delete undoPatch.reminder[key];
                            }
                        }
                        return executeTaskCommandValue({ action: 'patch', taskID: id, patch: undoPatch, options: { allowSystem: true }, recordUndo: false });
                    },
                };
                rememberUndo(state.lastUndo);
                undoID = state.lastUndo.id;
            }
            return {
                task: after,
                changes: patch,
                ...(completion ? { completion } : {}),
                ...(own(patch, 'repeatRule') || completion ? { repeatSummary: TaskRecurrence.summary(after.repeatRule) } : {}),
                undoID,
                refresh: taskMutationRefresh('update', [id], [after.documentID]),
            };
        });
    }

    function extractInsertedID(data) {
        try {
            return text(data[0].doOperations[0].id);
        } catch (error) {
            return '';
        }
    }

    async function resolveInsertedTaskID(insertedID) {
        const id = requireID(insertedID, '新块 ID');
        const rows = await sql(`
            WITH RECURSIVE tree(id, depth) AS (
                SELECT '${escapeSql(id)}', 0
                UNION ALL
                SELECT b.id, tree.depth + 1 FROM blocks b JOIN tree ON b.parent_id = tree.id WHERE tree.depth < 4
            )
            SELECT b.id FROM blocks b JOIN tree ON tree.id = b.id
            WHERE b.type = 'i' AND b.subtype = 't'
            ORDER BY tree.depth ASC, b.sort ASC, b.created ASC LIMIT 1
        `);
        if (rows.length) return text(rows[0].id);
        throw new DomainError(ERROR.STORAGE_ERROR, '任务已写入但暂未解析到真实任务块', { insertedID: id });
    }

    async function createTask(input) {
        const source = input && typeof input === 'object' ? input : {};
        if (source.options?.agentWrite === true) validateAgentTaskRecurrence(source.patch || {});
        const title = text(source.title || source.content);
        if (!title) throw new DomainError(ERROR.INVALID_ARGUMENT, '任务标题不能为空');
        const parentTaskID = text(source.parentTaskID || source.parentTaskId);
        const documentID = text(source.documentID || source.documentId || source.docID || source.docId);
        const parentID = parentTaskID ? requireID(parentTaskID, '父任务 ID') : requireID(documentID, '文档 ID');
        if (parentTaskID) await getTaskRow(parentTaskID);
        else await requireDocumentBlock(documentID);
        const markdown = `- [${source.patch && source.patch.done ? 'x' : ' '}] ${title}`;
        const result = await api('/api/block/appendBlock', { parentID, data: markdown, dataType: 'markdown' });
        const insertedID = extractInsertedID(result);
        if (!insertedID) throw new DomainError(ERROR.STORAGE_ERROR, '新建任务失败：未返回块 ID');
        const taskID = await resolveInsertedTaskID(insertedID);
        const patch = { ...(source.patch && typeof source.patch === 'object' ? source.patch : {}) };
        delete patch.title;
        let task;
        try {
            if (Object.keys(patch).length) task = (await applyTaskPatch(taskID, patch, { recordUndo: false, agentWrite: source.options?.agentWrite === true })).task;
            else task = await taskDTO(taskID);
        } catch (error) {
            try { await api('/api/block/deleteBlock', { id: insertedID }); }
            catch (rollbackError) { throw new DomainError(ERROR.STORAGE_ERROR, '任务字段写入失败，且新建任务未能清理', { taskID, cause: text(error.message), rollbackError: text(rollbackError.message) }); }
            throw error;
        }
        const createdFingerprint = stableJson((() => {
            const snapshot = { ...task };
            delete snapshot.updated;
            return snapshot;
        })());
        state.lastUndo = {
            id: token('undo'),
            createdAt: Date.now(),
            label: `新建任务：${task.title}`,
            verify: async () => {
                const current = { ...(await taskDTO(taskID)) };
                delete current.updated;
                return stableJson(current) === createdFingerprint;
            },
            execute: async () => {
                return deleteTaskNow(taskID);
            },
        };
        rememberUndo(state.lastUndo);
        return {
            task,
            ...(task.repeatRule?.enabled ? { repeatSummary: TaskRecurrence.summary(task.repeatRule) } : {}),
            insertedBlockID: insertedID,
            undoID: state.lastUndo.id,
            refresh: taskMutationRefresh('create', [taskID], [task.documentID]),
        };
    }

    function normalizeTreeBlock(value) {
        const source = value && typeof value === 'object' ? value : {};
        return {
            ...source,
            id: text(source.id || source.ID),
            type: text(source.type || source.Type).toLowerCase(),
            subtype: text(source.subType || source.subtype || source.SubType).toLowerCase(),
        };
    }

    function isTreeBlockType(block, shortType, nodeType) {
        const type = text(block?.type).toLowerCase();
        return type === shortType || type === nodeType;
    }

    function isTreeDocumentBlock(block) {
        return isTreeBlockType(block, 'd', 'nodedocument');
    }

    function isTreeListBlock(block) {
        return isTreeBlockType(block, 'l', 'nodelist');
    }

    function isTreeTaskBlock(block) {
        return isTreeBlockType(block, 'i', 'nodelistitem') && text(block?.subtype).toLowerCase() === 't';
    }

    async function readBlockTreePath(blockID, label = '块') {
        const id = requireID(blockID, `${label} ID`);
        const raw = await api('/api/block/getBlockBreadcrumb', { id, excludeTypes: [] });
        const path = (Array.isArray(raw) ? raw : []).map(normalizeTreeBlock).filter((item) => item.id);
        const current = path.find((item) => item.id === id) || null;
        if (!current) throw new DomainError(ERROR.NOT_FOUND, `未找到${label}`, { blockID: id });
        const document = path.find(isTreeDocumentBlock) || null;
        return { id, path, current, document };
    }

    async function tryReadBlockTreePath(blockID, label = '块') {
        try {
            return await readBlockTreePath(blockID, label);
        } catch (error) {
            if (error instanceof DomainError && error.code === ERROR.NOT_FOUND) return null;
            throw error;
        }
    }

    async function readTreeChildren(blockID) {
        const id = requireID(blockID, '父块 ID');
        const raw = await api('/api/block/getChildBlocks', { id });
        return (Array.isArray(raw) ? raw : []).map(normalizeTreeBlock).filter((item) => item.id);
    }

    async function inspectTaskListsUnder(ownerID, preferredListID = '', targetTaskID = '') {
        const ownerChildren = await readTreeChildren(ownerID);
        const listBlocks = ownerChildren.filter(isTreeListBlock);
        const preferredID = text(preferredListID);
        const targetID = text(targetTaskID);
        const preferredList = preferredID ? listBlocks.find((list) => list.id === preferredID) : null;
        const preferred = preferredList ? {
            list: preferredList,
            children: await readTreeChildren(preferredList.id),
        } : null;
        if (preferred && (!targetID || preferred.children.some((item) => item.id === targetID))) {
            return { ownerChildren, entries: [preferred], taskList: preferred };
        }
        const entries = preferred ? [preferred] : [];
        for (const list of listBlocks) {
            if (preferred && list.id === preferred.list.id) continue;
            const entry = { list, children: await readTreeChildren(list.id) };
            entries.push(entry);
            const matched = targetID
                ? entry.children.some((item) => item.id === targetID)
                : entry.list.subtype === 't' || entry.children.some(isTreeTaskBlock);
            if (matched) return { ownerChildren, entries, taskList: entry };
        }
        return { ownerChildren, entries, taskList: null };
    }

    function placementFromTaskList(taskID, listID, children, context = {}) {
        const id = requireID(taskID, '任务 ID');
        const taskIDs = (Array.isArray(children) ? children : [])
            .filter(isTreeTaskBlock)
            .map((item) => item.id);
        const index = taskIDs.indexOf(id);
        if (index < 0) {
            throw new DomainError(ERROR.CONFLICT, '任务不在预期列表中', {
                taskID: id,
                listID: text(listID),
                childTaskIDs: taskIDs,
            });
        }
        return {
            taskID: id,
            parentListID: text(listID),
            parentTaskID: text(context.parentTaskID),
            parentType: 'l',
            previousSiblingID: index > 0 ? taskIDs[index - 1] : '',
            nextSiblingID: index + 1 < taskIDs.length ? taskIDs[index + 1] : '',
            firstTaskID: text(taskIDs[0]),
            taskCount: taskIDs.length,
            documentID: text(context.documentID),
        };
    }

    async function readTaskTreeContext(taskID) {
        const id = requireID(taskID, '任务 ID');
        const location = await readBlockTreePath(id, '任务');
        if (!isTreeTaskBlock(location.current)) {
            throw new DomainError(ERROR.INVALID_ARGUMENT, '目标块不是任务', { blockID: id });
        }
        const currentIndex = location.path.findIndex((item) => item.id === id);
        const ancestors = currentIndex >= 0 ? location.path.slice(0, currentIndex) : location.path;
        const parentTasks = ancestors.filter(isTreeTaskBlock);
        return {
            ...location,
            documentID: text(location.document?.id),
            parentTaskID: text(parentTasks[parentTasks.length - 1]?.id),
            ancestorTaskIDs: parentTasks.map((item) => item.id),
        };
    }

    async function readTaskPlacementFromTree(taskID, preferredListID = '') {
        const context = await readTaskTreeContext(taskID);
        const preferredID = text(preferredListID);
        if (preferredID) {
            try {
                const preferredChildren = await readTreeChildren(preferredID);
                if (preferredChildren.some((item) => item.id === context.id && isTreeTaskBlock(item))) {
                    return placementFromTaskList(context.id, preferredID, preferredChildren, context);
                }
            } catch (error) {}
        }
        const currentIndex = context.path.findIndex((item) => item.id === context.id);
        const ownerCandidates = (currentIndex >= 0 ? context.path.slice(0, currentIndex) : context.path)
            .slice()
            .reverse()
            .filter((item, index, items) => item.id && items.findIndex((candidate) => candidate.id === item.id) === index);
        if (!ownerCandidates.length) {
            throw new DomainError(ERROR.CONFLICT, '无法确定任务所在文档', { taskID: context.id });
        }
        const summarizeBlock = (item) => ({
            id: item.id,
            type: item.type,
            subtype: item.subtype,
        });
        const attempts = [];
        for (const owner of ownerCandidates) {
            const inspected = isTreeListBlock(owner)
                ? {
                    ownerChildren: await readTreeChildren(owner.id),
                    entries: [],
                }
                : await inspectTaskListsUnder(owner.id, '', context.id);
            if (isTreeListBlock(owner)) {
                inspected.entries.push({ list: owner, children: inspected.ownerChildren });
            }
            const matches = inspected.entries.filter((entry) => entry.children.some((item) => item.id === context.id));
            attempts.push({
                owner: summarizeBlock(owner),
                ownerChildren: inspected.ownerChildren.map(summarizeBlock),
                candidateLists: inspected.entries.map((entry) => ({
                    list: summarizeBlock(entry.list),
                    children: entry.children.map(summarizeBlock),
                })),
                matchingListIDs: matches.map((entry) => entry.list.id),
            });
            if (matches.length === 1) {
                return placementFromTaskList(context.id, matches[0].list.id, matches[0].children, context);
            }
            if (matches.length > 1) break;
        }
        const diagnostic = {
            taskID: context.id,
            documentID: context.documentID,
            parentTaskID: context.parentTaskID,
            ancestorTaskIDs: context.ancestorTaskIDs,
            preferredListID: preferredID,
            breadcrumb: context.path.map(summarizeBlock),
            ownerCandidates: ownerCandidates.map(summarizeBlock),
            attempts,
            matchingListIDs: attempts.flatMap((attempt) => attempt.matchingListIDs),
        };
        throw new DomainError(ERROR.CONFLICT, '无法确定任务所在列表', diagnostic);
    }

    function comparablePlacement(value) {
        const source = value && typeof value === 'object' ? value : {};
        return {
            parentListID: text(source.parentListID || source.parentListId || source.parentID),
            documentID: text(source.documentID || source.documentId),
            previousSiblingID: text(source.previousSiblingID || source.previousSiblingId || source.previousID),
            nextSiblingID: text(source.nextSiblingID || source.nextSiblingId || source.nextID),
        };
    }

    async function capturePlacement(taskID, rowInput) {
        const source = rowInput && typeof rowInput === 'object' ? rowInput : {};
        const parentType = text(source.parent_type || source.parentType).toLowerCase();
        const preferredListID = text(source.parentListID || source.parentListId)
            || (parentType === 'l' || parentType === 'nodelist' ? text(source.parent_id || source.parentID) : '');
        const placement = await readTaskPlacementFromTree(taskID, preferredListID);
        return {
            ...placement,
            parentID: placement.parentListID,
            previousID: placement.previousSiblingID,
            nextID: placement.nextSiblingID,
        };
    }

    async function firstTaskIDInList(listID) {
        const id = text(listID);
        if (!id) return '';
        try {
            const children = await readTreeChildren(id);
            return text(children.find(isTreeTaskBlock)?.id);
        } catch (error) {
            return '';
        }
    }

    async function reconcileMovedTaskAttrHosts(taskID, before, moved) {
        const placement = moved?.placement && typeof moved.placement === 'object' ? moved.placement : {};
        const oldFirstTaskID = await firstTaskIDInList(before?.parentID);
        const newFirstTaskID = await firstTaskIDInList(placement.parentListID || placement.parentID);
        const taskIDs = uniqueStrings([
            taskID,
            before?.previousID,
            before?.nextID,
            placement.previousSiblingID,
            placement.nextSiblingID,
            placement.firstTaskID,
            oldFirstTaskID,
            newFirstTaskID,
        ]);
        return reconcileTaskAttrHostsNow(taskIDs);
    }

    async function buildMovePlan(taskID, source, currentPlacement = null) {
        const input = source && typeof source === 'object' ? source : {};
        const payload = { id: taskID };
        const preferredListID = text(
            input.targetListID || input.targetListId || input.parentListID || input.parentListId
                || currentPlacement?.parentListID || currentPlacement?.parentListId
        );
        if (text(input.previousID || input.previousId)) {
            const previous = await readBlockTreePath(input.previousID || input.previousId, '前一块');
            if (previous.id === taskID) throw new DomainError(ERROR.INVALID_ARGUMENT, '任务不能相对自身移动');
            if (isTreeDocumentBlock(previous.current)) throw new DomainError(ERROR.INVALID_ARGUMENT, '前一块不能是文档块');
            if (!isTreeTaskBlock(previous.current)) {
                throw new DomainError(ERROR.INVALID_ARGUMENT, '任务项只能直接移动到任务列表内，请使用文档或标题移动方式');
            }
            payload.previousID = previous.id;
            const targetPlacement = await readTaskPlacementFromTree(previous.id, preferredListID);
            return {
                payload,
                targetListID: targetPlacement.parentListID,
                targetContext: {
                    parentTaskID: targetPlacement.parentTaskID,
                    documentID: targetPlacement.documentID,
                },
            };
        }
        if (text(input.nextID || input.nextId)) {
            const nextID = requireID(input.nextID || input.nextId, '后一任务 ID');
            if (nextID === taskID) throw new DomainError(ERROR.INVALID_ARGUMENT, '任务不能相对自身移动');
            const nextPlacement = await readTaskPlacementFromTree(nextID, preferredListID);
            let previousID = text(nextPlacement.previousSiblingID);
            if (previousID === taskID) {
                const liveCurrentPlacement = currentPlacement && typeof currentPlacement === 'object'
                    ? currentPlacement
                    : await readTaskPlacementFromTree(taskID);
                previousID = liveCurrentPlacement.parentListID === nextPlacement.parentListID
                    ? text(liveCurrentPlacement.previousSiblingID)
                    : '';
            }
            if (previousID) payload.previousID = previousID;
            else payload.parentID = nextPlacement.parentListID;
            return {
                payload,
                targetListID: nextPlacement.parentListID,
                targetContext: {
                    parentTaskID: nextPlacement.parentTaskID,
                    documentID: nextPlacement.documentID,
                },
            };
        }
        if (text(input.parentID || input.parentId || input.documentID || input.documentId)) {
            const explicitParentID = text(input.parentID || input.parentId);
            const target = await readBlockTreePath(
                explicitParentID || input.documentID || input.documentId,
                explicitParentID ? '移动目标' : '目标文档',
            );
            if (!isTreeListBlock(target.current)) {
                throw new DomainError(ERROR.INVALID_ARGUMENT, '任务项只能直接移入列表，请使用文档或父任务移动方式');
            }
            if (target.id === taskID) throw new DomainError(ERROR.INVALID_ARGUMENT, '任务不能移动到自身内部');
            payload.parentID = target.id;
            const currentIndex = target.path.findIndex((item) => item.id === target.id);
            const ancestors = currentIndex >= 0 ? target.path.slice(0, currentIndex) : target.path;
            const parentTasks = ancestors.filter(isTreeTaskBlock);
            return {
                payload,
                targetListID: target.id,
                targetContext: {
                    parentTaskID: text(parentTasks[parentTasks.length - 1]?.id),
                    documentID: text(target.document?.id),
                },
            };
        }
        throw new DomainError(ERROR.INVALID_ARGUMENT, '缺少目标位置');
    }

    async function confirmMovePlanPlacement(taskID, plan) {
        const movePlan = plan && typeof plan === 'object' ? plan : {};
        const targetListID = text(movePlan.targetListID);
        const targetContext = movePlan.targetContext && typeof movePlan.targetContext === 'object'
            ? movePlan.targetContext
            : null;
        if (targetListID && targetContext?.documentID) {
            try {
                const children = await readTreeChildren(targetListID);
                if (children.some((item) => item.id === taskID && isTreeTaskBlock(item))) {
                    return placementFromTaskList(taskID, targetListID, children, targetContext);
                }
            } catch (error) {}
        }
        return readTaskPlacementFromTree(taskID, targetListID);
    }

    function normalizeTaskMoveMode(value) {
        const mode = text(value || '');
        if (!mode || mode === 'doc') return 'docTop';
        if (['docTop', 'docBottom', 'document-list', 'independent-document', 'recycle-document', 'heading', 'before', 'after', 'child', 'child-top'].includes(mode)) return mode;
        throw new DomainError(ERROR.INVALID_ARGUMENT, `不支持的任务移动方式: ${mode}`);
    }

    async function resolveTaskMoveCommand(taskID, source) {
        const input = source && typeof source === 'object' ? source : {};
        const rawMode = text(input.mode);
        if (!rawMode) {
            const legacyParentTaskID = text(input.parentTaskID || input.parentTaskId);
            if (legacyParentTaskID) {
                return {
                    mode: text(input.childPosition || input.position).toLowerCase() === 'top' ? 'child-top' : 'child',
                    parentTaskID: requireID(legacyParentTaskID, '父任务 ID'),
                    requestedListID: input.requestedListID || input.requestedListId,
                    childPosition: text(input.childPosition || input.position).toLowerCase() === 'top' ? 'top' : 'bottom',
                };
            }
            if (text(input.previousID || input.previousId || input.nextID || input.nextId || input.parentID || input.parentId || input.documentID || input.documentId)) {
                return { mode: 'direct', moveInput: input };
            }
        }
        const mode = normalizeTaskMoveMode(input.mode);
        if (mode === 'child' || mode === 'child-top') {
            const parentTaskID = requireID(input.parentTaskID || input.parentTaskId || input.targetTaskID || input.targetTaskId, '父任务 ID');
            return {
                mode,
                parentTaskID,
                requestedListID: input.requestedListID || input.requestedListId,
                childPosition: mode === 'child-top' ? 'top' : 'bottom',
            };
        }
        if (mode === 'before' || mode === 'after') {
            const targetTaskID = requireID(input.targetTaskID || input.targetTaskId, '目标任务 ID');
            const targetListID = text(input.targetListID || input.targetListId);
            return {
                mode,
                moveInput: mode === 'before'
                    ? { nextID: targetTaskID, targetListID }
                    : { previousID: targetTaskID, targetListID },
            };
        }
        if (mode === 'heading') {
            const headingID = requireID(input.headingID || input.headingId || input.targetHeadingID || input.targetHeadingId, '标题 ID');
            const heading = await getBlockRole(headingID, '标题块');
            if (heading.type !== 'h') throw new DomainError(ERROR.INVALID_ARGUMENT, '目标块不是标题');
            const documentID = text(input.targetDocumentID || input.targetDocumentId || input.documentID || input.documentId);
            if (documentID && heading.rootID !== documentID) {
                throw new DomainError(ERROR.CONFLICT, '目标标题不属于指定文档');
            }
            return {
                mode,
                headingID,
                requestedListID: input.requestedListID || input.requestedListId,
            };
        }
        if (mode === 'document-list') {
            const documentID = requireID(
                input.targetDocumentID || input.targetDocumentId || input.documentID || input.documentId,
                '目标文档 ID',
            );
            await requireDocumentBlock(documentID);
            return {
                mode,
                documentID,
                sourceListID: text(input.sourceListID || input.sourceListId),
                sourceDocumentID: text(input.sourceDocumentID || input.sourceDocumentId),
                moveInput: input,
            };
        }
        if (mode === 'recycle-document' || mode === 'independent-document') {
            const documentID = requireID(
                input.targetDocumentID || input.targetDocumentId || input.documentID || input.documentId,
                '目标文档 ID',
            );
            await requireDocumentBlock(documentID);
            return { mode, documentID };
        }
        const documentID = requireID(
            input.targetDocumentID || input.targetDocumentId || input.documentID || input.documentId,
            '目标文档 ID',
        );
        await requireDocumentBlock(documentID);
        const targetLists = await inspectTaskListsUnder(
            documentID,
            input.targetListID || input.targetListId,
        );
        const containerID = text(targetLists.taskList?.list?.id);
        if (!containerID) {
            return {
                mode,
                documentID,
                independentDocument: true,
                independentPosition: mode === 'docBottom' ? 'bottom' : 'top',
            };
        }
        const siblingIDs = targetLists.taskList.children
            .filter(isTreeTaskBlock)
            .map((item) => item.id)
            .filter((id) => id !== taskID);
        if (!siblingIDs.length) return { mode, moveInput: { parentID: containerID } };
        return {
            mode,
            moveInput: mode === 'docBottom'
                ? { previousID: siblingIDs[siblingIDs.length - 1] }
                : { nextID: siblingIDs[0] },
        };
    }

    function applyPlacementToTaskDTO(task, placement) {
        const dto = task && typeof task === 'object' ? task : {};
        const target = placement && typeof placement === 'object' ? placement : {};
        dto.parentListID = text(target.parentListID);
        dto.parentTaskID = text(target.parentTaskID);
        dto.parentType = text(target.parentType);
        dto.previousSiblingID = text(target.previousSiblingID);
        dto.nextSiblingID = text(target.nextSiblingID);
        dto.firstTaskID = text(target.firstTaskID);
        dto.documentID = text(target.documentID);
        return dto;
    }

    function nestedTaskListDOM(listID, taskDOM) {
        const id = requireID(listID, '子列表 ID');
        const dom = String(taskDOM || '').trim();
        if (!dom || !dom.includes('data-type="NodeListItem"')) {
            throw new DomainError(ERROR.STORAGE_ERROR, '无法读取待移动任务的标准块 DOM');
        }
        return `<div data-subtype="t" data-node-id="${id}" data-type="NodeList" class="list" updated="${id.slice(0, 14)}">${dom}<div class="protyle-attr" contenteditable="false">&ZeroWidthSpace;</div></div>`;
    }

    async function ensureTaskListContainer(row, registryInput) {
        const source = row && typeof row === 'object' ? row : {};
        if (text(source.parent_type).toLowerCase() !== 'd') return source;
        const documentID = requireID(source.parent_id || source.root_id, '任务所在文档 ID');
        try {
            const liveDocumentChildren = await api('/api/block/getChildBlocks', { id: documentID });
            const liveChildren = Array.isArray(liveDocumentChildren) ? liveDocumentChildren : [];
            const directTask = liveChildren.some((child) => text(child?.id) === text(source.id)
                && text(child?.type).toLowerCase() === 'i'
                && text(child?.subType || child?.subtype).toLowerCase() === 't');
            if (!directTask) {
                for (const child of liveChildren) {
                    const childType = text(child?.type).toLowerCase();
                    if (childType !== 'l' && childType !== 'nodelist') continue;
                    const listChildren = await api('/api/block/getChildBlocks', { id: text(child?.id) });
                    const liveTasks = (Array.isArray(listChildren) ? listChildren : []).filter((item) => (
                        text(item?.type).toLowerCase() === 'i'
                        && text(item?.subType || item?.subtype).toLowerCase() === 't'
                    ));
                    const liveIndex = liveTasks.findIndex((item) => text(item?.id) === text(source.id));
                    if (liveIndex < 0) continue;
                    return {
                        ...source,
                        parent_id: text(child?.id),
                        parent_type: 'l',
                        parent_task_id: '',
                        previous_sibling_id: text(liveTasks[liveIndex - 1]?.id),
                        next_sibling_id: text(liveTasks[liveIndex + 1]?.id),
                        parent_task_count: liveTasks.length,
                        first_task_id: text(liveTasks[0]?.id),
                        __taskHorizonLivePlacement: true,
                    };
                }
            }
        } catch (error) {}
        const childRows = await sql(`
            SELECT id, type, subtype FROM blocks
            WHERE parent_id = '${escapeSql(documentID)}'
            ORDER BY sort ASC, created ASC, id ASC
        `);
        const nakedTaskRows = childRows.filter((child) => (
            text(child.type).toLowerCase() === 'i' && text(child.subtype).toLowerCase() === 't'
        ));
        if (!nakedTaskRows.length) return source;

        const nakedTaskIDs = new Set(nakedTaskRows.map((child) => text(child.id)).filter(Boolean));
        const prepared = new Map();
        for (const taskID of nakedTaskIDs) {
            const taskDOM = await readBlockDOM(taskID);
            prepared.set(taskID, {
                taskDOM,
                listID: newNodeID(),
            });
        }

        const operations = [];
        let previousFinalID = '';
        for (const child of childRows) {
            const childID = text(child.id);
            const entry = prepared.get(childID);
            if (!entry) {
                previousFinalID = childID;
                continue;
            }
            const insertOperation = {
                action: 'insert',
                id: entry.listID,
                parentID: documentID,
                data: nestedTaskListDOM(entry.listID, entry.taskDOM),
            };
            if (previousFinalID) insertOperation.previousID = previousFinalID;
            operations.push({ action: 'delete', id: childID }, insertOperation);
            previousFinalID = entry.listID;
        }
        await pushTaskTransaction(operations);

        for (const [taskID, entry] of prepared) {
            const children = await api('/api/block/getChildBlocks', { id: entry.listID });
            const childIDs = (Array.isArray(children) ? children : [])
                .map((child) => text(child && (child.id || child.ID)))
                .filter(Boolean);
            if (!childIDs.includes(taskID)) {
                throw new DomainError(ERROR.CONFLICT, '顶层任务项修复后未进入任务列表', {
                    taskID,
                    listID: entry.listID,
                    childIDs,
                });
            }
        }

        const repaired = prepared.get(text(source.id));
        if (!repaired) return source;
        return {
            ...source,
            parent_id: repaired.listID,
            parent_type: 'l',
            parent_task_id: '',
            previous_sibling_id: '',
            next_sibling_id: '',
            parent_task_count: 1,
            first_task_id: text(source.id),
            __taskHorizonStructureRepaired: true,
        };
    }

    async function ensureTaskListMutationTarget(taskID, registryInput, rowInput) {
        const id = requireID(taskID, '任务 ID');
        let row = rowInput && typeof rowInput === 'object' ? rowInput : await getTaskRow(id);
        if (text(row.parent_type).toLowerCase() !== 'l') {
            // SQL parent metadata can lag behind the live tree. Verify the
            // existing list before rejecting a date write or repairing a
            // supposedly naked task; neither case should recreate a valid task.
            try {
                const placement = await readTaskPlacementFromTree(id);
                row = {
                    ...row,
                    root_id: placement.documentID || row.root_id,
                    parent_id: placement.parentListID,
                    parent_type: placement.parentType,
                    parent_task_id: placement.parentTaskID,
                    previous_sibling_id: placement.previousSiblingID,
                    next_sibling_id: placement.nextSiblingID,
                    first_task_id: placement.firstTaskID,
                    parent_task_count: placement.taskCount,
                    __taskHorizonLivePlacement: true,
                };
            } catch (error) {}
        }
        row = await ensureTaskListContainer(row, registryInput);
        const parentType = text(row && row.parent_type).toLowerCase();
        if (parentType !== 'l') {
            throw new DomainError(ERROR.CONFLICT, '任务不在合法的列表容器中', {
                taskID: id,
                parentID: text(row && row.parent_id),
                parentType,
            });
        }
        return row;
    }

    async function moveIndependentTaskListToDocument(taskID, documentID, sourceListID, sourceDocumentID, source) {
        const id = requireID(taskID, '任务 ID');
        const targetDocumentID = requireID(documentID, '目标文档 ID');
        await requireDocumentBlock(targetDocumentID);
        const archiveDocumentID = requireID(sourceDocumentID, '归档文档 ID');
        await requireDocumentBlock(archiveDocumentID);
        const archiveChildren = await api('/api/block/getChildBlocks', { id: archiveDocumentID });
        const liveArchiveChildren = Array.isArray(archiveChildren) ? archiveChildren : [];
        const listCandidates = liveArchiveChildren.filter((item) => {
            const type = text(item?.type).toLowerCase();
            return type === 'l' || type === 'nodelist';
        });
        const requestedListID = text(sourceListID);
        if (requestedListID) requireID(requestedListID, '归档任务列表 ID');
        const orderedCandidates = listCandidates.slice().sort((left, right) => {
            if (text(left?.id) === requestedListID) return -1;
            if (text(right?.id) === requestedListID) return 1;
            return 0;
        });
        const matches = [];
        for (const candidate of orderedCandidates) {
            const candidateID = text(candidate?.id);
            if (!candidateID) continue;
            const children = await api('/api/block/getChildBlocks', { id: candidateID });
            const childIDs = (Array.isArray(children) ? children : [])
                .map((item) => text(item?.id))
                .filter(Boolean);
            if (childIDs.includes(id)) matches.push({ id: candidateID, childIDs });
        }
        const directTask = liveArchiveChildren.some((item) => (
            text(item?.id) === id
            && text(item?.type).toLowerCase() === 'i'
            && text(item?.subType || item?.subtype).toLowerCase() === 't'
        ));
        if (matches.length !== 1 && !directTask) {
            throw new DomainError(ERROR.CONFLICT, '无法从归档文档确定任务所在列表', {
                taskID: id,
                archiveDocumentID,
                requestedListID,
                matchedListIDs: matches.map((item) => item.id),
            });
        }
        if (matches.length > 1) {
            throw new DomainError(ERROR.CONFLICT, '任务同时出现在多个归档列表中', {
                taskID: id,
                archiveDocumentID,
                matchedListIDs: matches.map((item) => item.id),
            });
        }
        const sourceMatch = matches[0] || null;
        const sourceList = sourceMatch ? {
            id: sourceMatch.id,
            parentID: archiveDocumentID,
            rootID: archiveDocumentID,
            type: 'l',
            subtype: 't',
        } : null;
        const sourceChildIDs = sourceMatch ? sourceMatch.childIDs.slice() : [id];
        const sourceTaskIndex = sourceChildIDs.indexOf(id);
        const sourcePreviousID = sourceTaskIndex > 0 ? text(sourceChildIDs[sourceTaskIndex - 1]) : '';
        const sourceNextID = sourceTaskIndex >= 0 ? text(sourceChildIDs[sourceTaskIndex + 1]) : '';
        const canMoveSourceList = !!sourceList
            && sourceChildIDs.length === 1
            && sourceChildIDs[0] === id;

        const input = source && typeof source === 'object' ? source : {};
        const previousID = text(input.previousID || input.previousId);
        const nextID = text(input.nextID || input.nextId);
        let expectedPreviousID = '';
        let expectedNextID = '';
        const targetChildren = await api('/api/block/getChildBlocks', { id: targetDocumentID });
        const orderedTargetIDs = (Array.isArray(targetChildren) ? targetChildren : [])
            .map((item) => text(item?.id))
            .filter((blockID) => blockID
                && blockID !== (canMoveSourceList ? sourceList.id : '')
                && blockID !== (directTask ? id : ''));
        if (previousID) {
            if (!orderedTargetIDs.includes(previousID)) {
                throw new DomainError(ERROR.CONFLICT, '默认位置的前一块已经变化', { previousID, targetDocumentID });
            }
            expectedPreviousID = previousID;
        } else if (nextID) {
            const nextIndex = orderedTargetIDs.indexOf(nextID);
            if (nextIndex < 0) throw new DomainError(ERROR.CONFLICT, '默认位置的后一块已经变化', { nextID, targetDocumentID });
            expectedNextID = nextID;
            if (nextIndex > 0) expectedPreviousID = orderedTargetIDs[nextIndex - 1];
        }

        let listID = '';
        if (canMoveSourceList) {
            listID = sourceList.id;
            const movePayload = expectedPreviousID
                ? { id: sourceList.id, previousID: expectedPreviousID }
                : { id: sourceList.id, parentID: targetDocumentID };
            await api('/api/block/moveBlock', movePayload);
        } else {
            const scaffoldResult = await api('/api/block/insertBlock', {
                parentID: targetDocumentID,
                ...(expectedPreviousID ? { previousID: expectedPreviousID } : {}),
                data: '- [ ]',
                dataType: 'markdown',
            });
            listID = requireID(extractInsertedID(scaffoldResult), '恢复任务列表 ID');
            const scaffoldChildren = await api('/api/block/getChildBlocks', { id: listID });
            const scaffoldTaskID = requireID(
                (Array.isArray(scaffoldChildren) ? scaffoldChildren : [])[0]?.id,
                '恢复任务列表占位任务 ID',
            );
            try {
                await api('/api/block/moveBlock', { id, parentID: listID });
                const movedChildren = await api('/api/block/getChildBlocks', { id: listID });
                const movedChildIDs = (Array.isArray(movedChildren) ? movedChildren : [])
                    .map((item) => text(item?.id))
                    .filter(Boolean);
                if (!movedChildIDs.includes(id)) {
                    throw new DomainError(ERROR.CONFLICT, '任务恢复后未进入独立列表', { taskID: id, listID, movedChildIDs });
                }
                await api('/api/block/deleteBlock', { id: scaffoldTaskID });
            } catch (error) {
                try {
                    const children = await api('/api/block/getChildBlocks', { id: listID });
                    const childIDs = (Array.isArray(children) ? children : []).map((item) => text(item?.id)).filter(Boolean);
                    if (!childIDs.includes(id)) await api('/api/block/deleteBlock', { id: listID });
                } catch (e) {}
                throw error;
            }
        }

        await api('/api/sqlite/flushTransaction', {});
        const [documentChildren, verifiedListChildren] = await Promise.all([
            api('/api/block/getChildBlocks', { id: targetDocumentID }),
            api('/api/block/getChildBlocks', { id: listID }),
        ]);
        const documentChildIDs = (Array.isArray(documentChildren) ? documentChildren : [])
            .map((item) => text(item?.id))
            .filter(Boolean);
        const verifiedTaskIDs = (Array.isArray(verifiedListChildren) ? verifiedListChildren : [])
            .map((item) => text(item?.id))
            .filter(Boolean);
        const listIndex = documentChildIDs.indexOf(listID);
        const actualPreviousID = listIndex > 0 ? text(documentChildIDs[listIndex - 1]) : '';
        const actualNextID = listIndex >= 0 ? text(documentChildIDs[listIndex + 1]) : '';
        if (listIndex < 0
            || actualPreviousID !== expectedPreviousID
            || (expectedNextID && actualNextID !== expectedNextID)
            || verifiedTaskIDs.length !== 1
            || verifiedTaskIDs[0] !== id) {
            throw new DomainError(ERROR.CONFLICT, '任务未落盘到默认新建位置', {
                taskID: id,
                listID,
                targetDocumentID,
                expectedPreviousID,
                expectedNextID,
                actualPreviousID,
                actualNextID,
                listChildIDs: verifiedTaskIDs,
            });
        }
        const placement = {
            taskID: id,
            parentListID: listID,
            parentTaskID: '',
            parentType: 'l',
            previousSiblingID: '',
            nextSiblingID: '',
            firstTaskID: id,
            documentID: targetDocumentID,
        };
        return {
            placement,
            listID,
            sourceListID: text(sourceList?.id),
            sourcePreviousID,
            sourceNextID,
            authoritative: true,
        };
    }

    async function moveTaskIntoHeading(taskID, headingID, requestedListID, sourceRow) {
        const id = requireID(taskID, '任务 ID');
        const hid = requireID(headingID, '标题 ID');
        const heading = await getBlockRole(hid, '标题块');
        if (heading.type !== 'h') throw new DomainError(ERROR.INVALID_ARGUMENT, '目标块不是标题');
        const before = sourceRow && typeof sourceRow === 'object' ? sourceRow : await getTaskRow(id);
        const sourceList = before.__taskHorizonStructureRepaired === true
            ? { id: text(before.parent_id), parentID: text(before.root_id), rootID: text(before.root_id), type: 'l', subtype: 't' }
            : await getBlockRole(before.parent_id, '任务列表');
        let sourceListChildren = [];
        let sourceListParent = null;
        try {
            sourceListChildren = await api('/api/block/getChildBlocks', { id: sourceList.id });
            sourceListParent = before.__taskHorizonStructureRepaired === true
                ? { id: text(before.root_id), type: 'd' }
                : await getBlockRole(sourceList.parentID, '任务列表父块');
        } catch (e) {
            sourceListChildren = [];
            sourceListParent = null;
        }
        const sourceChildIDs = (Array.isArray(sourceListChildren) ? sourceListChildren : [])
            .map((item) => text(item?.id))
            .filter(Boolean);
        const canMoveSourceList = sourceList.type === 'l'
            && sourceListParent?.type === 'd'
            && sourceChildIDs.length === 1
            && sourceChildIDs[0] === id;

        let listID = '';
        let scaffoldTaskID = '';
        let movePayload;
        if (canMoveSourceList) {
            listID = sourceList.id;
            movePayload = { id: listID, previousID: hid, parentID: heading.parentID };
            await api('/api/block/moveBlock', movePayload);
        } else {
            const scaffoldResult = await api('/api/block/insertBlock', {
                previousID: hid,
                data: '- [ ]',
                dataType: 'markdown',
            });
            listID = requireID(extractInsertedID(scaffoldResult), '标题任务列表 ID');
            const scaffoldChildren = await api('/api/block/getChildBlocks', { id: listID });
            scaffoldTaskID = requireID((Array.isArray(scaffoldChildren) ? scaffoldChildren : [])[0]?.id, '标题任务列表占位任务 ID');
            movePayload = { id, parentID: listID };
            try {
                await api('/api/block/moveBlock', movePayload);
                const movedChildren = await api('/api/block/getChildBlocks', { id: listID });
                const movedChildIDs = (Array.isArray(movedChildren) ? movedChildren : [])
                    .map((item) => text(item?.id))
                    .filter(Boolean);
                if (!movedChildIDs.includes(id)) {
                    throw new DomainError(ERROR.CONFLICT, '任务移动后未进入独立列表', { taskID: id, listID, movedChildIDs });
                }
                await api('/api/block/deleteBlock', { id: scaffoldTaskID });
            } catch (error) {
                try {
                    const children = await api('/api/block/getChildBlocks', { id: listID });
                    const childIDs = (Array.isArray(children) ? children : []).map((item) => text(item?.id)).filter(Boolean);
                    if (!childIDs.includes(id)) await api('/api/block/deleteBlock', { id: listID });
                } catch (e) {}
                throw error;
            }
        }

        await api('/api/sqlite/flushTransaction', {});
        const [documentChildren, verifiedListChildren] = await Promise.all([
            api('/api/block/getChildBlocks', { id: heading.parentID }),
            api('/api/block/getChildBlocks', { id: listID }),
        ]);
        const documentChildIDs = (Array.isArray(documentChildren) ? documentChildren : [])
            .map((item) => text(item?.id))
            .filter(Boolean);
        const verifiedTaskIDs = (Array.isArray(verifiedListChildren) ? verifiedListChildren : [])
            .map((item) => text(item?.id))
            .filter(Boolean);
        const headingIndex = documentChildIDs.indexOf(hid);
        if (headingIndex < 0 || documentChildIDs[headingIndex + 1] !== listID || !verifiedTaskIDs.includes(id)) {
            throw new DomainError(ERROR.CONFLICT, '任务未落盘到目标标题下', {
                taskID: id,
                headingID: hid,
                listID,
                headingNextID: headingIndex >= 0 ? text(documentChildIDs[headingIndex + 1]) : '',
                listChildIDs: verifiedTaskIDs,
            });
        }
        const placement = {
            taskID: id,
            parentListID: listID,
            parentTaskID: '',
            parentType: 'l',
            previousSiblingID: canMoveSourceList ? text(before.previous_sibling_id) : '',
            nextSiblingID: '',
            firstTaskID: id,
            documentID: heading.rootID,
        };
        return {
            task: applyPlacementToTaskDTO(await taskDTO(before), placement),
            placement,
            listID,
            authoritative: true,
        };
    }

    async function moveTaskIntoIndependentDocument(taskID, documentID, independentPosition, sourceRow) {
        const id = requireID(taskID, '任务 ID');
        const targetDocumentID = requireID(documentID, '目标文档 ID');
        const position = text(independentPosition).toLowerCase() === 'bottom' ? 'bottom' : 'top';
        await requireDocumentBlock(targetDocumentID);
        const before = sourceRow && typeof sourceRow === 'object' ? sourceRow : await getTaskRow(id);
        const sourceList = before.__taskHorizonStructureRepaired === true
            ? { id: text(before.parent_id), parentID: text(before.root_id), rootID: text(before.root_id), type: 'l', subtype: 't' }
            : await getBlockRole(before.parent_id, '任务列表');
        let sourceListChildren = [];
        let sourceListParent = null;
        try {
            sourceListChildren = await api('/api/block/getChildBlocks', { id: sourceList.id });
            sourceListParent = before.__taskHorizonStructureRepaired === true
                ? { id: text(before.root_id), type: 'd' }
                : await getBlockRole(sourceList.parentID, '任务列表父块');
        } catch (e) {
            sourceListChildren = [];
            sourceListParent = null;
        }
        const sourceChildIDs = (Array.isArray(sourceListChildren) ? sourceListChildren : [])
            .map((item) => text(item?.id))
            .filter(Boolean);
        const canMoveSourceList = sourceList.type === 'l'
            && sourceListParent?.type === 'd'
            && sourceChildIDs.length === 1
            && sourceChildIDs[0] === id;
        const targetChildrenBefore = await api('/api/block/getChildBlocks', { id: targetDocumentID });
        const targetChildIDsBefore = (Array.isArray(targetChildrenBefore) ? targetChildrenBefore : [])
            .map((item) => text(item?.id))
            .filter((childID) => childID && childID !== sourceList.id);
        const targetLastChildID = text(targetChildIDsBefore[targetChildIDsBefore.length - 1]);

        let listID = '';
        let scaffoldTaskID = '';
        if (canMoveSourceList) {
            listID = sourceList.id;
            const payload = position === 'bottom' && targetLastChildID
                ? { id: listID, previousID: targetLastChildID }
                : { id: listID, parentID: targetDocumentID };
            await api('/api/block/moveBlock', payload);
        } else {
            const endpoint = position === 'bottom' ? '/api/block/appendBlock' : '/api/block/insertBlock';
            const scaffoldResult = await api(endpoint, {
                parentID: targetDocumentID,
                data: '- [ ]',
                dataType: 'markdown',
            });
            listID = requireID(extractInsertedID(scaffoldResult), '目标任务列表 ID');
            const scaffoldChildren = await api('/api/block/getChildBlocks', { id: listID });
            scaffoldTaskID = requireID((Array.isArray(scaffoldChildren) ? scaffoldChildren : [])[0]?.id, '列表占位任务 ID');
            try {
                await api('/api/block/moveBlock', { id, parentID: listID });
                const movedChildren = await api('/api/block/getChildBlocks', { id: listID });
                const movedChildIDs = (Array.isArray(movedChildren) ? movedChildren : [])
                    .map((item) => text(item?.id))
                    .filter(Boolean);
                if (!movedChildIDs.includes(id)) {
                    throw new DomainError(ERROR.CONFLICT, '任务移动后未进入目标独立列表', { taskID: id, listID, movedChildIDs });
                }
                await api('/api/block/deleteBlock', { id: scaffoldTaskID });
            } catch (error) {
                try {
                    const children = await api('/api/block/getChildBlocks', { id: listID });
                    const childIDs = (Array.isArray(children) ? children : []).map((item) => text(item?.id)).filter(Boolean);
                    if (!childIDs.includes(id)) await api('/api/block/deleteBlock', { id: listID });
                } catch (e) {}
                throw error;
            }
        }

        await api('/api/sqlite/flushTransaction', {});
        const [documentChildren, verifiedListChildren] = await Promise.all([
            api('/api/block/getChildBlocks', { id: targetDocumentID }),
            api('/api/block/getChildBlocks', { id: listID }),
        ]);
        const documentChildIDs = (Array.isArray(documentChildren) ? documentChildren : [])
            .map((item) => text(item?.id))
            .filter(Boolean);
        const verifiedTaskIDs = (Array.isArray(verifiedListChildren) ? verifiedListChildren : [])
            .map((item) => text(item?.id))
            .filter(Boolean);
        const expectedDocumentListID = position === 'bottom'
            ? text(documentChildIDs[documentChildIDs.length - 1])
            : text(documentChildIDs[0]);
        if (expectedDocumentListID !== listID || verifiedTaskIDs.length !== 1 || verifiedTaskIDs[0] !== id) {
            throw new DomainError(ERROR.CONFLICT, '任务未落盘到目标文档的独立列表', {
                taskID: id,
                listID,
                targetDocumentID,
                position,
                actualDocumentEdgeID: expectedDocumentListID,
                listChildIDs: verifiedTaskIDs,
            });
        }
        const placement = {
            taskID: id,
            parentListID: listID,
            parentTaskID: '',
            parentType: 'l',
            previousSiblingID: '',
            nextSiblingID: '',
            firstTaskID: id,
            documentID: targetDocumentID,
        };
        return {
            task: applyPlacementToTaskDTO(await taskDTO(before), placement),
            placement,
            listID,
            authoritative: true,
        };
    }

    async function moveTaskIntoParent(taskID, parentTaskID, requestedListID, childPosition, sourceRow) {
        const id = requireID(taskID, '任务 ID');
        const parentID = requireID(parentTaskID, '父任务 ID');
        const position = text(childPosition).toLowerCase() === 'top' ? 'top' : 'bottom';
        if (id === parentID) throw new DomainError(ERROR.INVALID_ARGUMENT, '任务不能移动到自身内部');

        const before = sourceRow && typeof sourceRow === 'object' ? sourceRow : await getTaskRow(id);
        const parentContext = await readTaskTreeContext(parentID);
        if (parentContext.ancestorTaskIDs.includes(id)) {
            throw new DomainError(ERROR.INVALID_ARGUMENT, '父任务不能移动到自己的子任务中');
        }
        const targetLists = await inspectTaskListsUnder(parentID, requestedListID);
        if (targetLists.taskList) {
            const listID = requireID(targetLists.taskList.list.id, '子列表 ID');
            const liveChildren = targetLists.taskList.children;
            const liveTaskIDs = liveChildren.filter(isTreeTaskBlock).map((item) => item.id);
            const currentIndex = liveTaskIDs.indexOf(id);
            const alreadyAtEdge = currentIndex >= 0
                && (position === 'top' ? currentIndex === 0 : currentIndex === liveTaskIDs.length - 1);
            if (alreadyAtEdge) {
                const placement = placementFromTaskList(id, listID, liveChildren, {
                    parentTaskID: parentID,
                    documentID: parentContext.documentID,
                });
                return {
                    changed: false,
                    reason: 'already-there',
                    task: applyPlacementToTaskDTO(await taskDTO(before), placement),
                    placement,
                    listID,
                    recovered: true,
                };
            }
            const siblingIDs = liveTaskIDs.filter((taskIDValue) => taskIDValue !== id);
            const firstSiblingID = text(siblingIDs[0]);
            const lastSiblingID = text(siblingIDs[siblingIDs.length - 1]);
            const movePayload = position === 'bottom' && lastSiblingID
                ? { id, previousID: lastSiblingID }
                : { id, parentID: listID };
            await api('/api/block/moveBlock', movePayload);
            const placement = placementFromTaskList(id, listID, await readTreeChildren(listID), {
                parentTaskID: parentID,
                documentID: parentContext.documentID,
            });
            return {
                task: applyPlacementToTaskDTO(await taskDTO(before), placement),
                placement,
                listID,
                authoritative: true,
            };
        }

        const listID = requireID(requestedListID, '预生成子列表 ID');
        const duplicateList = await tryReadBlockTreePath(listID, '预生成子列表');
        if (duplicateList) {
            throw new DomainError(ERROR.CONFLICT, '预生成子列表 ID 已被其他块占用');
        }
        const domResult = await api('/api/block/getBlockDOM', { id });
        const taskDOM = String(domResult && domResult.dom || '').trim();
        if (!taskDOM.includes(`data-node-id="${id}"`)) {
            throw new DomainError(ERROR.STORAGE_ERROR, '读取到的任务块 DOM 与任务 ID 不一致');
        }
        const targetLastChildID = text(targetLists.ownerChildren
            .filter((item) => item.id !== id)
            .slice(-1)[0]?.id);
        const insertOperation = {
            action: 'insert',
            id: listID,
            parentID,
            data: nestedTaskListDOM(listID, taskDOM),
        };
        if (targetLastChildID) insertOperation.previousID = targetLastChildID;
        await api('/api/transactions', {
            reqId: Date.now(),
            transactions: [{
                doOperations: [{ action: 'delete', id }, insertOperation],
            }],
        });
        const placement = placementFromTaskList(id, listID, await readTreeChildren(listID), {
            parentTaskID: parentID,
            documentID: parentContext.documentID,
        });
        return {
            task: applyPlacementToTaskDTO(await taskDTO(before), placement),
            placement,
            listID,
            atomic: true,
            authoritative: true,
        };
    }

    async function verifyBatchChildMove(listID, taskIDs) {
        const children = await api('/api/block/getChildBlocks', { id: listID });
        const childIDs = (Array.isArray(children) ? children : [])
            .map((item) => text(item && (item.id || item.ID)))
            .filter(Boolean);
        const selected = new Set(taskIDs);
        const actualOrder = childIDs.filter((id) => selected.has(id));
        if (actualOrder.length !== taskIDs.length || actualOrder.some((id, index) => id !== taskIDs[index])) {
            throw new DomainError(ERROR.CONFLICT, '批量移动后的位置校验失败', {
                listID,
                expectedTaskIDs: taskIDs,
                actualTaskIDs: actualOrder,
            });
        }
        return childIDs;
    }

    async function batchMoveTasksIntoParent(taskIDs, parentTaskID, requestedListID, childPosition) {
        const ids = uniqueStrings(taskIDs).map((id) => requireID(id, '任务 ID'));
        const parentID = requireID(parentTaskID, '父任务 ID');
        const position = text(childPosition).toLowerCase() === 'top' ? 'top' : 'bottom';
        if (ids.length < 2) throw new DomainError(ERROR.INVALID_ARGUMENT, '批量移动至少需要两个任务');
        if (ids.includes(parentID)) throw new DomainError(ERROR.INVALID_ARGUMENT, '任务不能移动到自身内部');

        const [rows, parentContext, registry] = await Promise.all([
            Promise.all(ids.map((id) => getTaskRow(id))),
            readTaskTreeContext(parentID),
            getFieldRegistry(),
        ]);
        const previousPlacements = await Promise.all(ids.map((id, index) => capturePlacement(id, rows[index])));
        if (ids.some((id) => parentContext.ancestorTaskIDs.includes(id))) {
            throw new DomainError(ERROR.INVALID_ARGUMENT, '父任务不能移动到自己的子任务中');
        }

        const attrOperations = (await Promise.all(rows.map((row) => buildTaskAttrPreservationOperation(row, registry)))).filter(Boolean);
        const requestedID = text(requestedListID);
        const targetLists = await inspectTaskListsUnder(parentID, requestedID);
        let listID = text(targetLists.taskList?.list?.id);
        if (!listID && requestedID) {
            requireID(requestedID, '预生成子列表 ID');
            const duplicateList = await tryReadBlockTreePath(requestedID, '预生成子列表');
            if (duplicateList) {
                throw new DomainError(ERROR.CONFLICT, '预生成子列表 ID 已被其他块占用');
            }
        }
        let transactionCount = 0;

        if (listID) {
            const siblingIDs = targetLists.taskList.children
                .filter(isTreeTaskBlock)
                .map((item) => item.id)
                .filter((id) => !ids.includes(id));
            const anchorID = position === 'bottom' ? text(siblingIDs[siblingIDs.length - 1]) : '';
            const moveOperations = ids.slice().reverse().map((id) => (
                anchorID
                    ? { action: 'move', id, previousID: anchorID }
                    : { action: 'move', id, parentID: listID }
            ));
            await pushTaskTransaction([...attrOperations, ...moveOperations]);
            transactionCount = 1;
        } else {
            listID = requireID(requestedID, '预生成子列表 ID');
            const seedID = position === 'top' ? ids[ids.length - 1] : ids[0];
            const seedAttr = attrOperations.find((operation) => text(operation.id) === seedID);
            const taskDOM = await readBlockDOM(seedID);
            const targetLastChildID = text(targetLists.ownerChildren
                .filter((item) => !ids.includes(item.id))
                .slice(-1)[0]?.id);
            const insertOperation = {
                action: 'insert',
                id: listID,
                parentID,
                data: nestedTaskListDOM(listID, taskDOM),
            };
            if (targetLastChildID) insertOperation.previousID = targetLastChildID;
            const remainingIDs = ids.filter((id) => id !== seedID);
            const remainingAttrs = attrOperations.filter((operation) => text(operation.id) !== seedID);
            const moveOperations = remainingIDs.slice().reverse().map((id) => (
                position === 'bottom'
                    ? { action: 'move', id, previousID: seedID }
                    : { action: 'move', id, parentID: listID }
            ));
            await pushTaskTransaction([
                { action: 'delete', id: seedID },
                insertOperation,
                ...(seedAttr ? [seedAttr] : []),
                ...remainingAttrs,
                ...moveOperations,
            ]);
            transactionCount = 1;
        }

        const childIDs = await verifyBatchChildMove(listID, ids);
        const firstTaskID = text(childIDs[0]);
        const results = await Promise.all(rows.map(async (row, rowIndex) => {
            const id = text(row.id);
            const index = childIDs.indexOf(id);
            const placement = {
                taskID: id,
                parentListID: listID,
                parentTaskID: parentID,
                parentType: 'l',
                previousSiblingID: index > 0 ? text(childIDs[index - 1]) : '',
                nextSiblingID: index >= 0 && index + 1 < childIDs.length ? text(childIDs[index + 1]) : '',
                firstTaskID,
                documentID: parentContext.documentID,
            };
            return {
                task: applyPlacementToTaskDTO(await taskDTO(row, undefined, registry), placement),
                placement,
                previousPlacement: previousPlacements[rowIndex],
                authoritative: true,
            };
        }));
        return {
            results,
            taskIDs: ids,
            listID,
            parentTaskID: parentID,
            transactionCount,
            authoritative: true,
            refresh: taskMutationRefresh('move', ids, [
                ...previousPlacements.map((placement) => text(placement.documentID)),
                parentContext.documentID,
            ]),
        };
    }

    async function batchMoveTasks(input) {
        const source = input && typeof input === 'object' ? input : {};
        const taskIDs = uniqueStrings([
            ...(Array.isArray(source.taskIDs) ? source.taskIDs : []),
            ...(Array.isArray(source.taskIds) ? source.taskIds : []),
        ]);
        const parentTaskID = requireID(source.parentTaskID || source.parentTaskId || source.targetTaskID || source.targetTaskId, '父任务 ID');
        const position = text(source.childPosition || source.position).toLowerCase() === 'top'
            || text(source.mode).toLowerCase() === 'child-top'
            ? 'top'
            : 'bottom';
        return runTaskLanes([...taskIDs, parentTaskID], () => batchMoveTasksIntoParent(
            taskIDs,
            parentTaskID,
            source.requestedListID || source.requestedListId,
            position,
        ));
    }

    async function moveTask(input, options) {
        const source = input && typeof input === 'object' ? input : {};
        const taskID = requireID(source.taskID || source.taskId, '任务 ID');
        const laneID = text(source.laneID || source.laneId) || taskID;
        const targetLaneIDs = uniqueStrings([
            laneID,
            source.parentTaskID,
            source.parentTaskId,
            source.targetTaskID,
            source.targetTaskId,
            source.previousID,
            source.previousId,
            source.nextID,
            source.nextId,
            source.parentID,
            source.parentId,
            source.targetListID,
            source.targetListId,
            source.targetDocumentID,
            source.targetDocumentId,
            source.documentID,
            source.documentId,
            source.headingID,
            source.headingId,
        ]);
        return runTaskLanes(targetLaneIDs, async () => {
            if (normalizeTaskMoveMode(source.mode) === 'document-list') {
                const command = await resolveTaskMoveCommand(taskID, source);
                const moved = await moveIndependentTaskListToDocument(
                    taskID,
                    command.documentID,
                    command.sourceListID,
                    command.sourceDocumentID,
                    command.moveInput,
                );
                const previousPlacement = {
                    parentID: text(moved.sourceListID || command.sourceListID),
                    documentID: text(command.sourceDocumentID),
                    previousID: text(moved.sourcePreviousID),
                    nextID: text(moved.sourceNextID),
                };
                await reconcileMovedTaskAttrHosts(taskID, previousPlacement, moved);
                return {
                    ...moved,
                    changed: moved.changed !== false,
                    previousPlacement,
                    undoID: '',
                    refresh: taskMutationRefresh('move', [taskID], [command.sourceDocumentID, command.documentID]),
                };
            }
            let preparedTaskRow = await getTaskRow(taskID);
            preparedTaskRow = await ensureTaskListContainer(preparedTaskRow);
            const useAuthoritativePlacement = source.authoritative === true
                || preparedTaskRow.__taskHorizonStructureRepaired === true;
            const before = await capturePlacement(taskID, preparedTaskRow);
            const beforeTask = useAuthoritativePlacement ? preparedTaskRow : null;
            if (beforeTask) await preserveTaskAttrsOnOwnBlockBeforeMove(beforeTask);
            const command = await resolveTaskMoveCommand(taskID, source);
            const parentTaskID = text(command.parentTaskID);
            let moved;
            if (command.mode === 'heading') {
                moved = await moveTaskIntoHeading(
                    taskID,
                    command.headingID,
                    command.requestedListID,
                    preparedTaskRow,
                );
            } else if (command.mode === 'recycle-document' || command.mode === 'independent-document') {
                moved = await moveTaskIntoIndependentDocument(taskID, command.documentID, 'top', preparedTaskRow);
            } else if (command.independentDocument === true) {
                moved = await moveTaskIntoIndependentDocument(
                    taskID,
                    command.documentID,
                    command.independentPosition,
                    preparedTaskRow,
                );
            } else if (parentTaskID) {
                moved = await moveTaskIntoParent(
                    taskID,
                    parentTaskID,
                    command.requestedListID,
                    command.childPosition,
                    preparedTaskRow,
                );
            } else {
                const movePlan = await buildMovePlan(taskID, command.moveInput, before);
                await api('/api/block/moveBlock', movePlan.payload);
                const placement = await confirmMovePlanPlacement(taskID, movePlan);
                moved = {
                    task: applyPlacementToTaskDTO(await taskDTO(beforeTask || preparedTaskRow), placement),
                    placement,
                    authoritative: true,
                };
            }
            await reconcileMovedTaskAttrHosts(taskID, before, moved);
            const confirmedPlacement = moved?.placement || await readTaskPlacementFromTree(taskID);
            moved.placement = confirmedPlacement;
            moved.task = applyPlacementToTaskDTO(await taskDTO(taskID), confirmedPlacement);
            const task = moved.task;
            const expectedPlacement = confirmedPlacement;
            const placementChanged = stableJson(comparablePlacement(before)) !== stableJson(comparablePlacement(confirmedPlacement));
            let undoID = '';
            if (source.recordUndo !== false && (!options || options.recordUndo !== false) && moved.atomic !== true) {
                state.lastUndo = {
                    id: token('undo'),
                    createdAt: Date.now(),
                    label: `移动任务：${task.title}`,
                    verify: async () => stableJson(comparablePlacement(await capturePlacement(taskID, expectedPlacement))) === stableJson(comparablePlacement(expectedPlacement)),
                    execute: async () => {
                        const restorePlan = await buildMovePlan(taskID, before, expectedPlacement);
                        await api('/api/block/moveBlock', restorePlan.payload);
                        const restoredPlacement = await confirmMovePlanPlacement(taskID, restorePlan);
                        const restoredTask = applyPlacementToTaskDTO(await taskDTO(taskID), restoredPlacement);
                        const dateRollupUpdates = await reconcileTaskDateRollups([task.documentID, restoredTask.documentID]);
                        return {
                            task: restoredTask,
                            dateRollupUpdates,
                            refresh: taskMutationRefresh('move', [taskID], [task.documentID, restoredTask.documentID]),
                        };
                    },
                };
                rememberUndo(state.lastUndo);
                undoID = state.lastUndo.id;
            }
            return {
                ...moved,
                changed: moved.changed !== false && placementChanged,
                ...(placementChanged ? {} : { reason: moved.reason || 'already-there' }),
                task,
                previousPlacement: before,
                undoID,
                refresh: taskMutationRefresh('move', [taskID], [before.documentID, task.documentID]),
            };
        });
    }

    function isScheduleLinkedToTaskOrVirtualSource(item, taskID) {
        const id = text(taskID);
        if (!id) return false;
        const linkedTaskID = text(item && (item.taskId || item.task_id || item.linkedTaskId));
        const virtualMatch = linkedTaskID.match(VIRTUAL_TASK_ID_RE);
        const sourceTaskID = text(item && (item.sourceTaskId || item.sourceTaskID)) || text(virtualMatch && virtualMatch[1]);
        return linkedTaskID === id || sourceTaskID === id;
    }

    async function collectTaskSubtreeIDs(taskID) {
        const id = requireID(taskID, '任务 ID');
        const rows = await sql(`
            WITH RECURSIVE task_tree(id, depth) AS (
                SELECT id, 0 FROM blocks WHERE id = '${escapeSql(id)}'
                UNION ALL
                SELECT b.id, task_tree.depth + 1
                FROM blocks b JOIN task_tree ON b.parent_id = task_tree.id
                WHERE task_tree.depth < 128
            )
            SELECT b.id FROM blocks b JOIN task_tree ON task_tree.id = b.id
            WHERE b.type = 'i' AND b.subtype = 't'
            ORDER BY task_tree.depth ASC, b.sort ASC, b.created ASC, b.id ASC
        `);
        return uniqueStrings([id, ...rows.map((item) => item && item.id)]);
    }

    async function deleteTaskNow(taskID) {
        const id = requireID(taskID, '任务 ID');
        const row = await getTaskRow(id);
        const cleanupWarnings = [];
        let deletedTaskIDs = [id];
        try {
            deletedTaskIDs = await collectTaskSubtreeIDs(id);
        } catch (error) {
            cleanupWarnings.push({
                step: 'collect-task-subtree',
                message: text(error && error.message) || '无法收集任务子树',
            });
        }
        await api('/api/sqlite/flushTransaction', {});
        await api('/api/block/deleteBlock', { id });
        await api('/api/sqlite/flushTransaction', {});
        try {
            await runScheduleLane(async () => {
                const schedules = await loadSchedules({ allowMissing: true, fresh: true });
                const next = schedules.filter((item) => (
                    !deletedTaskIDs.some((deletedID) => isScheduleLinkedToTaskOrVirtualSource(item, deletedID))
                ));
                if (next.length !== schedules.length) await saveSchedules(next);
            });
        } catch (error) {
            cleanupWarnings.push({
                step: 'delete-task-schedules',
                message: text(error && error.message) || '清除任务日程失败',
            });
        }
        return {
            deletedTaskID: id,
            deletedTaskIDs,
            cleanupWarnings,
            refresh: taskMutationRefresh('delete', deletedTaskIDs, [row.root_id]),
        };
    }

    function pruneTokens(map) {
        const now = Date.now();
        for (const [key, item] of map.entries()) {
            if (!item || Number(item.expiresAt) <= now) map.delete(key);
        }
    }

    function normalizeRegisteredScopeIDs(values, label) {
        if (!Array.isArray(values)) throw new DomainError(ERROR.INVALID_ARGUMENT, `${label}必须是数组`);
        const ids = uniqueStrings(values);
        const invalid = ids.find((id) => !ID_RE.test(id));
        if (invalid) throw new DomainError(ERROR.INVALID_ARGUMENT, `${label}包含无效 ID`, { id: invalid });
        return ids;
    }

    function cloneScopeValue(value, fallback) {
        try {
            const cloned = JSON.parse(JSON.stringify(value));
            return cloned === undefined ? fallback : cloned;
        } catch (error) {
            return fallback;
        }
    }

    function normalizeRegisteredVirtualTasks(values) {
        if (values == null) return [];
        if (!Array.isArray(values)) throw new DomainError(ERROR.INVALID_ARGUMENT, '循环虚拟任务范围必须是数组');
        const seen = new Set();
        return values.map((item) => {
            const source = item && typeof item === 'object' && !Array.isArray(item) ? item : {};
            const id = text(source.id);
            const match = id.match(VIRTUAL_TASK_ID_RE);
            if (!match) throw new DomainError(ERROR.INVALID_ARGUMENT, '循环虚拟任务包含无效 ID', { id });
            if (seen.has(id)) return null;
            seen.add(id);
            const sourceTaskID = text(source.sourceTaskID || source.sourceTaskId || match[1]);
            if (sourceTaskID !== match[1]) throw new DomainError(ERROR.INVALID_ARGUMENT, '循环虚拟任务来源不匹配', { id, sourceTaskID });
            const documentID = text(source.documentID || source.documentId);
            if (documentID && !ID_RE.test(documentID)) throw new DomainError(ERROR.INVALID_ARGUMENT, '循环虚拟任务文档 ID 无效', { id, documentID });
            const dto = {
                id,
                virtualTask: true,
                virtualType: 'recurring-history',
                readOnly: true,
                sourceTaskID,
                title: text(source.title) || '(无内容)',
                markdown: String(source.markdown || ''),
                done: true,
                parentListID: '',
                parentTaskID: '',
                documentID,
                documentName: text(source.documentName),
                documentPath: text(source.documentPath),
                created: text(source.created),
                updated: text(source.updated),
                attrHostID: '',
                attrHostState: 'virtual-read-only',
                priority: text(source.priority),
                priorityScore: Number.isFinite(Number(source.priorityScore)) ? Number(source.priorityScore) : null,
                customStatus: text(source.customStatus),
                startDate: text(source.startDate),
                completionTime: text(source.completionTime),
                taskCompleteAt: text(source.taskCompleteAt),
                duration: text(source.duration),
                remark: text(source.remark),
                taskDateColor: text(source.taskDateColor),
                customTime: text(source.customTime),
                milestone: source.milestone === true,
                pinned: source.pinned === true,
                allDayBottom: source.allDayBottom === true,
                tomatoEstimateCount: Number.isFinite(Number(source.tomatoEstimateCount)) ? Number(source.tomatoEstimateCount) : null,
                tomatoCount: Number.isFinite(Number(source.tomatoCount)) ? Number(source.tomatoCount) : null,
                tomatoMinutes: Number.isFinite(Number(source.tomatoMinutes)) ? Number(source.tomatoMinutes) : null,
                tomatoHours: Number.isFinite(Number(source.tomatoHours)) ? Number(source.tomatoHours) : null,
                attachments: Array.isArray(source.attachments) ? cloneScopeValue(source.attachments, []) : [],
                attachmentCount: Math.max(0, Number(source.attachmentCount) || (Array.isArray(source.attachments) ? source.attachments.length : 0)),
                reminder: cloneScopeValue(source.reminder, null),
                hasReminder: source.hasReminder === true || source.reminder != null,
                repeatRule: cloneScopeValue(source.repeatRule, null),
                repeatState: cloneScopeValue(source.repeatState, null),
                customFieldValues: source.customFieldValues && typeof source.customFieldValues === 'object' && !Array.isArray(source.customFieldValues)
                    ? cloneScopeValue(source.customFieldValues, {})
                    : {},
            };
            return dto;
        }).filter(Boolean);
    }

    function pruneTaskScopes() {
        pruneTokens(state.taskScopes);
        while (state.taskScopes.size >= TASK_SCOPE_MAX_ENTRIES) {
            const oldest = state.taskScopes.keys().next().value;
            if (!oldest) break;
            state.taskScopes.delete(oldest);
        }
    }

    function registerTaskScope(input) {
        const source = input && typeof input === 'object' ? input : {};
        const taskIDs = normalizeRegisteredScopeIDs(source.taskIDs, '任务范围');
        const documentIDs = normalizeRegisteredScopeIDs(source.documentIDs || [], '文档范围');
        const scopeMode = text(source.scopeMode) === 'documents' ? 'documents' : 'tasks';
        if (scopeMode === 'documents' && !documentIDs.length) throw new DomainError(ERROR.INVALID_ARGUMENT, '文档任务范围缺少文档 ID');
        const virtualTasks = normalizeRegisteredVirtualTasks(source.virtualTasks);
        const virtualTaskMap = new Map(virtualTasks.map((item) => [item.id, item]));
        const taskIDSet = new Set(taskIDs);
        const documentIDSet = new Set(documentIDs);
        const documentTaskIDs = new Set();
        const taskValues = new Map();
        (Array.isArray(source.taskValues) ? source.taskValues : []).forEach((item) => {
            const id = text(item && item.id);
            const inDocumentScope = scopeMode === 'documents' && documentIDSet.has(text(item && item.documentID));
            if (!taskIDSet.has(id) && !inDocumentScope) return;
            if (inDocumentScope) documentTaskIDs.add(id);
            const values = {};
            ['priorityScore', 'tomatoMinutes', 'tomatoHours', 'tomatoCount'].forEach((field) => {
                const raw = item && item[field];
                if (raw == null || String(raw).trim() === '') return;
                const value = Number(raw);
                if (Number.isFinite(value)) values[field] = value;
            });
            if (Object.keys(values).length) taskValues.set(id, values);
        });
        const realTaskCount = scopeMode === 'documents'
            ? new Set(taskIDs.concat(Array.from(documentTaskIDs))).size
            : taskIDs.length;
        pruneTaskScopes();
        const scopeToken = token('task_scope');
        const expiresAt = Date.now() + TASK_SCOPE_TOKEN_TTL;
        state.taskScopes.set(scopeToken, {
            scopeToken,
            scopeID: text(source.scopeID),
            scopeMode,
            taskIDs,
            documentIDs,
            realTaskCount,
            taskValues,
            virtualTasks,
            virtualTaskMap,
            createdAt: Date.now(),
            expiresAt,
        });
        return {
            scopeToken,
            scopeID: text(source.scopeID),
            scopeMode,
            taskCount: realTaskCount + virtualTasks.length,
            realTaskCount,
            virtualTaskCount: virtualTasks.length,
            documentCount: documentIDs.length,
            expiresAt: new Date(expiresAt).toISOString(),
        };
    }

    function registerDocumentGroupSnapshot(input) {
        const source = input && typeof input === 'object' && !Array.isArray(input) ? input : {};
        const groups = Array.isArray(source.groups) ? source.groups : [];
        const tabGroups = Array.isArray(source.tabGroups) ? source.tabGroups : [];
        const membersByGroup = new Map();
        const namesByGroup = new Map();
        groups.forEach((group) => {
            const groupID = text(group && group.id);
            if (!groupID || membersByGroup.has(groupID)) return;
            const documentIDs = uniqueStrings(group && (group.documentIDs || group.documentIds))
                .filter((id) => ID_RE.test(id));
            membersByGroup.set(groupID, new Set(documentIDs));
            namesByGroup.set(groupID, text(group && group.name));
        });
        const membersByTabGroup = new Map();
        const namesByTabGroup = new Map();
        tabGroups.forEach((group) => {
            const groupID = text(group && group.id);
            if (!groupID || membersByTabGroup.has(groupID)) return;
            const documentIDs = uniqueStrings(group && (group.documentIDs || group.documentIds))
                .filter((id) => ID_RE.test(id));
            membersByTabGroup.set(groupID, new Set(documentIDs));
            namesByTabGroup.set(groupID, text(group && group.name));
        });
        state.documentGroupSnapshot = {
            registeredAt: Date.now(),
            membersByGroup,
            namesByGroup,
            membersByTabGroup,
            namesByTabGroup,
        };
        return {
            groupCount: membersByGroup.size,
            tabGroupCount: membersByTabGroup.size,
            documentCount: new Set([
                ...Array.from(membersByGroup.values()).flatMap((ids) => Array.from(ids)),
                ...Array.from(membersByTabGroup.values()).flatMap((ids) => Array.from(ids)),
            ]).size,
        };
    }

    function resolveTaskScopeToken(value) {
        const scopeToken = text(value);
        if (!scopeToken) return null;
        pruneTokens(state.taskScopes);
        const item = state.taskScopes.get(scopeToken);
        if (!item) throw new DomainError(ERROR.NOT_FOUND, '任务范围已过期或不存在，请重新读取当前视图范围');
        item.expiresAt = Date.now() + TASK_SCOPE_TOKEN_TTL;
        state.taskScopes.delete(scopeToken);
        state.taskScopes.set(scopeToken, item);
        return item;
    }

    async function previewTaskDelete(taskID) {
        pruneTokens(state.deleteTokens);
        const task = await taskDTO(requireID(taskID, '任务 ID'));
        const deletedTaskIDs = await collectTaskSubtreeIDs(task.id);
        const schedules = await loadSchedules({ fresh: true });
        const linkedSchedules = schedules.filter((item) => (
            deletedTaskIDs.some((deletedID) => isScheduleLinkedToTaskOrVirtualSource(item, deletedID))
        ));
        const previewToken = token('delete_task');
        state.deleteTokens.set(previewToken, {
            kind: 'task',
            taskID: task.id,
            fingerprint: `${task.updated}:${task.id}`,
            expiresAt: Date.now() + DELETE_TOKEN_TTL,
        });
        return {
            previewToken,
            expiresAt: new Date(Date.now() + DELETE_TOKEN_TTL).toISOString(),
            task: { id: task.id, title: task.title, documentName: task.documentName },
            deletedTaskIDs,
            linkedScheduleCount: linkedSchedules.length,
        };
    }

    async function executeTaskDelete(taskID, previewToken) {
        pruneTokens(state.deleteTokens);
        const id = requireID(taskID, '任务 ID');
        const item = state.deleteTokens.get(text(previewToken));
        if (!item || item.kind !== 'task' || item.taskID !== id) {
            throw new DomainError(ERROR.CONFIRMATION_REQUIRED, '请先预览删除并使用有效确认令牌');
        }
        const row = await getTaskRow(id);
        if (item.fingerprint !== `${text(row.updated)}:${id}`) {
            state.deleteTokens.delete(text(previewToken));
            throw new DomainError(ERROR.CONFLICT, '任务在预览后已发生变化，请重新预览');
        }
        state.deleteTokens.delete(text(previewToken));
        return executeTaskCommandValue({ action: 'delete', taskID: id });
    }

    function normalizeTaskQueryDateRange(value) {
        if (value == null) return null;
        if (!value || typeof value !== 'object' || Array.isArray(value)) {
            throw new DomainError(ERROR.INVALID_ARGUMENT, 'dateRange 格式无效');
        }
        const field = text(value.field);
        if (!['taskSpan', 'startDate', 'completionTime', 'taskCompleteAt'].includes(field)) {
            throw new DomainError(ERROR.INVALID_ARGUMENT, 'dateRange.field 不受支持');
        }
        const normalizeDay = (input, label) => {
            const day = text(input);
            if (day && !/^\d{4}-\d{2}-\d{2}$/.test(day)) {
                throw new DomainError(ERROR.INVALID_ARGUMENT, `${label} 必须为 YYYY-MM-DD`);
            }
            return day;
        };
        const from = normalizeDay(value.from, 'dateRange.from');
        const to = normalizeDay(value.to, 'dateRange.to');
        if (!from && !to) throw new DomainError(ERROR.INVALID_ARGUMENT, 'dateRange 至少需要 from 或 to');
        if (from && to && from > to) throw new DomainError(ERROR.INVALID_ARGUMENT, 'dateRange.from 不能晚于 to');
        const mode = text(value.mode) || 'overlap';
        if (!['overlap', 'within'].includes(mode)) throw new DomainError(ERROR.INVALID_ARGUMENT, 'dateRange.mode 不受支持');
        return { field, from, to, mode };
    }

    function normalizeTaskQueryFilters(input) {
        const source = input && typeof input === 'object' && !Array.isArray(input) ? input : {};
        const normalizeSet = (value, label) => {
            if (value == null) return [];
            if (!Array.isArray(value)) throw new DomainError(ERROR.INVALID_ARGUMENT, `${label} 必须为数组`);
            const items = uniqueStrings(value);
            if (items.length > 50) throw new DomainError(ERROR.INVALID_ARGUMENT, `${label} 最多 50 项`);
            return items;
        };
        return {
            ...source,
            keyword: text(source.keyword).slice(0, 200),
            priorities: normalizeSet(source.priorities, 'priorities'),
            customStatuses: normalizeSet(source.customStatuses, 'customStatuses'),
            dateRange: normalizeTaskQueryDateRange(source.dateRange),
        };
    }

    function taskDoneExpression(alias) {
        return TaskStatus.sqlDone(`${text(alias) || 'task'}.markdown`);
    }

    function taskStatusExpression(registry, alias) {
        const attr = taskFieldAttrExpression(registry, 'customStatus', alias);
        const marker = TaskStatus.sqlMarker(`${alias}.markdown`);
        const groups = new Map();
        registry.statusOptions.forEach((item) => {
            const value = TaskStatus.optionMarker(item);
            if (!groups.has(value)) groups.set(value, []);
            groups.get(value).push(item);
        });
        const branches = Array.from(groups, ([value, items]) => {
            const fallback = value === ' ' ? (items.find((item) => item.id === (registry.settings?.checkboxUndoneStatusId || 'todo')) || items[0]) : items[0];
            const ids = items.map((item) => `'${escapeSql(item.id)}'`).join(',');
            return `WHEN ${marker} = '${escapeSql(value)}' THEN CASE WHEN ${attr} IN (${ids}) THEN ${attr} ELSE '${escapeSql(fallback.id)}' END`;
        });
        return `(CASE ${branches.join(' ')} ELSE ${attr} END)`;
    }

    function taskFieldAttrExpression(registry, fieldID, alias) {
        const field = registry && registry.byId && registry.byId.get(fieldID);
        if (!field) throw new DomainError(ERROR.UNSUPPORTED, `任务字段不可用: ${fieldID}`);
        return completionAttrExpression([field.attr].concat(field.aliases || []), alias);
    }

    function appendTaskDateRangeConditions(conditions, range, registry, alias) {
        if (!range) return;
        const startExpr = taskFieldAttrExpression(registry, 'startDate', alias);
        const dueExpr = taskFieldAttrExpression(registry, 'completionTime', alias);
        if (range.field === 'taskSpan') {
            const hasDate = `(${startExpr} != '' OR ${dueExpr} != '')`;
            const effectiveStart = `(CASE WHEN ${startExpr} != '' THEN substr(${startExpr}, 1, 10) ELSE substr(${dueExpr}, 1, 10) END)`;
            const effectiveEnd = `(CASE WHEN ${dueExpr} != '' THEN substr(${dueExpr}, 1, 10) ELSE substr(${startExpr}, 1, 10) END)`;
            conditions.push(hasDate);
            if (range.mode === 'within') {
                if (range.from) conditions.push(`${effectiveStart} >= '${escapeSql(range.from)}'`);
                if (range.to) conditions.push(`${effectiveEnd} <= '${escapeSql(range.to)}'`);
            } else {
                if (range.from) conditions.push(`${effectiveEnd} >= '${escapeSql(range.from)}'`);
                if (range.to) conditions.push(`${effectiveStart} <= '${escapeSql(range.to)}'`);
            }
            return;
        }
        const fieldExpr = taskFieldAttrExpression(registry, range.field, alias);
        const dayExpr = `substr(${fieldExpr}, 1, 10)`;
        conditions.push(`${fieldExpr} != ''`);
        if (range.from) conditions.push(`${dayExpr} >= '${escapeSql(range.from)}'`);
        if (range.to) conditions.push(`${dayExpr} <= '${escapeSql(range.to)}'`);
    }

    function buildTaskWhere(filters, cursor, normalizedScope, registry) {
        const source = filters && typeof filters === 'object' ? filters : {};
        const conditions = ["task.type = 'i'", "task.subtype = 't'"];
        const scope = normalizedScope || normalizeTaskScope(source);
        appendTaskScopeConditions(conditions, scope, 'task');
        if (scope.tokenBacked && Array.isArray(source.ids) && source.ids.length) {
            const explicitRealIDs = uniqueStrings(source.ids).filter((id) => ID_RE.test(id));
            conditions.push(explicitRealIDs.length
                ? `task.id IN (${explicitRealIDs.map((id) => `'${escapeSql(id)}'`).join(',')})`
                : '1 = 0');
        }
        if (scope.tokenBacked && Array.isArray(source.documentIDs) && source.documentIDs.length) {
            const explicitDocumentIDs = uniqueStrings(source.documentIDs).filter((id) => ID_RE.test(id));
            conditions.push(explicitDocumentIDs.length
                ? `task.root_id IN (${explicitDocumentIDs.map((id) => `'${escapeSql(id)}'`).join(',')})`
                : '1 = 0');
        }
        if (text(source.keyword)) {
            const keyword = escapeSql(text(source.keyword));
            conditions.push(`(instr(task.content, '${keyword}') > 0 OR instr(task.markdown, '${keyword}') > 0)`);
        }
        const doneExpr = taskDoneExpression('task');
        if (source.done === true) conditions.push(doneExpr);
        if (source.done === false) conditions.push(`NOT ${doneExpr} AND ${TaskStatus.sqlMarker('task.markdown')} != '-'`);
        if (source.priorities.length) {
            const priorityExpr = taskFieldAttrExpression(registry, 'priority', 'task');
            conditions.push(`${priorityExpr} IN (${source.priorities.map((value) => `'${escapeSql(value)}'`).join(',')})`);
        }
        if (source.customStatuses.length) {
            const statusExpr = taskStatusExpression(registry, 'task');
            conditions.push(`${statusExpr} IN (${source.customStatuses.map((value) => `'${escapeSql(value)}'`).join(',')})`);
        }
        appendTaskDateRangeConditions(conditions, source.dateRange, registry, 'task');
        if (source.overdue === true || source.overdue === false) {
            const dueExpr = taskFieldAttrExpression(registry, 'completionTime', 'task');
            const today = (() => {
                const now = new Date();
                return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
            })();
            const overdueExpr = `(NOT ${doneExpr} AND ${TaskStatus.sqlMarker('task.markdown')} != '-' AND ${dueExpr} != '' AND substr(${dueExpr}, 1, 10) < '${today}')`;
            conditions.push(source.overdue ? overdueExpr : `NOT ${overdueExpr}`);
        }
        const cursorMatch = text(cursor).match(/^(\d{14}):([0-9]{14}-[A-Za-z0-9]+)$/);
        if (cursorMatch) {
            conditions.push(`(task.updated < '${cursorMatch[1]}' OR (task.updated = '${cursorMatch[1]}' AND task.id < '${escapeSql(cursorMatch[2])}'))`);
        }
        return conditions.join(' AND ');
    }

    function filterVirtualTaskRows(scope, filters) {
        const source = filters && typeof filters === 'object' ? filters : {};
        if (source.includeVirtual === false) return [];
        const idSet = Array.isArray(source.ids) && source.ids.length ? new Set(uniqueStrings(source.ids)) : null;
        const documentSet = Array.isArray(source.documentIDs) && source.documentIDs.length ? new Set(uniqueStrings(source.documentIDs)) : null;
        const prioritySet = source.priorities.length ? new Set(source.priorities) : null;
        const statusSet = source.customStatuses.length ? new Set(source.customStatuses) : null;
        const keyword = text(source.keyword).toLocaleLowerCase();
        return (Array.isArray(scope && scope.virtualTasks) ? scope.virtualTasks : []).filter((item) => {
            if (idSet && !idSet.has(item.id)) return false;
            if (documentSet && !documentSet.has(item.documentID)) return false;
            if (source.done === false) return false;
            if (source.overdue === true) return false;
            if (prioritySet && !prioritySet.has(text(item.priority))) return false;
            if (statusSet && !statusSet.has(text(item.customStatus))) return false;
            if (source.dateRange) {
                const range = source.dateRange;
                const start = text(item.startDate).slice(0, 10);
                const due = text(item.completionTime).slice(0, 10);
                if (range.field === 'taskSpan') {
                    if (!start && !due) return false;
                    const effectiveStart = start || due;
                    const effectiveEnd = due || start;
                    if (range.mode === 'within') {
                        if (range.from && effectiveStart < range.from) return false;
                        if (range.to && effectiveEnd > range.to) return false;
                    } else {
                        if (range.from && effectiveEnd < range.from) return false;
                        if (range.to && effectiveStart > range.to) return false;
                    }
                } else {
                    const value = text(item[range.field]).slice(0, 10);
                    if (!value || (range.from && value < range.from) || (range.to && value > range.to)) return false;
                }
            }
            if (keyword) {
                const haystack = [item.title, item.markdown, item.remark, item.documentName, item.priority, item.customStatus]
                    .map((value) => text(value).toLocaleLowerCase())
                    .join('\n');
                if (!haystack.includes(keyword)) return false;
            }
            return true;
        });
    }

    async function queryTaskRows(input) {
        const source = input && typeof input === 'object' ? input : {};
        const limit = clampInt(source.limit, 1, 200, 50);
        const registry = await getFieldRegistry();
        const filters = normalizeTaskQueryFilters(source.filters);
        const scope = normalizeTaskScope(filters);
        const virtualRows = filterVirtualTaskRows(scope, filters);
        const virtualCursor = text(source.cursor).match(/^virtual:(\d+)$/);
        if (virtualCursor) {
            if (!scope.tokenBacked) throw new DomainError(ERROR.INVALID_ARGUMENT, '循环虚拟任务游标需要有效范围令牌');
            const offset = Math.max(0, Number(virtualCursor[1]) || 0);
            const page = virtualRows.slice(offset, offset + limit);
            const nextOffset = offset + page.length;
            return {
                items: page.map((item) => projectTaskDTO(applyTaskDisplayNames({ ...item }, registry), source.fields, ['virtualTask', 'virtualType', 'readOnly', 'sourceTaskID'])),
                nextCursor: nextOffset < virtualRows.length ? `virtual:${nextOffset}` : '',
                limit,
                customFieldDefinitions: (!Array.isArray(source.fields) || !source.fields.length || source.fields.includes('customFieldValues'))
                    ? customFieldDefinitions(registry)
                    : [],
                statusDefinitions: shouldIncludeTaskFieldMetadata(source.fields, 'customStatus', 'customStatusName') ? statusDefinitions(registry) : [],
                priorityDefinitions: shouldIncludeTaskFieldMetadata(source.fields, 'priority', 'priorityName') ? priorityDefinitions() : [],
            };
        }
        const rows = await sql(`
            SELECT
                task.id, task.markdown, task.content AS raw_content, task.parent_id, task.root_id,
                task.box, task.path AS block_path, task.sort AS block_sort, task.created, task.updated,
                COALESCE(doc.content, '') AS doc_name, COALESCE(doc.hpath, '') AS doc_path,
                COALESCE(parent.type, '') AS parent_type,
                (SELECT COUNT(*) FROM blocks s WHERE s.parent_id = task.parent_id AND s.type = 'i' AND s.subtype = 't') AS parent_task_count,
                (SELECT id FROM blocks s WHERE s.parent_id = task.parent_id AND s.type = 'i' AND s.subtype = 't' ORDER BY s.sort ASC, s.created ASC, s.id ASC LIMIT 1) AS first_task_id
            FROM blocks task
            LEFT JOIN blocks doc ON doc.id = task.root_id
            LEFT JOIN blocks parent ON parent.id = task.parent_id
            WHERE ${buildTaskWhere(filters, source.cursor, scope, registry)}
            ORDER BY task.updated DESC, task.id DESC
            LIMIT ${limit + 1}
        `);
        const page = rows.slice(0, limit);
        const tasks = [];
        for (const row of page) {
            const dto = await taskDTO(row, source.fields, registry);
            tasks.push(applyScopedTaskValues(dto, row.id, source.fields, scope));
        }
        const hasMoreRealRows = rows.length > limit;
        let nextCursor = '';
        if (hasMoreRealRows) {
            const last = page[page.length - 1];
            nextCursor = last ? `${text(last.updated)}:${text(last.id)}` : '';
        } else if (virtualRows.length) {
            const remaining = Math.max(0, limit - tasks.length);
            const virtualPage = virtualRows.slice(0, remaining);
            tasks.push(...virtualPage.map((item) => projectTaskDTO(applyTaskDisplayNames({ ...item }, registry), source.fields, ['virtualTask', 'virtualType', 'readOnly', 'sourceTaskID'])));
            if (virtualPage.length < virtualRows.length) nextCursor = `virtual:${virtualPage.length}`;
        }
        return {
            items: tasks,
            nextCursor,
            limit,
            customFieldDefinitions: (!Array.isArray(source.fields) || !source.fields.length || source.fields.includes('customFieldValues'))
                ? customFieldDefinitions(registry)
                : [],
            statusDefinitions: shouldIncludeTaskFieldMetadata(source.fields, 'customStatus', 'customStatusName') ? statusDefinitions(registry) : [],
            priorityDefinitions: shouldIncludeTaskFieldMetadata(source.fields, 'priority', 'priorityName') ? priorityDefinitions() : [],
        };
    }

    async function searchDocumentRows(input) {
        const source = input && typeof input === 'object' ? input : {};
        const keyword = text(source.keyword).slice(0, 200);
        const limit = clampInt(source.limit, 1, 50, 20);
        const terms = keyword.split(/\s+/).map((item) => text(item)).filter(Boolean).slice(0, 8);
        if (!terms.length) return { items: [], limit };
        const conditions = terms.map((term) => {
            const value = escapeSql(term);
            return `(instr(lower(doc.content), lower('${value}')) > 0 OR instr(lower(doc.hpath), lower('${value}')) > 0)`;
        });
        const exact = escapeSql(keyword);
        const rows = await sql(`
            SELECT doc.id, doc.content AS name, doc.hpath AS path, doc.box, doc.updated
            FROM blocks doc
            WHERE doc.type = 'd' AND ${conditions.join(' AND ')}
            ORDER BY
                CASE
                    WHEN lower(doc.content) = lower('${exact}') THEN 0
                    WHEN instr(lower(doc.content), lower('${exact}')) = 1 THEN 1
                    ELSE 2
                END,
                doc.updated DESC, doc.id DESC
            LIMIT ${limit}
        `);
        return {
            items: rows.map((row) => ({
                id: text(row.id),
                name: text(row.name) || `文档 ${text(row.id).slice(-6)}`,
                path: text(row.path),
                box: text(row.box),
                updated: text(row.updated),
            })),
            limit,
        };
    }

    async function listTaskScopes() {
        const settings = await getSettings();
        const groups = (Array.isArray(settings.docGroups) ? settings.docGroups : []).map((group) => ({
            id: text(group && group.id),
            name: text(group && group.name) || '未命名分组',
            documents: Array.isArray(group && group.docs) ? group.docs.map((item) => ({ id: text(item && (item.id || item.docId)), recursive: !!(item && item.recursive) })).filter((item) => item.id) : [],
        }));
        const documents = await sql("SELECT DISTINCT d.id, d.content AS name, d.hpath AS path FROM blocks t JOIN blocks d ON d.id = t.root_id WHERE t.type = 'i' AND t.subtype = 't' ORDER BY d.hpath COLLATE NOCASE LIMIT 500");
        return { groups, documents: documents.map((row) => ({ id: text(row.id), name: text(row.name), path: text(row.path) })) };
    }

    function normalizeSchedule(input, existing) {
        const source = input && typeof input === 'object' ? input : {};
        const base = existing && typeof existing === 'object' ? existing : {};
        const out = { ...base };
        const copy = (target, aliases) => {
            for (const key of aliases) {
                if (own(source, key)) {
                    out[target] = source[key];
                    return;
                }
            }
        };
        copy('taskId', ['taskId', 'taskID']);
        copy('title', ['title']);
        copy('start', ['start']);
        copy('end', ['end']);
        copy('allDay', ['allDay']);
        copy('calendarId', ['calendarId', 'calendarID']);
        copy('color', ['color']);
        copy('plannedMinutes', ['plannedMinutes', 'durationMinutes']);
        copy('reminderMode', ['reminderMode']);
        copy('reminderEnabled', ['reminderEnabled']);
        copy('reminderOffsetMin', ['reminderOffsetMin']);
        copy('repeatRule', ['repeatRule', 'repeat_rule']);
        copy('completedOccurrences', ['completedOccurrences']);
        copy('skippedOccurrences', ['skippedOccurrences']);
        out.taskId = text(out.taskId);
        out.title = text(out.title);
        out.start = text(out.start);
        out.end = text(out.end);
        out.calendarId = text(out.calendarId);
        out.color = text(out.color);
        out.allDay = !!out.allDay;
        if (out.repeatRule != null && typeof out.repeatRule !== 'object') {
            throw new DomainError(ERROR.INVALID_ARGUMENT, '日程循环规则无效');
        }
        if (out.repeatRule && typeof out.repeatRule === 'object') {
            try {
                out.repeatRule = JSON.parse(JSON.stringify(out.repeatRule));
            } catch (e) {
                throw new DomainError(ERROR.INVALID_ARGUMENT, '日程循环规则无效');
            }
        }
        if (out.completedOccurrences != null && !Array.isArray(out.completedOccurrences)) {
            throw new DomainError(ERROR.INVALID_ARGUMENT, '已完成日程实例无效');
        }
        if (out.skippedOccurrences != null && !Array.isArray(out.skippedOccurrences)) {
            throw new DomainError(ERROR.INVALID_ARGUMENT, '已跳过日程实例无效');
        }
        if (out.plannedMinutes != null && text(out.plannedMinutes) !== '') {
            const minutes = Number(out.plannedMinutes);
            if (!Number.isFinite(minutes) || minutes < 0) throw new DomainError(ERROR.INVALID_ARGUMENT, '计划时长无效');
            out.plannedMinutes = minutes;
        }
        const explicitReminderMode = own(source, 'reminderMode');
        const reminderMode = text(out.reminderMode) || 'inherit';
        if (explicitReminderMode && !SCHEDULE_REMINDER_MODES.includes(reminderMode)) {
            throw new DomainError(ERROR.INVALID_ARGUMENT, '日程提醒模式无效');
        }
        out.reminderMode = reminderMode === 'custom' ? 'custom' : 'inherit';
        if (out.reminderMode === 'custom') {
            if (own(source, 'reminderEnabled') && typeof source.reminderEnabled !== 'boolean') {
                throw new DomainError(ERROR.INVALID_ARGUMENT, '日程提醒开关无效');
            }
            out.reminderEnabled = out.reminderEnabled === true;
            const reminderOffset = Number(out.reminderOffsetMin);
            if (own(source, 'reminderOffsetMin') && !SCHEDULE_REMINDER_OFFSETS.includes(reminderOffset)) {
                throw new DomainError(ERROR.INVALID_ARGUMENT, '日程提醒提前时间无效');
            }
            out.reminderOffsetMin = SCHEDULE_REMINDER_OFFSETS.includes(reminderOffset) ? reminderOffset : 0;
        } else {
            out.reminderEnabled = null;
            out.reminderOffsetMin = null;
        }
        const startMs = Date.parse(out.start);
        const endMs = Date.parse(out.end);
        if (!out.start || !Number.isFinite(startMs)) throw new DomainError(ERROR.INVALID_ARGUMENT, '日程开始时间无效');
        if (!out.end || !Number.isFinite(endMs) || endMs <= startMs) throw new DomainError(ERROR.INVALID_ARGUMENT, '日程结束时间必须晚于开始时间');
        return out;
    }

    function clearVirtualScheduleTaskLinkMetadata(item) {
        if (!item || typeof item !== 'object') return item;
        delete item.virtualTask;
        delete item.virtualType;
        delete item.sourceTaskId;
        delete item.docId;
        delete item.recurringCompletedAt;
        return item;
    }

    async function normalizeScheduleTaskLink(item, scopeToken) {
        const taskID = text(item && item.taskId);
        if (!taskID) return clearVirtualScheduleTaskLinkMetadata(item);
        if (VIRTUAL_TASK_ID_RE.test(taskID)) {
            const scope = normalizeTaskScope({ scopeToken });
            const virtualTask = scope.virtualTaskMap.get(taskID);
            if (!virtualTask) {
                throw new DomainError(ERROR.NOT_FOUND, '循环虚拟任务不在当前任务范围内，请重新读取当前视图范围');
            }
            item.taskId = virtualTask.id;
            item.virtualTask = true;
            item.virtualType = text(virtualTask.virtualType) || 'recurring-history';
            item.sourceTaskId = text(virtualTask.sourceTaskID);
            item.docId = text(virtualTask.documentID);
            item.recurringCompletedAt = text(virtualTask.taskCompleteAt || virtualTask.completionTime);
            if (!text(item.title)) item.title = text(virtualTask.title) || '(无内容)';
            return item;
        }
        const binding = await resolveTaskBinding(taskID);
        item.taskId = binding.taskID;
        return clearVirtualScheduleTaskLinkMetadata(item);
    }

    function cloneScheduleSnapshotItems(items) {
        const list = Array.isArray(items) ? items : [];
        try {
            if (typeof structuredClone === 'function') return structuredClone(list);
        } catch (error) {}
        try { return JSON.parse(JSON.stringify(list)); } catch (error) {}
        return list.map((item) => ({ ...item }));
    }

    function getScheduleSnapshotError(snapshot) {
        if (snapshot?.status === 'missing') {
            return jsonStorageError(SCHEDULE_FILE, { status: 'missing' });
        }
        return jsonStorageError(SCHEDULE_FILE, snapshot?.record || {
            status: 'unavailable',
            error: new Error('schedule snapshot unavailable'),
        });
    }

    async function loadSchedules(options) {
        const allowMissing = options?.allowMissing !== false;
        const forceRead = options?.fresh === true;
        const snapshot = state.scheduleSnapshot;
        const fresh = Number(snapshot.loadedAt) > 0
            && Date.now() - Number(snapshot.loadedAt) < SCHEDULE_SNAPSHOT_TTL_MS;
        if (!forceRead && fresh && snapshot.status === 'valid' && Array.isArray(snapshot.items)) {
            return cloneScheduleSnapshotItems(snapshot.items);
        }
        if (!forceRead && fresh && snapshot.status === 'missing') {
            if (allowMissing) return [];
            throw getScheduleSnapshotError(snapshot);
        }
        if (!snapshot.inflight) {
            snapshot.inflight = (async () => {
                const record = await readJsonState(SCHEDULE_FILE);
                if (record.status === 'missing') {
                    return { status: 'missing', items: [], record };
                }
                if (record.status !== 'valid' || !Array.isArray(record.value)) {
                    const invalidRecord = record.status === 'valid'
                        ? { status: 'corrupt', error: new Error('schedule list is invalid') }
                        : record;
                    return { status: 'error', items: [], record: invalidRecord };
                }
                return {
                    status: 'valid',
                    items: record.value.filter((item) => item && typeof item === 'object'),
                    record,
                };
            })();
        }
        const inflight = snapshot.inflight;
        let result;
        try {
            result = await inflight;
        } finally {
            if (snapshot.inflight === inflight) snapshot.inflight = null;
        }
        snapshot.status = result.status;
        snapshot.items = cloneScheduleSnapshotItems(result.items);
        snapshot.record = result.record;
        snapshot.loadedAt = Date.now();
        if (result.status === 'missing') {
            if (allowMissing) return [];
            throw getScheduleSnapshotError(snapshot);
        }
        if (result.status !== 'valid') throw getScheduleSnapshotError(snapshot);
        return cloneScheduleSnapshotItems(snapshot.items);
    }

    async function saveSchedules(items) {
        const next = Array.isArray(items) ? items.filter((item) => item && typeof item === 'object') : [];
        await writeJson(SCHEDULE_FILE, next);
        state.scheduleSnapshot.status = 'valid';
        state.scheduleSnapshot.items = cloneScheduleSnapshotItems(next);
        state.scheduleSnapshot.record = null;
        state.scheduleSnapshot.loadedAt = Date.now();
    }

    function warmScheduleSnapshot() {
        try {
            return loadSchedules({ allowMissing: true }).catch(() => null);
        } catch (error) {
            return Promise.resolve(null);
        }
    }

    async function saveScheduleSnapshot(items, options) {
        const incoming = Array.isArray(items) ? items.filter((item) => item && typeof item === 'object') : [];
        const opts = options && typeof options === 'object' ? options : {};
        const operation = text(opts.op) || 'replace';
        const changedIDs = uniqueStrings([opts.scheduleId].concat(Array.isArray(opts.scheduleIds) ? opts.scheduleIds : []));
        const current = await loadSchedules({ allowMissing: true, fresh: true });
        const incomingByID = new Map(incoming.map((item) => [text(item.id), item]).filter((entry) => entry[0]));
        let next;
        if (operation === 'delete' && changedIDs.length) {
            const removed = new Set(changedIDs);
            next = current.filter((item) => !removed.has(text(item.id)));
        } else if ((operation === 'create' || operation === 'update') && changedIDs.length) {
            const changed = new Set(changedIDs);
            next = current.map((item) => changed.has(text(item.id)) && incomingByID.has(text(item.id)) ? incomingByID.get(text(item.id)) : item);
            changedIDs.forEach((id) => {
                if (incomingByID.has(id) && !next.some((item) => text(item.id) === id)) next.push(incomingByID.get(id));
            });
        } else if (opts.allowSchedulePrune === true) {
            next = incoming;
        } else {
            next = incoming.slice();
            current.forEach((item) => {
                const id = text(item.id);
                if (id && !incomingByID.has(id)) next.push(item);
            });
        }
        await saveSchedules(next);
        return { items: next, count: next.length };
    }

    async function querySchedules(input) {
        const source = input && typeof input === 'object' ? input : {};
        const filters = source.filters && typeof source.filters === 'object' ? source.filters : {};
        const limit = clampInt(source.limit, 1, 500, 100);
        const taskIDs = new Set(uniqueStrings(filters.taskIDs || filters.taskIds));
        const fromMs = text(filters.from) ? Date.parse(filters.from) : NaN;
        const toMs = text(filters.to) ? Date.parse(filters.to) : NaN;
        const list = await loadSchedules();
        const items = list.filter((item) => {
            if (taskIDs.size && !taskIDs.has(text(item.taskId || item.task_id || item.linkedTaskId))) return false;
            const startMs = Date.parse(item.start);
            const endMs = Date.parse(item.end);
            if (Number.isFinite(fromMs) && Number.isFinite(endMs) && endMs < fromMs) return false;
            if (Number.isFinite(toMs) && Number.isFinite(startMs) && startMs > toMs) return false;
            return true;
        }).slice(0, limit);
        return { items, totalMatched: items.length, limit };
    }

    async function createSchedule(input, options) {
        return runScheduleLane(async () => {
            const list = await loadSchedules({ allowMissing: true });
            const item = normalizeSchedule(input);
            await normalizeScheduleTaskLink(item, input && input.scopeToken);
            item.id = text(input && input.id) || token('schedule');
            if (list.some((current) => text(current.id) === item.id)) throw new DomainError(ERROR.CONFLICT, '日程 ID 已存在');
            list.push(item);
            await saveSchedules(list);
            let undoID = '';
            if (!options || options.recordUndo !== false) {
                const expected = stableJson(item);
                state.lastUndo = {
                    id: token('undo'), createdAt: Date.now(), label: `新建日程：${item.title || item.id}`,
                    verify: async () => {
                        const current = (await loadSchedules()).find((entry) => text(entry.id) === item.id);
                        return !!current && stableJson(current) === expected;
                    },
                    execute: () => deleteScheduleNow(item.id),
                };
                rememberUndo(state.lastUndo);
                undoID = state.lastUndo.id;
            }
            return { schedule: item, undoID };
        });
    }

    async function updateSchedule(input, options) {
        return runScheduleLane(async () => {
            const id = text(input && (input.id || input.scheduleID || input.scheduleId));
            if (!id) throw new DomainError(ERROR.INVALID_ARGUMENT, '缺少日程 ID');
            const list = await loadSchedules();
            const index = list.findIndex((item) => text(item.id) === id);
            if (index < 0) throw new DomainError(ERROR.NOT_FOUND, '未找到日程');
            const before = { ...list[index] };
            const patch = input && input.patch && typeof input.patch === 'object' ? input.patch : input;
            const next = normalizeSchedule(patch, before);
            if (own(patch, 'taskId') || own(patch, 'taskID')) {
                await normalizeScheduleTaskLink(next, text(input && input.scopeToken) || text(patch && patch.scopeToken));
            }
            next.id = id;
            list[index] = next;
            await saveSchedules(list);
            let undoID = '';
            if (!options || options.recordUndo !== false) {
                const expected = stableJson(next);
                state.lastUndo = {
                    id: token('undo'), createdAt: Date.now(), label: `更新日程：${next.title || id}`,
                    verify: async () => {
                        const current = (await loadSchedules()).find((entry) => text(entry.id) === id);
                        return !!current && stableJson(current) === expected;
                    },
                    execute: () => restoreScheduleSnapshot(before),
                };
                rememberUndo(state.lastUndo);
                undoID = state.lastUndo.id;
            }
            return { schedule: next, changes: patch, undoID };
        });
    }

    async function restoreScheduleSnapshot(snapshot) {
        return runScheduleLane(async () => {
            const id = text(snapshot && snapshot.id);
            if (!id) throw new DomainError(ERROR.INVALID_ARGUMENT, '缺少日程 ID');
            const list = await loadSchedules();
            const index = list.findIndex((item) => text(item.id) === id);
            if (index < 0) throw new DomainError(ERROR.NOT_FOUND, '未找到日程');
            const restored = { ...snapshot, id };
            list[index] = restored;
            await saveSchedules(list);
            return { schedule: restored, changes: restored };
        });
    }

    async function deleteScheduleNow(scheduleID) {
        return runScheduleLane(async () => {
            const id = text(scheduleID);
            if (!id) throw new DomainError(ERROR.INVALID_ARGUMENT, '缺少日程 ID');
            const list = await loadSchedules();
            const index = list.findIndex((item) => text(item.id) === id);
            if (index < 0) throw new DomainError(ERROR.NOT_FOUND, '未找到日程');
            const removed = list[index];
            list.splice(index, 1);
            await saveSchedules(list);
            return { deletedScheduleID: id, schedule: removed };
        });
    }

    async function previewScheduleDelete(scheduleID) {
        pruneTokens(state.deleteTokens);
        const id = text(scheduleID);
        const list = await loadSchedules();
        const item = list.find((current) => text(current.id) === id);
        if (!item) throw new DomainError(ERROR.NOT_FOUND, '未找到日程');
        const previewToken = token('delete_schedule');
        state.deleteTokens.set(previewToken, { kind: 'schedule', scheduleID: id, fingerprint: stableJson(item), expiresAt: Date.now() + DELETE_TOKEN_TTL });
        return { previewToken, expiresAt: new Date(Date.now() + DELETE_TOKEN_TTL).toISOString(), schedule: item };
    }

    async function executeScheduleDelete(scheduleID, previewToken) {
        pruneTokens(state.deleteTokens);
        const id = text(scheduleID);
        const item = state.deleteTokens.get(text(previewToken));
        if (!item || item.kind !== 'schedule' || item.scheduleID !== id) {
            throw new DomainError(ERROR.CONFIRMATION_REQUIRED, '请先预览删除并使用有效确认令牌');
        }
        const list = await loadSchedules();
        const current = list.find((schedule) => text(schedule.id) === id);
        if (!current) throw new DomainError(ERROR.NOT_FOUND, '未找到日程');
        if (item.fingerprint !== stableJson(current)) {
            state.deleteTokens.delete(text(previewToken));
            throw new DomainError(ERROR.CONFLICT, '日程在预览后已发生变化，请重新预览');
        }
        state.deleteTokens.delete(text(previewToken));
        return deleteScheduleNow(id);
    }

    function mutationReceipt(items) {
        const rows = Array.isArray(items) ? items : [];
        return {
            mutationGroupID: token('mutation'),
            undoID: text(state.lastUndo?.id),
            summary: {
                total: rows.length,
                succeeded: rows.filter((item) => item.ok).length,
                failed: rows.filter((item) => !item.ok && !item.skipped).length,
                skipped: rows.filter((item) => item.skipped).length,
            },
            items: rows,
        };
    }

    function pruneUndoRecords() {
        const cutoff = Date.now() - UNDO_RECORD_TTL;
        for (const [id, undo] of state.undoRecords) {
            if (!undo || Number(undo.createdAt) < cutoff) state.undoRecords.delete(id);
        }
        while (state.undoRecords.size > UNDO_RECORD_MAX_ENTRIES) {
            state.undoRecords.delete(state.undoRecords.keys().next().value);
        }
    }

    function rememberUndo(undo) {
        if (!undo || !text(undo.id) || typeof undo.execute !== 'function') return null;
        if (!Number.isFinite(Number(undo.sequence)) || Number(undo.sequence) <= 0) {
            state.undoSequence += 1;
            undo.sequence = state.undoSequence;
        }
        pruneUndoRecords();
        state.undoRecords.delete(undo.id);
        state.undoRecords.set(undo.id, undo);
        pruneUndoRecords();
        return undo;
    }

    function setGroupedUndo(label, steps) {
        const items = (Array.isArray(steps) ? steps : []).filter((item) => item && typeof item.execute === 'function');
        if (!items.length) {
            state.lastUndo = null;
            return null;
        }
        state.lastUndo = {
            id: token('undo'),
            createdAt: Date.now(),
            label,
            verify: async () => {
                for (const item of items) {
                    if (typeof item.verify === 'function' && !(await item.verify())) return false;
                }
                return true;
            },
            execute: async () => {
                const results = [];
                for (const item of items.slice().reverse()) results.push(await item.execute());
                return { items: results };
            },
        };
        rememberUndo(state.lastUndo);
        return state.lastUndo;
    }

    function groupUndoMutations(input) {
        pruneUndoRecords();
        const source = input && typeof input === 'object' ? input : {};
        const undoIDs = uniqueStrings(source.undoIDs || source.undoIds).slice(0, 50);
        if (!undoIDs.length) throw new DomainError(ERROR.INVALID_ARGUMENT, '缺少需要组合的撤销令牌');
        if (!undoIDs.includes(text(state.lastUndo && state.lastUndo.id))) {
            throw new DomainError(ERROR.CONFLICT, '组合撤销前已有新的写入，请重新执行当前操作');
        }
        const steps = undoIDs.map((id) => state.undoRecords.get(id));
        if (steps.some((undo) => !undo)) {
            throw new DomainError(ERROR.NOT_FOUND, '部分撤销令牌已过期，无法安全组合');
        }
        steps.sort((left, right) => Number(left.sequence) - Number(right.sequence));
        const grouped = setGroupedUndo(text(source.label).slice(0, 120) || '撤销本轮 AI 操作', steps);
        grouped.childUndoIDs = steps.map((undo) => undo.id);
        rememberUndo(grouped);
        return { undoID: grouped.id, label: grouped.label, count: undoIDs.length };
    }

    function operationKind(domain, operation, index) {
        const itemIndex = Math.max(0, Number(index) || 0);
        const label = domain === 'schedules' ? '日程' : '任务';
        const supported = domain === 'schedules'
            ? ['create', 'update', 'delete']
            : ['create', 'update', 'move', 'delete'];
        const fields = ['kind', 'action', 'type'].map((key) => ({
            key,
            value: text(operation && operation[key]).toLowerCase(),
        })).filter((item) => item.value);
        if (!fields.length) {
            throw new DomainError(ERROR.INVALID_ARGUMENT, `第 ${itemIndex + 1} 项${label}操作缺少 kind/action/type`, {
                index: itemIndex,
                domain,
                supported,
            });
        }
        const normalized = fields.map((item) => (
            domain === 'tasks' && item.value === 'patch' ? 'update' : item.value
        ));
        const kinds = Array.from(new Set(normalized));
        if (kinds.length > 1) {
            throw new DomainError(ERROR.INVALID_ARGUMENT, `第 ${itemIndex + 1} 项${label}操作类型冲突`, {
                index: itemIndex,
                domain,
                fields: Object.fromEntries(fields.map((item) => [item.key, item.value])),
            });
        }
        if (!supported.includes(kinds[0])) {
            throw new DomainError(ERROR.INVALID_ARGUMENT, `第 ${itemIndex + 1} 项${label}操作未知: ${fields[0].value}`, {
                index: itemIndex,
                domain,
                operation: fields[0].value,
                supported,
            });
        }
        return kinds[0];
    }

    async function executeTaskOperations(operations) {
        const rows = [];
        const undoSteps = [];
        state.lastUndo = null;
        const items = Array.isArray(operations) ? operations : [];
        for (let index = 0; index < items.length; index += 1) {
            const operation = items[index];
            let kind = '';
            try {
                kind = operationKind('tasks', operation, index);
                state.lastUndo = null;
                let value;
                value = await executeTaskCommandValue({ ...operation, action: kind === 'update' ? 'patch' : kind, options: { agentWrite: true } });
                const task = value && (value.task || value);
                if (kind !== 'delete' && state.lastUndo) undoSteps.push(state.lastUndo);
                rows.push({ kind: `task:${kind}`, targetID: text(task && task.id) || text(operation.taskID || operation.taskId), targetLabel: text(task && task.title), ok: true, changes: value, error: null, reversible: kind !== 'delete' });
            } catch (error) {
                rows.push({ kind: `task:${kind}`, targetID: text(operation && (operation.taskID || operation.taskId)), targetLabel: text(operation && operation.title), ok: false, changes: null, error: failure(error).error, reversible: false });
            }
        }
        setGroupedUndo('撤销本次任务操作', undoSteps);
        return mutationReceipt(rows);
    }

    async function executeScheduleOperations(operations) {
        const rows = [];
        const undoSteps = [];
        state.lastUndo = null;
        const items = Array.isArray(operations) ? operations : [];
        for (let index = 0; index < items.length; index += 1) {
            const operation = items[index];
            let kind = '';
            try {
                kind = operationKind('schedules', operation, index);
                state.lastUndo = null;
                let value;
                if (kind === 'create') value = await createSchedule(operation);
                else if (kind === 'update') value = await updateSchedule(operation);
                else if (kind === 'delete') value = await deleteScheduleNow(operation.scheduleID || operation.scheduleId || operation.id);
                const schedule = value && (value.schedule || value);
                if (kind !== 'delete' && state.lastUndo) undoSteps.push(state.lastUndo);
                rows.push({ kind: `schedule:${kind}`, targetID: text(schedule && schedule.id) || text(operation.id), targetLabel: text(schedule && schedule.title), ok: true, changes: value, error: null, reversible: kind !== 'delete' });
            } catch (error) {
                rows.push({ kind: `schedule:${kind}`, targetID: text(operation && (operation.id || operation.scheduleID || operation.scheduleId)), targetLabel: text(operation && operation.title), ok: false, changes: null, error: failure(error).error, reversible: false });
            }
        }
        setGroupedUndo('撤销本次日程操作', undoSteps);
        return mutationReceipt(rows);
    }

    function operationsHaveDelete(domain, operations) {
        return (Array.isArray(operations) ? operations : []).some((item, index) => operationKind(domain, item, index) === 'delete');
    }

    function requirePhaseAction(args, executeAction) {
        const phase = text(args && args.phase);
        const action = text(args && args.action);
        const expected = phase === 'preview' ? 'get' : executeAction;
        if (phase !== 'preview' && phase !== 'execute') {
            throw new DomainError(ERROR.INVALID_ARGUMENT, 'phase 必须是 preview 或 execute');
        }
        if (action !== expected) {
            throw new DomainError(ERROR.INVALID_ARGUMENT, `${phase} 阶段必须使用 action=${expected}`);
        }
    }

    function requireAction(args, expected) {
        const action = text(args && args.action);
        if (action !== expected) throw new DomainError(ERROR.INVALID_ARGUMENT, `必须使用 action=${expected}`);
    }

    async function guardOperationPreview(kind, operations, phase, previewToken) {
        pruneTokens(state.operationTokens);
        const normalizedOperations = (Array.isArray(operations) ? operations : []).map((operation, index) => {
            const normalized = { ...(operation || {}), kind: operationKind(kind, operation, index) };
            delete normalized.action;
            delete normalized.type;
            return normalized;
        });
        const fingerprint = stableJson(normalizedOperations);
        if (!operationsHaveDelete(kind, operations)) {
            return phase === 'preview'
                ? { previewOnly: true, previewToken: '', operations, requiresToken: false }
                : null;
        }
        if (phase === 'preview') {
            const value = token(`${kind}_plan`);
            state.operationTokens.set(value, { kind, fingerprint, expiresAt: Date.now() + PREVIEW_TOKEN_TTL });
            return { previewOnly: true, previewToken: value, expiresAt: new Date(Date.now() + PREVIEW_TOKEN_TTL).toISOString(), operations };
        }
        const item = state.operationTokens.get(text(previewToken));
        if (!item || item.kind !== kind || item.fingerprint !== fingerprint) {
            throw new DomainError(ERROR.CONFIRMATION_REQUIRED, '包含删除的批处理必须先预览并使用确认令牌');
        }
        state.operationTokens.delete(text(previewToken));
        return null;
    }

    function defaultDurationDefaults() {
        return {
            enabled: true,
            syncToManualDrag: false,
            fallbackMinutes: 25,
            rules: [
                { id: 'meeting', name: '会议', keywords: ['会议', '例会', '周会'], minutes: 30 },
                { id: 'writing', name: '写作', keywords: ['报告', '周报', '复盘', '方案', '文档', '撰写'], minutes: 60 },
                { id: 'communication-admin', name: '沟通杂务', keywords: ['邮件', '回复', '整理', '报销', '归档'], minutes: 15 },
            ],
        };
    }

    function normalizeDurationMatchText(value) {
        const raw = text(value).replace(/\s+/g, ' ').trim();
        try { return raw.normalize('NFKC').toLowerCase(); } catch (error) { return raw.toLowerCase(); }
    }

    function normalizeDurationMinutes(value, fallback, path) {
        const minutes = Number(value);
        if (!Number.isFinite(minutes) || minutes < DURATION_DEFAULT_MINUTES_MIN || minutes > DURATION_DEFAULT_MINUTES_MAX) {
            if (path) throw new DomainError(ERROR.INVALID_ARGUMENT, `${path} 应为 ${DURATION_DEFAULT_MINUTES_MIN}-${DURATION_DEFAULT_MINUTES_MAX} 分钟`);
            return fallback;
        }
        return Math.round(minutes);
    }

    function normalizeDurationDefaults(value, options) {
        const strict = options?.strict === true;
        const defaults = defaultDurationDefaults();
        if (!value || typeof value !== 'object' || Array.isArray(value)) {
            if (strict) throw new DomainError(ERROR.INVALID_ARGUMENT, 'durationDefaults 策略格式无效');
            return defaults;
        }
        const source = value;
        const rawRules = Array.isArray(source.rules) ? source.rules : defaults.rules;
        const rules = rawRules.map((item, index) => {
            if (!item || typeof item !== 'object' || Array.isArray(item)) {
                if (strict) throw new DomainError(ERROR.INVALID_ARGUMENT, `durationDefaults.rules.${index} 格式无效`);
                return null;
            }
            const name = text(item.name).slice(0, 40);
            const rawKeywords = Array.isArray(item.keywords) ? item.keywords : [];
            const seen = new Set();
            const keywords = rawKeywords.map((keyword) => text(keyword).slice(0, 80)).filter((keyword) => {
                const normalized = normalizeDurationMatchText(keyword);
                if (!normalized || seen.has(normalized)) return false;
                seen.add(normalized);
                return true;
            });
            if (strict && !name) throw new DomainError(ERROR.INVALID_ARGUMENT, `durationDefaults.rules.${index}.name 不能为空`);
            if (strict && !keywords.length) throw new DomainError(ERROR.INVALID_ARGUMENT, `durationDefaults.rules.${index}.keywords 不能为空`);
            return {
                id: text(item.id).slice(0, 80) || `duration-rule-${index + 1}`,
                name: name || `规则 ${index + 1}`,
                keywords,
                minutes: normalizeDurationMinutes(item.minutes, defaults.fallbackMinutes, strict ? `durationDefaults.rules.${index}.minutes` : ''),
            };
        }).filter(Boolean);
        return {
            enabled: source.enabled !== false,
            syncToManualDrag: source.syncToManualDrag === true,
            fallbackMinutes: normalizeDurationMinutes(source.fallbackMinutes, defaults.fallbackMinutes, strict ? 'durationDefaults.fallbackMinutes' : ''),
            rules,
        };
    }

    function resolveDurationCandidates(candidates, durationDefaults, options) {
        const config = normalizeDurationDefaults(durationDefaults);
        const manualDrag = options?.manualDrag === true;
        const enabled = config.enabled !== false && (!manualDrag || config.syncToManualDrag === true);
        return (Array.isArray(candidates) ? candidates : []).slice(0, 200).map((candidate, index) => {
            const source = candidate && typeof candidate === 'object' ? candidate : {};
            const taskID = text(source.taskID || source.taskId || source.id) || `duration-candidate-${index + 1}`;
            if (!enabled) return { taskID, minutes: null, source: 'missing', ruleID: '', ruleName: '' };
            const title = normalizeDurationMatchText(source.title);
            const matchedRule = config.rules.find((rule) => rule.keywords.some((keyword) => title.includes(normalizeDurationMatchText(keyword)))) || null;
            if (matchedRule) {
                return {
                    taskID,
                    minutes: matchedRule.minutes,
                    source: 'rule',
                    ruleID: matchedRule.id,
                    ruleName: matchedRule.name,
                };
            }
            return { taskID, minutes: config.fallbackMinutes, source: 'fallback', ruleID: '', ruleName: '' };
        });
    }

    async function resolveTaskDurationDefaults(input) {
        const source = input && typeof input === 'object' ? input : {};
        const policy = await getPolicy();
        const manualDrag = text(source.mode) === 'manual-drag';
        const items = resolveDurationCandidates(source.items || source.durationCandidates, policy.durationDefaults, { manualDrag });
        return { mode: manualDrag ? 'manual-drag' : 'ai', items };
    }

    function defaultPolicy() {
        const weeklyAvailability = {
            mon: '09:00-12:00, 14:00-18:00',
            tue: '09:00-12:00, 14:00-18:00',
            wed: '09:00-12:00, 14:00-18:00',
            thu: '09:00-12:00, 14:00-18:00',
            fri: '09:00-12:00, 14:00-18:00',
            sat: '09:00-12:00, 14:00-18:00',
            sun: '09:00-12:00, 14:00-18:00',
        };
        return {
            schemaVersion: 2,
            revision: 1,
            global: {
                weeklyAvailability,
                fixedOccupancy: [],
                deadlinePriority: { enabled: true },
                defaultCalendarID: '',
                customInstructions: '',
            },
            documentOverrides: {},
            groupOverrides: {},
            durationDefaults: defaultDurationDefaults(),
            previous: null,
        };
    }

    function normalizeStoredPolicyConfig(config) {
        const source = config && typeof config === 'object' && !Array.isArray(config) ? config : {};
        return Object.fromEntries(POLICY_CONFIG_FIELDS.filter((key) => own(source, key)).map((key) => [key, source[key]]));
    }

    function normalizeStoredPolicyOverrides(overrides) {
        const source = overrides && typeof overrides === 'object' && !Array.isArray(overrides) ? overrides : {};
        return Object.fromEntries(Object.entries(source)
            .filter(([, config]) => config && typeof config === 'object' && !Array.isArray(config))
            .map(([scopeID, config]) => [scopeID, normalizeStoredPolicyConfig(config)]));
    }

    function normalizePolicySnapshot(current) {
        if (!current || typeof current !== 'object' || Array.isArray(current)) return null;
        const defaults = defaultPolicy();
        const global = normalizeStoredPolicyConfig({ ...defaults.global, ...(current.global || {}) });
        if (!global.weeklyAvailability || typeof global.weeklyAvailability !== 'object' || !Object.keys(global.weeklyAvailability).length) {
            global.weeklyAvailability = defaults.global.weeklyAvailability;
        }
        const rawDocumentOverrides = current.documentOverrides && typeof current.documentOverrides === 'object' && !Array.isArray(current.documentOverrides)
            ? current.documentOverrides
            : (current.listOverrides && typeof current.listOverrides === 'object' && !Array.isArray(current.listOverrides) ? current.listOverrides : {});
        const rawGroupOverrides = current.groupOverrides && typeof current.groupOverrides === 'object' && !Array.isArray(current.groupOverrides)
            ? current.groupOverrides
            : {};
        const documentOverrides = normalizeStoredPolicyOverrides(rawDocumentOverrides);
        const groupOverrides = normalizeStoredPolicyOverrides(rawGroupOverrides);
        const durationDefaults = normalizeDurationDefaults(current.durationDefaults);
        const previous = current.previous && typeof current.previous === 'object' && !Array.isArray(current.previous)
            ? {
                ...current.previous,
                global: normalizeStoredPolicyConfig(current.previous.global),
                documentOverrides: normalizeStoredPolicyOverrides(current.previous.documentOverrides),
                groupOverrides: normalizeStoredPolicyOverrides(current.previous.groupOverrides),
                durationDefaults: normalizeDurationDefaults(current.previous.durationDefaults),
            }
            : null;
        const normalized = {
            ...defaults,
            ...current,
            schemaVersion: 2,
            global,
            documentOverrides,
            groupOverrides,
            durationDefaults,
            previous,
            revision: Math.max(1, Number(current.revision) || 1),
        };
        delete normalized.listOverrides;
        return normalized;
    }

    async function getPolicyRecord() {
        const record = await readJsonState(POLICY_FILE);
        if (record.status === 'missing') return { storageState: 'missing', policy: defaultPolicy() };
        if (record.status !== 'valid') throw jsonStorageError(POLICY_FILE, record);
        const policy = normalizePolicySnapshot(record.value);
        if (!policy) {
            throw jsonStorageError(POLICY_FILE, {
                status: 'corrupt',
                error: new Error('policy config is invalid'),
            });
        }
        return { storageState: 'valid', policy };
    }

    async function getPolicy() {
        return (await getPolicyRecord()).policy;
    }

    async function restorePolicySnapshot(input) {
        const record = await readJsonState(POLICY_FILE);
        if (record.status === 'valid') {
            const current = normalizePolicySnapshot(record.value);
            if (!current) throw jsonStorageError(POLICY_FILE, { status: 'corrupt', error: new Error('policy config is invalid') });
            return current;
        }
        if (record.status !== 'missing' && record.status !== 'corrupt') throw jsonStorageError(POLICY_FILE, record);
        const restored = normalizePolicySnapshot(input);
        if (!restored) throw new DomainError(ERROR.INVALID_ARGUMENT, '安排规则恢复数据无效');
        await writeJson(POLICY_FILE, restored);
        return restored;
    }

    function normalizePolicyDocumentGroups(settings) {
        return (Array.isArray(settings && settings.docGroups) ? settings.docGroups : []).map((group) => ({
            id: text(group && group.id),
            name: text(group && group.name) || '未命名文档分组',
            notebookID: text(group && (group.notebookId || group.notebookID)),
            documents: (Array.isArray(group && group.docs) ? group.docs : []).map((entry) => ({
                id: text(entry && typeof entry === 'object' ? (entry.id || entry.docId) : entry),
                recursive: !!(entry && typeof entry === 'object' && entry.recursive),
            })).filter((entry) => entry.id),
            excludedDocumentIDs: uniqueStrings(group && group.excludedDocIds),
        })).filter((group) => group.id);
    }

    async function policyDocumentMeta(documentIDs, groups) {
        const ids = uniqueStrings([
            ...documentIDs,
            ...groups.flatMap((group) => group.documents.filter((entry) => entry.recursive).map((entry) => entry.id)),
        ]).filter((id) => ID_RE.test(id));
        if (!ids.length) return new Map();
        const rows = await sql(`SELECT id, box, path, hpath FROM blocks WHERE type = 'd' AND id IN (${ids.map((id) => `'${escapeSql(id)}'`).join(',')})`);
        return new Map(rows.map((row) => [text(row.id), {
            id: text(row.id),
            box: text(row.box),
            path: text(row.path).replace(/\/+$/, ''),
            hpath: text(row.hpath).replace(/\/+$/, ''),
        }]));
    }

    function documentMatchesPolicyGroup(documentID, group, metaByID) {
        const id = text(documentID);
        if (!id || !group || group.excludedDocumentIDs.includes(id)) return false;
        const target = metaByID.get(id) || null;
        if (group.notebookID && target && target.box === group.notebookID) return true;
        return group.documents.some((entry) => {
            if (entry.id === id) return true;
            if (!entry.recursive || !target) return false;
            const root = metaByID.get(entry.id);
            if (!root || root.box !== target.box) return false;
            if (root.path && target.path) {
                const rootPath = root.path.replace(/\.sy$/i, '');
                return target.path === root.path || target.path.startsWith(`${rootPath}/`);
            }
            return !!root.hpath && !!target.hpath
                && (target.hpath === root.hpath || target.hpath.startsWith(`${root.hpath}/`));
        });
    }

    async function getTaskPolicy(input) {
        const source = input && typeof input === 'object' ? input : {};
        const policy = await getPolicy();
        const settings = await getSettings();
        const documentGroups = normalizePolicyDocumentGroups(settings);
        const documentIDs = uniqueStrings(source.documentIDs || source.documentIds).filter((id) => ID_RE.test(id)).slice(0, 200);
        const result = {
            ...policy,
            precedence: ['document', 'documentGroup', 'global'],
            documentGroups: documentGroups.map((group) => ({ id: group.id, name: group.name })),
            effectiveByDocument: {},
            durationEstimates: resolveDurationCandidates(source.durationCandidates, policy.durationDefaults),
        };
        if (!documentIDs.length) return result;
        const metaByID = await policyDocumentMeta(documentIDs, documentGroups);
        const groupSnapshot = state.documentGroupSnapshot;
        const useGroupSnapshot = !!groupSnapshot
            && (Date.now() - Number(groupSnapshot.registeredAt || 0)) < (30 * 60 * 1000)
            && documentGroups.every((group) => groupSnapshot.membersByGroup.has(group.id));
        documentIDs.forEach((documentID) => {
            const matchedGroups = documentGroups.filter((item) => useGroupSnapshot
                ? groupSnapshot.membersByGroup.get(item.id).has(documentID)
                : documentMatchesPolicyGroup(documentID, item, metaByID));
            const primaryGroup = matchedGroups[0] || null;
            const appliedGroup = matchedGroups.find((item) => policy.groupOverrides[item.id]) || null;
            result.effectiveByDocument[documentID] = {
                documentGroupID: primaryGroup?.id || '',
                documentGroupName: primaryGroup?.name || '',
                documentGroups: matchedGroups.map((item) => ({ id: item.id, name: item.name })),
                appliedGroupRuleID: appliedGroup?.id || '',
                appliedGroupRuleName: appliedGroup?.name || '',
                membershipSource: useGroupSnapshot ? 'pluginResolvedSnapshot' : 'sqlFallback',
                config: {
                    ...(policy.global || {}),
                    ...((appliedGroup && policy.groupOverrides[appliedGroup.id]) || {}),
                    ...(policy.documentOverrides[documentID] || {}),
                },
            };
        });
        return result;
    }

    function normalizePolicyConfigPatch(config, path) {
        if (!config || typeof config !== 'object' || Array.isArray(config)) throw new DomainError(ERROR.INVALID_ARGUMENT, `${path} 策略格式无效`);
        const allowed = new Set(POLICY_CONFIG_FIELDS);
        const out = {};
        Object.keys(config).forEach((key) => {
            if (!allowed.has(key)) throw new DomainError(ERROR.INVALID_ARGUMENT, `不支持的策略字段: ${path}.${key}`);
            out[key] = config[key];
        });
        return out;
    }

    function normalizePolicyOverridePatch(overrides, path) {
        if (!overrides || typeof overrides !== 'object' || Array.isArray(overrides)) throw new DomainError(ERROR.INVALID_ARGUMENT, `${path} 策略格式无效`);
        return Object.fromEntries(Object.entries(overrides).map(([scopeID, config]) => [
            scopeID,
            config == null ? null : normalizePolicyConfigPatch(config, `${path}.${scopeID}`),
        ]));
    }

    function normalizePolicyPatch(patch) {
        const source = patch && typeof patch === 'object' && !Array.isArray(patch) ? patch : {};
        const out = {};
        if (own(source, 'durationDefaults')) out.durationDefaults = normalizeDurationDefaults(source.durationDefaults, { strict: true });
        if (own(source, 'global')) out.global = normalizePolicyConfigPatch(source.global, 'global');
        if (own(source, 'documentOverrides') || own(source, 'listOverrides')) {
            const legacy = own(source, 'listOverrides') ? source.listOverrides : {};
            const current = own(source, 'documentOverrides') ? source.documentOverrides : {};
            if (!legacy || typeof legacy !== 'object' || Array.isArray(legacy)) throw new DomainError(ERROR.INVALID_ARGUMENT, 'listOverrides 策略格式无效');
            if (!current || typeof current !== 'object' || Array.isArray(current)) throw new DomainError(ERROR.INVALID_ARGUMENT, 'documentOverrides 策略格式无效');
            out.documentOverrides = normalizePolicyOverridePatch({ ...legacy, ...current }, 'documentOverrides');
        }
        if (own(source, 'groupOverrides')) {
            out.groupOverrides = normalizePolicyOverridePatch(source.groupOverrides, 'groupOverrides');
        }
        if (!Object.keys(out).length) throw new DomainError(ERROR.INVALID_ARGUMENT, '策略补丁为空');
        return out;
    }

    function policyDiff(current, patch) {
        const changes = [];
        Object.keys(patch).forEach((section) => {
            const values = patch[section] || {};
            Object.keys(values).forEach((key) => {
                const before = current[section] && current[section][key];
                const after = values[key];
                if (stableJson(before) !== stableJson(after)) changes.push({ path: `${section}.${key}`, before: before == null ? null : before, after });
            });
        });
        return changes;
    }

    async function previewPolicyPatch(input) {
        pruneTokens(state.policyTokens);
        const current = await getPolicy();
        const expectedRevision = Number(input && input.expectedRevision);
        if (Number.isFinite(expectedRevision) && expectedRevision !== Number(current.revision)) {
            throw new DomainError(ERROR.STALE_REVISION, '策略版本已变化，请重新读取');
        }
        const patch = normalizePolicyPatch(input && input.patch);
        const changes = policyDiff(current, patch);
        const previewToken = token('policy');
        state.policyTokens.set(previewToken, { expectedRevision: current.revision, patch, expiresAt: Date.now() + PREVIEW_TOKEN_TTL });
        return { previewToken, expectedRevision: current.revision, changes, expiresAt: new Date(Date.now() + PREVIEW_TOKEN_TTL).toISOString() };
    }

    async function applyPolicyPatch(input) {
        pruneTokens(state.policyTokens);
        const current = await getPolicy();
        const item = state.policyTokens.get(text(input && input.previewToken));
        if (!item) throw new DomainError(ERROR.CONFIRMATION_REQUIRED, '请先预览策略变更');
        if (Number(current.revision) !== Number(item.expectedRevision) || Number(input && input.expectedRevision) !== Number(item.expectedRevision)) {
            throw new DomainError(ERROR.STALE_REVISION, '策略版本已变化，请重新预览');
        }
        const nextDocumentOverrides = { ...(current.documentOverrides || {}) };
        Object.entries(item.patch.documentOverrides || {}).forEach(([scopeID, value]) => {
            if (value == null) delete nextDocumentOverrides[scopeID];
            else nextDocumentOverrides[scopeID] = value;
        });
        const nextGroupOverrides = { ...(current.groupOverrides || {}) };
        Object.entries(item.patch.groupOverrides || {}).forEach(([scopeID, value]) => {
            if (value == null) delete nextGroupOverrides[scopeID];
            else nextGroupOverrides[scopeID] = value;
        });
        const next = {
            ...current,
            schemaVersion: 2,
            global: { ...(current.global || {}), ...(item.patch.global || {}) },
            documentOverrides: nextDocumentOverrides,
            groupOverrides: nextGroupOverrides,
            durationDefaults: item.patch.durationDefaults || current.durationDefaults,
            previous: {
                revision: current.revision,
                global: current.global,
                documentOverrides: current.documentOverrides,
                groupOverrides: current.groupOverrides,
                durationDefaults: current.durationDefaults,
            },
            revision: Number(current.revision) + 1,
        };
        await writeJson(POLICY_FILE, next);
        state.policyTokens.delete(text(input.previewToken));
        return { policy: next, changes: policyDiff(current, item.patch) };
    }

    function completionAttrExpression(names, alias) {
        const table = text(alias) || 't';
        const list = uniqueStrings(names).map((name) => `'${escapeSql(name)}'`).join(',');
        return `COALESCE((SELECT a.value FROM attributes a
            WHERE a.block_id = ${table}.id AND a.name IN (${list}) AND a.value != ''
            ORDER BY CASE WHEN a.name = '${escapeSql(names[0])}' THEN 0 ELSE 1 END LIMIT 1), '')`;
    }

    function normalizeTaskScope(input) {
        const source = input && typeof input === 'object' ? input : {};
        const registered = resolveTaskScopeToken(source.scopeToken);
        if (registered) {
            return {
                scopeToken: registered.scopeToken,
                scopeID: registered.scopeID,
                scopeMode: registered.scopeMode === 'documents' ? 'documents' : 'tasks',
                taskIDs: registered.taskIDs.slice(),
                documentIDs: registered.documentIDs.slice(),
                realTaskCount: Math.max(0, Number(registered.realTaskCount) || 0),
                taskValues: new Map(registered.taskValues || []),
                virtualTasks: (registered.virtualTasks || []).map((item) => ({ ...item })),
                virtualTaskMap: new Map(registered.virtualTaskMap || []),
                tokenBacked: true,
            };
        }
        return {
            scopeToken: '',
            scopeID: '',
            scopeMode: 'tasks',
            taskIDs: uniqueStrings(source.taskIDs || source.taskIds || source.ids).filter((id) => ID_RE.test(id)),
            documentIDs: uniqueStrings(source.documentIDs || source.documentIds || source.docIDs || source.docIds).filter((id) => ID_RE.test(id)),
            taskValues: new Map(),
            virtualTasks: [],
            virtualTaskMap: new Map(),
            tokenBacked: false,
        };
    }

    function appendTaskScopeConditions(conditions, scope, alias) {
        const table = text(alias) || 't';
        if (scope.tokenBacked) {
            if (scope.scopeMode === 'documents') {
                const branches = [];
                if (scope.taskIDs.length) branches.push(`${table}.id IN (${scope.taskIDs.map((id) => `'${escapeSql(id)}'`).join(',')})`);
                if (scope.documentIDs.length) branches.push(`${table}.root_id IN (${scope.documentIDs.map((id) => `'${escapeSql(id)}'`).join(',')})`);
                conditions.push(branches.length ? `(${branches.join(' OR ')})` : '1 = 0');
                return conditions;
            }
            conditions.push(scope.taskIDs.length
                ? `${table}.id IN (${scope.taskIDs.map((id) => `'${escapeSql(id)}'`).join(',')})`
                : '1 = 0');
            return conditions;
        }
        if (scope.taskIDs.length) conditions.push(`${table}.id IN (${scope.taskIDs.map((id) => `'${escapeSql(id)}'`).join(',')})`);
        if (scope.documentIDs.length) conditions.push(`${table}.root_id IN (${scope.documentIDs.map((id) => `'${escapeSql(id)}'`).join(',')})`);
        return conditions;
    }

    function taskScopeCoverage(scope) {
        return {
            scopeToken: text(scope && scope.scopeToken),
            scopeID: text(scope && scope.scopeID),
            scopeMode: text(scope && scope.scopeMode) || 'tasks',
            taskCount: Number.isFinite(Number(scope && scope.realTaskCount))
                ? Math.max(0, Number(scope.realTaskCount))
                : (Array.isArray(scope && scope.taskIDs) ? scope.taskIDs.length : 0),
            virtualTaskCount: Array.isArray(scope && scope.virtualTasks) ? scope.virtualTasks.length : 0,
            totalScopeTaskCount: (Number.isFinite(Number(scope && scope.realTaskCount))
                ? Math.max(0, Number(scope.realTaskCount))
                : (Array.isArray(scope && scope.taskIDs) ? scope.taskIDs.length : 0))
                + (Array.isArray(scope && scope.virtualTasks) ? scope.virtualTasks.length : 0),
            virtualTasksIncluded: false,
            documentCount: Array.isArray(scope && scope.documentIDs) ? scope.documentIDs.length : 0,
        };
    }

    async function getCompletedTaskRows(input) {
        const registry = await getFieldRegistry();
        const completeField = registry.byId.get('taskCompleteAt');
        const statusField = registry.byId.get('customStatus');
        const priorityField = registry.byId.get('priority');
        const completeExpr = completionAttrExpression([completeField.attr].concat(completeField.aliases || []));
        const statusExpr = completionAttrExpression([statusField.attr].concat(statusField.aliases || []));
        const priorityExpr = completionAttrExpression([priorityField.attr].concat(priorityField.aliases || []));
        const requestedCustomFieldIDs = uniqueStrings(input && input.customFieldIDs).slice(0, 20);
        const customFields = requestedCustomFieldIDs.map((fieldID, index) => {
            const field = registry.byId.get(fieldID);
            if (!field || !field.custom) throw new DomainError(ERROR.INVALID_ARGUMENT, `未注册的自定义字段: ${fieldID}`);
            return { field, alias: `custom_field_${index}` };
        });
        const customSelect = customFields.map(({ field, alias }) => `, ${completionAttrExpression([field.attr].concat(field.aliases || []))} AS ${alias}`).join('');
        const conditions = ["t.type = 'i'", "t.subtype = 't'", TaskStatus.sqlDone('t.markdown')];
        const scope = normalizeTaskScope(input);
        appendTaskScopeConditions(conditions, scope, 't');
        const fromDate = text(input && input.from);
        const toDate = text(input && input.to);
        if (fromDate && !isStrictDateKey(fromDate)) throw new DomainError(ERROR.INVALID_ARGUMENT, '统计起始日期格式无效，应为 YYYY-MM-DD');
        if (toDate && !isStrictDateKey(toDate)) throw new DomainError(ERROR.INVALID_ARGUMENT, '统计结束日期格式无效，应为 YYYY-MM-DD');
        if (fromDate && toDate && fromDate > toDate) throw new DomainError(ERROR.INVALID_ARGUMENT, '统计结束日期不能早于起始日期');
        const coverageRows = await sql(`
            SELECT COUNT(*) AS completed_in_scope,
                SUM(CASE WHEN ${completeExpr} = '' THEN 1 ELSE 0 END) AS missing_completion_time
            FROM blocks t
            WHERE ${conditions.join(' AND ')}
        `);
        const dateConditions = [];
        if (fromDate) dateConditions.push(`substr(completed_at, 1, 10) >= '${escapeSql(fromDate)}'`);
        if (toDate) dateConditions.push(`substr(completed_at, 1, 10) <= '${escapeSql(toDate)}'`);
        const rows = await sql(`
            SELECT * FROM (
                SELECT t.id, t.root_id, t.content AS title, d.content AS doc_name,
                    ${completeExpr} AS completed_at,
                    ${statusExpr} AS custom_status,
                    ${priorityExpr} AS priority
                    ${customSelect}
                FROM blocks t LEFT JOIN blocks d ON d.id = t.root_id
                WHERE ${conditions.join(' AND ')}
            ) completed_tasks
            ${dateConditions.length ? `WHERE completed_at != '' AND ${dateConditions.join(' AND ')}` : ''}
            ORDER BY completed_at ASC
        `);
        const coverage = coverageRows[0] || {};
        return {
            rows,
            customFields,
            registry,
            completedInScope: Number(coverage.completed_in_scope) || 0,
            missingCompletionTime: Number(coverage.missing_completion_time) || 0,
        };
    }

    function periodKey(value, period) {
        const raw = text(value).slice(0, 10);
        if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return 'unknown';
        if (period === 'day') return raw;
        if (period === 'year') return raw.slice(0, 4);
        if (period === 'week') {
            const date = new Date(`${raw}T00:00:00Z`);
            const day = date.getUTCDay() || 7;
            date.setUTCDate(date.getUTCDate() + 4 - day);
            const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
            const week = Math.ceil((((date - yearStart) / 86400000) + 1) / 7);
            return `${date.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
        }
        return raw.slice(0, 7);
    }

    function countBy(rows, keySelector) {
        const map = new Map();
        rows.forEach((row) => {
            const key = text(keySelector(row)) || '未设置';
            map.set(key, (map.get(key) || 0) + 1);
        });
        return Array.from(map, ([key, count]) => ({ key, count })).sort((a, b) => b.count - a.count || a.key.localeCompare(b.key));
    }

    function countByLabeled(rows, valueSelector, labelSelector) {
        const map = new Map();
        rows.forEach((row) => {
            const value = text(valueSelector(row));
            const current = map.get(value) || { value, key: text(labelSelector(value)) || value || '未设置', count: 0 };
            current.count += 1;
            map.set(value, current);
        });
        return Array.from(map.values()).sort((a, b) => b.count - a.count || a.key.localeCompare(b.key));
    }

    function customFieldBreakdown(rows, field, alias) {
        const definition = customFieldDefinitions({ fields: [field] })[0];
        const options = Array.isArray(definition?.options) ? definition.options : [];
        const optionByID = new Map(options.map((option) => [option.id, option]));
        const optionIDByValue = new Map();
        options.forEach((option) => {
            optionIDByValue.set(option.id, option.id);
            optionIDByValue.set(option.label, option.id);
        });
        const directRowsByID = new Map(options.map((option) => [option.id, new Set()]));
        const totalRowsByID = new Map(options.map((option) => [option.id, new Set()]));
        const unknownRowsByValue = new Map();
        const unsetRows = new Set();
        rows.forEach((row, rowIndex) => {
            const raw = text(row && row[alias]);
            const values = raw
                ? (text(field?.type) === 'multi' ? raw.split(',').map(text).filter(Boolean) : [raw])
                : [];
            if (!values.length) {
                unsetRows.add(rowIndex);
                return;
            }
            new Set(values).forEach((value) => {
                const optionID = optionIDByValue.get(value);
                if (!optionID) {
                    const rowIDs = unknownRowsByValue.get(value) || new Set();
                    rowIDs.add(rowIndex);
                    unknownRowsByValue.set(value, rowIDs);
                    return;
                }
                directRowsByID.get(optionID).add(rowIndex);
                const option = optionByID.get(optionID);
                [optionID].concat(option?.ancestorIDs || []).forEach((id) => totalRowsByID.get(id)?.add(rowIndex));
            });
        });
        const items = options.map((option) => ({
            value: option.id,
            key: option.label,
            count: directRowsByID.get(option.id)?.size || 0,
        })).filter((item) => item.count > 0);
        unknownRowsByValue.forEach((rowIDs, value) => items.push({ value, key: value, count: rowIDs.size }));
        if (unsetRows.size) items.push({ value: '', key: '未设置', count: unsetRows.size });
        items.sort((a, b) => b.count - a.count || a.key.localeCompare(b.key));
        return {
            items,
            hierarchyItems: options.map((option) => ({
                ...option,
                directCount: directRowsByID.get(option.id)?.size || 0,
                totalCount: totalRowsByID.get(option.id)?.size || 0,
            })),
        };
    }

    const FOCUS_STATS_CONTRACT_VERSION = 2;
    const DOCK_TOMATO_PLUGIN_ID = 'siyuan-plugin-docktomato';
    const FOCUS_STATS_DEADLINE_MS = 10000;
    const FOCUS_STATS_SCOPE_TASK_LIMIT = 10000;
    const FOCUS_STATS_CANDIDATE_LIMIT = 20000;
    const FOCUS_STATS_SNAPSHOT_TASK_LIMIT = 20000;
    const FOCUS_STATS_SNAPSHOT_BYTE_LIMIT = 8 * 1024 * 1024;

    function focusStatsScopeTooLarge(details = {}) {
        return new DomainError('FOCUS_SCOPE_TOO_LARGE', '专注统计任务范围过大', {
            maxTaskCount: FOCUS_STATS_SCOPE_TASK_LIMIT,
            ...details,
        });
    }

    function withFocusStatsDeadline(input) {
        const source = input && typeof input === 'object' ? { ...input } : {};
        const generated = Date.now() + FOCUS_STATS_DEADLINE_MS;
        const requested = Math.max(0, Number(source.deadlineAt) || 0);
        source.deadlineAt = requested > 0 ? Math.min(requested, generated) : generated;
        return source;
    }

    function assertFocusStatsDeadline(input, stage) {
        const deadlineAt = Math.max(0, Number(input?.deadlineAt) || 0);
        if (!deadlineAt || Date.now() < deadlineAt) return;
        throw new DomainError('STATS_QUERY_EXPIRED', '统计查询已超过执行期限', {
            deadlineAt,
            stage: text(stage),
        });
    }

    async function runWithFocusStatsDeadline(input, stage, operation) {
        assertFocusStatsDeadline(input, stage);
        const deadlineAt = Math.max(0, Number(input?.deadlineAt) || 0);
        const remainingMs = Math.max(1, deadlineAt - Date.now());
        const controller = typeof AbortController === 'function' ? new AbortController() : null;
        let timer = null;
        const timeout = new Promise((resolve, reject) => {
            timer = setTimeout(() => {
                try { controller?.abort?.(); } catch (e) {}
                reject(new DomainError('STATS_QUERY_EXPIRED', '统计查询已超过执行期限', {
                    deadlineAt,
                    stage: text(stage),
                }));
            }, remainingMs);
        });
        try {
            return await Promise.race([
                Promise.resolve().then(() => operation(controller?.signal)),
                timeout,
            ]);
        } finally {
            if (timer !== null) clearTimeout(timer);
        }
    }

    async function callDockTomatoRpc(method, input) {
        const requestInput = withFocusStatsDeadline(input);
        let payload;
        try {
            payload = await runWithFocusStatsDeadline(requestInput, `dock-rpc:${method}`, async (signal) => {
                const response = await siyuan.client.fetch(`/api/plugin/rpc?name=${encodeURIComponent(DOCK_TOMATO_PLUGIN_ID)}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        jsonrpc: '2.0',
                        id: token('dock_stats'),
                        method,
                        params: [requestInput],
                    }),
                    signal,
                });
                if (!response?.ok) {
                    throw new DomainError('DOCK_TOMATO_STATS_UNAVAILABLE', '底栏番茄钟统计服务不可用', {
                        method,
                        status: Number(response?.status) || 0,
                    });
                }
                try {
                    return await response.json();
                } catch (error) {
                    throw new DomainError(ERROR.STORAGE_CORRUPT, '底栏番茄钟统计响应无法解析', {
                        method,
                        cause: text(error?.message),
                    });
                }
            });
        } catch (error) {
            if (error instanceof DomainError) throw error;
            throw new DomainError('DOCK_TOMATO_STATS_UNAVAILABLE', '底栏番茄钟统计服务不可用', {
                method,
                cause: text(error?.message),
            });
        }
        if (payload?.error) {
            const rpcCode = Number(payload.error.code);
            const unavailable = rpcCode === -32001 || rpcCode === -32002;
            throw new DomainError(unavailable ? 'DOCK_TOMATO_STATS_UNAVAILABLE' : ERROR.UNSUPPORTED,
                unavailable ? '底栏番茄钟统计服务未加载' : '底栏番茄钟统计接口调用失败', {
                    method,
                    rpcCode,
                    rpcMessage: text(payload.error.message),
                });
        }

        const result = payload?.result;
        if (result?.ok !== true) {
            if (result?.ok === false && result.error) {
                throw new DomainError(text(result.error.code) || ERROR.STORAGE_ERROR,
                    text(result.error.message) || '底栏番茄钟统计失败', {
                        method,
                        ...(result.error.details && typeof result.error.details === 'object' ? result.error.details : {}),
                    });
            }
            throw new DomainError(ERROR.UNSUPPORTED, '底栏番茄钟统计响应格式不兼容', { method });
        }
        if (Number(result.data?.contractVersion) !== FOCUS_STATS_CONTRACT_VERSION) {
            throw new DomainError(ERROR.UNSUPPORTED, '底栏番茄钟统计核心不兼容', { method });
        }
        return result.data;
    }

    const queryDockTomatoFocusStats = (input) => callDockTomatoRpc('dockTomatoQueryFocus', input);
    const queryDockTomatoRoutineStats = (input) => callDockTomatoRpc('dockTomatoQueryRoutine', input);
    const listDockTomatoSessions = (input) => callDockTomatoRpc('dockTomatoListSessions', input);

    async function collectFocusSubtreeTaskIDs(rootTaskID, input) {
        const id = requireID(rootTaskID, '根任务 ID');
        assertFocusStatsDeadline(input, 'before-root-scope');
        const rows = await sql(`
            WITH RECURSIVE task_tree(id, depth) AS (
                SELECT id, 0
                FROM blocks
                WHERE id = '${escapeSql(id)}' AND type = 'i' AND subtype = 't'
                UNION ALL
                SELECT child.id, task_tree.depth + 1
                FROM task_tree
                JOIN blocks child_list
                    ON child_list.parent_id = task_tree.id AND child_list.type = 'l'
                JOIN blocks child
                    ON child.parent_id = child_list.id AND child.type = 'i' AND child.subtype = 't'
                WHERE task_tree.depth < 128
                LIMIT ${FOCUS_STATS_SCOPE_TASK_LIMIT + 1}
            )
            SELECT id, depth AS tree_depth
            FROM task_tree
            ORDER BY depth ASC, id ASC
            LIMIT ${FOCUS_STATS_SCOPE_TASK_LIMIT + 1}
        `);
        assertFocusStatsDeadline(input, 'after-root-scope');
        if (!rows.length || text(rows[0]?.id) !== id) {
            throw new DomainError(ERROR.INVALID_ARGUMENT, '根任务必须指向任务块', { rootTaskID: id });
        }
        if (rows.some((item) => Number(item?.tree_depth) >= 128)) {
            throw focusStatsScopeTooLarge({ rootTaskID: id, maxDepth: 128 });
        }
        const taskIDs = uniqueStrings(rows.map((item) => item?.id));
        if (taskIDs.length > FOCUS_STATS_SCOPE_TASK_LIMIT) {
            throw focusStatsScopeTooLarge({ rootTaskID: id, taskCount: taskIDs.length });
        }
        return taskIDs;
    }

    async function collectFocusDocumentTaskIDs(documentIDs, input) {
        const out = new Set();
        const ids = uniqueStrings(documentIDs).filter((id) => ID_RE.test(id));
        for (let offset = 0; offset < ids.length; offset += 100) {
            assertFocusStatsDeadline(input, 'document-scope');
            const chunk = ids.slice(offset, offset + 100);
            const rows = await sql(`SELECT id FROM blocks
                WHERE root_id IN (${chunk.map((id) => `'${escapeSql(id)}'`).join(',')})
                    AND type = 'i' AND subtype = 't'
                ORDER BY id ASC
                LIMIT ${FOCUS_STATS_SCOPE_TASK_LIMIT + 1}`);
            rows.forEach((row) => {
                const id = text(row?.id);
                if (id) out.add(id);
            });
            if (out.size > FOCUS_STATS_SCOPE_TASK_LIMIT) {
                throw focusStatsScopeTooLarge({ documentCount: ids.length, taskCount: out.size });
            }
        }
        return out;
    }

    async function expandFocusCandidateIDs(taskIDs, input) {
        const out = new Set(taskIDs);
        for (let offset = 0; offset < taskIDs.length; offset += 100) {
            assertFocusStatsDeadline(input, 'focus-binding-scope');
            const chunk = taskIDs.slice(offset, offset + 100);
            // 与 resolveFocusBindingsBatch 保持一致：列表归首个任务，普通子块归最近任务。
            // 在历史预筛选前保留这些旧 ID，且不越过其他任务或任务列表边界。
            const rows = await sql(`
                WITH RECURSIVE focus_seeds(id) AS (
                    SELECT id FROM blocks
                    WHERE id IN (${chunk.map((id) => `'${escapeSql(id)}'`).join(',')})
                        AND type = 'i' AND subtype = 't'
                    UNION
                    SELECT parent.id FROM blocks task
                    JOIN blocks parent ON parent.id = task.parent_id AND parent.type = 'l'
                    WHERE task.id IN (${chunk.map((id) => `'${escapeSql(id)}'`).join(',')})
                        AND task.type = 'i' AND task.subtype = 't'
                        AND task.id = (
                            SELECT child.id FROM blocks child
                            WHERE child.parent_id = parent.id AND child.type = 'i' AND child.subtype = 't'
                            ORDER BY child.sort ASC, child.created ASC, child.id ASC LIMIT 1
                        )
                ), focus_candidates(id, depth) AS (
                    SELECT id, 0 FROM focus_seeds
                    UNION ALL
                    SELECT child.id, focus_candidates.depth + 1
                    FROM focus_candidates
                    JOIN blocks child ON child.parent_id = focus_candidates.id
                    WHERE focus_candidates.depth < 29
                        AND NOT (child.type = 'i' AND COALESCE(child.subtype, '') = 't')
                        AND NOT (child.type = 'l' AND EXISTS (
                            SELECT 1 FROM blocks task
                            WHERE task.parent_id = child.id AND task.type = 'i' AND task.subtype = 't'
                        ))
                    LIMIT ${FOCUS_STATS_CANDIDATE_LIMIT + 1}
                )
                SELECT DISTINCT id FROM focus_candidates
                LIMIT ${FOCUS_STATS_CANDIDATE_LIMIT + 1}
            `);
            rows.forEach((row) => { if (text(row?.id)) out.add(text(row.id)); });
            if (out.size > FOCUS_STATS_CANDIDATE_LIMIT) {
                throw focusStatsScopeTooLarge({ candidateCount: out.size, maxCandidateCount: FOCUS_STATS_CANDIDATE_LIMIT });
            }
        }
        assertFocusStatsDeadline(input, 'focus-binding-scope-complete');
        return Array.from(out).sort();
    }

    async function resolveFocusCandidateIDs(input = {}) {
        const source = withFocusStatsDeadline(input);
        assertFocusStatsDeadline(source, 'focus-scope-start');
        const rootTaskID = text(source.rootTaskID || source.rootTaskId);
        const hasExplicitScope = !!text(source.scopeToken)
            || Object.prototype.hasOwnProperty.call(source, 'taskIDs')
            || Object.prototype.hasOwnProperty.call(source, 'taskIds')
            || Object.prototype.hasOwnProperty.call(source, 'documentIDs')
            || Object.prototype.hasOwnProperty.call(source, 'documentIds');
        if (!rootTaskID && !hasExplicitScope) return null;

        let scopedIDs = null;
        if (hasExplicitScope) {
            const rawTaskIDs = Array.isArray(source.taskIDs) ? source.taskIDs : (Array.isArray(source.taskIds) ? source.taskIds : []);
            const rawDocumentIDs = Array.isArray(source.documentIDs) ? source.documentIDs : (Array.isArray(source.documentIds) ? source.documentIds : []);
            if (rawTaskIDs.length > FOCUS_STATS_SCOPE_TASK_LIMIT || rawDocumentIDs.length > FOCUS_STATS_SCOPE_TASK_LIMIT) {
                throw focusStatsScopeTooLarge({
                    taskCount: rawTaskIDs.length,
                    documentCount: rawDocumentIDs.length,
                });
            }
            const scope = normalizeTaskScope(source);
            scopedIDs = new Set(scope.taskIDs);
            if (scopedIDs.size > FOCUS_STATS_SCOPE_TASK_LIMIT || scope.documentIDs.length > FOCUS_STATS_SCOPE_TASK_LIMIT) {
                throw focusStatsScopeTooLarge({ taskCount: scopedIDs.size, documentCount: scope.documentIDs.length });
            }
            const documentTaskIDs = await collectFocusDocumentTaskIDs(scope.documentIDs, source);
            documentTaskIDs.forEach((id) => scopedIDs.add(id));
            if (scopedIDs.size > FOCUS_STATS_SCOPE_TASK_LIMIT) {
                throw focusStatsScopeTooLarge({ taskCount: scopedIDs.size });
            }
        }

        let rootIDs = null;
        if (rootTaskID) rootIDs = new Set(await collectFocusSubtreeTaskIDs(rootTaskID, source));
        const candidateIDs = rootIDs && scopedIDs
            ? Array.from(rootIDs).filter((id) => scopedIDs.has(id))
            : Array.from(rootIDs || scopedIDs || []);
        if (candidateIDs.length > FOCUS_STATS_SCOPE_TASK_LIMIT) {
            throw focusStatsScopeTooLarge({ taskCount: candidateIDs.length });
        }
        assertFocusStatsDeadline(source, 'focus-scope-complete');
        return expandFocusCandidateIDs(candidateIDs, source);
    }

    function focusStatsUtf8ByteLength(value) {
        const source = String(value == null ? '' : value);
        let bytes = 0;
        for (let index = 0; index < source.length; index += 1) {
            const code = source.charCodeAt(index);
            if (code < 0x80) bytes += 1;
            else if (code < 0x800) bytes += 2;
            else if (code >= 0xD800 && code <= 0xDBFF && index + 1 < source.length
                && source.charCodeAt(index + 1) >= 0xDC00 && source.charCodeAt(index + 1) <= 0xDFFF) {
                bytes += 4;
                index += 1;
            } else bytes += 3;
        }
        return bytes;
    }

    function focusStatsSnapshotTooLarge(details = {}) {
        return new DomainError('FOCUS_SCOPE_TOO_LARGE', '任务统计快照过大', {
            maxTaskCount: FOCUS_STATS_SNAPSHOT_TASK_LIMIT,
            maxSnapshotBytes: FOCUS_STATS_SNAPSHOT_BYTE_LIMIT,
            ...details,
        });
    }

    function normalizeFocusTaskSnapshot(value, options = {}) {
        const source = value && typeof value === 'object' ? value : {};
        const rows = Array.isArray(source.tasks) ? source.tasks : (Array.isArray(value) ? value : []);
        if (rows.length > FOCUS_STATS_SNAPSHOT_TASK_LIMIT) throw focusStatsSnapshotTooLarge({ taskCount: rows.length });
        const customFieldID = text(options?.groupBy) === 'customField'
            ? text(options?.customFieldID || options?.customFieldId)
            : '';
        const tasks = new Map();
        const aliases = new Map();
        let snapshotBytes = 2;
        rows.forEach((row) => {
            if (!(row && typeof row === 'object')) return;
            const id = text(row.id || row.taskID || row.taskId);
            if (!id || tasks.has(id)) return;
            const aliasIDs = uniqueStrings([id].concat(Array.isArray(row.aliasIDs) ? row.aliasIDs : (Array.isArray(row.aliasIds) ? row.aliasIds : [])));
            const task = {
                id,
                aliasIDs,
                parentTaskID: text(row.parentTaskID || row.parentTaskId || row.parent_task_id),
                documentID: text(row.documentID || row.documentId || row.docId || row.root_id),
                documentName: text(row.documentName || row.docName || row.doc),
                h2: text(row.h2 || row.h2Name || row.headingName),
                h2Id: text(row.h2Id || row.h2_id || row.headingId),
                h2Path: text(row.h2Path),
                title: text(row.title || row.content) || '未命名任务',
                done: row.done === true,
                customStatus: text(row.customStatus || row.custom_status),
                customStatusName: text(row.customStatusName),
                priority: text(row.priority),
                priorityName: text(row.priorityName),
                customFieldValues: customFieldID && row.customFieldValues && typeof row.customFieldValues === 'object'
                    ? { [customFieldID]: row.customFieldValues[customFieldID] }
                    : {},
                duration: row.duration,
                tomatoEstimateCount: row.tomatoEstimateCount,
                created: text(row.created),
            };
            let serialized = '';
            try { serialized = JSON.stringify(task); } catch (error) { throw focusStatsSnapshotTooLarge({ reason: 'not-serializable' }); }
            snapshotBytes += focusStatsUtf8ByteLength(serialized) + 1;
            if (snapshotBytes > FOCUS_STATS_SNAPSHOT_BYTE_LIMIT) {
                throw focusStatsSnapshotTooLarge({ taskCount: tasks.size + 1, bytes: snapshotBytes });
            }
            tasks.set(id, task);
            aliasIDs.forEach((alias) => { if (!aliases.has(alias)) aliases.set(alias, id); });
        });
        return { tasks, aliases, revision: Math.max(0, Number(source.revision) || 0), byteLength: snapshotBytes };
    }

    function snapshotTaskAncestors(taskID, snapshot) {
        const out = [];
        const seen = new Set([text(taskID)]);
        let parentID = text(snapshot?.tasks?.get(text(taskID))?.parentTaskID);
        while (parentID && !seen.has(parentID) && out.length < 200) {
            seen.add(parentID);
            out.push(parentID);
            parentID = text(snapshot.tasks.get(parentID)?.parentTaskID);
        }
        return out.reverse();
    }

    function normalizeSemanticTask(task, ancestorTaskIDs = []) {
        if (!(task && typeof task === 'object')) return null;
        return {
            id: text(task.id),
            aliasIDs: uniqueStrings([task.id].concat(task.aliasIDs || [])),
            parentTaskID: text(task.parentTaskID),
            ancestorTaskIDs: uniqueStrings(ancestorTaskIDs),
            documentID: text(task.documentID),
            documentName: text(task.documentName),
            h2: text(task.h2 || task.h2Name || task.headingName),
            h2Id: text(task.h2Id || task.h2_id || task.headingId),
            h2Path: text(task.h2Path),
            title: text(task.title) || '未命名任务',
            done: task.done === true,
            customStatus: text(task.customStatus),
            customStatusName: text(task.customStatusName),
            priority: text(task.priority),
            priorityName: text(task.priorityName),
            customFieldValues: task.customFieldValues && typeof task.customFieldValues === 'object' ? { ...task.customFieldValues } : {},
            duration: task.duration,
            tomatoEstimateCount: task.tomatoEstimateCount,
            created: text(task.created),
        };
    }

    function createSnapshotTaskResolver(snapshotValue, options = {}) {
        const snapshot = normalizeFocusTaskSnapshot(snapshotValue, options);
        return {
            snapshot,
            async preload() {},
            async resolve(candidateIDs) {
                for (const candidate of uniqueStrings(candidateIDs)) {
                    const id = snapshot.aliases.get(candidate) || (snapshot.tasks.has(candidate) ? candidate : '');
                    if (!id) continue;
                    const task = snapshot.tasks.get(id);
                    return normalizeSemanticTask(task, snapshotTaskAncestors(id, snapshot));
                }
                return null;
            },
            async get(taskID) {
                const id = snapshot.aliases.get(text(taskID)) || text(taskID);
                const task = snapshot.tasks.get(id);
                return task ? normalizeSemanticTask(task, snapshotTaskAncestors(id, snapshot)) : null;
            },
        };
    }

    function createCompositeTaskResolver(snapshotValue, options = {}) {
        const snapshotResolver = createSnapshotTaskResolver(snapshotValue, options);
        let kernelResolverPromise = null;
        const kernelResolver = () => {
            if (!kernelResolverPromise) kernelResolverPromise = createKernelTaskResolver(options);
            return kernelResolverPromise;
        };
        return {
            snapshot: snapshotResolver.snapshot,
            async preload(candidateGroups, control = options) {
                const missing = [];
                const groups = Array.isArray(candidateGroups) ? candidateGroups : [];
                for (let index = 0; index < groups.length; index += 1) {
                    if (index % 256 === 0) assertFocusStatsDeadline(control, 'snapshot-preload');
                    const group = groups[index];
                    if (!await snapshotResolver.resolve(group)) missing.push(group);
                }
                if (missing.length) await (await kernelResolver()).preload(missing, control);
            },
            async resolve(candidateIDs) {
                const projected = await snapshotResolver.resolve(candidateIDs);
                if (projected) return projected;
                const persisted = await (await kernelResolver()).resolve(candidateIDs);
                if (!persisted) return null;
                return await snapshotResolver.get(persisted.id) || persisted;
            },
            async get(taskID) {
                const projected = await snapshotResolver.get(taskID);
                if (projected) return projected;
                return (await kernelResolver()).get(taskID);
            },
        };
    }

    async function readFocusBlockRolesBatch(blockIDs, control = {}) {
        const result = new Map();
        const ids = uniqueStrings(blockIDs);
        for (let offset = 0; offset < ids.length; offset += 200) {
            assertFocusStatsDeadline(control, 'task-binding-role-batch');
            const chunk = ids.slice(offset, offset + 200);
            const rows = await sql(`SELECT id, parent_id, root_id, type, subtype FROM blocks WHERE id IN (${chunk.map((id) => `'${escapeSql(id)}'`).join(',')})`);
            rows.forEach((row) => result.set(text(row.id), row));
        }
        return result;
    }

    async function readFocusListTasksBatch(listIDs, control = {}) {
        const result = new Map();
        const ids = uniqueStrings(listIDs);
        for (let offset = 0; offset < ids.length; offset += 100) {
            assertFocusStatsDeadline(control, 'task-binding-list-batch');
            const chunk = ids.slice(offset, offset + 100);
            const rows = await sql(`
                SELECT source.id AS list_id,
                    COALESCE((
                        SELECT child.id FROM blocks child
                        WHERE child.parent_id = source.id AND child.type = 'i' AND child.subtype = 't'
                        ORDER BY child.sort ASC, child.created ASC, child.id ASC
                        LIMIT 1
                    ), '') AS task_id
                FROM blocks source
                WHERE source.id IN (${chunk.map((id) => `'${escapeSql(id)}'`).join(',')})
            `);
            rows.forEach((row) => result.set(text(row.list_id), text(row.task_id)));
        }
        return result;
    }

    async function resolveFocusBindingsBatch(candidateGroups, control = {}) {
        const groups = (Array.isArray(candidateGroups) ? candidateGroups : [])
            .map((group) => uniqueStrings(group))
            .filter((group) => group.length);
        const resolved = new Map();
        const active = new Map(uniqueStrings(groups.flat()).map((id) => [id, {
            currentID: id,
            seen: new Set([id]),
        }]));
        for (let depth = 0; active.size && depth < 30; depth += 1) {
            assertFocusStatsDeadline(control, 'task-binding-depth');
            const roles = await readFocusBlockRolesBatch(Array.from(active.values(), (state) => state.currentID), control);
            const listTasks = await readFocusListTasksBatch(Array.from(roles.values())
                .filter((row) => text(row?.type).toLowerCase() === 'l')
                .map((row) => text(row.id)), control);
            for (const [candidateID, state] of active) {
                const row = roles.get(state.currentID);
                if (!row) {
                    resolved.set(candidateID, null);
                    active.delete(candidateID);
                    continue;
                }
                const type = text(row.type).toLowerCase();
                const subtype = text(row.subtype).toLowerCase();
                const taskID = type === 'i' && subtype === 't'
                    ? text(row.id)
                    : (type === 'l' ? text(listTasks.get(text(row.id))) : '');
                if (taskID) {
                    resolved.set(candidateID, taskID);
                    active.delete(candidateID);
                    continue;
                }
                const parentID = text(row.parent_id);
                if (!parentID || state.seen.has(parentID)) {
                    resolved.set(candidateID, null);
                    active.delete(candidateID);
                    continue;
                }
                state.seen.add(parentID);
                state.currentID = parentID;
            }
        }
        active.forEach((_state, candidateID) => resolved.set(candidateID, null));
        const taskIDs = new Set();
        groups.forEach((group) => {
            const taskID = group.map((candidate) => text(resolved.get(candidate))).find(Boolean) || '';
            group.forEach((candidate) => resolved.set(candidate, taskID || null));
            if (taskID) taskIDs.add(taskID);
        });
        return { resolved, taskIDs };
    }

    async function readFocusTaskRowsBatch(taskIDs, control = {}) {
        const result = new Map();
        let frontier = uniqueStrings(taskIDs);
        let depth = 0;
        while (frontier.length && depth < 200) {
            const pending = frontier.filter((id) => !result.has(id));
            if (!pending.length) break;
            const next = [];
            for (let offset = 0; offset < pending.length; offset += 100) {
                assertFocusStatsDeadline(control, 'focus-task-row-batch');
                const chunk = pending.slice(offset, offset + 100);
                const rows = await sql(`
                    SELECT
                        task.id,
                        task.markdown,
                        task.content AS raw_content,
                        task.parent_id,
                        task.root_id,
                        task.created,
                        task.updated,
                        COALESCE(doc.content, '') AS doc_name,
                        COALESCE(doc.hpath, '') AS doc_path,
                        COALESCE(parent.type, '') AS parent_type,
                        COALESCE(CASE WHEN list_parent.type = 'i' AND list_parent.subtype = 't' THEN list_parent.id ELSE '' END, '') AS parent_task_id,
                        0 AS parent_task_count,
                        '' AS first_task_id,
                        '' AS previous_sibling_id,
                        '' AS next_sibling_id
                    FROM blocks task
                    LEFT JOIN blocks doc ON doc.id = task.root_id
                    LEFT JOIN blocks parent ON parent.id = task.parent_id
                    LEFT JOIN blocks list_parent ON list_parent.id = parent.parent_id
                    WHERE task.id IN (${chunk.map((id) => `'${escapeSql(id)}'`).join(',')})
                        AND task.type = 'i' AND task.subtype = 't'
                `);
                rows.forEach((row) => {
                    const id = text(row.id);
                    if (!id) return;
                    result.set(id, row);
                    const parentID = text(row.parent_task_id);
                    if (parentID && !result.has(parentID)) next.push(parentID);
                });
            }
            frontier = uniqueStrings(next);
            depth += 1;
        }
        return result;
    }

    async function readFocusTaskAttrsBatch(taskIDs, attrNames = [], control = {}) {
        const result = new Map(uniqueStrings(taskIDs).map((id) => [id, {}]));
        const ids = Array.from(result.keys());
        const names = uniqueStrings(attrNames);
        if (!names.length) return result;
        for (let offset = 0; offset < ids.length; offset += 200) {
            assertFocusStatsDeadline(control, 'focus-task-attr-batch');
            const chunk = ids.slice(offset, offset + 200);
            const rows = await sql(`SELECT block_id, name, value FROM attributes WHERE block_id IN (${chunk.map((id) => `'${escapeSql(id)}'`).join(',')}) AND name IN (${names.map((name) => `'${escapeSql(name)}'`).join(',')})`);
            rows.forEach((row) => {
                const id = text(row.block_id);
                const name = text(row.name);
                if (result.has(id) && name) result.get(id)[name] = String(row.value == null ? '' : row.value);
            });
        }
        return result;
    }

    function focusTaskAttributeProjection(registry, customFieldID = '') {
        const fieldIDs = ['customStatus', 'priority', 'duration', 'tomatoEstimateCount'];
        if (customFieldID) fieldIDs.push(customFieldID);
        const fields = fieldIDs.map((fieldID) => registry?.byId?.get(fieldID)).filter(Boolean);
        return {
            attrNames: uniqueStrings(fields.flatMap((field) => [field.attr].concat(field.aliases || []))),
            fields,
        };
    }

    function decodeFocusTaskAttributes(attrs, projection, customFieldID = '') {
        const source = attrs && typeof attrs === 'object' ? attrs : {};
        const result = { customFieldValues: {} };
        (projection?.fields || []).forEach((field) => {
            const raw = uniqueStrings([field.attr].concat(field.aliases || []))
                .map((name) => own(source, name) ? String(source[name] == null ? '' : source[name]) : '')
                .find((value) => value !== '') || '';
            if (field.custom) {
                if (field.id === customFieldID) result.customFieldValues[field.id] = raw;
            } else if (field.type === 'boolean') result[field.id] = raw === '1' || raw === 'true';
            else if (field.type === 'number') result[field.id] = raw === '' ? null : Number(raw);
            else result[field.id] = raw;
        });
        return result;
    }

    function focusTaskDTOFromBatchRow(row, attrs, registry, fields, attrProjection, customFieldID) {
        const context = buildAttrContext(row);
        const dto = {
            id: text(row.id),
            title: taskOwnTitle(row),
            markdown: String(row.markdown || ''),
            done: parseDone(row.markdown),
            parentListID: text(row.parent_id),
            parentTaskID: text(row.parent_task_id),
            parentType: text(row.parent_type),
            documentID: text(row.root_id),
            documentName: text(row.doc_name),
            documentPath: text(row.doc_path),
            created: text(row.created),
            updated: text(row.updated),
            attrHostID: context.primaryHostID,
            attrHostState: context.state,
            priorityScore: null,
            ...decodeFocusTaskAttributes(attrs, attrProjection, customFieldID),
        };
        return projectTaskDTO(applyTaskDisplayNames(dto, registry), fields);
    }

    async function createKernelTaskResolver(options = {}) {
        const registry = await getFieldRegistry();
        const tasks = new Map();
        const candidates = new Map();
        const customFieldID = text(options?.groupBy) === 'customField'
            ? text(options?.customFieldID || options?.customFieldId)
            : '';
        const fields = ['documentName', 'created', 'customStatus', 'priority', 'duration', 'tomatoEstimateCount'];
        if (customFieldID) fields.push('customFieldValues');
        const attrProjection = focusTaskAttributeProjection(registry, customFieldID);
        const preload = async (candidateGroups, control = options) => {
            const groups = (Array.isArray(candidateGroups) ? candidateGroups : [])
                .map((group) => uniqueStrings(group))
                .filter((group) => group.length);
            const bindings = await resolveFocusBindingsBatch(groups, control);
            bindings.resolved.forEach((taskID, candidateID) => candidates.set(candidateID, taskID));
            const rows = await readFocusTaskRowsBatch(Array.from(bindings.taskIDs), control);
            const attrs = await readFocusTaskAttrsBatch(Array.from(rows.keys()), attrProjection.attrNames, control);
            rows.forEach((row, id) => {
                const ancestors = [];
                const seen = new Set([id]);
                let parentID = text(row.parent_task_id);
                while (parentID && !seen.has(parentID) && ancestors.length < 200) {
                    seen.add(parentID);
                    ancestors.unshift(parentID);
                    parentID = text(rows.get(parentID)?.parent_task_id);
                }
                const dto = focusTaskDTOFromBatchRow(row, attrs.get(id), registry, fields, attrProjection, customFieldID);
                tasks.set(id, normalizeSemanticTask(dto, ancestors));
            });
        };
        const loadTask = async (taskID) => {
            const id = text(taskID);
            if (!id) return null;
            if (tasks.has(id)) return tasks.get(id);
            assertFocusStatsDeadline(options, 'focus-task-load');
            let task = null;
            try {
                const [dto, context] = await Promise.all([
                    taskDTO(id, fields, registry),
                    readTaskTreeContext(id),
                ]);
                task = normalizeSemanticTask({
                    ...dto,
                    parentTaskID: context.parentTaskID,
                }, context.ancestorTaskIDs);
            } catch (e) {}
            tasks.set(id, task);
            return task;
        };
        return {
            snapshot: null,
            preload,
            async resolve(candidateIDs) {
                const ids = uniqueStrings(candidateIDs);
                const missing = ids.filter((candidate) => !candidates.has(candidate));
                if (missing.length) await preload([missing], options);
                for (const candidate of ids) {
                    const cachedID = candidates.get(candidate);
                    if (cachedID && tasks.has(cachedID)) return tasks.get(cachedID);
                }
                return null;
            },
            get: loadTask,
        };
    }

    function makeFocusAggregate() {
        return {
            focusSec: 0,
            countdownSec: 0,
            stopwatchSec: 0,
            distractionCount: 0,
            sessionCount: 0,
            focusSessionCount: 0,
            completedSessionCount: 0,
            countdownSessionCount: 0,
            stopwatchSessionCount: 0,
            lastEndMs: 0,
            buckets: new Map(),
        };
    }

    function mergeFocusStats(target, source) {
        target.focusSec += Number(source?.focusSec) || 0;
        target.countdownSec += Number(source?.countdownSec) || 0;
        target.stopwatchSec += Number(source?.stopwatchSec) || 0;
        target.distractionCount += Math.max(0, Number(source?.distractionCount) || 0);
        target.sessionCount += Math.max(0, Number(source?.sessionCount) || 0);
        target.focusSessionCount += Math.max(0, Number(source?.focusSessionCount) || 0);
        target.completedSessionCount += Math.max(0, Number(source?.completedSessionCount) || 0);
        target.countdownSessionCount += Math.max(0, Number(source?.countdownSessionCount) || 0);
        target.stopwatchSessionCount += Math.max(0, Number(source?.stopwatchSessionCount) || 0);
        target.lastEndMs = Math.max(target.lastEndMs, Number(source?.lastEndMs) || 0);
        (Array.isArray(source?.buckets) ? source.buckets : []).forEach((bucket) => {
            const key = text(bucket?.key);
            if (!key) return;
            if (!target.buckets.has(key)) target.buckets.set(key, { key, from: bucket.from, to: bucket.to, ...makeFocusAggregate() });
            mergeFocusStats(target.buckets.get(key), { ...bucket, buckets: [] });
        });
        return target;
    }

    function serializeFocusAggregate(value) {
        return {
            focusSec: value.focusSec,
            countdownSec: value.countdownSec,
            stopwatchSec: value.stopwatchSec,
            distractionCount: value.distractionCount,
            sessionCount: value.sessionCount,
            focusSessionCount: value.focusSessionCount,
            countdownSessionCount: value.countdownSessionCount,
            stopwatchSessionCount: value.stopwatchSessionCount,
            completedSessionCount: value.completedSessionCount,
            lastEndMs: value.lastEndMs,
            buckets: Array.from(value.buckets.values()).map((bucket) => ({
                key: bucket.key,
                from: bucket.from,
                to: bucket.to,
                ...serializeFocusAggregate({ ...bucket, buckets: new Map() }),
            })),
        };
    }

    function taskMatchesFocusScope(task, scope, taskIDs, documentIDs) {
        if (!scope) return true;
        if (!scope.taskIDs.length && !scope.documentIDs.length) return false;
        if (scope.scopeMode === 'documents' && scope.documentIDs.length) return documentIDs.has(task.documentID);
        if (scope.taskIDs.length) return taskIDs.has(task.id);
        if (scope.documentIDs.length) return documentIDs.has(task.documentID);
        return true;
    }

    function classificationValues(task, options, resolverTasks) {
        const groupBy = text(options?.groupBy || 'task');
        if (groupBy === 'document') return [{ id: task.documentID || '__unset', label: task.documentName || '未命名文档' }];
        if (groupBy === 'status') return [{ id: task.customStatus || '__unset', label: task.customStatusName || task.customStatus || '未设置' }];
        if (groupBy === 'priority') return [{ id: task.priority || 'none', label: task.priorityName || resolvePriorityName(task.priority) }];
        if (groupBy === 'customField') {
            const fieldID = text(options?.customFieldID || options?.customFieldId);
            const raw = task.customFieldValues?.[fieldID];
            const values = Array.isArray(raw) ? raw : (text(raw) ? [raw] : []);
            return values.length
                ? uniqueStrings(values).map((value) => ({ id: value, label: value }))
                : [{ id: '__unset', label: '未设置' }];
        }
        if (groupBy === 'parent') {
            const parentID = task.parentTaskID || task.id;
            const parent = resolverTasks.get(parentID);
            return [{ id: parentID, label: parent?.title || (parentID === task.id ? task.title : '父任务') }];
        }
        return [{ id: task.id, label: task.title }];
    }

    function pruneEmptyFocusBuckets(stats) {
        const seen = new Set();
        const prune = (aggregate) => {
            if (!aggregate || typeof aggregate !== 'object' || seen.has(aggregate)) return;
            seen.add(aggregate);
            if (!Array.isArray(aggregate.buckets)) return;
            aggregate.buckets = aggregate.buckets.filter((bucket) => Number(bucket?.focusSec) > 0);
        };
        prune(stats?.totals);
        prune(stats?.unattributed);
        (Array.isArray(stats?.tasks) ? stats.tasks : []).forEach(prune);
        (Array.isArray(stats?.classification) ? stats.classification : []).forEach(prune);
        const detail = stats?.parentDetail && typeof stats.parentDetail === 'object' ? stats.parentDetail : null;
        if (detail) ['self', 'descendants', 'combined'].forEach((key) => prune(detail[key]));
        return stats;
    }

    async function projectFocusStatistics(rawStats, input = {}, snapshotValue = null) {
        if (Number(rawStats?.contractVersion) !== FOCUS_STATS_CONTRACT_VERSION) {
            throw new DomainError(ERROR.UNSUPPORTED, '番茄统计数据契约不兼容');
        }
        const source = input && typeof input === 'object' ? input : {};
        assertFocusStatsDeadline(source, 'task-projection-start');
        const hasExplicitScope = !!text(source.scopeToken)
            || Object.prototype.hasOwnProperty.call(source, 'taskIDs')
            || Object.prototype.hasOwnProperty.call(source, 'taskIds')
            || Object.prototype.hasOwnProperty.call(source, 'documentIDs')
            || Object.prototype.hasOwnProperty.call(source, 'documentIds');
        const scope = hasExplicitScope ? normalizeTaskScope(source) : null;
        const scopeTaskIDs = new Set(scope?.taskIDs || []);
        const scopeDocumentIDs = new Set(scope?.documentIDs || []);
        const resolver = snapshotValue ? createCompositeTaskResolver(snapshotValue, source) : await createKernelTaskResolver(source);
        const taskAggregates = new Map();
        const taskObjects = new Map();
        const unattributed = makeFocusAggregate();
        const associations = Array.isArray(rawStats?.associations) ? rawStats.associations : [];
        await resolver.preload(associations.map((association) => association?.candidateIds || []), source);
        assertFocusStatsDeadline(source, 'task-projection-preloaded');

        for (let associationIndex = 0; associationIndex < associations.length; associationIndex += 1) {
            if (associationIndex % 128 === 0) assertFocusStatsDeadline(source, 'task-projection-scan');
            const association = associations[associationIndex];
            const task = await resolver.resolve(association?.candidateIds || []);
            if (!task || !taskMatchesFocusScope(task, scope, scopeTaskIDs, scopeDocumentIDs)) {
                if (!scope && (!task || !(association?.candidateIds || []).length)) mergeFocusStats(unattributed, association);
                continue;
            }
            taskObjects.set(task.id, task);
            if (!taskAggregates.has(task.id)) taskAggregates.set(task.id, makeFocusAggregate());
            mergeFocusStats(taskAggregates.get(task.id), association);
            for (const ancestorID of task.ancestorTaskIDs) {
                if (!taskObjects.has(ancestorID)) {
                    const ancestor = await resolver.get(ancestorID);
                    if (ancestor) taskObjects.set(ancestorID, ancestor);
                }
            }
        }

        const total = makeFocusAggregate();
        taskAggregates.forEach((aggregate) => mergeFocusStats(total, serializeFocusAggregate(aggregate)));
        if (!scope) mergeFocusStats(total, serializeFocusAggregate(unattributed));

        const tasks = Array.from(taskAggregates.entries()).map(([taskID, aggregate]) => ({
            ...taskObjects.get(taskID),
            ...serializeFocusAggregate(aggregate),
        })).sort((a, b) => b.lastEndMs - a.lastEndMs || b.focusSec - a.focusSec);

        const classification = new Map();
        tasks.forEach((task) => {
            classificationValues(task, source, taskObjects).forEach((item) => {
                if (!classification.has(item.id)) classification.set(item.id, { id: item.id, label: item.label, aggregate: makeFocusAggregate() });
                mergeFocusStats(classification.get(item.id).aggregate, task);
            });
        });

        let parentDetail = null;
        const rootTaskID = text(source.rootTaskID || source.rootTaskId);
        if (rootTaskID) {
            const self = taskAggregates.get(rootTaskID) || makeFocusAggregate();
            const descendants = makeFocusAggregate();
            tasks.filter((task) => task.id !== rootTaskID && task.ancestorTaskIDs.includes(rootTaskID))
                .forEach((task) => mergeFocusStats(descendants, task));
            const combined = makeFocusAggregate();
            mergeFocusStats(combined, serializeFocusAggregate(self));
            mergeFocusStats(combined, serializeFocusAggregate(descendants));
            parentDetail = {
                taskID: rootTaskID,
                self: serializeFocusAggregate(self),
                descendants: serializeFocusAggregate(descendants),
                combined: serializeFocusAggregate(combined),
            };
        }
        assertFocusStatsDeadline(source, 'task-projection-complete');

        const projected = {
            contractVersion: FOCUS_STATS_CONTRACT_VERSION,
            range: rawStats.range,
            totals: serializeFocusAggregate(total),
            tasks,
            unattributed: serializeFocusAggregate(unattributed),
            classification: Array.from(classification.values()).map((item) => ({
                id: item.id,
                label: item.label,
                ...serializeFocusAggregate(item.aggregate),
            })).sort((a, b) => b.focusSec - a.focusSec),
            parentDetail,
            meta: {
                ...(rawStats.meta || {}),
                taskSnapshotRevision: resolver.snapshot?.revision || 0,
                taskScope: scope ? taskScopeCoverage(scope) : null,
            },
        };
        // 明细弹窗只需要有记录的日子；默认保留空桶以兼容现有统计消费方。
        if (source.dropEmptyBuckets === true) pruneEmptyFocusBuckets(projected);
        return projected;
    }

    async function queryFocusStatistics(input, snapshotValue = null) {
        const options = withFocusStatsDeadline(input);
        const candidateIDs = await resolveFocusCandidateIDs(options);
        const dockOptions = { ...options };
        if (candidateIDs !== null) {
            dockOptions.candidateIDs = candidateIDs;
            dockOptions.candidateIDsConstrainTotals = true;
        }
        assertFocusStatsDeadline(options, 'before-dock-query');
        const raw = await queryDockTomatoFocusStats(dockOptions);
        assertFocusStatsDeadline(options, 'after-dock-query');
        return projectFocusStatistics(raw, options, snapshotValue);
    }

    function withDefaultStatisticsRange(input) {
        const source = input && typeof input === 'object' ? { ...input } : {};
        const to = text(source.to) || new Date().toISOString();
        const toMs = Date.parse(to);
        if (!Number.isFinite(toMs)) throw new DomainError(ERROR.INVALID_ARGUMENT, 'to 不是有效时间');
        const from = text(source.from) || new Date(toMs - 30 * 86400000).toISOString();
        const fromMs = Date.parse(from);
        if (!Number.isFinite(fromMs) || toMs <= fromMs) throw new DomainError(ERROR.INVALID_ARGUMENT, 'from/to 必须构成有效时间范围');
        return { ...source, from, to };
    }

    async function queryAgentFocusStatistics(input) {
        requireAction(input, 'query');
        return queryFocusStatistics(withDefaultStatisticsRange(input));
    }

    async function queryAgentRoutineStatistics(input) {
        requireAction(input, 'query');
        return queryDockTomatoRoutineStats(withDefaultStatisticsRange(input));
    }

    async function listAgentFocusSessions(input) {
        requireAction(input, 'query');
        const options = withFocusStatsDeadline(withDefaultStatisticsRange(input));
        const result = await listDockTomatoSessions(options);
        assertFocusStatsDeadline(options, 'focus-session-projection-start');
        const resolver = await createKernelTaskResolver(options);
        const items = [];
        const resultItems = Array.isArray(result?.items) ? result.items : [];
        await resolver.preload(resultItems.map((item) => item?.candidateIds || []), options);
        for (let itemIndex = 0; itemIndex < resultItems.length; itemIndex += 1) {
            if (itemIndex % 128 === 0) assertFocusStatsDeadline(options, 'focus-session-projection-scan');
            const item = resultItems[itemIndex];
            const task = await resolver.resolve(item?.candidateIds || []);
            items.push({
                ...item,
                task: task ? {
                    id: task.id,
                    title: task.title,
                    documentID: task.documentID,
                    documentName: task.documentName,
                } : null,
            });
        }
        return { ...result, items };
    }

    async function aggregateTaskStats(input) {
        const source = input && typeof input === 'object' ? input : {};
        const scope = normalizeTaskScope(source);
        const completed = await getCompletedTaskRows(source);
        const rows = completed.rows;
        const period = ['day', 'week', 'month', 'year'].includes(text(source.period)) ? text(source.period) : 'month';
        return {
            totalCompleted: rows.length,
            period,
            trend: countBy(rows.filter((row) => text(row.completed_at)), (row) => periodKey(row.completed_at, period)).sort((a, b) => a.key.localeCompare(b.key)),
            byDocument: countBy(rows, (row) => row.doc_name || row.root_id),
            byStatus: countByLabeled(rows, (row) => row.custom_status, (value) => resolveStatusName(value, completed.registry)),
            byPriority: countByLabeled(rows, (row) => row.priority, resolvePriorityName),
            byCustomField: completed.customFields.map(({ field, alias }) => ({
                fieldID: field.id,
                label: text(field.label || field.name) || field.id,
                ...customFieldBreakdown(rows, field, alias),
            })),
            coverage: {
                from: text(source.from),
                to: text(source.to),
                completedInScope: completed.completedInScope,
                missingCompletionTime: completed.missingCompletionTime,
                source: 'done+taskCompleteAt',
                ...taskScopeCoverage(scope),
            },
            customFieldDefinitions: customFieldDefinitions(completed.registry),
            statusDefinitions: statusDefinitions(completed.registry),
            priorityDefinitions: priorityDefinitions(),
        };
    }

    function normalizeDurationUnit(value) {
        return text(value).toLowerCase() === 'minutes' ? 'minutes' : 'hours';
    }

    function parseDurationMinutes(value, unit = 'hours') {
        const raw = text(value);
        if (!raw) return null;
        if (/^-/.test(raw)) return null;
        const normalizedUnit = normalizeDurationUnit(unit);
        const clock = /^(\d+)\s*:\s*([0-5]\d)$/.exec(raw);
        if (clock) return Number(clock[1]) * 60 + Number(clock[2]);
        if (/^\d+(?:\.\d+)?$/.test(raw)) {
            const n = Number(raw);
            if (!Number.isFinite(n) || n < 0) return null;
            return normalizedUnit === 'minutes' ? n : n * 60;
        }
        let minutes = 0;
        let matched = false;
        const re = /(\d+(?:\.\d+)?)\s*(天|小时|时|分钟|分|days?|day|d|hours?|hour|hrs?|hr|h|minutes?|minute|mins?|min|m)/gi;
        let match;
        while ((match = re.exec(raw))) {
            const amount = Number(match[1]);
            if (!Number.isFinite(amount) || amount < 0) continue;
            const token = text(match[2]).toLowerCase();
            matched = true;
            if (token === '天' || token === 'day' || token === 'days' || token === 'd') minutes += amount * 1440;
            else if (token === '小时' || token === '时' || token === 'hour' || token === 'hours' || token === 'hr' || token === 'hrs' || token === 'h') minutes += amount * 60;
            else minutes += amount;
        }
        return matched ? minutes : null;
    }

    async function aggregateTimeUsage(input) {
        const source = input && typeof input === 'object' ? input : {};
        const scope = normalizeTaskScope(source);
        const effectiveTo = text(source.to) || new Date().toISOString();
        const effectiveToMs = Date.parse(effectiveTo);
        if (!Number.isFinite(effectiveToMs)) throw new DomainError(ERROR.INVALID_ARGUMENT, 'to 不是有效时间');
        const effectiveFrom = text(source.from) || new Date(effectiveToMs - 30 * 86400000).toISOString();
        const effectiveFromMs = Date.parse(effectiveFrom);
        if (!Number.isFinite(effectiveFromMs) || !Number.isFinite(effectiveToMs) || effectiveToMs <= effectiveFromMs) {
            throw new DomainError(ERROR.INVALID_ARGUMENT, 'from/to 必须构成有效时间范围');
        }
        const registry = await getFieldRegistry();
        const settings = await getSettings();
        const durationUnit = normalizeDurationUnit(settings.durationFormat);
        const durationField = registry.byId.get('duration');
        const estimateExpr = completionAttrExpression([durationField.attr].concat(durationField.aliases || []));
        const taskConditions = ["t.type = 'i'", "t.subtype = 't'"];
        appendTaskScopeConditions(taskConditions, scope, 't');
        const rows = await sql(`SELECT t.id, ${estimateExpr} AS estimate FROM blocks t WHERE ${taskConditions.join(' AND ')}`);
        let estimatedMinutes = 0;
        let estimateAvailable = 0;
        rows.forEach((row) => {
            const estimate = parseDurationMinutes(row.estimate, durationUnit);
            if (estimate != null) { estimatedMinutes += estimate; estimateAvailable += 1; }
        });
        const scopedTaskIDs = new Set(rows.map((row) => text(row.id)).filter(Boolean));
        const scopeRestricted = scope.tokenBacked || scope.taskIDs.length > 0 || scope.documentIDs.length > 0;
        const schedules = (await loadSchedules()).filter((item) => {
            if (scopeRestricted && !scopedTaskIDs.has(text(item.taskId || item.task_id || item.linkedTaskId))) return false;
            const startMs = Date.parse(item.start);
            const endMs = Date.parse(item.end);
            if (Number.isFinite(endMs) && endMs <= effectiveFromMs) return false;
            if (Number.isFinite(startMs) && startMs >= effectiveToMs) return false;
            return true;
        });
        let plannedMinutes = 0;
        let plannedAvailable = 0;
        schedules.forEach((item) => {
            let minutes = Number(item.plannedMinutes);
            if (!Number.isFinite(minutes) || minutes <= 0) {
                const start = Date.parse(item.start);
                const end = Date.parse(item.end);
                minutes = Number.isFinite(start) && Number.isFinite(end) && end > start ? (end - start) / 60000 : NaN;
            }
            if (Number.isFinite(minutes) && minutes > 0) { plannedMinutes += minutes; plannedAvailable += 1; }
        });
        const focusScope = scope.scopeMode === 'documents' && scope.documentIDs.length
            ? { documentIDs: scope.documentIDs }
            : (scope.taskIDs.length ? { taskIDs: scope.taskIDs } : (scope.documentIDs.length ? { documentIDs: scope.documentIDs } : {}));
        let actual;
        try {
            const focusStats = await queryFocusStatistics({
                from: effectiveFrom,
                to: effectiveTo,
                bucket: 'none',
                groupBy: 'task',
                ...focusScope,
            });
            const actualMinutes = Math.max(0, Number(focusStats?.totals?.focusSec) || 0) / 60;
            const actualAvailable = Array.isArray(focusStats?.tasks) ? focusStats.tasks.length : 0;
            actual = {
                minutes: Math.round(actualMinutes),
                availableCount: actualAvailable,
                missingCount: Math.max(0, rows.length - actualAvailable),
                available: true,
                source: 'docktomato-history',
            };
        } catch (error) {
            actual = {
                minutes: 0,
                availableCount: 0,
                missingCount: rows.length,
                available: false,
                source: 'docktomato-history',
                errorCode: text(error?.code) || ERROR.STORAGE_ERROR,
            };
        }
        return {
            estimated: { minutes: Math.round(estimatedMinutes), availableCount: estimateAvailable, missingCount: rows.length - estimateAvailable, available: estimateAvailable > 0 },
            planned: { minutes: Math.round(plannedMinutes), availableCount: plannedAvailable, missingCount: schedules.length - plannedAvailable, available: plannedAvailable > 0 },
            actual,
            coverage: { from: effectiveFrom, to: effectiveTo, ...taskScopeCoverage(scope) },
        };
    }

    async function undoLastMutation(input) {
        const undo = state.lastUndo;
        if (!undo || (input && text(input.undoID) && text(input.undoID) !== undo.id)) throw new DomainError(ERROR.NOT_FOUND, '没有可撤销的操作');
        if (typeof undo.verify === 'function' && !(await undo.verify())) {
            state.lastUndo = null;
            state.undoRecords.delete(undo.id);
            throw new DomainError(ERROR.CONFLICT, '相关任务或日程已被其他操作修改，撤销已取消');
        }
        state.lastUndo = null;
        state.undoRecords.delete(undo.id);
        (Array.isArray(undo.childUndoIDs) ? undo.childUndoIDs : []).forEach((id) => state.undoRecords.delete(id));
        try {
            const data = await undo.execute();
            return { undoID: undo.id, label: undo.label, data };
        } catch (error) {
            throw new DomainError(text(error && error.code) || ERROR.STORAGE_ERROR, text(error && error.message) || '撤销执行失败', {
                ...(error && error.details && typeof error.details === 'object' ? error.details : {}),
                undoConsumed: true,
            });
        }
    }

    function objectSchema(properties, required) {
        return { type: 'object', properties: properties || {}, required: required || [], additionalProperties: false };
    }

    function stringSchema(description, values) {
        const schema = { type: 'string', description: description || '' };
        if (Array.isArray(values)) schema.enum = values;
        return schema;
    }

    function normalizeMcpTools(value) {
        const source = value && typeof value === 'object' ? value : {};
        const normalized = Object.create(null);
        for (const name of MCP_TOOL_NAMES) normalized[name] = source[name] !== false;
        return normalized;
    }

    function isMcpToolEnabled(name) {
        return MCP_TOOL_NAMES.includes(name) && state.mcpTools[name] !== false;
    }

    function getMcpToolGroup(groupID) {
        const id = text(groupID);
        return MCP_TOOL_GROUPS.find((group) => group.id === id) || null;
    }

    function validateMcpToolCatalog(definitions) {
        const definedNames = new Set((Array.isArray(definitions) ? definitions : []).map((definition) => definition[0]));
        const configuredNames = new Set(MCP_TOOL_NAMES);
        const missingGroup = Array.from(definedNames).filter((name) => !configuredNames.has(name));
        const missingDefinition = Array.from(configuredNames).filter((name) => !definedNames.has(name));
        if (missingGroup.length || missingDefinition.length || configuredNames.size !== MCP_TOOL_NAMES.length) {
            throw new DomainError(ERROR.STORAGE_ERROR, '任务工具分组定义不完整', { missingGroup, missingDefinition });
        }
    }

    function agentCapabilityConfig(name, definition) {
        const config = {
            title: definition[1],
            description: `任务管理器插件：${definition[1]}`,
            inputSchema: definition[2],
        };
        const actionEffects = MCP_ACTION_EFFECTS[name];
        if (actionEffects) config.actionEffects = actionEffects;
        else config.effects = MCP_READ_ONLY_TOOLS.has(name) ? { localRead: true } : { localWrite: true };
        return config;
    }

    function mcpToolRuntime() {
        const agent = siyuan?.agent;
        if (typeof agent?.registerCapability === 'function' && typeof agent?.unregisterCapability === 'function') {
            return {
                kind: 'agent',
                register: (name, definition, handler) => agent.registerCapability(name, agentCapabilityConfig(name, definition), (args) => asAgentCapabilityResult(handler, args)),
                unregister: (name) => agent.unregisterCapability(name),
            };
        }
        const legacy = siyuan?.mcp;
        if (typeof legacy?.registerTool === 'function' && typeof legacy?.unregisterTool === 'function') {
            return {
                kind: 'mcp',
                register: (name, definition, handler) => legacy.registerTool(name, {
                    title: definition[1],
                    description: `任务管理器插件：${definition[1]}`,
                    inputSchema: definition[2],
                    readOnly: MCP_READ_ONLY_TOOLS.has(name),
                }, handler),
                unregister: (name) => legacy.unregisterTool(name),
            };
        }
        return null;
    }

    function requireMcpOperationTools(domain, operations) {
        const toolMap = domain === 'schedules'
            ? { create: 'create_schedule', update: 'update_schedule', delete: 'delete_schedule' }
            : { create: 'create_task', update: 'update_task', move: 'move_task', delete: 'delete_task' };
        const disabled = new Set();
        const items = Array.isArray(operations) ? operations : [];
        for (let index = 0; index < items.length; index += 1) {
            const kind = operationKind(domain, items[index], index);
            const toolName = toolMap[kind];
            if (toolName && !isMcpToolEnabled(toolName)) disabled.add(toolName);
        }
        if (disabled.size) {
            throw new DomainError(ERROR.UNSUPPORTED, '批量操作包含已在设置中关闭的工具', { tools: Array.from(disabled) });
        }
    }

    function toolDefinitions() {
        const anyObject = { type: 'object', additionalProperties: true };
        const taskRepeatRule = objectSchema({
            version: { type: 'integer', minimum: 1, maximum: 1 },
            enabled: { type: 'boolean' },
            type: stringSchema('循环单位；none 清除循环，fsrs 为 FSRS 间隔重复并自动使用 complete', ['none', 'daily', 'workday', 'weekly', 'monthly', 'yearly', 'fsrs']),
            trigger: stringSchema('due 按原计划推进，complete 从实际完成日计算，checkin 为按计划打卡', ['due', 'complete', 'checkin']),
            every: { type: 'integer', minimum: 1, maximum: 3650 },
            weekdays: { type: 'array', description: '每周日期，0=周日；空列表按起始日期的星期计算', items: { type: 'integer', minimum: 0, maximum: 6 } },
            monthDays: { type: 'array', description: '1–31；-1 表示月末', items: { type: 'integer', minimum: -1, maximum: 31 }, minItems: 1 },
            monthWeek: objectSchema({ ordinal: { type: 'integer', minimum: -1, maximum: 5 }, weekday: { type: 'integer', minimum: 0, maximum: 6 } }, ['ordinal', 'weekday']),
            monthlyMode: stringSchema('月循环方式', ['date', 'weekday']),
            calendarMode: stringSchema('历法', ['solar', 'lunar']),
            anchorDate: stringSchema('首次日期 YYYY-MM-DD；打卡使用此字段作为计划起始日期，不写任务开始或截止日期'),
            until: stringSchema('可选结束日期，与 maxOccurrences 互斥；FSRS 不使用固定结束条件'),
            maxOccurrences: { type: 'integer', description: '总轮数（含首次）；0 为不限制；FSRS 固定为 0', minimum: 0, maximum: 200 },
        }, ['type']);
        const taskPatch = { ...anyObject, properties: {
            repeatRule: taskRepeatRule,
            expectedOccurrenceId: stringSchema('完成循环任务必填，使用 get_task 返回的 occurrenceId，防止重复完成下一轮'),
            followReminder: objectSchema({
                times: { type: 'array', items: stringSchema('HH:mm'), minItems: 1, maxItems: 12 },
                intentText: stringSchema('用户本轮原话；明确提到提醒或通知时才添加，不能从循环或时间推断'),
            }, ['times', 'intentText']),
        } };
        const taskDateRange = objectSchema({
            field: stringSchema('日期字段', ['taskSpan', 'startDate', 'completionTime', 'taskCompleteAt']),
            from: stringSchema('起始日期 YYYY-MM-DD'),
            to: stringSchema('结束日期 YYYY-MM-DD'),
            mode: stringSchema('taskSpan 匹配方式', ['overlap', 'within']),
        }, ['field']);
        const taskQueryFilters = objectSchema({
            scopeToken: stringSchema('当前任务视图范围令牌'),
            ids: { type: 'array', items: { type: 'string' } },
            documentIDs: { type: 'array', items: { type: 'string' } },
            keyword: { type: 'string' },
            done: { type: 'boolean' },
            dateRange: taskDateRange,
            overdue: { type: 'boolean' },
            priorities: { type: 'array', items: { type: 'string' }, maxItems: 50 },
            customStatuses: { type: 'array', description: '状态 ID；可从 statusDefinitions 读取 ID 与中文状态名映射', items: { type: 'string' }, maxItems: 50 },
            includeVirtual: { type: 'boolean' },
        });
        const taskFields = {
            type: 'array',
            description: '返回字段投影；省略则返回全部。priority 与 customStatus 是稳定 ID，并分别配套中文 priorityName、customStatusName；completionTime=截止日期，taskCompleteAt=完成时间，priorityScore=加权分数，duration=预估时长，tomatoEstimateCount=预计番茄；循环任务的 tomatoCount/tomatoMinutes/tomatoHours 表示当前轮或历史当次专注，其他任务表示累计实际专注；attachments=附件，customFieldValues=自定义列。',
            items: { type: 'string', enum: TASK_READ_FIELDS },
        };
        const readAction = stringSchema('只读操作', ['get']);
        const listAction = stringSchema('只读操作', ['list']);
        const queryAction = stringSchema('只读操作', ['query']);
        const reminderFollow = objectSchema({
            date: stringSchema('普通任务从提醒要求解析日期 YYYY-MM-DD；今天/今晚使用当日；已有打卡循环时省略，使用打卡计划而不写任务截止日期'),
            times: { type: 'array', items: stringSchema('HH:mm'), minItems: 1, maxItems: 12 },
        }, ['times']);
        const reminderSchedule = objectSchema({
            startDate: stringSchema('开始日期 YYYY-MM-DD'),
            endDate: stringSchema('可选结束日期 YYYY-MM-DD'),
            times: { type: 'array', items: stringSchema('HH:mm'), minItems: 1, maxItems: 12 },
            interval: stringSchema('重复方式', REMINDER_INTERVALS),
            every: { type: 'integer', minimum: 1, maximum: 365 },
            monthlyMode: stringSchema('月重复方式', ['date', 'weekday']),
            calendarMode: stringSchema('历法', ['solar', 'lunar']),
        }, ['startDate', 'times', 'interval']);
        const agentScheduleRule = objectSchema({
            kind: stringSchema('运行方式', AGENT_SCHEDULE_KINDS),
            date: stringSchema('单次运行日期 YYYY-MM-DD'),
            weekday: { type: 'integer', minimum: 0, maximum: 6 },
            time: stringSchema('运行时间 HH:mm'),
        }, ['kind', 'time']);
        const agentScheduleConfig = objectSchema({
            name: stringSchema('定时任务名称'),
            prompt: stringSchema('到点后交给智能体执行的指令'),
            enabled: { type: 'boolean' },
            includeInternalPrompt: { type: 'boolean', description: '是否附加插件的无人值守内部提示词；只影响发给模型的文字规则，定时执行始终自动处理能力确认、提问和浏览器操作' },
            condition: stringSchema('运行条件', ['always', 'today_has_completed_tasks']),
            schedule: agentScheduleRule,
            output: objectSchema({
                mode: stringSchema('输出方式：notification=通知展示，document=写入指定文档，daily_note=写入今天日记', ['notification', 'document', 'daily_note']),
                documentId: stringSchema('写入文档 ID'),
                documentMode: stringSchema('文档组织方式', ['target', 'monthly_child']),
                insertPosition: stringSchema('插入位置', ['bottom', 'top']),
            }),
        });
        const scheduleMutableFields = {
            taskId: stringSchema('可选真实任务、任务子块或循环虚拟实例 ID'),
            title: { type: 'string' },
            start: { type: 'string' },
            end: { type: 'string' },
            allDay: { type: 'boolean' },
            calendarId: { type: 'string' },
            color: { type: 'string' },
            plannedMinutes: { type: 'number' },
            reminderMode: stringSchema('inherit=继承全局日程提醒，custom=使用本日程提醒设置', SCHEDULE_REMINDER_MODES),
            reminderEnabled: { type: 'boolean', description: 'reminderMode=custom 时启用或关闭本日程提醒' },
            reminderOffsetMin: { type: 'integer', description: 'reminderMode=custom 时提前提醒分钟数，仅支持 0、5、10、15、30、60', minimum: 0, maximum: 60 },
            repeatRule: anyObject,
        };
        const schedulePatch = objectSchema(scheduleMutableFields);
        const taskOperationKinds = ['create', 'update', 'move', 'delete'];
        const scheduleOperationKinds = ['create', 'update', 'delete'];
        const taskOperation = objectSchema({
            kind: stringSchema('规范操作类型', taskOperationKinds),
            action: stringSchema('兼容操作类型；patch 等价于 update', taskOperationKinds.concat('patch')),
            type: stringSchema('兼容操作类型；patch 等价于 update', taskOperationKinds.concat('patch')),
            taskID: stringSchema('更新、移动或删除的任务 ID'),
            title: stringSchema('创建任务时的标题'),
            documentID: stringSchema('创建或移动任务时的目标文档 ID'),
            parentTaskID: stringSchema('创建任务时的可选父任务 ID'),
            patch: taskPatch,
            parentID: stringSchema('移动任务时的目标文档、列表或父任务 ID'),
            previousID: stringSchema('移动到该块之后'),
            nextID: stringSchema('移动到该任务之前'),
        });
        const scheduleOperation = objectSchema({
            kind: stringSchema('规范操作类型', scheduleOperationKinds),
            action: stringSchema('兼容操作类型', scheduleOperationKinds),
            type: stringSchema('兼容操作类型', scheduleOperationKinds),
            id: stringSchema('更新日程时的日程 ID'),
            scheduleID: stringSchema('删除日程时的日程 ID'),
            scopeToken: stringSchema('关联循环虚拟实例时必填的当前任务范围令牌'),
            ...scheduleMutableFields,
            patch: schedulePatch,
        });
        const taskOperations = { type: 'array', items: taskOperation };
        const scheduleOperations = { type: 'array', items: scheduleOperation };
        return [
            ['list_task_scopes', '列出任务范围', objectSchema({ action: listAction }, ['action']), async () => listTaskScopes()],
            ['get_task', '读取完整任务字段；返回 customFieldValues 时同时返回含父级、路径和归档状态的 customFieldDefinitions；循环虚拟任务只读且必须提供 scopeToken', objectSchema({ action: readAction, taskID: stringSchema('任务、子块或循环虚拟任务 ID'), scopeToken: stringSchema('读取当前视图或循环虚拟任务的范围令牌'), fields: taskFields }, ['action', 'taskID']), async (args) => getTaskDTOByReference(args.taskID, args.fields, args.scopeToken)],
            ['query_tasks', '在任务范围内按完成、日期、逾期、优先级和状态分页查询；省略 fields 返回全部字段；返回 customFieldValues 时同时返回含父级、路径和归档状态的 customFieldDefinitions', objectSchema({ action: queryAction, filters: taskQueryFilters, fields: taskFields, limit: { type: 'integer', minimum: 1, maximum: 200 }, cursor: { type: 'string' } }, ['action']), queryTaskRows],
            ['create_task', '直接在文档或父任务下创建单个任务，无需预览；未指定位置时使用对话提供的插件默认新建位置；patch.repeatRule 设置循环，只有明确要求提醒时才传 followReminder，与循环一起保存', objectSchema({ action: stringSchema('直接创建', ['create']), title: stringSchema('任务标题'), documentID: stringSchema('目标文档块 ID'), parentTaskID: stringSchema('可选父任务 ID，提供时优先于 documentID'), patch: taskPatch }, ['action', 'title']), async (args) => { requireAction(args, 'create'); return executeTaskCommandValue({ ...args, action: 'create', options: { agentWrite: true } }); }],
            ['update_task', '更新任务字段及循环；repeatRule 由任务管理器维护轮次；明确要求提醒才传 followReminder；完成循环任务先读取 occurrenceId，再传 expectedOccurrenceId；禁止写 repeatState/repeatHistory/reminder', objectSchema({ action: stringSchema('写操作', ['update']), taskID: { type: 'string' }, patch: taskPatch }, ['action', 'taskID', 'patch']), async (args) => { requireAction(args, 'update'); return executeTaskCommandValue({ ...args, action: 'patch', options: { agentWrite: true } }); }],
            ['configure_task_reminder', '单次直接配置跟随任务或独立提醒；应先用 query_tasks 检索已有任务并在明确匹配时传入 taskID；没有绑定任务时使用 taskTitle 在全部任务中先精确、再按可见标题模糊匹配，允许少量错字并优先绑定未完成项，找不到才使用插件默认新建位置 documentID 自动创建任务并立即设置提醒，不要先调用 create_task；跟随任务提醒同时设置截止日期并默认同步完成任务；提醒类型未明确时必须先用 question 选择类型', objectSchema({
                action: stringSchema('直接写入', ['apply']),
                operation: stringSchema('提醒操作', ['set', 'clear']),
                taskID: stringSchema('已有任务或任务子块 ID；没有绑定任务时省略'),
                taskTitle: stringSchema('没有绑定任务时创建的任务标题'),
                documentID: stringSchema('全局没有同名任务、需要新建时使用的插件默认新建文档 ID'),
                mode: stringSchema('提醒模式', ['follow_task', 'independent']),
                follow: reminderFollow,
                schedule: reminderSchedule,
            }, ['action', 'operation']), configureTaskReminder],
            ['manage_agent_schedules', '管理 AI 定时任务；提醒类型未明确时必须先用 question 让用户选择 AI 定时任务、跟随任务提醒或独立提醒', objectSchema({
                action: stringSchema('操作', ['list', 'create', 'update', 'delete']),
                scheduleID: stringSchema('AI 定时任务 ID'),
                event: agentScheduleConfig,
                patch: agentScheduleConfig,
            }, ['action']), manageAgentSchedules],
            ['move_task', '移动任务并验证目标块类型', objectSchema({ action: stringSchema('写操作', ['move']), taskID: stringSchema('真实任务 ID'), parentID: stringSchema('目标文档、列表或父任务 ID'), documentID: stringSchema('目标文档块 ID'), previousID: stringSchema('移动到该块之后'), nextID: stringSchema('移动到该任务之前') }, ['action', 'taskID']), async (args) => { requireAction(args, 'move'); return executeTaskCommandValue({ ...args, action: 'move' }); }],
            ['delete_task', '预览或删除任务', objectSchema({ action: stringSchema('预览只读，执行为删除', ['get', 'delete']), phase: stringSchema('阶段', ['preview', 'execute']), taskID: { type: 'string' }, previewToken: { type: 'string' } }, ['action', 'phase', 'taskID']), async (args) => {
                requirePhaseAction(args, 'delete');
                return args.phase === 'preview' ? previewTaskDelete(args.taskID) : executeTaskDelete(args.taskID, args.previewToken);
            }],
            ['batch_tasks', '批量执行任务操作；每项使用 kind，兼容 action/type', objectSchema({ action: stringSchema('预览只读，执行为写入', ['get', 'apply']), phase: stringSchema('阶段', ['preview', 'execute']), operations: taskOperations, previewToken: { type: 'string' } }, ['action', 'phase', 'operations']), async (args) => {
                requirePhaseAction(args, 'apply');
                requireMcpOperationTools('tasks', args.operations);
                return (await guardOperationPreview('tasks', args.operations, args.phase, args.previewToken)) || executeTaskOperations(args.operations);
            }],
            ['query_schedules', '查询日程；filters.taskIDs 可包含循环虚拟实例 ID', objectSchema({ action: queryAction, filters: anyObject, limit: { type: 'integer', minimum: 1, maximum: 500 } }, ['action']), querySchedules],
            ['create_schedule', '创建日程；提醒未指定时继承全局设置；可关联真实任务，或使用当前 scopeToken 关联只读循环虚拟实例', objectSchema({ action: stringSchema('写操作', ['create']), scopeToken: stringSchema('关联循环虚拟实例时必填的当前任务范围令牌'), ...scheduleMutableFields }, ['action', 'start', 'end']), async (args) => { requireAction(args, 'create'); return createSchedule(args); }],
            ['update_schedule', '更新日程及单条日程提醒；重新关联循环虚拟实例时必须提供当前 scopeToken', objectSchema({ action: stringSchema('写操作', ['update']), id: { type: 'string' }, scopeToken: stringSchema('重新关联循环虚拟实例时必填的当前任务范围令牌'), patch: schedulePatch }, ['action', 'id', 'patch']), async (args) => { requireAction(args, 'update'); return updateSchedule(args); }],
            ['delete_schedule', '预览或删除日程', objectSchema({ action: stringSchema('预览只读，执行为删除', ['get', 'delete']), phase: stringSchema('阶段', ['preview', 'execute']), scheduleID: { type: 'string' }, previewToken: { type: 'string' } }, ['action', 'phase', 'scheduleID']), async (args) => {
                requirePhaseAction(args, 'delete');
                return args.phase === 'preview' ? previewScheduleDelete(args.scheduleID) : executeScheduleDelete(args.scheduleID, args.previewToken);
            }],
            ['batch_schedules', '批量执行日程操作；每项使用 kind，兼容 action/type；关联循环虚拟实例的 create/update 操作各自携带当前 scopeToken', objectSchema({ action: stringSchema('预览只读，执行为写入', ['get', 'apply']), phase: stringSchema('阶段', ['preview', 'execute']), operations: scheduleOperations, previewToken: { type: 'string' } }, ['action', 'phase', 'operations']), async (args) => {
                requirePhaseAction(args, 'apply');
                requireMcpOperationTools('schedules', args.operations);
                return (await guardOperationPreview('schedules', args.operations, args.phase, args.previewToken)) || executeScheduleOperations(args.operations);
            }],
            ['apply_task_operation_plan', '协调任务与日程操作；每项使用 kind，兼容 action/type；关联循环虚拟实例的日程操作各自携带当前 scopeToken', objectSchema({ action: stringSchema('写操作', ['apply']), taskOperations, scheduleOperations }, ['action']), async (args) => {
                requireAction(args, 'apply');
                const taskOperations = Array.isArray(args.taskOperations) ? args.taskOperations : [];
                const scheduleOperations = Array.isArray(args.scheduleOperations) ? args.scheduleOperations : [];
                if (taskOperations.length + scheduleOperations.length > 50) throw new DomainError(ERROR.INVALID_ARGUMENT, '组合操作最多 50 项');
                if (operationsHaveDelete('tasks', taskOperations) || operationsHaveDelete('schedules', scheduleOperations)) throw new DomainError(ERROR.INVALID_ARGUMENT, '组合操作不支持删除，请使用独立删除工具');
                requireMcpOperationTools('tasks', taskOperations);
                requireMcpOperationTools('schedules', scheduleOperations);
                const taskReceipt = await executeTaskOperations(taskOperations);
                const taskUndo = state.lastUndo;
                const scheduleReceipt = await executeScheduleOperations(scheduleOperations);
                const scheduleUndo = state.lastUndo;
                setGroupedUndo('撤销本次任务与日程操作', [taskUndo, scheduleUndo]);
                return mutationReceipt(taskReceipt.items.concat(scheduleReceipt.items));
            }],
            ['get_task_policy', '读取任务规划策略；传入任务所属文档 ID 时同时返回按“文档 > 文档分组 > 全局”解析后的有效规则，可为缺少预估时长的任务返回确定性默认时长', objectSchema({ action: readAction, documentIDs: { type: 'array', items: { type: 'string' }, maxItems: 200 }, durationCandidates: { type: 'array', maxItems: 200, items: objectSchema({ taskID: { type: 'string' }, title: { type: 'string' }, documentID: { type: 'string' } }, ['taskID', 'title']) } }, ['action']), getTaskPolicy],
            ['preview_task_policy_patch', '预览规划策略变更', objectSchema({ action: readAction, expectedRevision: { type: 'integer' }, patch: anyObject }, ['action', 'expectedRevision', 'patch']), async (args) => { requireAction(args, 'get'); return previewPolicyPatch(args); }],
            ['apply_task_policy_patch', '应用已预览的规划策略变更', objectSchema({ action: stringSchema('写操作', ['apply']), expectedRevision: { type: 'integer' }, previewToken: { type: 'string' } }, ['action', 'expectedRevision', 'previewToken']), async (args) => { requireAction(args, 'apply'); return applyPolicyPatch(args); }],
            ['aggregate_task_stats', '聚合任务完成统计；自定义标签同时返回直接计数 items 与按祖先去重汇总的 hierarchyItems（directCount/totalCount）', objectSchema({ action: queryAction, scopeToken: stringSchema('当前任务视图范围令牌'), from: { type: 'string' }, to: { type: 'string' }, period: stringSchema('聚合周期', ['day', 'week', 'month', 'year']), taskIDs: { type: 'array', items: { type: 'string' } }, documentIDs: { type: 'array', items: { type: 'string' } }, customFieldIDs: { type: 'array', description: '需要按自定义标签直接计数和父级汇总时传入 customFieldDefinitions 中的字段 ID', items: { type: 'string' }, maxItems: 20 } }, ['action']), aggregateTaskStats],
            ['aggregate_time_usage', '聚合预估、计划和实际用时', objectSchema({ action: queryAction, scopeToken: stringSchema('当前任务视图范围令牌'), from: { type: 'string' }, to: { type: 'string' }, taskIDs: { type: 'array', items: { type: 'string' } }, documentIDs: { type: 'array', items: { type: 'string' } } }, ['action']), aggregateTimeUsage],
            ['query_focus_statistics', '查询任意时间范围的专注统计；未指定时间时默认最近30天，可按日、周、月、季度或年直接返回分桶结果', objectSchema({ action: queryAction, scopeToken: stringSchema('当前任务视图范围令牌'), from: { type: 'string' }, to: { type: 'string' }, bucket: stringSchema('时间分桶', ['none', 'hour', 'day', 'week', 'month', 'quarter', 'year']), groupBy: stringSchema('任务分类维度', ['task', 'parent', 'document', 'status', 'priority', 'customField']), customFieldID: { type: 'string' }, rootTaskID: { type: 'string' }, taskIDs: { type: 'array', items: { type: 'string' } }, documentIDs: { type: 'array', items: { type: 'string' } } }, ['action']), queryAgentFocusStatistics],
            ['query_routine_statistics', '查询任意时间范围的日常事务、专注、休息、覆盖和未记录时长', objectSchema({ action: queryAction, from: { type: 'string' }, to: { type: 'string' }, bucket: stringSchema('时间分桶', ['none', 'hour', 'day', 'week', 'month', 'quarter', 'year']) }, ['action']), queryAgentRoutineStatistics],
            ['list_focus_sessions', '分页读取专注会话明细；常规汇总应优先使用 query_focus_statistics', objectSchema({ action: queryAction, from: { type: 'string' }, to: { type: 'string' }, limit: { type: 'integer', minimum: 1, maximum: 500 }, cursor: { type: 'integer', minimum: 0 } }, ['action']), listAgentFocusSessions],
        ];
    }

    async function reconcileTools() {
        const definitions = toolDefinitions();
        validateMcpToolCatalog(definitions);
        const desired = new Map();
        if (state.mcpEnabled) {
            for (const definition of definitions) {
                if (isMcpToolEnabled(definition[0])) desired.set(definition[0], definition);
            }
        }
        const runtime = mcpToolRuntime();
        if ((desired.size || state.registeredTools.size) && !runtime) {
            throw new DomainError(ERROR.UNSUPPORTED, '当前思源内核未提供插件 Agent 能力接口');
        }
        for (const name of Array.from(state.registeredTools)) {
            if (desired.has(name)) continue;
            await runtime.unregister(name);
            state.registeredTools.delete(name);
        }
        for (const [name, definition] of desired) {
            if (state.registeredTools.has(name)) continue;
            await runtime.register(name, definition, async (args) => asResult(() => {
                if (!state.mcpEnabled || !isMcpToolEnabled(name)) {
                    throw new DomainError(ERROR.UNSUPPORTED, '该任务工具已在设置中关闭', { tool: name });
                }
                return definition[3](args || {});
            }));
            state.registeredTools.add(name);
        }
    }

    async function unregisterTools() {
        const names = Array.from(state.registeredTools);
        const runtime = mcpToolRuntime();
        for (const name of names) {
            try { await runtime?.unregister(name); } catch (error) {}
            state.registeredTools.delete(name);
        }
    }

    async function persistMcpConfig() {
        const tools = {};
        for (const name of MCP_TOOL_NAMES) tools[name] = isMcpToolEnabled(name);
        await writeJson(MCP_CONFIG_FILE, {
            schemaVersion: 2,
            enabled: state.mcpDesiredEnabled,
            tools,
            updatedAt: nowIso(),
        });
    }

    function mcpPersistedConfigSignature() {
        return JSON.stringify({
            enabled: state.mcpDesiredEnabled === true,
            tools: MCP_TOOL_NAMES.map((name) => [name, isMcpToolEnabled(name)]),
        });
    }

    function mcpRuntimeConfigSignature() {
        return `${state.mcpAuthorized === true ? 1 : 0}|${mcpPersistedConfigSignature()}`;
    }

    async function applyMcpConfigChange(change, options = {}) {
        const previousEnabled = state.mcpEnabled;
        const previousAuthorized = state.mcpAuthorized;
        const previousDesiredEnabled = state.mcpDesiredEnabled;
        const previousTools = { ...state.mcpTools };
        const previousPersistedSignature = mcpPersistedConfigSignature();
        const previousRuntimeSignature = mcpRuntimeConfigSignature();
        const persist = options.persist !== false;
        let persistedChanged = false;
        let runtimeChanged = false;
        try {
            change();
            persistedChanged = mcpPersistedConfigSignature() !== previousPersistedSignature;
            runtimeChanged = mcpRuntimeConfigSignature() !== previousRuntimeSignature;
            if (runtimeChanged) await reconcileTools();
            if (persist && persistedChanged) await persistMcpConfig();
            return getCapabilities();
        } catch (error) {
            state.mcpEnabled = previousEnabled;
            state.mcpAuthorized = previousAuthorized;
            state.mcpDesiredEnabled = previousDesiredEnabled;
            state.mcpTools = previousTools;
            if (runtimeChanged) {
                try { await reconcileTools(); } catch (rollbackError) {}
            }
            if (persist && persistedChanged) {
                try { await persistMcpConfig(); } catch (rollbackError) {}
            }
            throw error;
        }
    }

    async function setMcpEnabled(enabled) {
        const desired = enabled === true;
        if (desired && !state.mcpAuthorized) {
            throw new DomainError(ERROR.UNSUPPORTED, '当前版本未获得任务 MCP 工具权益');
        }
        return await applyMcpConfigChange(() => {
            state.mcpDesiredEnabled = desired;
            state.mcpEnabled = state.mcpAuthorized && desired;
        });
    }

    async function syncMcpEntitlement(input) {
        const value = input && typeof input === 'object' ? input : {};
        if (typeof value.allowed !== 'boolean') {
            throw new DomainError(ERROR.INVALID_ARGUMENT, 'allowed 必须是布尔值');
        }
        return await applyMcpConfigChange(() => {
            state.mcpAuthorized = value.allowed === true;
            state.mcpEnabled = state.mcpAuthorized && state.mcpDesiredEnabled;
        }, { persist: false });
    }

    async function setMcpToolConfig(input) {
        const value = input && typeof input === 'object' ? input : {};
        if (typeof value.enabled !== 'boolean') {
            throw new DomainError(ERROR.INVALID_ARGUMENT, 'enabled 必须是布尔值');
        }
        if (value.enabled === true && !state.mcpAuthorized) {
            throw new DomainError(ERROR.UNSUPPORTED, '当前版本未获得任务 MCP 工具权益');
        }
        const toolName = text(value.toolName || value.tool);
        const groupID = text(value.groupID || value.group);
        if ((toolName && groupID) || (!toolName && !groupID)) {
            throw new DomainError(ERROR.INVALID_ARGUMENT, '必须且只能指定一个工具或分组');
        }
        let names;
        if (toolName) {
            if (!MCP_TOOL_NAMES.includes(toolName)) throw new DomainError(ERROR.NOT_FOUND, '未找到任务工具', { tool: toolName });
            names = [toolName];
        } else {
            const group = getMcpToolGroup(groupID);
            if (!group) throw new DomainError(ERROR.NOT_FOUND, '未找到任务工具分组', { group: groupID });
            names = group.tools.map((tool) => tool[0]);
        }
        return await applyMcpConfigChange(() => {
            for (const name of names) state.mcpTools[name] = value.enabled;
        });
    }

    function getCapabilities() {
        const definitions = toolDefinitions();
        validateMcpToolCatalog(definitions);
        const definitionMap = new Map(definitions.map((definition) => [definition[0], definition]));
        return {
            kernelAvailable: true,
            mcpAvailable: !!mcpToolRuntime(),
            mcpEnabled: state.mcpEnabled,
            mcpAuthorized: state.mcpAuthorized,
            registeredTools: Array.from(state.registeredTools),
            registeredToolCount: state.registeredTools.size,
            enabledToolCount: MCP_TOOL_NAMES.filter((name) => isMcpToolEnabled(name)).length,
            totalToolCount: MCP_TOOL_NAMES.length,
            toolGroups: MCP_TOOL_GROUPS.map((group) => ({
                id: group.id,
                label: group.label,
                description: group.description,
                enabledCount: group.tools.filter((tool) => isMcpToolEnabled(tool[0])).length,
                totalCount: group.tools.length,
                tools: group.tools.map(([name, label]) => ({
                    name,
                    label,
                    description: definitionMap.get(name)?.[1] || label,
                    enabled: isMcpToolEnabled(name),
                    registered: state.registeredTools.has(name),
                    readOnly: MCP_READ_ONLY_TOOLS.has(name),
                })),
            })),
            services: { tasks: true, schedules: true, reminders: true, agentSchedules: true, policy: true, stats: true, undo: true },
            contractVersion: PLUGIN_VERSION,
        };
    }

    async function getVerifiedCapabilities() {
        await sql('SELECT 1 AS task_horizon_session_probe');
        return getCapabilities();
    }

    async function bindRpc() {
        await siyuan.rpc.bind('taskHorizonGetCapabilities', () => asResult(() => getVerifiedCapabilities()));
        await siyuan.rpc.bind('taskHorizonSyncMcpEntitlement', (input) => asResult(() => syncMcpEntitlement(input || {})));
        await siyuan.rpc.bind('taskHorizonSetMcpEnabled', (enabled) => asResult(() => setMcpEnabled(enabled)));
        await siyuan.rpc.bind('taskHorizonSetMcpToolConfig', (input) => asResult(() => setMcpToolConfig(input || {})));
        await siyuan.rpc.bind('taskHorizonRegisterTaskScope', (input) => asResult(() => registerTaskScope(input || {})));
        await siyuan.rpc.bind('taskHorizonRegisterDocumentGroupSnapshot', (input) => asResult(() => registerDocumentGroupSnapshot(input || {})));
        await siyuan.rpc.bind('taskHorizonResolveTaskBinding', (blockID) => asResult(() => resolveTaskBinding(blockID)));
        await siyuan.rpc.bind('taskHorizonGetCustomFieldDefinitions', () => asResult(async () => customFieldDefinitions(await getFieldRegistry())));
        await siyuan.rpc.bind('taskHorizonGetTask', (taskID, fields) => asResult(() => getTaskDTO(taskID, fields)));
        await siyuan.rpc.bind('taskHorizonGetTaskPlacement', (taskID) => asResult(() => taskPlacementDTO(taskID)));
        await siyuan.rpc.bind('taskHorizonQueryTasks', (input) => asResult(() => queryTaskRows(input || {})));
        await siyuan.rpc.bind('taskHorizonSearchDocuments', (input) => asResult(() => searchDocumentRows(input || {})));
        await siyuan.rpc.bind('taskHorizonListTaskScopes', () => asResult(() => listTaskScopes()));
        await siyuan.rpc.bind('taskHorizonMutateTask', (input) => asResult(() => executeTaskCommand(input || {})));
        await siyuan.rpc.bind('taskHorizonCreateTask', (input) => asResult(() => executeTaskCommandValue({ ...(input || {}), action: 'create' })));
        await siyuan.rpc.bind('taskHorizonUpdateTask', (taskID, patch, options) => asResult(() => executeTaskCommandValue({ action: 'patch', taskID, patch: patch || {}, options: options || {} })));
        await siyuan.rpc.bind('taskHorizonConfigureTaskReminder', (input) => asResult(() => configureTaskReminder(input || {})));
        await siyuan.rpc.bind('taskHorizonLoadAgentSchedules', () => asResult(() => loadAgentSchedules({ allowMissing: false })));
        await siyuan.rpc.bind('taskHorizonReplaceAgentSchedules', (input) => asResult(() => replaceAgentSchedules(input || {})));
        await siyuan.rpc.bind('taskHorizonSaveAgentSchedule', (input) => asResult(() => saveAgentSchedule(input || {})));
        await siyuan.rpc.bind('taskHorizonDeleteAgentSchedule', (scheduleID) => asResult(() => deleteAgentSchedule(scheduleID)));
        await siyuan.rpc.bind('taskHorizonClaimAgentScheduleOccurrence', (input) => asResult(() => claimAgentScheduleOccurrence(input || {})));
        await siyuan.rpc.bind('taskHorizonRenewAgentScheduleOccurrence', (input) => asResult(() => renewAgentScheduleOccurrence(input || {})));
        await siyuan.rpc.bind('taskHorizonFinishAgentScheduleOccurrence', (input) => asResult(() => finishAgentScheduleOccurrence(input || {})));
        await siyuan.rpc.bind('taskHorizonResolveAgentScheduleOutputDocument', (input) => asResult(() => resolveAgentScheduleOutputDocument(input || {})));
        await siyuan.rpc.bind('taskHorizonPersistUiTaskAttrs', (taskID, attrs, options) => asResult(() => executeTaskCommandValue({ action: 'attrs', taskID, attrs: attrs || {}, ...(options || {}) })));
        await siyuan.rpc.bind('taskHorizonPersistUiBlockOperation', (input) => asResult(() => executeTaskCommandValue({ action: 'blockOperation', operation: input || {}, laneID: input?.laneID || input?.laneId })));
        await siyuan.rpc.bind('taskHorizonMoveTask', (input) => asResult(() => executeTaskCommandValue({ ...(input || {}), action: 'move' })));
        await siyuan.rpc.bind('taskHorizonPreviewDeleteTask', (taskID) => asResult(() => previewTaskDelete(taskID)));
        await siyuan.rpc.bind('taskHorizonDeleteTask', (taskID, previewToken) => asResult(() => executeTaskDelete(taskID, previewToken)));
        await siyuan.rpc.bind('taskHorizonLoadSchedules', () => asResult(() => loadSchedules({ allowMissing: false })));
        await siyuan.rpc.bind('taskHorizonSaveSchedules', (items, options) => asResult(() => runScheduleLane(() => saveScheduleSnapshot(items, options))));
        await siyuan.rpc.bind('taskHorizonQuerySchedules', (input) => asResult(() => querySchedules(input || {})));
        await siyuan.rpc.bind('taskHorizonCreateSchedule', (input) => asResult(() => createSchedule(input || {})));
        await siyuan.rpc.bind('taskHorizonUpdateSchedule', (input) => asResult(() => updateSchedule(input || {})));
        await siyuan.rpc.bind('taskHorizonPreviewDeleteSchedule', (scheduleID) => asResult(() => previewScheduleDelete(scheduleID)));
        await siyuan.rpc.bind('taskHorizonDeleteSchedule', (scheduleID, previewToken) => asResult(() => executeScheduleDelete(scheduleID, previewToken)));
        await siyuan.rpc.bind('taskHorizonGetPolicy', () => asResult(async () => {
            const record = await getPolicyRecord();
            return { ...record.policy, __storageState: record.storageState };
        }));
        await siyuan.rpc.bind('taskHorizonRestorePolicy', (input) => asResult(() => restorePolicySnapshot(input || {})));
        await siyuan.rpc.bind('taskHorizonResolveDurationDefaults', (input) => asResult(() => resolveTaskDurationDefaults(input || {})));
        await siyuan.rpc.bind('taskHorizonPreviewPolicyPatch', (input) => asResult(() => previewPolicyPatch(input || {})));
        await siyuan.rpc.bind('taskHorizonApplyPolicyPatch', (input) => asResult(() => applyPolicyPatch(input || {})));
        await siyuan.rpc.bind('taskHorizonAggregateTaskStats', (input) => asResult(() => aggregateTaskStats(input || {})));
        await siyuan.rpc.bind('taskHorizonAggregateTimeUsage', (input) => asResult(() => aggregateTimeUsage(input || {})));
        await siyuan.rpc.bind('taskHorizonProjectFocusStatistics', (rawStats, input, taskSnapshot) => asResult(() => (
            projectFocusStatistics(rawStats || {}, input || {}, taskSnapshot || null)
        )));
        await siyuan.rpc.bind('taskHorizonResolveFocusCandidateIDs', (input) => asResult(async () => ({
            candidateIDs: await resolveFocusCandidateIDs(input || {}),
        })));
        await siyuan.rpc.bind('taskHorizonQueryFocusStatistics', (input) => asResult(() => queryFocusStatistics(input || {})));
        await siyuan.rpc.bind('taskHorizonQueryRoutineStatistics', (input) => asResult(() => queryDockTomatoRoutineStats(input || {})));
        await siyuan.rpc.bind('taskHorizonListFocusSessions', (input) => asResult(() => listDockTomatoSessions(input || {})));
        await siyuan.rpc.bind('taskHorizonGroupUndoMutations', (input) => asResult(() => groupUndoMutations(input || {})));
        await siyuan.rpc.bind('taskHorizonUndoLastMutation', (input) => asResult(() => undoLastMutation(input || {})));
    }

    const RPC_NAMES = [
        'taskHorizonGetCapabilities', 'taskHorizonSyncMcpEntitlement', 'taskHorizonSetMcpEnabled', 'taskHorizonSetMcpToolConfig', 'taskHorizonRegisterTaskScope', 'taskHorizonResolveTaskBinding', 'taskHorizonGetCustomFieldDefinitions',
        'taskHorizonGetTask', 'taskHorizonGetTaskPlacement', 'taskHorizonQueryTasks', 'taskHorizonSearchDocuments', 'taskHorizonListTaskScopes', 'taskHorizonMutateTask', 'taskHorizonCreateTask', 'taskHorizonUpdateTask', 'taskHorizonConfigureTaskReminder',
        'taskHorizonLoadAgentSchedules', 'taskHorizonReplaceAgentSchedules', 'taskHorizonSaveAgentSchedule', 'taskHorizonDeleteAgentSchedule', 'taskHorizonClaimAgentScheduleOccurrence', 'taskHorizonRenewAgentScheduleOccurrence', 'taskHorizonFinishAgentScheduleOccurrence', 'taskHorizonResolveAgentScheduleOutputDocument', 'taskHorizonPersistUiTaskAttrs', 'taskHorizonPersistUiBlockOperation',
        'taskHorizonMoveTask', 'taskHorizonPreviewDeleteTask', 'taskHorizonDeleteTask',
        'taskHorizonLoadSchedules', 'taskHorizonSaveSchedules', 'taskHorizonQuerySchedules',
        'taskHorizonCreateSchedule', 'taskHorizonUpdateSchedule', 'taskHorizonPreviewDeleteSchedule',
        'taskHorizonDeleteSchedule', 'taskHorizonGetPolicy', 'taskHorizonRestorePolicy', 'taskHorizonResolveDurationDefaults', 'taskHorizonPreviewPolicyPatch',
        'taskHorizonApplyPolicyPatch', 'taskHorizonAggregateTaskStats', 'taskHorizonAggregateTimeUsage',
        'taskHorizonProjectFocusStatistics', 'taskHorizonResolveFocusCandidateIDs', 'taskHorizonQueryFocusStatistics', 'taskHorizonQueryRoutineStatistics', 'taskHorizonListFocusSessions',
        'taskHorizonGroupUndoMutations', 'taskHorizonUndoLastMutation',
    ];

    siyuan.plugin.lifecycle.onload = async function () {
        await ensureTaskAttrItemStorageMigration();
        const scheduleWarmup = warmScheduleSnapshot();
        await bindRpc();
        // Keep the warm read off the startup critical path while allowing the
        // first calendar RPC to reuse its parsed payload when ready.
        void scheduleWarmup;
        const config = await readJson(MCP_CONFIG_FILE, { schemaVersion: 2, enabled: false, tools: {} });
        const currentConfig = config && config.schemaVersion === 2 ? config : null;
        state.mcpAuthorized = false;
        state.mcpDesiredEnabled = currentConfig?.enabled === true;
        state.mcpEnabled = false;
        state.mcpTools = normalizeMcpTools(currentConfig?.tools);
        await reconcileTools();
    };

    siyuan.plugin.lifecycle.onrunning = function () {};

    siyuan.plugin.lifecycle.onunload = async function () {
        await unregisterTools();
        for (const name of RPC_NAMES) {
            try { await siyuan.rpc.unbind(name); } catch (error) {}
        }
        state.taskLanes.clear();
        state.deleteTokens.clear();
        state.reminderTokens.clear();
        state.policyTokens.clear();
        state.operationTokens.clear();
        state.taskScopes.clear();
        state.undoRecords.clear();
        state.undoSequence = 0;
        state.lastUndo = null;
    };
})();
