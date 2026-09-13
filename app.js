(function () {
  "use strict";

  const Core = window.GameCore;
  const STORAGE_KEY = "sunday-showdown-game-v1";
  const SETTINGS_KEY = "sunday-showdown-settings-v1";
  const API_BASE = "https://the-trivia-api.com/v2/questions";
  const TEAM_COLORS = ["#69a6ff", "#f4bd4f", "#58d3a0", "#e57a88", "#b78cff", "#ff9d58"];
  const API_CATEGORIES = [
    { slug: "arts_and_literature", name: "Arts & Literature", icon: "✎" },
    { slug: "film_and_tv", name: "Film & TV", icon: "▻" },
    { slug: "food_and_drink", name: "Food & Drink", icon: "◇" },
    { slug: "general_knowledge", name: "General Knowledge", icon: "◎" },
    { slug: "geography", name: "Geography", icon: "⌖" },
    { slug: "history", name: "History", icon: "⌛" },
    { slug: "music", name: "Music", icon: "♫" },
    { slug: "science", name: "Science", icon: "⚗" },
    { slug: "society_and_culture", name: "Society & Culture", icon: "◈" },
    { slug: "sport_and_leisure", name: "Sport & Leisure", icon: "☆" },
    { slug: "pop_culture", name: "Pop Culture", icon: "★", tags: ["film", "tv", "music", "comics", "fictitious_characters", "disney"] },
    { slug: "video_games", name: "Video Games", icon: "⌘", tags: ["video_games"] },
    { slug: "comics_and_heroes", name: "Comics & Heroes", icon: "⚡", tags: ["comics", "marvel", "mcu", "dc"] },
    { slug: "mythology", name: "Mythology", icon: "♜", tags: ["mythology"] },
    { slug: "animals_and_nature", name: "Animals & Nature", icon: "♧", tags: ["animals", "nature"] },
    { slug: "technology_and_internet", name: "Tech & Internet", icon: "⌁", tags: ["technology", "the_internet", "computing"] },
    { slug: "faith_and_religion", name: "Faith & Religion", icon: "✚", tags: ["religion", "christianity", "bible"] },
    { slug: "space_and_astronomy", name: "Space & Astronomy", icon: "☄", tags: ["space", "astronomy", "the_solar_system"] },
    { slug: "theater_and_musicals", name: "Theater & Musicals", icon: "♪", tags: ["theater", "musicals"] },
    { slug: "politics_and_leaders", name: "Politics & Leaders", icon: "♙", tags: ["politics", "leaders", "presidents"] }
  ];

  const refs = {};
  let sourceMode = "api";
  let selectedCategories = new Set();
  let teamDraft = ["Team One", "Team Two"];
  let clueSeconds = 30;
  let specialClueCount = 1;
  let customPack = null;
  let game = null;
  let loadingController = null;
  let clueTimer = null;
  let clueDeadline = 0;
  let audioContext = null;
  let soundEnabled = true;
  let lastFocusedTile = null;
  let siteTheme = document.documentElement.dataset.theme === "dark" ? "dark" : "light";
  let musicTracks = [];
  let musicTrackIndex = 0;
  let musicVolume = 0.28;
  let musicLoop = true;
  let musicDucked = false;

  function $(id) { return document.getElementById(id); }

  function element(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function clone(value) {
    return typeof structuredClone === "function"
      ? structuredClone(value)
      : JSON.parse(JSON.stringify(value));
  }

  function collectRefs() {
    [
      "setup-screen", "loading-screen", "game-screen", "final-screen", "results-screen",
      "brand-button", "theme-button", "sound-button", "fullscreen-button", "connection-pill", "connection-label",
      "music-button", "music-popover", "music-close-button", "music-file-input", "music-empty", "music-player",
      "music-choose-button", "music-track-name", "music-track-count", "music-previous-button", "music-play-button",
      "music-next-button", "music-volume-input", "music-volume-value", "music-loop-input", "music-replace-button",
      "music-clear-button", "background-audio",
      "resume-banner", "resume-summary", "resume-game-button", "discard-game-button",
      "category-options", "category-selection-count", "randomize-categories", "starter-categories",
      "question-file-input", "file-drop", "file-result", "download-csv-button", "download-json-button",
      "team-inputs", "team-count", "team-minus", "team-plus", "timer-options", "special-minus", "special-count",
      "special-plus", "special-count-description",
      "penalty-toggle", "start-game-button", "start-button-label", "start-note",
      "loading-message", "loading-progress-bar", "cancel-loading-button",
      "game-label", "board-title", "clues-remaining", "game-progress", "scoreboard", "control-team-name",
      "game-board", "undo-button", "score-button", "end-board-button", "game-setup-button", "api-credit",
      "clue-modal", "clue-category", "clue-value", "close-clue-button", "timer-chip", "timer-ring",
      "timer-value", "special-intro", "wager-input", "wager-help", "confirm-wager-button",
      "clue-content", "clue-text", "choice-list", "answer-panel", "answer-text", "clue-footer",
      "responder-list", "no-score-button", "reveal-button", "wrong-button", "correct-button",
      "score-modal", "close-score-button", "done-score-button", "score-editor",
      "final-title", "final-content", "winner-name", "winner-score", "final-rankings",
      "rematch-button", "new-game-button", "toast-region", "confetti-layer"
    ].forEach(function (id) { refs[id] = $(id); });
  }

  function init() {
    collectRefs();
    loadPreferences();
    renderCategoryOptions();
    renderStarterCategories();
    renderTeamInputs();
    bindSetupEvents();
    bindGameEvents();
    bindGlobalEvents();
    updateSourceUi();
    updateConnectionState();
    refreshResumeBanner();
    renderMusicUi();
  }

  function loadPreferences() {
    try {
      const saved = JSON.parse(localStorage.getItem(SETTINGS_KEY) || "null");
      if (saved && typeof saved === "object") {
        soundEnabled = saved.sound !== false;
        siteTheme = saved.theme === "dark" ? "dark" : "light";
        musicVolume = Number.isFinite(saved.musicVolume) ? Math.max(0, Math.min(1, saved.musicVolume)) : 0.28;
        musicLoop = saved.musicLoop !== false;
        clueSeconds = [0, 30, 45, 60].includes(saved.timer) ? saved.timer : 30;
        if (Number.isInteger(saved.specialCount)) specialClueCount = Math.max(0, Math.min(5, saved.specialCount));
        else if (typeof saved.special === "boolean") specialClueCount = saved.special ? 1 : 0;
        if (typeof saved.penalty === "boolean") refs["penalty-toggle"].checked = saved.penalty;
      }
    } catch (_) { /* A bad preference should never stop the game. */ }
    applyTheme(siteTheme);
    refs["music-volume-input"].value = String(Math.round(musicVolume * 100));
    refs["music-volume-value"].textContent = Math.round(musicVolume * 100) + "%";
    refs["music-loop-input"].checked = musicLoop;
    updateSpecialCountUi();
    updateBackgroundVolume();
    updateSoundButton();
    refs["timer-options"].querySelectorAll("button").forEach(function (button) {
      const selected = Number(button.dataset.seconds) === clueSeconds;
      button.classList.toggle("is-selected", selected);
      button.setAttribute("aria-checked", String(selected));
      button.tabIndex = selected ? 0 : -1;
    });
  }

  function savePreferences() {
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify({
        sound: soundEnabled,
        theme: siteTheme,
        musicVolume: musicVolume,
        musicLoop: musicLoop,
        timer: clueSeconds,
        specialCount: specialClueCount,
        penalty: refs["penalty-toggle"].checked
      }));
    } catch (_) { /* Private browsing can disable storage. */ }
  }

  function renderCategoryOptions() {
    const activeSlug = document.activeElement && document.activeElement.classList.contains("category-option")
      ? document.activeElement.dataset.slug
      : null;
    refs["category-options"].replaceChildren();
    API_CATEGORIES.forEach(function (category) {
      const button = element("button", "category-option");
      button.type = "button";
      button.dataset.slug = category.slug;
      button.setAttribute("aria-pressed", String(selectedCategories.has(category.slug)));
      button.textContent = category.icon + "  " + category.name;
      if (selectedCategories.has(category.slug)) button.classList.add("is-selected");
      button.addEventListener("click", function () { toggleCategory(category.slug); });
      refs["category-options"].appendChild(button);
    });
    updateCategoryCount();
    if (activeSlug) {
      const restored = refs["category-options"].querySelector('[data-slug="' + activeSlug + '"]');
      if (restored) restored.focus();
    }
  }

  function renderStarterCategories() {
    const columns = Core.buildColumns(window.STARTER_PACK.questions);
    refs["starter-categories"].replaceChildren.apply(
      refs["starter-categories"],
      columns.map(function (column) { return element("span", "", column.name); })
    );
  }

  function toggleCategory(slug) {
    if (selectedCategories.has(slug)) selectedCategories.delete(slug);
    else if (selectedCategories.size < 6) selectedCategories.add(slug);
    else {
      toast("Choose up to six categories. Remove one before adding another.");
      return;
    }
    renderCategoryOptions();
  }

  function randomizeCategories() {
    selectedCategories = new Set(Core.shuffle(API_CATEGORIES).slice(0, 6).map(function (item) { return item.slug; }));
    renderCategoryOptions();
    playSound("select");
  }

  function updateCategoryCount() {
    const count = selectedCategories.size;
    refs["category-selection-count"].textContent = count
      ? count + " selected" + (count < 6 ? " · " + (6 - count) + " will be chosen at random" : " · board ready")
      : "0 selected · 6 will be chosen at random";
  }

  function setSource(mode) {
    sourceMode = mode;
    document.querySelectorAll(".source-tab").forEach(function (tab) {
      const selected = tab.dataset.source === mode;
      tab.classList.toggle("is-selected", selected);
      tab.setAttribute("aria-selected", String(selected));
      tab.tabIndex = selected ? 0 : -1;
      const panel = $("source-" + tab.dataset.source);
      panel.hidden = !selected;
      panel.classList.toggle("is-active", selected);
    });
    updateSourceUi();
    playSound("select");
  }

  function updateSourceUi() {
    document.querySelectorAll(".source-tab").forEach(function (tab) {
      tab.tabIndex = tab.dataset.source === sourceMode ? 0 : -1;
    });
    if (sourceMode === "api") {
      refs["start-button-label"].textContent = "Create my game";
      refs["start-note"].innerHTML = '<span aria-hidden="true">⌁</span> Requires internet for a fresh board';
      refs["start-game-button"].disabled = false;
    } else if (sourceMode === "custom") {
      refs["start-button-label"].textContent = customPack && !customPack.errors.length ? "Play imported board" : "Choose a question file";
      refs["start-note"].innerHTML = '<span aria-hidden="true">▣</span> CSV and JSON are processed privately';
      refs["start-game-button"].disabled = Boolean(customPack && customPack.errors.length);
    } else {
      refs["start-button-label"].textContent = "Play Bible Basics";
      refs["start-note"].innerHTML = '<span aria-hidden="true">✓</span> Ready to play without internet';
      refs["start-game-button"].disabled = false;
    }
  }

  function renderTeamInputs() {
    const count = teamDraft.length;
    refs["team-count"].textContent = String(count);
    refs["team-minus"].disabled = count <= 1;
    refs["team-plus"].disabled = count >= 6;
    refs["team-inputs"].replaceChildren();
    teamDraft.forEach(function (name, index) {
      const wrapper = element("label", "team-field");
      wrapper.setAttribute("for", "team-name-" + index);
      const dot = element("span", "team-color");
      dot.style.background = TEAM_COLORS[index];
      const input = element("input");
      input.id = "team-name-" + index;
      input.type = "text";
      input.maxLength = 24;
      input.value = name;
      input.setAttribute("aria-label", "Team " + (index + 1) + " name");
      input.addEventListener("input", function () { teamDraft[index] = input.value; });
      wrapper.append(dot, input);
      refs["team-inputs"].appendChild(wrapper);
    });
  }

  function changeTeamCount(delta) {
    const next = Math.max(1, Math.min(6, teamDraft.length + delta));
    if (next === teamDraft.length) return;
    while (teamDraft.length < next) teamDraft.push("Team " + numberWord(teamDraft.length + 1));
    teamDraft = teamDraft.slice(0, next);
    renderTeamInputs();
    playSound("select");
  }

  function changeSpecialClueCount(delta) {
    const next = Math.max(0, Math.min(5, specialClueCount + delta));
    if (next === specialClueCount) return;
    specialClueCount = next;
    updateSpecialCountUi();
    savePreferences();
    playSound("select");
  }

  function updateSpecialCountUi() {
    refs["special-count"].textContent = String(specialClueCount);
    refs["special-minus"].disabled = specialClueCount <= 0;
    refs["special-plus"].disabled = specialClueCount >= 5;
    refs["special-count-description"].textContent = specialClueCount === 0
      ? "No hidden wager tiles this game"
      : specialClueCount === 1
        ? "1 hidden wager tile · marked imports first"
        : specialClueCount + " hidden wager tiles · marked imports first";
  }

  function numberWord(number) {
    return ["One", "Two", "Three", "Four", "Five", "Six"][number - 1] || String(number);
  }

  function bindSetupEvents() {
    document.querySelectorAll(".source-tab").forEach(function (tab) {
      tab.addEventListener("click", function () { setSource(tab.dataset.source); });
      tab.addEventListener("keydown", handleTabKeyboard);
    });
    refs["randomize-categories"].addEventListener("click", randomizeCategories);
    refs["team-minus"].addEventListener("click", function () { changeTeamCount(-1); });
    refs["team-plus"].addEventListener("click", function () { changeTeamCount(1); });
    refs["timer-options"].addEventListener("click", function (event) {
      const button = event.target.closest("button[data-seconds]");
      if (!button) return;
      selectTimerButton(button);
    });
    refs["timer-options"].querySelectorAll("button[data-seconds]").forEach(function (button) {
      button.addEventListener("keydown", handleTimerKeyboard);
    });
    refs["special-minus"].addEventListener("click", function () { changeSpecialClueCount(-1); });
    refs["special-plus"].addEventListener("click", function () { changeSpecialClueCount(1); });
    refs["penalty-toggle"].addEventListener("change", savePreferences);
    refs["start-game-button"].addEventListener("click", startFromSetup);
    refs["file-drop"].addEventListener("click", openQuestionFilePicker);
    refs["file-drop"].addEventListener("keydown", function (event) {
      if (event.key === "Enter" || event.key === " ") { event.preventDefault(); openQuestionFilePicker(); }
    });
    refs["question-file-input"].addEventListener("change", function () {
      const selectedFile = refs["question-file-input"].files[0];
      if (selectedFile) handleFile(selectedFile);
      refs["question-file-input"].value = "";
    });
    ["dragenter", "dragover"].forEach(function (eventName) {
      refs["file-drop"].addEventListener(eventName, function (event) {
        event.preventDefault(); refs["file-drop"].classList.add("is-dragging");
      });
    });
    ["dragleave", "drop"].forEach(function (eventName) {
      refs["file-drop"].addEventListener(eventName, function (event) {
        event.preventDefault(); refs["file-drop"].classList.remove("is-dragging");
      });
    });
    refs["file-drop"].addEventListener("drop", function (event) {
      const file = event.dataTransfer.files[0];
      if (file) handleFile(file);
    });
    refs["download-csv-button"].addEventListener("click", function () {
      downloadText("sunday-showdown-template.csv", Core.createCsvTemplate(), "text/csv;charset=utf-8");
    });
    refs["download-json-button"].addEventListener("click", function () {
      downloadText("sunday-showdown-example.json", Core.createJsonTemplate(), "application/json;charset=utf-8");
    });
    refs["resume-game-button"].addEventListener("click", resumeSavedGame);
    refs["discard-game-button"].addEventListener("click", discardSavedGame);
    refs["cancel-loading-button"].addEventListener("click", cancelLoading);
  }

  function bindGameEvents() {
    refs["game-setup-button"].addEventListener("click", returnToSetup);
    refs["undo-button"].addEventListener("click", undoLastAction);
    refs["score-button"].addEventListener("click", openScoreModal);
    refs["end-board-button"].addEventListener("click", requestFinalChallenge);
    refs["close-clue-button"].addEventListener("click", closeClue);
    refs["reveal-button"].addEventListener("click", revealAnswer);
    refs["no-score-button"].addEventListener("click", function () { completeClue("no-score"); });
    refs["wrong-button"].addEventListener("click", handleIncorrectResponse);
    refs["correct-button"].addEventListener("click", function () { completeClue("correct"); });
    refs["confirm-wager-button"].addEventListener("click", confirmSpecialWager);
    refs["close-score-button"].addEventListener("click", closeScoreModal);
    refs["done-score-button"].addEventListener("click", closeScoreModal);
    refs["rematch-button"].addEventListener("click", rematch);
    refs["new-game-button"].addEventListener("click", newGame);
    refs["clue-modal"].addEventListener("click", function (event) { if (event.target === refs["clue-modal"]) closeClue(); });
    refs["score-modal"].addEventListener("click", function (event) { if (event.target === refs["score-modal"]) closeScoreModal(); });
  }

  function bindGlobalEvents() {
    refs["theme-button"].addEventListener("click", function () {
      siteTheme = siteTheme === "dark" ? "light" : "dark";
      applyTheme(siteTheme);
      savePreferences();
      playSound("select");
    });
    refs["music-button"].addEventListener("click", toggleMusicPopover);
    refs["music-close-button"].addEventListener("click", closeMusicPopover);
    refs["music-choose-button"].addEventListener("click", openMusicPicker);
    refs["music-replace-button"].addEventListener("click", openMusicPicker);
    refs["music-clear-button"].addEventListener("click", clearMusicPlaylist);
    refs["music-file-input"].addEventListener("change", function () {
      const files = Array.from(refs["music-file-input"].files || []);
      refs["music-file-input"].value = "";
      if (files.length) useMusicFiles(files);
    });
    refs["music-play-button"].addEventListener("click", toggleMusicPlayback);
    refs["music-previous-button"].addEventListener("click", previousMusicTrack);
    refs["music-next-button"].addEventListener("click", nextMusicTrack);
    refs["music-volume-input"].addEventListener("input", function () {
      musicVolume = Number(refs["music-volume-input"].value) / 100;
      refs["music-volume-value"].textContent = Math.round(musicVolume * 100) + "%";
      updateBackgroundVolume();
      savePreferences();
    });
    refs["music-loop-input"].addEventListener("change", function () {
      musicLoop = refs["music-loop-input"].checked;
      savePreferences();
    });
    refs["background-audio"].addEventListener("play", renderMusicUi);
    refs["background-audio"].addEventListener("pause", renderMusicUi);
    refs["background-audio"].addEventListener("ended", handleMusicEnded);
    refs["background-audio"].addEventListener("error", handleMusicError);
    refs["sound-button"].addEventListener("click", function () {
      soundEnabled = !soundEnabled; updateSoundButton(); savePreferences();
      if (soundEnabled) playSound("select");
    });
    refs["fullscreen-button"].addEventListener("click", toggleFullscreen);
    refs["brand-button"].addEventListener("click", function () {
      if (game && !refs["setup-screen"].classList.contains("is-active")) returnToSetup();
      else showScreen("setup-screen");
    });
    window.addEventListener("online", updateConnectionState);
    window.addEventListener("offline", updateConnectionState);
    document.addEventListener("fullscreenchange", updateFullscreenButton);
    document.addEventListener("click", function (event) {
      if (!refs["music-popover"].hidden && !event.target.closest(".music-menu")) closeMusicPopover(false);
    });
    window.addEventListener("beforeunload", revokeMusicUrls);
    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape") {
        if (!refs["clue-modal"].hidden) closeClue();
        else if (!refs["score-modal"].hidden) closeScoreModal();
        else if (!refs["music-popover"].hidden) closeMusicPopover();
      }
      if (event.key === "Tab") trapModalFocus(event);
    });
  }

  function handleTabKeyboard(event) {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const tabs = Array.from(document.querySelectorAll(".source-tab"));
    const current = tabs.indexOf(event.currentTarget);
    let next = event.key === "Home" ? 0 : event.key === "End" ? tabs.length - 1 : current + (event.key === "ArrowLeft" ? -1 : 1);
    next = (next + tabs.length) % tabs.length;
    setSource(tabs[next].dataset.source);
    tabs[next].focus();
  }

  function selectTimerButton(button) {
    clueSeconds = Number(button.dataset.seconds);
    refs["timer-options"].querySelectorAll("button").forEach(function (item) {
      const selected = item === button;
      item.classList.toggle("is-selected", selected);
      item.setAttribute("aria-checked", String(selected));
      item.tabIndex = selected ? 0 : -1;
    });
    savePreferences();
  }

  function handleTimerKeyboard(event) {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const buttons = Array.from(refs["timer-options"].querySelectorAll("button[data-seconds]"));
    const current = buttons.indexOf(event.currentTarget);
    let next = event.key === "Home" ? 0 : event.key === "End" ? buttons.length - 1 : current + (event.key === "ArrowLeft" ? -1 : 1);
    next = (next + buttons.length) % buttons.length;
    selectTimerButton(buttons[next]);
    buttons[next].focus();
  }

  function trapModalFocus(event) {
    const modal = !refs["clue-modal"].hidden
      ? refs["clue-modal"].querySelector('[role="dialog"]')
      : (!refs["score-modal"].hidden ? refs["score-modal"].querySelector('[role="dialog"]') : null);
    if (!modal) return;
    const focusable = Array.from(modal.querySelectorAll('button:not(:disabled), input:not(:disabled), [tabindex]:not([tabindex="-1"])'))
      .filter(function (node) { return !node.hidden && node.offsetParent !== null; });
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  }

  function setAppInert(inert) {
    const shell = document.querySelector(".app-shell");
    if (shell) shell.inert = Boolean(inert);
  }

  async function handleFile(file) {
    const lower = file.name.toLowerCase();
    if (!lower.endsWith(".csv") && !lower.endsWith(".json")) {
      customPack = null;
      showFileResult(null, ["Choose a .csv or .json question file."], file.name);
      updateSourceUi();
      return;
    }
    try {
      const text = await file.text();
      customPack = Core.parseQuestionFile(text, file.name);
      showFileResult(customPack, customPack.errors, file.name);
      updateSourceUi();
      if (!customPack.errors.length) playSound("correct");
    } catch (error) {
      customPack = null;
      showFileResult(null, [error.message], file.name);
      updateSourceUi();
    }
  }

  function openQuestionFilePicker() {
    refs["question-file-input"].value = "";
    refs["question-file-input"].click();
  }

  function showFileResult(pack, errors, fileName) {
    const box = refs["file-result"];
    box.hidden = false;
    box.classList.toggle("is-error", Boolean(errors && errors.length));
    box.replaceChildren();
    if (errors && errors.length) {
      box.appendChild(element("strong", "", "Couldn’t use " + fileName));
      const list = element("ul");
      errors.slice(0, 5).forEach(function (message) { list.appendChild(element("li", "", message)); });
      if (errors.length > 5) list.appendChild(element("li", "", "+ " + (errors.length - 5) + " more issues"));
      box.appendChild(list);
    } else {
      const columns = Core.buildColumns(pack.questions);
      box.appendChild(element("strong", "", "✓ " + fileName + " is ready"));
      box.appendChild(element("span", "", columns.length + " categories · " + pack.questions.length + " clues" + (pack.final ? " · Final Challenge included" : "")));
      if (pack.warnings.length) box.appendChild(element("div", "", pack.warnings[0]));
    }
  }

  function downloadText(fileName, content, type) {
    const url = URL.createObjectURL(new Blob([content], { type: type }));
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }

  async function startFromSetup() {
    normalizeTeamNames();
    if (sourceMode === "custom" && !customPack) {
      openQuestionFilePicker();
      return;
    }
    if (sourceMode === "custom" && customPack.errors.length) {
      toast("Fix the import errors before starting.", true);
      return;
    }

    if (sourceMode === "api") {
      await buildApiGame();
      return;
    }
    const pack = sourceMode === "custom" ? customPack : window.STARTER_PACK;
    beginGame(pack);
  }

  function normalizeTeamNames() {
    teamDraft = teamDraft.map(function (name, index) { return name.trim() || "Team " + numberWord(index + 1); });
    renderTeamInputs();
  }

  function chosenApiCategories() {
    const explicitlyChosen = API_CATEGORIES.filter(function (category) { return selectedCategories.has(category.slug); });
    const remaining = Core.shuffle(API_CATEGORIES.filter(function (category) { return !selectedCategories.has(category.slug); }));
    return explicitlyChosen.concat(remaining).slice(0, 6);
  }

  async function buildApiGame() {
    showScreen("loading-screen");
    refs["loading-progress-bar"].style.width = "5%";
    refs["loading-message"].textContent = "Choosing categories and contacting the trivia service.";
    const controller = new AbortController();
    loadingController = controller;
    const categories = chosenApiCategories();
    let completed = 0;

    try {
      const results = await Promise.all(categories.map(async function (category) {
        const questions = await fetchCategory(category, controller.signal);
        completed += 1;
        refs["loading-progress-bar"].style.width = (8 + completed * 14) + "%";
        refs["loading-message"].textContent = "Loaded " + completed + " of 6 categories…";
        return { category: category, questions: questions };
      }));

      const boardQuestions = [];
      const finalCandidates = [];
      const seenApiQuestions = new Set();
      results.forEach(function (result) {
        const shuffled = Core.shuffle(result.questions);
        const unseen = shuffled.filter(function (raw) {
          const key = raw.id || (raw.question && raw.question.text) || raw.question;
          return !seenApiQuestions.has(key);
        });
        const selectedRaw = unseen.slice(0, 5);
        if (selectedRaw.length < 5) {
          shuffled.forEach(function (raw) {
            if (selectedRaw.length < 5 && !selectedRaw.includes(raw)) selectedRaw.push(raw);
          });
        }
        const sorted = selectedRaw.sort(function (a, b) { return Core.difficultyRank(a) - Core.difficultyRank(b); });
        sorted.forEach(function (raw, index) {
          seenApiQuestions.add(raw.id || (raw.question && raw.question.text) || raw.question);
          boardQuestions.push(Core.normalizeApiQuestion(raw, result.category.name, Core.VALUE_STEPS[index], "live"));
        });
        shuffled.forEach(function (raw) {
          if (!selectedRaw.includes(raw)) finalCandidates.push({ raw: raw, category: result.category });
        });
      });

      const finalPick = Core.shuffle(finalCandidates.filter(function (candidate) {
        const raw = candidate.raw;
        return !seenApiQuestions.has(raw.id || (raw.question && raw.question.text) || raw.question);
      }))[0];
      const finalQuestion = finalPick ? {
        category: finalPick.category.name,
        question: Core.decodeEntities(finalPick.raw.question && finalPick.raw.question.text),
        answer: Core.decodeEntities(finalPick.raw.correctAnswer)
      } : clone(window.STARTER_PACK.final);

      refs["loading-progress-bar"].style.width = "100%";
      refs["loading-message"].textContent = "Board ready. Let’s play!";
      await delay(280);
      if (controller.signal.aborted) return;
      beginGame({ title: "Fresh Trivia", source: "api", questions: boardQuestions, final: finalQuestion });
      setConnection("Live questions loaded", false);
    } catch (error) {
      if (controller.signal.aborted) return;
      console.warn("Live trivia could not be loaded; using the included board.", error);
      refs["loading-message"].textContent = "The trivia service is unavailable. Loading the included board instead…";
      refs["loading-progress-bar"].style.width = "100%";
      setConnection("Using offline questions", true);
      toast("Live trivia was unavailable, so the ready-to-play board was loaded.", true);
      await delay(650);
      if (controller.signal.aborted) return;
      beginGame(window.STARTER_PACK);
    } finally {
      if (loadingController === controller) loadingController = null;
    }
  }

  async function fetchCategory(category, signal) {
    const filter = category.tags
      ? "tags=" + encodeURIComponent(category.tags.join(","))
      : "categories=" + encodeURIComponent(category.slug);
    const url = API_BASE + "?limit=10&" + filter + "&contentFilter=family";
    let lastError;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        const response = await fetchWithTimeout(url, signal, 9000);
        if (!response.ok) throw new Error("Trivia service returned " + response.status + ".");
        const questions = await response.json();
        if (!Array.isArray(questions) || questions.length < 6) throw new Error("Not enough questions were returned for " + category.name + ".");
        return questions;
      } catch (error) {
        if (signal.aborted) throw error;
        lastError = error;
        if (attempt < 2) await delay(500 * (attempt + 1));
      }
    }
    throw lastError;
  }

  async function fetchWithTimeout(url, parentSignal, milliseconds) {
    const requestController = new AbortController();
    const cancelRequest = function () { requestController.abort(); };
    if (parentSignal.aborted) requestController.abort();
    else parentSignal.addEventListener("abort", cancelRequest, { once: true });
    const timeout = setTimeout(function () { requestController.abort(); }, milliseconds);
    try {
      return await fetch(url, {
        headers: { Accept: "application/json" },
        signal: requestController.signal
      });
    } finally {
      clearTimeout(timeout);
      parentSignal.removeEventListener("abort", cancelRequest);
    }
  }

  function delay(milliseconds) {
    return new Promise(function (resolve) { setTimeout(resolve, milliseconds); });
  }

  function cancelLoading() {
    if (loadingController) loadingController.abort();
    loadingController = null;
    showScreen("setup-screen");
  }

  function beginGame(pack) {
    const selectedPack = clone(pack);
    const settings = {
      timer: clueSeconds,
      specialCount: Math.min(specialClueCount, selectedPack.questions.length),
      penalty: refs["penalty-toggle"].checked
    };
    const markedSpecials = selectedPack.questions.filter(function (question) { return question.isSpecial; });
    selectedPack.questions.forEach(function (question) {
      question.used = false;
      question.isSpecial = false;
    });

    const chosenSpecials = markedSpecials.slice(0, settings.specialCount);
    const preferredCandidates = Core.shuffle(selectedPack.questions.filter(function (question) {
      return !chosenSpecials.includes(question) && question.value >= 600;
    }));
    const remainingCandidates = Core.shuffle(selectedPack.questions.filter(function (question) {
      return !chosenSpecials.includes(question) && !preferredCandidates.includes(question);
    }));
    preferredCandidates.concat(remainingCandidates).some(function (question) {
      if (chosenSpecials.length >= settings.specialCount) return true;
      chosenSpecials.push(question);
      return false;
    });
    chosenSpecials.forEach(function (question) { question.isSpecial = true; });

    game = {
      version: 1,
      phase: "board",
      title: selectedPack.title || "Sunday Showdown",
      source: selectedPack.source || sourceMode,
      questions: selectedPack.questions,
      final: selectedPack.final || null,
      teams: teamDraft.map(function (name, index) { return { name: name, color: TEAM_COLORS[index], score: 0 }; }),
      activeTeam: 0,
      history: [],
      settings: settings,
      finalState: null,
      startedAt: Date.now()
    };
    saveGame();
    renderGame();
    showScreen("game-screen");
    playSound("start");
  }

  function renderGame() {
    if (!game) return;
    refs["board-title"].textContent = game.title;
    refs["game-label"].textContent = game.source === "api" ? "Live trivia board" : (game.source === "custom" ? "Custom board" : "Ready-to-play board");
    refs["api-credit"].hidden = game.source !== "api";
    renderScores();
    renderBoard();
    updateBoardStatus();
  }

  function renderScores() {
    refs["scoreboard"].replaceChildren();
    game.teams.forEach(function (team, index) {
      const card = element("div", "score-card" + (index === game.activeTeam ? " is-active" : ""));
      card.style.setProperty("--team-color", team.color);
      const swatch = element("span", "score-swatch");
      const copy = element("span", "score-copy");
      copy.append(element("span", "score-name", team.name));
      const value = element("strong", "score-value" + (team.score < 0 ? " is-negative" : ""), Core.formatMoney(team.score));
      copy.append(value);
      card.append(swatch, copy);
      refs["scoreboard"].appendChild(card);
    });
    refs["control-team-name"].textContent = game.teams[game.activeTeam].name;
  }

  function renderBoard() {
    const columns = Core.buildColumns(game.questions);
    const maxRows = Math.max.apply(null, columns.map(function (column) { return column.questions.length; }));
    let assignedTabStop = false;
    refs["game-board"].style.setProperty("--category-count", columns.length);
    refs["game-board"].replaceChildren();

    columns.forEach(function (column, columnIndex) {
      const columnNode = element("div", "board-column");
      columnNode.setAttribute("role", "group");
      columnNode.setAttribute("aria-label", column.name);
      const header = element("div", "category-header", column.name);
      header.setAttribute("role", "heading");
      header.setAttribute("aria-level", "2");
      columnNode.appendChild(header);

      for (let rowIndex = 0; rowIndex < maxRows; rowIndex += 1) {
        const question = column.questions[rowIndex];
        if (!question) {
          const empty = element("div", "board-empty");
          empty.setAttribute("aria-hidden", "true");
          columnNode.appendChild(empty);
          continue;
        }
        const tile = element("button", "clue-tile" + (question.used ? " is-used" : ""), question.used ? "" : "$" + question.value.toLocaleString("en-US"));
        tile.type = "button";
        tile.disabled = Boolean(question.used);
        tile.dataset.questionId = question.id;
        tile.dataset.col = String(columnIndex);
        tile.dataset.row = String(rowIndex);
        tile.tabIndex = !question.used && !assignedTabStop ? 0 : -1;
        if (!question.used && !assignedTabStop) assignedTabStop = true;
        tile.setAttribute("aria-label", question.used ? column.name + " for $" + question.value + ", already played" : column.name + " for $" + question.value);
        tile.addEventListener("click", function () { openClue(question.id, tile); });
        tile.addEventListener("keydown", handleBoardNavigation);
        columnNode.appendChild(tile);
      }
      refs["game-board"].appendChild(columnNode);
    });
  }

  function handleBoardNavigation(event) {
    if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) return;
    event.preventDefault();
    const tile = event.currentTarget;
    const currentCol = Number(tile.dataset.col);
    const currentRow = Number(tile.dataset.row);
    const candidates = Array.from(refs["game-board"].querySelectorAll(".clue-tile:not(:disabled)"));
    let target = null;
    if (event.key === "ArrowUp" || event.key === "ArrowDown") {
      const direction = event.key === "ArrowUp" ? -1 : 1;
      target = candidates
        .filter(function (item) {
          const row = Number(item.dataset.row);
          return Number(item.dataset.col) === currentCol && (row - currentRow) * direction > 0;
        })
        .sort(function (a, b) { return Math.abs(Number(a.dataset.row) - currentRow) - Math.abs(Number(b.dataset.row) - currentRow); })[0];
    } else {
      const direction = event.key === "ArrowLeft" ? -1 : 1;
      const possibleColumns = Array.from(new Set(candidates.map(function (item) { return Number(item.dataset.col); })))
        .filter(function (col) { return (col - currentCol) * direction > 0; })
        .sort(function (a, b) { return Math.abs(a - currentCol) - Math.abs(b - currentCol); });
      if (possibleColumns.length) {
        target = candidates
          .filter(function (item) { return Number(item.dataset.col) === possibleColumns[0]; })
          .sort(function (a, b) { return Math.abs(Number(a.dataset.row) - currentRow) - Math.abs(Number(b.dataset.row) - currentRow); })[0];
      }
    }
    if (target) {
      candidates.forEach(function (item) { item.tabIndex = -1; });
      target.tabIndex = 0;
      target.focus();
    }
  }

  function focusFirstAvailableTile() {
    const target = refs["game-board"].querySelector(".clue-tile:not(:disabled)");
    if (target) {
      refs["game-board"].querySelectorAll(".clue-tile").forEach(function (tile) { tile.tabIndex = -1; });
      target.tabIndex = 0;
      target.focus();
    } else {
      refs["end-board-button"].focus();
    }
  }

  function updateBoardStatus() {
    const used = game.questions.filter(function (question) { return question.used; }).length;
    const remaining = game.questions.length - used;
    refs["clues-remaining"].textContent = remaining + " clue" + (remaining === 1 ? "" : "s") + " left";
    refs["game-progress"].style.width = (game.questions.length ? used / game.questions.length * 100 : 100) + "%";
    refs["undo-button"].disabled = !game.history.length;
    refs["end-board-button"].textContent = remaining === 0 && game.final ? "Final Challenge" : "End board";
  }

  function openClue(questionId, tile) {
    const question = game.questions.find(function (item) { return item.id === questionId; });
    if (!question || question.used) return;
    lastFocusedTile = tile;
    game.current = {
      questionId: questionId,
      responder: game.activeTeam,
      value: question.value,
      revealed: false,
      specialLocked: false,
      attempted: [],
      changes: []
    };
    refs["clue-category"].textContent = question.category;
    refs["clue-value"].textContent = "$" + question.value.toLocaleString("en-US");
    refs["clue-text"].textContent = question.question;
    refs["answer-text"].textContent = question.answer;
    refs["answer-panel"].hidden = true;
    refs["no-score-button"].textContent = "No answer";
    refs["reveal-button"].hidden = false;
    refs["wrong-button"].hidden = false;
    refs["correct-button"].hidden = false;
    renderChoices(question);
    renderResponders(question.isSpecial);
    closeMusicPopover(false);
    duckBackgroundMusic(true);
    setAppInert(true);
    refs["clue-modal"].hidden = false;
    document.body.style.overflow = "hidden";

    if (question.isSpecial) {
      const maxWager = getMaxSpecialWager();
      game.current.maxWager = maxWager;
      refs["special-intro"].hidden = false;
      refs["clue-content"].hidden = true;
      refs["clue-footer"].hidden = true;
      refs["wager-input"].max = String(maxWager);
      refs["wager-input"].value = String(Math.min(question.value, maxWager));
      refs["wager-help"].textContent = "Maximum wager: " + Core.formatMoney(maxWager);
      refs["clue-modal"].querySelector('[role="dialog"]').setAttribute("aria-describedby", "wager-help");
      stopTimer();
      playSound("special");
      setTimeout(function () { refs["wager-input"].focus(); }, 50);
    } else {
      refs["special-intro"].hidden = true;
      refs["clue-content"].hidden = false;
      refs["clue-footer"].hidden = false;
      refs["clue-modal"].querySelector('[role="dialog"]').setAttribute("aria-describedby", "clue-text");
      startTimer(game.settings.timer);
      playSound("open");
      setTimeout(function () { refs["reveal-button"].focus(); }, 50);
    }
  }

  function renderChoices(question) {
    refs["choice-list"].replaceChildren();
    if (game.source === "api" || !Array.isArray(question.choices) || question.choices.length < 2) {
      refs["choice-list"].hidden = true;
      return;
    }
    Core.shuffle(question.choices).forEach(function (choice) {
      refs["choice-list"].appendChild(element("span", "", choice));
    });
    refs["choice-list"].hidden = false;
  }

  function renderResponders(specialOnly, focusIndex) {
    refs["responder-list"].replaceChildren();
    game.teams.forEach(function (team, index) {
      const attempted = game.current.attempted.includes(index);
      const button = element("button", "responder-button" + (index === game.current.responder && !attempted ? " is-selected" : "") + (attempted ? " is-locked" : ""), team.name);
      button.type = "button";
      button.style.setProperty("--team-color", team.color);
      button.setAttribute("aria-pressed", String(index === game.current.responder && !attempted));
      button.disabled = attempted || Boolean(specialOnly && index !== game.activeTeam);
      button.addEventListener("click", function () {
        game.current.responder = index;
        renderResponders(specialOnly, index);
        playSound("select");
      });
      refs["responder-list"].appendChild(button);
    });
    if (Number.isInteger(focusIndex)) {
      const restored = refs["responder-list"].querySelectorAll(".responder-button")[focusIndex];
      if (restored) restored.focus();
    }
  }

  function getMaxSpecialWager() {
    const highestValue = Math.max.apply(null, game.questions.map(function (question) { return question.value; }));
    return Math.max(highestValue, game.teams[game.activeTeam].score, 0);
  }

  function confirmSpecialWager() {
    if (!game || !game.current) return;
    const value = Math.round(Number(refs["wager-input"].value));
    if (!Number.isFinite(value) || value < 0 || value > game.current.maxWager) {
      toast("Enter a wager from $0 to " + Core.formatMoney(game.current.maxWager) + ".", true);
      refs["wager-input"].focus();
      return;
    }
    game.current.value = value;
    game.current.specialLocked = true;
    refs["clue-value"].textContent = "Wager " + Core.formatMoney(value);
    refs["special-intro"].hidden = true;
    refs["clue-content"].hidden = false;
    refs["clue-footer"].hidden = false;
    refs["clue-modal"].querySelector('[role="dialog"]').setAttribute("aria-describedby", "clue-text");
    startTimer(game.settings.timer);
    playSound("start");
    refs["reveal-button"].focus();
  }

  function revealAnswer() {
    if (!game || !game.current) return;
    game.current.revealed = true;
    refs["answer-panel"].hidden = false;
    refs["reveal-button"].hidden = true;
    refs["wrong-button"].hidden = false;
    refs["correct-button"].hidden = false;
    stopTimer();
    playSound("reveal");
    refs["answer-panel"].focus();
  }

  function handleIncorrectResponse() {
    if (!game || !game.current) return;
    const question = game.questions.find(function (item) { return item.id === game.current.questionId; });
    if (!question) return;

    if (question.isSpecial || game.current.revealed) {
      completeClue("incorrect");
      return;
    }

    const responder = game.current.responder;
    if (game.current.attempted.includes(responder)) return;
    const delta = game.settings.penalty ? -game.current.value : 0;
    if (delta) {
      game.teams[responder].score += delta;
      game.current.changes.push({ teamIndex: responder, delta: delta });
    }
    game.current.attempted.push(responder);
    const nextResponder = game.teams.findIndex(function (_, index) { return !game.current.attempted.includes(index); });
    playSound("wrong");

    if (nextResponder < 0) {
      revealAnswer();
      refs["wrong-button"].hidden = true;
      refs["correct-button"].hidden = true;
      refs["no-score-button"].textContent = "Finish clue";
      toast("Every team has tried. The correct response is now shown.");
      return;
    }

    game.current.responder = nextResponder;
    renderResponders(false, nextResponder);
    toast(game.teams[responder].name + " missed" + (game.settings.penalty ? " and loses " + Core.formatMoney(game.current.value) : "") + ". " + game.teams[nextResponder].name + " may answer.");
  }

  function completeClue(result) {
    if (!game || !game.current) return;
    const question = game.questions.find(function (item) { return item.id === game.current.questionId; });
    if (!question) return;
    const responder = game.current.responder;
    const effectiveValue = game.current.value;
    const previousActive = game.activeTeam;
    let delta = 0;
    if (result === "correct") delta = effectiveValue;
    if (result === "incorrect" && game.settings.penalty) delta = -effectiveValue;

    const changes = game.current.changes.slice();
    if (delta) {
      game.teams[responder].score += delta;
      changes.push({ teamIndex: responder, delta: delta });
    }
    if (result === "correct") game.activeTeam = responder;
    question.used = true;
    game.history.push({
      type: "clue",
      questionId: question.id,
      teamIndex: responder,
      delta: delta,
      changes: changes,
      previousActive: previousActive,
      result: result
    });
    game.current = null;
    closeClue(true, false);
    saveGame();
    renderGame();
    focusFirstAvailableTile();

    if (result === "correct") {
      playSound("correct");
      burstConfetti(24);
      toast(game.teams[responder].name + " gains " + Core.formatMoney(effectiveValue) + "!");
    } else if (result === "incorrect") {
      playSound("wrong");
      toast(game.settings.penalty
        ? game.teams[responder].name + " loses " + Core.formatMoney(effectiveValue) + "."
        : "Incorrect — no points deducted.");
    } else {
      playSound("select");
      toast(changes.length ? "Clue closed. Missed-answer penalties were kept." : "Clue closed with no score change.");
    }

    const remaining = game.questions.filter(function (item) { return !item.used; }).length;
    if (!remaining) toast(game.final ? "Board complete — Final Challenge is ready!" : "Board complete!");
  }

  function closeClue(force, restoreFocus) {
    if (refs["clue-modal"].hidden) return;
    if (!force && game && game.current && game.current.specialLocked) {
      const leave = window.confirm("Close this clue? The wager will be cleared and the tile will remain available.");
      if (!leave) return;
    }
    stopTimer();
    if (game && game.current && Array.isArray(game.current.changes)) {
      game.current.changes.forEach(function (change) {
        if (game.teams[change.teamIndex]) game.teams[change.teamIndex].score -= change.delta;
      });
    }
    refs["clue-modal"].hidden = true;
    document.body.style.overflow = "";
    duckBackgroundMusic(false);
    setAppInert(false);
    if (game) game.current = null;
    if (restoreFocus !== false && lastFocusedTile && !lastFocusedTile.disabled) {
      refs["game-board"].querySelectorAll(".clue-tile").forEach(function (tile) { tile.tabIndex = -1; });
      lastFocusedTile.tabIndex = 0;
      lastFocusedTile.focus();
    }
  }

  function startTimer(seconds) {
    stopTimer();
    if (!seconds) {
      refs["timer-chip"].hidden = true;
      return;
    }
    refs["timer-chip"].hidden = false;
    refs["timer-chip"].classList.remove("is-low");
    clueDeadline = Date.now() + seconds * 1000;
    updateTimer(seconds);
    clueTimer = setInterval(function () {
      const remaining = Math.max(0, Math.ceil((clueDeadline - Date.now()) / 1000));
      updateTimer(remaining, seconds);
      if (remaining <= 0) {
        stopTimer(false);
        refs["timer-chip"].hidden = false;
        refs["timer-value"].textContent = "0";
        refs["timer-chip"].classList.add("is-low");
        playSound("timeout");
        toast("Time is up.", true);
      }
    }, 250);
  }

  function updateTimer(remaining, total) {
    const duration = total || remaining;
    if (refs["timer-value"].textContent !== String(remaining)) refs["timer-value"].textContent = String(remaining);
    refs["timer-chip"].classList.toggle("is-low", remaining <= 5);
    refs["timer-ring"].style.strokeDashoffset = String(97.4 * (1 - remaining / Math.max(1, duration)));
  }

  function stopTimer(hide) {
    if (clueTimer) clearInterval(clueTimer);
    clueTimer = null;
    if (hide !== false) refs["timer-chip"].hidden = true;
  }

  function undoLastAction() {
    if (!game || !game.history.length) return;
    const action = game.history.pop();
    if (action.type === "clue") {
      const question = game.questions.find(function (item) { return item.id === action.questionId; });
      if (question) question.used = false;
      if (Array.isArray(action.changes)) {
        action.changes.forEach(function (change) {
          if (game.teams[change.teamIndex]) game.teams[change.teamIndex].score -= change.delta;
        });
      } else if (game.teams[action.teamIndex]) {
        game.teams[action.teamIndex].score -= action.delta;
      }
      game.activeTeam = action.previousActive;
      toast("Last clue result undone.");
    } else if (action.type === "score") {
      if (game.teams[action.teamIndex]) game.teams[action.teamIndex].score -= action.delta;
      toast("Score adjustment undone.");
    }
    saveGame();
    renderGame();
    playSound("select");
  }

  function openScoreModal() {
    renderScoreEditor();
    setAppInert(true);
    refs["score-modal"].hidden = false;
    document.body.style.overflow = "hidden";
    setTimeout(function () { refs["close-score-button"].focus(); }, 30);
  }

  function renderScoreEditor() {
    refs["score-editor"].replaceChildren();
    game.teams.forEach(function (team, index) {
      const row = element("div", "score-edit-row");
      const name = element("span", "score-edit-name", team.name);
      name.style.setProperty("--team-color", team.color);
      const score = element("strong", "", Core.formatMoney(team.score));
      const actions = element("div", "score-edit-actions");
      const minus = element("button", "", "−");
      minus.type = "button";
      minus.setAttribute("aria-label", "Subtract $100 from " + team.name);
      minus.addEventListener("click", function () { adjustScore(index, -100); });
      const plus = element("button", "", "+");
      plus.type = "button";
      plus.setAttribute("aria-label", "Add $100 to " + team.name);
      plus.addEventListener("click", function () { adjustScore(index, 100); });
      actions.append(minus, plus);
      row.append(name, score, actions);
      refs["score-editor"].appendChild(row);
    });
  }

  function adjustScore(teamIndex, delta) {
    game.teams[teamIndex].score += delta;
    game.history.push({ type: "score", teamIndex: teamIndex, delta: delta });
    saveGame();
    renderScoreEditor();
    renderScores();
    updateBoardStatus();
    const row = refs["score-editor"].querySelectorAll(".score-edit-row")[teamIndex];
    if (row) {
      const controls = row.querySelectorAll("button");
      const target = delta < 0 ? controls[0] : controls[controls.length - 1];
      if (target) target.focus();
    }
    playSound("select");
  }

  function closeScoreModal() {
    refs["score-modal"].hidden = true;
    document.body.style.overflow = "";
    if (refs["clue-modal"].hidden) setAppInert(false);
    if (!refs["score-button"].closest("[hidden]")) refs["score-button"].focus();
  }

  function requestFinalChallenge() {
    const remaining = game.questions.filter(function (question) { return !question.used; }).length;
    if (remaining && !window.confirm("There are " + remaining + " clues left. End the board anyway?")) return;
    if (!game.final) {
      showResults();
      return;
    }
    enterFinal();
  }

  function enterFinal() {
    game.phase = "final";
    if (!game.finalState) {
      game.finalState = {
        stage: "wager",
        wagers: game.teams.map(function () { return 0; }),
        marks: game.teams.map(function () { return null; })
      };
    }
    saveGame();
    renderFinal();
    showScreen("final-screen");
    playSound("special");
  }

  function renderFinal() {
    const content = refs["final-content"];
    content.replaceChildren();
    const state = game.finalState;
    if (state.stage === "wager") renderFinalWagers(content);
    else if (state.stage === "clue") renderFinalClue(content);
    else renderFinalScoring(content);
  }

  function finalCategoryBlock() {
    const block = element("div", "final-category");
    block.append(element("span", "", "Category"), element("h2", "", game.final.category));
    return block;
  }

  function renderFinalWagers(content) {
    content.appendChild(finalCategoryBlock());
    content.appendChild(element("p", "final-description", "Each team locks in a private wager before the clue is revealed."));
    const grid = element("div", "wager-grid");
    game.teams.forEach(function (team, index) {
      const max = Math.max(0, team.score);
      const card = element("div", "wager-card");
      card.style.setProperty("--team-color", team.color);
      const label = element("label", "", team.name);
      label.setAttribute("for", "final-wager-" + index);
      const money = element("div", "money-input");
      money.appendChild(element("span", "", "$"));
      const input = element("input");
      input.id = "final-wager-" + index;
      input.type = "password";
      input.inputMode = "numeric";
      input.pattern = "[0-9]*";
      input.value = String(game.finalState.wagers[index] || 0);
      input.dataset.teamIndex = String(index);
      input.setAttribute("aria-label", team.name + " wager, maximum $" + max);
      money.appendChild(input);
      card.append(label, money, element("small", "", "Available: " + Core.formatMoney(max)));
      grid.appendChild(card);
    });
    content.appendChild(grid);
    const actions = element("div", "final-actions");
    const back = button("Back to board", "button button-secondary", function () {
      game.phase = "board"; saveGame(); renderGame(); showScreen("game-screen");
    });
    const reveal = button("Lock wagers & reveal clue →", "button button-gold", lockFinalWagers);
    actions.append(back, reveal);
    content.appendChild(actions);
  }

  function lockFinalWagers() {
    const inputs = refs["final-content"].querySelectorAll("input[data-team-index]");
    const wagers = [];
    let valid = true;
    inputs.forEach(function (input) {
      const index = Number(input.dataset.teamIndex);
      const value = Math.round(Number(input.value));
      const max = Math.max(0, game.teams[index].score);
      if (!Number.isFinite(value) || value < 0 || value > max) {
        valid = false;
        input.setAttribute("aria-invalid", "true");
      } else {
        input.removeAttribute("aria-invalid");
        wagers[index] = value;
      }
    });
    if (!valid) {
      toast("Each wager must be between $0 and that team’s available score.", true);
      return;
    }
    game.finalState.wagers = wagers;
    game.finalState.stage = "clue";
    saveGame();
    renderFinal();
    playSound("start");
  }

  function renderFinalClue(content) {
    content.appendChild(finalCategoryBlock());
    content.appendChild(element("p", "final-clue", game.final.question));
    const actions = element("div", "final-actions");
    const answerButton = button("Reveal final response", "button button-gold", function () {
      game.finalState.stage = "score";
      saveGame();
      renderFinal();
      playSound("reveal");
    });
    actions.appendChild(answerButton);
    content.appendChild(actions);
  }

  function renderFinalScoring(content) {
    content.appendChild(finalCategoryBlock());
    content.appendChild(element("p", "final-answer", game.final.answer));
    content.appendChild(element("p", "final-description", "Mark each team’s response, then reveal the winner."));
    const grid = element("div", "final-score-grid");
    game.teams.forEach(function (team, index) {
      const row = element("div", "final-score-row");
      row.style.setProperty("--team-color", team.color);
      row.appendChild(element("span"));
      row.appendChild(element("strong", "", team.name));
      row.appendChild(element("em", "", "Wager " + Core.formatMoney(game.finalState.wagers[index])));
      const wrong = button("Incorrect", "button button-wrong" + (game.finalState.marks[index] === false ? " is-marked" : ""), function () { setFinalMark(index, false); });
      wrong.setAttribute("aria-pressed", String(game.finalState.marks[index] === false));
      const correct = button("Correct", "button button-correct" + (game.finalState.marks[index] === true ? " is-marked" : ""), function () { setFinalMark(index, true); });
      correct.setAttribute("aria-pressed", String(game.finalState.marks[index] === true));
      row.append(wrong, correct);
      grid.appendChild(row);
    });
    content.appendChild(grid);
    const finish = button("Reveal the winner →", "button button-gold", finishFinal);
    finish.disabled = game.finalState.marks.some(function (mark) { return mark === null; });
    const actions = element("div", "final-actions");
    actions.appendChild(finish);
    content.appendChild(actions);
  }

  function setFinalMark(teamIndex, correct) {
    game.finalState.marks[teamIndex] = correct;
    saveGame();
    renderFinal();
    const row = refs["final-content"].querySelectorAll(".final-score-row")[teamIndex];
    const target = row && row.querySelector(correct ? ".button-correct" : ".button-wrong");
    if (target) target.focus();
    playSound(correct ? "correct" : "wrong");
  }

  function finishFinal() {
    if (game.finalState.marks.some(function (mark) { return mark === null; })) return;
    game.teams.forEach(function (team, index) {
      const wager = game.finalState.wagers[index];
      team.score += game.finalState.marks[index] ? wager : -wager;
    });
    showResults();
  }

  function showResults() {
    game.phase = "results";
    saveGame();
    renderResults();
    showScreen("results-screen");
    playSound("winner");
    burstConfetti(90);
  }

  function renderResults() {
    const rankings = game.teams.map(function (team, index) {
      return { name: team.name, color: team.color, score: team.score, originalIndex: index };
    }).sort(function (a, b) { return b.score - a.score; });
    const topScore = rankings[0].score;
    const winners = rankings.filter(function (team) { return team.score === topScore; });
    refs["winner-name"].textContent = winners.length > 1 ? winners.map(function (team) { return team.name; }).join(" & ") : winners[0].name;
    refs["winner-score"].textContent = (winners.length > 1 ? "Tie score: " : "Final score: ") + Core.formatMoney(topScore);
    refs["final-rankings"].replaceChildren();
    rankings.forEach(function (team, index) {
      const row = element("div", "ranking-row");
      row.appendChild(element("span", "ranking-position", String(index + 1).padStart(2, "0")));
      const name = element("span", "ranking-name", team.name);
      name.style.setProperty("--team-color", team.color);
      row.append(name, element("strong", "ranking-score", Core.formatMoney(team.score)));
      refs["final-rankings"].appendChild(row);
    });
  }

  function button(text, className, handler) {
    const node = element("button", className, text);
    node.type = "button";
    node.addEventListener("click", handler);
    return node;
  }

  function rematch() {
    game.questions.forEach(function (question) { question.used = false; });
    game.teams.forEach(function (team) { team.score = 0; });
    game.activeTeam = 0;
    game.history = [];
    game.current = null;
    game.finalState = null;
    game.phase = "board";
    saveGame();
    renderGame();
    showScreen("game-screen");
    playSound("start");
  }

  function newGame() {
    game = null;
    clearSavedGame();
    refreshResumeBanner();
    showScreen("setup-screen");
  }

  function returnToSetup() {
    if (game && !window.confirm("Return to setup? Your current game will stay saved so you can resume it.")) return;
    closeClue(true);
    closeScoreModal();
    refreshResumeBanner();
    showScreen("setup-screen");
  }

  function showScreen(id) {
    document.querySelectorAll("main > .screen").forEach(function (screen) {
      const active = screen.id === id;
      screen.hidden = !active;
      screen.classList.toggle("is-active", active);
    });
    window.scrollTo({ top: 0, behavior: "instant" });
    const screen = $(id);
    const heading = screen && screen.querySelector("h1, h2");
    if (heading) {
      heading.tabIndex = -1;
      setTimeout(function () { heading.focus(); }, 0);
    }
  }

  function saveGame() {
    if (!game) return;
    try {
      const safeGame = clone(game);
      safeGame.current = null;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(safeGame));
    } catch (error) {
      console.warn("Could not save this game.", error);
    }
  }

  function clearSavedGame() {
    try { localStorage.removeItem(STORAGE_KEY); } catch (_) { /* no-op */ }
  }

  function getSavedGame() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
      if (!saved || saved.version !== 1 || !Array.isArray(saved.questions) || !Array.isArray(saved.teams)) return null;
      return saved;
    } catch (_) { return null; }
  }

  function refreshResumeBanner() {
    const saved = getSavedGame();
    refs["resume-banner"].hidden = !saved;
    if (!saved) return;
    const played = saved.questions.filter(function (question) { return question.used; }).length;
    refs["resume-summary"].textContent = saved.title + " · " + played + " of " + saved.questions.length + " clues played";
  }

  function resumeSavedGame() {
    const saved = getSavedGame();
    if (!saved) {
      refreshResumeBanner();
      toast("That saved game is no longer available.", true);
      return;
    }
    game = saved;
    if (game.phase === "final") {
      renderFinal(); showScreen("final-screen");
    } else if (game.phase === "results") {
      renderResults(); showScreen("results-screen");
    } else {
      game.phase = "board"; renderGame(); showScreen("game-screen");
    }
    playSound("start");
  }

  function discardSavedGame() {
    if (!window.confirm("Discard the saved game? This cannot be undone.")) return;
    clearSavedGame();
    game = null;
    refreshResumeBanner();
  }

  function toast(message, isError) {
    const node = element("div", "toast" + (isError ? " is-error" : ""), message);
    refs["toast-region"].appendChild(node);
    setTimeout(function () {
      node.style.opacity = "0";
      node.style.transform = "translateY(8px)";
      setTimeout(function () { node.remove(); }, 250);
    }, 3600);
  }

  function burstConfetti(count) {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const colors = ["#f4bd4f", "#69a6ff", "#58d3a0", "#e57a88", "#ffffff"];
    for (let i = 0; i < count; i += 1) {
      const piece = element("span", "confetti");
      piece.style.left = (15 + Math.random() * 70) + "%";
      piece.style.setProperty("--confetti-color", colors[i % colors.length]);
      piece.style.setProperty("--drift", (Math.random() * 240 - 120) + "px");
      piece.style.setProperty("--fall-time", (1.6 + Math.random() * 1.8) + "s");
      piece.style.animationDelay = (Math.random() * .35) + "s";
      piece.style.transform = "rotate(" + (Math.random() * 180) + "deg)";
      refs["confetti-layer"].appendChild(piece);
      setTimeout(function () { piece.remove(); }, 3900);
    }
  }

  function updateConnectionState() {
    if (navigator.onLine) setConnection("Ready to play", false);
    else setConnection("Offline mode", true);
  }

  function setConnection(label, offline) {
    refs["connection-label"].textContent = label;
    refs["connection-pill"].classList.toggle("is-offline", Boolean(offline));
  }

  function applyTheme(theme) {
    siteTheme = theme === "dark" ? "dark" : "light";
    document.documentElement.dataset.theme = siteTheme;
    const dark = siteTheme === "dark";
    refs["theme-button"].setAttribute("aria-label", dark ? "Switch to light mode" : "Switch to dark mode");
    refs["theme-button"].setAttribute("aria-pressed", String(dark));
    refs["theme-button"].title = dark ? "Switch to light mode" : "Switch to dark mode";
  }

  function toggleMusicPopover() {
    if (refs["music-popover"].hidden) {
      refs["music-popover"].hidden = false;
      refs["music-button"].setAttribute("aria-expanded", "true");
      renderMusicUi();
      setTimeout(function () { refs["music-close-button"].focus(); }, 0);
    } else {
      closeMusicPopover();
    }
  }

  function closeMusicPopover(returnFocus) {
    refs["music-popover"].hidden = true;
    refs["music-button"].setAttribute("aria-expanded", "false");
    if (returnFocus !== false) refs["music-button"].focus();
  }

  function openMusicPicker() {
    refs["music-file-input"].value = "";
    refs["music-file-input"].click();
  }

  function useMusicFiles(files) {
    const accepted = files.filter(function (file) {
      return file.type === "audio/mpeg" || file.name.toLowerCase().endsWith(".mp3");
    });
    if (!accepted.length) {
      toast("Choose one or more MP3 audio files.", true);
      return;
    }
    if (accepted.length !== files.length) toast((files.length - accepted.length) + " non-MP3 file" + (files.length - accepted.length === 1 ? " was" : "s were") + " skipped.", true);

    stopAndRevokeMusic();
    musicTracks = accepted.map(function (file) {
      return {
        name: file.name.replace(/\.mp3$/i, ""),
        fileName: file.name,
        url: URL.createObjectURL(file)
      };
    });
    musicTrackIndex = 0;
    loadMusicTrack(true);
    renderMusicUi();
    toast(musicTracks.length + " background track" + (musicTracks.length === 1 ? "" : "s") + " added.");
  }

  function stopAndRevokeMusic() {
    const audio = refs["background-audio"];
    audio.pause();
    audio.removeAttribute("src");
    audio.load();
    revokeMusicUrls();
  }

  function revokeMusicUrls() {
    musicTracks.forEach(function (track) {
      if (track.url && track.url.startsWith("blob:")) URL.revokeObjectURL(track.url);
    });
  }

  function clearMusicPlaylist() {
    stopAndRevokeMusic();
    musicTracks = [];
    musicTrackIndex = 0;
    renderMusicUi();
    toast("Background playlist cleared.");
  }

  function loadMusicTrack(shouldPlay) {
    const track = musicTracks[musicTrackIndex];
    if (!track) return;
    const audio = refs["background-audio"];
    audio.src = track.url;
    audio.load();
    updateBackgroundVolume();
    renderMusicUi();
    if (shouldPlay) playBackgroundMusic();
  }

  async function playBackgroundMusic() {
    if (!musicTracks.length) {
      openMusicPicker();
      return;
    }
    try {
      await refs["background-audio"].play();
    } catch (_) {
      renderMusicUi();
      toast("Your browser paused the soundtrack. Press Play to start it.", true);
    }
  }

  function toggleMusicPlayback() {
    if (!musicTracks.length) {
      openMusicPicker();
      return;
    }
    if (refs["background-audio"].paused) playBackgroundMusic();
    else refs["background-audio"].pause();
  }

  function previousMusicTrack() {
    if (!musicTracks.length) return;
    if (refs["background-audio"].currentTime > 3) {
      refs["background-audio"].currentTime = 0;
      playBackgroundMusic();
      return;
    }
    musicTrackIndex = (musicTrackIndex - 1 + musicTracks.length) % musicTracks.length;
    loadMusicTrack(true);
  }

  function nextMusicTrack() {
    if (!musicTracks.length) return;
    musicTrackIndex = (musicTrackIndex + 1) % musicTracks.length;
    loadMusicTrack(true);
  }

  function handleMusicEnded() {
    if (!musicTracks.length) return;
    if (musicTrackIndex < musicTracks.length - 1) {
      musicTrackIndex += 1;
      loadMusicTrack(true);
    } else if (musicLoop) {
      musicTrackIndex = 0;
      loadMusicTrack(true);
    } else {
      refs["background-audio"].currentTime = 0;
      renderMusicUi();
    }
  }

  function handleMusicError() {
    if (!musicTracks.length || !refs["background-audio"].getAttribute("src")) return;
    renderMusicUi();
    toast('Couldn’t play "' + musicTracks[musicTrackIndex].fileName + '". Try another MP3 file.', true);
  }

  function renderMusicUi() {
    const hasMusic = musicTracks.length > 0;
    const playing = hasMusic && !refs["background-audio"].paused && !refs["background-audio"].ended;
    refs["music-empty"].hidden = hasMusic;
    refs["music-player"].hidden = !hasMusic;
    refs["music-button"].classList.toggle("has-music", hasMusic);
    refs["music-button"].classList.toggle("is-playing", playing);
    refs["music-button"].setAttribute("aria-label", hasMusic
      ? "Open background music controls. " + (playing ? "Music is playing." : "Music is paused.")
      : "Open background music controls");
    if (!hasMusic) return;
    refs["music-track-name"].textContent = musicTracks[musicTrackIndex].name;
    refs["music-track-count"].textContent = "Track " + (musicTrackIndex + 1) + " of " + musicTracks.length;
    refs["music-play-button"].textContent = playing ? "❚❚" : "▶";
    refs["music-play-button"].setAttribute("aria-label", playing ? "Pause background music" : "Play background music");
    refs["music-play-button"].setAttribute("aria-pressed", String(playing));
    refs["music-previous-button"].disabled = musicTracks.length < 2;
    refs["music-next-button"].disabled = musicTracks.length < 2;
  }

  function duckBackgroundMusic(ducked) {
    musicDucked = Boolean(ducked);
    updateBackgroundVolume();
  }

  function updateBackgroundVolume() {
    if (!refs["background-audio"]) return;
    refs["background-audio"].volume = Math.max(0, Math.min(1, musicVolume * (musicDucked ? 0.38 : 1)));
  }

  function updateSoundButton() {
    refs["sound-button"].classList.toggle("is-muted", !soundEnabled);
    refs["sound-button"].setAttribute("aria-label", soundEnabled ? "Mute all audio" : "Turn on all audio");
    refs["sound-button"].title = soundEnabled ? "Mute all audio" : "Turn on all audio";
    if (refs["background-audio"]) refs["background-audio"].muted = !soundEnabled;
  }

  function playSound(kind) {
    if (!soundEnabled) return;
    try {
      audioContext = audioContext || new (window.AudioContext || window.webkitAudioContext)();
      const now = audioContext.currentTime;
      const notes = {
        select: [[330, .05]], open: [[240, .05], [390, .08]], reveal: [[440, .06], [550, .1]],
        correct: [[392, .07], [523, .08], [659, .13]], wrong: [[220, .1], [155, .18]],
        timeout: [[180, .16], [130, .24]], special: [[330, .1], [495, .12], [742, .22]],
        start: [[262, .06], [392, .08], [523, .13]], winner: [[392, .1], [523, .1], [659, .12], [784, .25]]
      }[kind] || [[330, .06]];
      let offset = 0;
      notes.forEach(function (note) {
        const oscillator = audioContext.createOscillator();
        const gain = audioContext.createGain();
        oscillator.type = kind === "wrong" || kind === "timeout" ? "triangle" : "sine";
        oscillator.frequency.value = note[0];
        gain.gain.setValueAtTime(.0001, now + offset);
        gain.gain.exponentialRampToValueAtTime(.09, now + offset + .01);
        gain.gain.exponentialRampToValueAtTime(.0001, now + offset + note[1]);
        oscillator.connect(gain).connect(audioContext.destination);
        oscillator.start(now + offset);
        oscillator.stop(now + offset + note[1] + .02);
        offset += note[1] * .8;
      });
    } catch (_) { /* Audio is optional. */ }
  }

  async function toggleFullscreen() {
    try {
      if (!document.fullscreenElement) await document.documentElement.requestFullscreen();
      else await document.exitFullscreen();
    } catch (_) { toast("Fullscreen is not available in this browser.", true); }
  }

  function updateFullscreenButton() {
    const active = Boolean(document.fullscreenElement);
    refs["fullscreen-button"].setAttribute("aria-label", active ? "Exit fullscreen" : "Enter fullscreen");
    refs["fullscreen-button"].title = active ? "Exit fullscreen" : "Enter fullscreen";
  }

  document.addEventListener("DOMContentLoaded", init);
})();
