# Little Sim Kitchen · TS4 Recipe Library

A lightweight, manually maintained recipe library and randomiser for The Sims 4 custom food recipes.

## The Palate integration

Use the two tabs at the top: **Recipes** for the existing Little Sim Kitchen collection and randomiser, or **The Palate** for the complete uploaded v2 taste journal (Sim profiles, preferences, favourites, taste tests, and the four-column recipe board).

The **Recipes tab is the master collection.** The Palate automatically reflects Kitchen recipe names, ingredients, meal category and creator information when the page loads or the collection changes. No double entry or copy button is needed. Within The Palate, **Taste details** lets you add prominent ingredients, flavours, textures, cuisines and food-type tags. These extra tags and each Sim's preferences, recipe ratings, favourites and taste history remain separately saved. Recipes added in earlier Palate versions are preserved, and unambiguous name matches are linked to Kitchen recipes without discarding their taste tags or opinions. Removing a Kitchen recipe removes it from active Palate selections but retains prior taste history and ratings for possible restoration. The sync works in one direction for core recipe fields; continue editing recipe names, ingredients and categories in the main Recipes tab.

**Migrating from the original local HTML file:** The previous `The_Palate_TS4_v2.html` opened via `file://` has different browser storage from GitHub Pages. Export **Back up** from the original app, then open **The Palate → Data & help → Restore a backup (.json)** on this hosted site. Restore replaces The Palate data on that site, so migrate before making new taste entries there. It does not replace the Kitchen library.

## Weekly meal plans

Open **The Palate → Meal Plan** to see a responsive weekly timetable: seven columns for Monday through Sunday and rows for Breakfast/Brunch, Lunch, Dinner, Snack, Dessert and Drinks. Small screens can scroll the grid horizontally while the meal labels remain visible.

The planner uses each Sim's **saved recipe ratings**. Loved (5/5), liked (4/5), and neutral (3/5) recipes are all eligible; the randomiser first picks a preference tier with relative weights **5:3:1**, then chooses a recipe within that tier. This means loved recipes are generally favoured over liked, and liked over neutral, even when the number of neutral recipes is large. Untested, disliked and hated foods are excluded. A category containing only one eligible recipe will repeat that dish across the week; an empty category stays blank. The Kitchen meal category determines the default section, falling back to Palate type tags for older recipes.

Each Sim and week has a separately saved schedule, included in Palate JSON backups. **Randomise again** replaces that week's schedule. Drag and drop any dish to move or swap it across days or meal categories; on mobile or with a keyboard, select a meal and then select the destination. Existing saved plans remain in place after updating and only change when explicitly rearranged or regenerated.

## Features

- Add, edit, and delete recipes manually.
- Save a recipe name, meal category, CC creator, Cooking/Baking/Gourmet Cooking/Canning/Cheesemaking skill requirement, minimum level (1–10), ingredients, original recipe URL, and notes.
- Open the Recipes browser below the randomiser, select a CC creator, and view that creator's recipes alphabetically.
- Search and filter by meal category within a creator's recipes; the Add recipe button remains available below the randomiser.
- Randomly choose a recipe, optionally filtering by meal category or creator.
- Randomiser uses a shuffled bag so every eligible recipe is chosen once before it repeats.
- Existing saved recipes and version 1 JSON backups remain compatible. Recipes with no skill information are shown as unspecified until you edit them.
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
