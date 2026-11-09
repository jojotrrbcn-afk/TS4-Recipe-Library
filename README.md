# Little Sim Kitchen · TS4 Recipe Library

A lightweight, manually maintained recipe library and randomiser for The Sims 4 custom food recipes.

## Features

- Add, edit, and delete recipes manually.
- Save a recipe name, meal category, CC creator, ingredients, original recipe URL, and notes.
- Search recipes and filter by meal category.
- Randomly choose a recipe, optionally filtering by meal category or creator.
- Randomiser uses a shuffled bag so every eligible recipe is chosen once before it repeats.
- Export your recipes to a JSON backup and import them later (existing entries are kept; same name + creator is treated as a duplicate).
- Works without a backend or Patreon authentication.

## How to publish with GitHub Pages

1. In this repository select **Settings → Pages**.
2. Under **Build and deployment**, choose **Deploy from a branch**.
3. Select the **main** branch and **/(root)** folder, then click **Save**.
4. After deployment, visit **https://jojotrrbcn-afk.github.io/TS4-Recipe-Library/**.

Changes pushed to the main branch are published to the same site after GitHub finishes deploying. GitHub Pages must be enabled once by the repository owner. Do not assume the website is live until GitHub shows a successful deployment.

## Important: how saving works

Recipes are saved in your **current browser's localStorage**. They are not stored in GitHub, and do **not** automatically sync to a different device or browser.

- **Export backup** downloads a JSON copy of your recipes.
- **Import backup** restores recipe entries from that file and skips duplicates by recipe name and creator.
- Export regularly. Clearing site data, private browsing, or browser/device changes can remove recipes from localStorage.
- Changes to the app code do not normally erase localStorage for the same site origin.

There is no Patreon scraping or automatic importing in this first version. Any future importing can be added separately without requiring it for manual entry.

## Files

- `index.html`: page layout and recipe form.
- `styles.css`: responsive styling.
- `app.js`: recipe library, local saving, randomiser, and backup/restore.

All three files are plain HTML, CSS and JavaScript. No build steps, dependencies, secrets, or subscriptions are required.
