"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const core = require("./core.js");

test("CSV parser handles quoted commas, quotes, and newlines", function () {
  const csv = 'category,value,question,answer\r\nPeople,200,"Who said, ""Let there be light""?","A\nresponse"';
  const rows = core.parseCSV(csv);
  assert.equal(rows.length, 2);
  assert.equal(rows[1][2], 'Who said, "Let there be light"?');
  assert.equal(rows[1][3], "A\nresponse");
});

test("custom CSV accepts price as an alias for value", function () {
  const csv = "category,question,answer,price\nPeople,Who built the ark?,Noah,$200";
  const pack = core.parseQuestionFile(csv, "questions.csv");
  assert.deepEqual(pack.errors, []);
  assert.equal(pack.questions[0].value, 200);
  assert.equal(pack.questions[0].answer, "Noah");
});

test("nested JSON categories and Final Challenge are normalized", function () {
  const json = JSON.stringify({
    title: "Test board",
    categories: [{ name: "Places", clues: [{ value: 200, question: "A question", answer: "An answer" }] }],
    final: { category: "Final", question: "Last one", answer: "Done" }
  });
  const pack = core.parseQuestionFile(json, "board.json");
  assert.equal(pack.title, "Test board");
  assert.equal(pack.questions[0].category, "Places");
  assert.equal(pack.final.answer, "Done");
});

test("malformed rows return useful validation errors", function () {
  const pack = core.normalizeRows([{ category: "People", question: "Missing two fields" }]);
  assert.equal(pack.questions.length, 0);
  assert.match(pack.errors[0], /missing answer/i);
});

test("questions are grouped and sorted into board columns", function () {
  const columns = core.buildColumns([
    { category: "One", value: 600 },
    { category: "Two", value: 200 },
    { category: "One", value: 200 }
  ]);
  assert.equal(columns.length, 2);
  assert.deepEqual(columns[0].questions.map(function (q) { return q.value; }), [200, 600]);
});

test("money formatting handles positive, zero, and negative scores", function () {
  assert.equal(core.formatMoney(1200), "$1,200");
  assert.equal(core.formatMoney(0), "$0");
  assert.equal(core.formatMoney(-400), "−$400");
});

test("downloaded CSV template is a complete playable board", function () {
  const pack = core.parseQuestionFile(core.createCsvTemplate(), "template.csv");
  assert.equal(pack.questions.length, 30);
  assert.equal(pack.categoryCount, 6);
  assert.ok(pack.final);
  assert.deepEqual(pack.errors, []);
});

test("duplicate imported ids are made unique", function () {
  const pack = core.normalizeRows([
    { id: "same", category: "One", value: 200, question: "First", answer: "A" },
    { id: "same", category: "One", value: 400, question: "Second", answer: "B" }
  ]);
  assert.notEqual(pack.questions[0].id, pack.questions[1].id);
  assert.match(pack.warnings.join(" "), /duplicate id/i);
});

test("live API questions remain open-ended while preserving the host answer", function () {
  const question = core.normalizeApiQuestion({
    id: "example",
    question: { text: "Which planet is known as the Red Planet?" },
    correctAnswer: "Mars",
    incorrectAnswers: ["Venus", "Jupiter", "Mercury"],
    difficulty: "easy"
  }, "Space", 200, "live");

  assert.equal(question.answer, "Mars");
  assert.deepEqual(question.choices, []);
});
