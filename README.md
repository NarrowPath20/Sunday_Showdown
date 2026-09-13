# Sunday Showdown

A dependency-free, host-led classroom trivia game inspired by the familiar category-and-clue format of televised quiz shows. It supports live family-friendly questions, private CSV/JSON imports, a ready-to-play Bible board, multiple teams, scoring, undo, timers, configurable hidden wager clues, Final Challenge, fullscreen play, custom MP3 background music, light/dark setup themes, sounds, and automatic local saving.

## Hosted game

The repository includes a GitHub Actions workflow that publishes the static game to GitHub Pages after every push to `master`. The configured custom-domain address is:

**https://sundayshowdown.com/**

In the repository's **Settings → Pages** screen, set **Source** to **GitHub Actions** the first time the site is deployed.

## Start the game

Node 18 or newer is the only requirement.

```powershell
npm start
```

Then open **http://localhost:4173**. You can choose a different port in PowerShell with:

```powershell
$env:SUNDAY_SHOWDOWN_PORT=8080
npm start
```

The game can also be opened directly from `index.html`, though running the small local server is recommended.

## Question sources

- **Fresh & random:** Select up to six topics or let the game choose from 20 options, including Pop Culture, Video Games, Comics & Heroes, Mythology, Animals & Nature, Tech & Internet, Faith & Religion, Space & Astronomy, Theater & Musicals, and Politics & Leaders. Live clues are presented as open-ended questions; the API's correct response remains hidden until the host reveals it. The board uses [The Trivia API v2](https://the-trivia-api.com/docs/) categories and tags with its family-content filter. If the service or internet connection is unavailable, the included board loads automatically.
- **Bring your own:** Choose or drag in a `.csv` or `.json` file. Files are parsed locally and are never uploaded.
- **Starter board:** A complete 30-clue Bible Basics board plus Final Challenge is included.

The free public Trivia API is intended for noncommercial use and its content is provided under CC BY-NC 4.0. Check the provider’s current terms before commercial deployment. A commercial API key should be kept in a server-side proxy, never in `app.js`.

## CSV format

Use the built-in **Download CSV template** button for a complete editable 6×5 board, or copy [`sample-questions.csv`](sample-questions.csv). Required board fields are `category`, `question`, `answer`, and either `value` or `price`.

```csv
round,category,value,question,answer,special
board,Bible Heroes,200,Who built the ark?,Noah,no
board,Bible Heroes,400,Who defeated Goliath?,David,yes
final,Faith,0,Your final question,Your final answer,no
```

- `round`: `board` or `final` (optional; omit it for normal clues).
- `special`: `yes` marks a hidden wager clue (optional).
- Quoted commas, escaped quotation marks, and multiline CSV values are supported.
- Flexible board sizes work, with up to eight categories and eight clues per category. Six categories with five clues each is recommended.

## JSON format

Use an array of flat question objects, an object with a `questions` array, or nested categories:

```json
{
  "title": "My Sunday Showdown",
  "categories": [
    {
      "name": "Bible Heroes",
      "clues": [
        { "value": 200, "question": "Who built the ark?", "answer": "Noah" }
      ]
    }
  ],
  "final": {
    "category": "Faith",
    "question": "Your final question",
    "answer": "Your final answer"
  }
}
```

## Host controls

- Pick a tile and select the responding team. If the host knows the response, **Incorrect** keeps the clue open for the next team; reveal the expected response after teams have tried. For unfamiliar live questions, the host can reveal first and then judge the response.
- Incorrect answers subtract the clue value when penalties are enabled.
- Choose from zero to five hidden wager clues per game. For imported boards, clues marked `special: yes` are selected first; any remaining special clues are assigned automatically.
- **Scores** makes manual `$100` corrections; **Undo** reverses the latest clue result or correction.
- The active team is the team that most recently answered correctly.
- Game state is saved in the browser after each action. Returning to setup does not erase it.
- When the board is done, run Final Challenge with private wagers and host-judged results.

## Background music and appearance

- Use the **music-note button** in the header to choose one or more `.mp3` files, play or pause the playlist, move between tracks, set volume, and choose whether the playlist loops.
- Selected MP3 files remain private and are played from temporary browser URLs. Browsers cannot restore those file permissions after a reload, so tracks must be selected again on a new visit. Volume and loop preferences are remembered.
- The speaker button is a master mute for both background music and game sound effects. Music automatically lowers while a clue dialog is open.
- The moon/sun button switches the setup website and header between light and dark modes. The game board, clue, Final Challenge, and results presentation colors intentionally remain unchanged.
- To ship permanent built-in music, place the supplied licensed MP3 files in the project and add them to the game’s audio manifest/server allowlist. Do not redistribute music without the appropriate license.

## Verify

```powershell
npm test
npm run check
```

The automated tests cover CSV quoting, import aliases, nested JSON, validation, board grouping, and score formatting.
