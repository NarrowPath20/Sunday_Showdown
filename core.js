(function (root, factory) {
  "use strict";
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.GameCore = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const VALUE_STEPS = [200, 400, 600, 800, 1000];

  function clean(value) {
    return value === undefined || value === null ? "" : String(value).trim();
  }

  function slugify(value) {
    return clean(value)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "item";
  }

  function decodeEntities(value) {
    const named = {
      amp: "&", quot: '"', apos: "'", lt: "<", gt: ">", nbsp: " ",
      rsquo: "’", lsquo: "‘", rdquo: "”", ldquo: "“", hellip: "…"
    };
    return clean(value)
      .replace(/&#(\d+);/g, function (_, code) { return String.fromCodePoint(Number(code)); })
      .replace(/&#x([0-9a-f]+);/gi, function (_, code) { return String.fromCodePoint(parseInt(code, 16)); })
      .replace(/&([a-z]+);/gi, function (match, name) { return named[name.toLowerCase()] || match; });
  }

  function parseCSV(text) {
    const source = String(text || "").replace(/^\uFEFF/, "");
    const rows = [];
    let row = [];
    let field = "";
    let quoted = false;

    for (let i = 0; i < source.length; i += 1) {
      const char = source[i];
      if (char === '"') {
        if (quoted && source[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          quoted = !quoted;
        }
      } else if (char === "," && !quoted) {
        row.push(field);
        field = "";
      } else if ((char === "\n" || char === "\r") && !quoted) {
        if (char === "\r" && source[i + 1] === "\n") i += 1;
        row.push(field);
        if (row.some(function (cell) { return clean(cell) !== ""; })) rows.push(row);
        row = [];
        field = "";
      } else {
        field += char;
      }
    }

    if (quoted) throw new Error("The CSV has an unclosed quoted field.");
    row.push(field);
    if (row.some(function (cell) { return clean(cell) !== ""; })) rows.push(row);
    return rows;
  }

  function csvToObjects(text) {
    const matrix = parseCSV(text);
    if (matrix.length < 2) throw new Error("The CSV needs a header and at least one question row.");
    const headers = matrix[0].map(function (header) { return slugify(header).replace(/-/g, ""); });
    return matrix.slice(1).map(function (cells, rowIndex) {
      const item = { __row: rowIndex + 2 };
      headers.forEach(function (header, index) { item[header] = cells[index] === undefined ? "" : cells[index]; });
      return item;
    });
  }

  function truthy(value) {
    if (value === true || value === 1) return true;
    return ["true", "yes", "y", "1", "special", "daily double"].includes(clean(value).toLowerCase());
  }

  function parseValue(value) {
    if (typeof value === "number") return Number.isFinite(value) ? Math.round(value) : NaN;
    const parsed = Number(clean(value).replace(/[$,\s]/g, ""));
    return Number.isFinite(parsed) ? Math.round(parsed) : NaN;
  }

  function objectWithNormalizedKeys(object) {
    const normalized = {};
    Object.keys(object || {}).forEach(function (key) {
      normalized[slugify(key).replace(/-/g, "")] = object[key];
    });
    if (object && object.__row) normalized.__row = object.__row;
    return normalized;
  }

  function pick(object, keys) {
    for (let i = 0; i < keys.length; i += 1) {
      if (object[keys[i]] !== undefined && object[keys[i]] !== null) return object[keys[i]];
    }
    return "";
  }

  function flattenJson(json) {
    if (Array.isArray(json)) return { title: "My Custom Game", rows: json, final: null };
    if (!json || typeof json !== "object") throw new Error("The JSON root must be an object or an array of questions.");

    let rows = [];
    if (Array.isArray(json.questions)) rows = json.questions;
    if (Array.isArray(json.categories)) {
      rows = [];
      json.categories.forEach(function (category) {
        const categoryName = clean(category.name || category.category || category.title);
        const clues = Array.isArray(category.clues) ? category.clues : (Array.isArray(category.questions) ? category.questions : []);
        clues.forEach(function (clue) {
          rows.push(Object.assign({}, clue, { category: clue.category || categoryName }));
        });
      });
    }

    return {
      title: clean(json.title || json.name) || "My Custom Game",
      rows: rows,
      final: json.final || json.finalChallenge || json.finalQuestion || null
    };
  }

  function normalizeFinal(raw, errors) {
    if (!raw) return null;
    const item = objectWithNormalizedKeys(raw);
    const category = clean(pick(item, ["category", "title"])) || "Final Challenge";
    const question = clean(pick(item, ["question", "clue", "prompt"]));
    const answer = clean(pick(item, ["answer", "response", "correctanswer"]));
    if (!question || !answer) {
      errors.push("The Final Challenge needs both a question and an answer.");
      return null;
    }
    return { category: category, question: question, answer: answer };
  }

  function normalizeRows(inputRows, options) {
    const opts = options || {};
    const errors = [];
    const warnings = [];
    const questions = [];
    const seenIds = new Set();
    let inlineFinal = null;

    (inputRows || []).forEach(function (raw, index) {
      const item = objectWithNormalizedKeys(raw || {});
      const rowLabel = item.__row ? "Row " + item.__row : "Question " + (index + 1);
      const category = clean(pick(item, ["category", "cat", "topic"]));
      const question = clean(pick(item, ["question", "clue", "prompt"]));
      const answer = clean(pick(item, ["answer", "response", "correctanswer", "correctresponse"]));
      const round = clean(pick(item, ["round", "stage"])).toLowerCase();
      let value = parseValue(pick(item, ["value", "price", "points", "amount"]));

      if (round === "final" || round === "final challenge" || round === "finalchallenge") {
        if (!question || !answer) errors.push(rowLabel + ": Final Challenge needs a question and answer.");
        else inlineFinal = { category: category || "Final Challenge", question: question, answer: answer };
        return;
      }

      const missing = [];
      if (!category) missing.push("category");
      if (!question) missing.push("question");
      if (!answer) missing.push("answer");
      if (missing.length) {
        errors.push(rowLabel + ": missing " + missing.join(", ") + ".");
        return;
      }
      if (!Number.isFinite(value) || value <= 0) {
        errors.push(rowLabel + ": value/price must be a positive number.");
        return;
      }

      let choices = pick(item, ["choices", "options", "incorrectanswers"]);
      if (typeof choices === "string") choices = choices.split("|").map(clean).filter(Boolean);
      if (!Array.isArray(choices)) choices = [];
      choices = choices.map(clean).filter(Boolean);
      if (choices.length && !choices.some(function (choice) { return choice.toLowerCase() === answer.toLowerCase(); })) choices.push(answer);

      let id = clean(item.id) || "custom-" + slugify(category) + "-" + value + "-" + (index + 1);
      if (seenIds.has(id)) {
        warnings.push(rowLabel + ': duplicate id "' + id + '" was made unique.');
        const baseId = id;
        let suffix = index + 1;
        while (seenIds.has(id)) { id = baseId + "-" + suffix; suffix += 1; }
      }
      seenIds.add(id);

      questions.push({
        id: id,
        category: category,
        value: value,
        question: question,
        answer: answer,
        choices: choices,
        isSpecial: truthy(pick(item, ["special", "dailydouble", "wager"])),
        used: false
      });
    });

    const categoryNames = [];
    questions.forEach(function (question) {
      if (!categoryNames.includes(question.category)) categoryNames.push(question.category);
    });
    if (!questions.length && !errors.length) errors.push("No board questions were found.");
    if (categoryNames.length > 8) errors.push("A board can contain at most 8 categories; this file has " + categoryNames.length + ".");
    categoryNames.forEach(function (category) {
      const matches = questions.filter(function (question) { return question.category === category; });
      if (matches.length > 8) errors.push('Category "' + category + '" has more than 8 clues.');
      const values = new Set();
      matches.forEach(function (question) {
        if (values.has(question.value)) warnings.push('Category "' + category + '" repeats the value $' + question.value + ".");
        values.add(question.value);
      });
    });
    if (categoryNames.length !== 6 || questions.length !== 30) {
      warnings.push("Classic boards use 6 categories and 30 clues; this file will use its " + categoryNames.length + " categories and " + questions.length + " clues.");
    }

    const finalQuestion = normalizeFinal(opts.final, errors) || inlineFinal;
    return {
      title: clean(opts.title) || "My Custom Game",
      source: "custom",
      questions: questions,
      final: finalQuestion,
      errors: errors,
      warnings: warnings,
      categoryCount: categoryNames.length
    };
  }

  function parseQuestionFile(text, fileName) {
    const name = clean(fileName).toLowerCase();
    if (name.endsWith(".json") || (!name.endsWith(".csv") && /^[\s\uFEFF]*[\[{]/.test(String(text)))) {
      let json;
      try { json = JSON.parse(String(text).replace(/^\uFEFF/, "")); }
      catch (error) { throw new Error("This JSON file could not be read: " + error.message); }
      const flattened = flattenJson(json);
      return normalizeRows(flattened.rows, { title: flattened.title, final: flattened.final });
    }

    const rows = csvToObjects(text);
    const pack = normalizeRows(rows, { title: name ? name.replace(/\.csv$/i, "").replace(/[-_]+/g, " ") : "My Custom Game" });
    return pack;
  }

  function buildColumns(questions) {
    const columns = [];
    (questions || []).forEach(function (question) {
      let column = columns.find(function (item) { return item.name === question.category; });
      if (!column) {
        column = { name: question.category, questions: [] };
        columns.push(column);
      }
      column.questions.push(question);
    });
    columns.forEach(function (column) {
      column.questions.sort(function (a, b) { return a.value - b.value; });
    });
    return columns;
  }

  function normalizeApiQuestion(raw, categoryName, value, idPrefix) {
    const questionText = raw && raw.question && typeof raw.question === "object" ? raw.question.text : raw.question;
    const answer = decodeEntities(raw && (raw.correctAnswer || raw.answer));
    return {
      id: (idPrefix || "api") + "-" + slugify(categoryName) + "-" + value + "-" + slugify(raw && raw.id || questionText).slice(0, 36),
      category: categoryName,
      value: value,
      question: decodeEntities(questionText),
      answer: answer,
      // Live games are intentionally open-ended. Keep the API's correct answer
      // for the host reveal, but do not turn its distractors into visible choices.
      choices: [],
      difficulty: clean(raw && raw.difficulty).toLowerCase(),
      used: false,
      isSpecial: false
    };
  }

  function difficultyRank(question) {
    return { easy: 1, medium: 2, hard: 3 }[clean(question && question.difficulty).toLowerCase()] || 2;
  }

  function formatMoney(value) {
    const amount = Number(value) || 0;
    const absolute = Math.abs(amount).toLocaleString("en-US");
    return amount < 0 ? "−$" + absolute : "$" + absolute;
  }

  function shuffle(items, random) {
    const copy = items.slice();
    const rand = random || Math.random;
    for (let i = copy.length - 1; i > 0; i -= 1) {
      const j = Math.floor(rand() * (i + 1));
      const temp = copy[i]; copy[i] = copy[j]; copy[j] = temp;
    }
    return copy;
  }

  function csvEscape(value) {
    const string = clean(value);
    return /[",\r\n]/.test(string) ? '"' + string.replace(/"/g, '""') + '"' : string;
  }

  function createCsvTemplate() {
    const rows = [["round", "category", "value", "question", "answer", "special"]];
    for (let category = 1; category <= 6; category += 1) {
      VALUE_STEPS.forEach(function (value, row) {
        rows.push([
          "board",
          "Category " + category,
          String(value),
          "Replace with question " + (row + 1) + " for category " + category,
          "Replace with the correct answer",
          category === 4 && value === 800 ? "yes" : "no"
        ]);
      });
    }
    rows.push(["final", "Final Category", "0", "Replace with your final question", "Replace with the final answer", "no"]);
    return rows.map(function (row) { return row.map(csvEscape).join(","); }).join("\r\n");
  }

  function createJsonTemplate() {
    return JSON.stringify({
      title: "My Sunday Showdown",
      categories: [
        {
          name: "Bible Heroes",
          clues: [
            { value: 200, question: "Who built the ark?", answer: "Noah" },
            { value: 400, question: "Who defeated Goliath?", answer: "David", special: true }
          ]
        },
        {
          name: "Places",
          clues: [
            { value: 200, question: "Where was Jesus born?", answer: "Bethlehem" }
          ]
        }
      ],
      final: { category: "Faith", question: "Type your final question here", answer: "Type the final answer here" }
    }, null, 2);
  }

  return {
    VALUE_STEPS: VALUE_STEPS,
    buildColumns: buildColumns,
    createCsvTemplate: createCsvTemplate,
    createJsonTemplate: createJsonTemplate,
    decodeEntities: decodeEntities,
    difficultyRank: difficultyRank,
    formatMoney: formatMoney,
    normalizeApiQuestion: normalizeApiQuestion,
    normalizeRows: normalizeRows,
    parseCSV: parseCSV,
    parseQuestionFile: parseQuestionFile,
    shuffle: shuffle,
    slugify: slugify
  };
});
