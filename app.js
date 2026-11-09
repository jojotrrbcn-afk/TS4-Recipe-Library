'use strict';

(function () {
  const STORAGE_KEY = 'little-sim-kitchen-recipes-v1';
  const CATEGORIES = ['Breakfast', 'Brunch', 'Lunch', 'Dinner', 'Dessert', 'Snack', 'Baking', 'Drinks', 'Other'];
  const SKILLS = ['Cooking', 'Baking', 'Gourmet Cooking'];
  const SKILL_NONE = 'none';
  const PAGE_SIZE = 8;
  const $ = (id) => document.getElementById(id);
  let recipes = [];
  let page = 1;
  let editingId = null;
  let selectionBag = [];
  let bagSignature = '';
  let previousPickId = '';
  let selectedRecipeId = '';
  let toastTimeout;

  function makeId() {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
    return String(Date.now()) + '-' + String(Math.random()).slice(2);
  }

  function normaliseUrl(input) {
    if (!input || typeof input !== 'string') return '';
    try {
      const url = new URL(input.trim());
      return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : '';
    } catch (_) {
      return '';
    }
  }

  function normaliseRecipe(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    const name = String(value.name || '').trim().slice(0, 150);
    if (!name) return null;
    const meal = CATEGORIES.includes(value.meal) ? value.meal : 'Other';
    const skillType = SKILLS.includes(value.skillType) || value.skillType === SKILL_NONE ? value.skillType : '';
    const parsedLevel = Number(value.skillLevel);
    const skillLevel = SKILLS.includes(skillType) && Number.isInteger(parsedLevel) && parsedLevel >= 1 && parsedLevel <= 10 ? parsedLevel : null;
    const ingredients = (Array.isArray(value.ingredients) ? value.ingredients : String(value.ingredients || '').split(/\r?\n/))
      .filter((part) => typeof part === 'string').map((part) => part.trim().slice(0, 150)).filter(Boolean).slice(0, 80);
    return {
      id: typeof value.id === 'string' && value.id.length < 120 && value.id ? value.id : makeId(),
      name,
      meal,
      creator: String(value.creator || '').trim().slice(0, 100),
      skillType,
      skillLevel,
      ingredients,
      url: normaliseUrl(value.url),
      notes: String(value.notes || '').trim().slice(0, 2000),
      createdAt: typeof value.createdAt === 'string' && !Number.isNaN(Date.parse(value.createdAt)) ? value.createdAt : new Date().toISOString()
    };
  }

  function loadRecipes() {
    let raw;
    try { raw = localStorage.getItem(STORAGE_KEY); }
    catch (_) {
      showToast('Browser storage is unavailable. Recipes cannot be saved here.');
      return;
    }
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) throw new Error('Unexpected saved format');
      recipes = parsed.map(normaliseRecipe).filter(Boolean);
    } catch (_) {
      recipes = [];
      alert('Your saved recipe data could not be read. It was not changed or overwritten. Please restore a backup if you have one.');
    }
  }

  function saveRecipes(next) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      recipes = next;
      invalidateBag();
      render();
      return true;
    } catch (_) {
      alert('Your browser could not save this change. Your existing recipes were left untouched. Export a backup, and check that browser storage is enabled and has space.');
      return false;
    }
  }

  function showToast(message) {
    const node = $('toast');
    node.textContent = message;
    node.classList.add('visible');
    clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => node.classList.remove('visible'), 3600);
  }

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function optionsFor(select, values, allText) {
    const previous = select.value;
    select.replaceChildren();
    select.add(new Option(allText, ''));
    values.forEach((value) => select.add(new Option(value, value)));
    if (values.includes(previous)) select.value = previous;
  }

  function renderFilters() {
    const usedMeals = CATEGORIES.filter((category) => recipes.some((recipe) => recipe.meal === category));
    const creators = [...new Set(recipes.map((recipe) => recipe.creator).filter(Boolean))].sort((a,b) => a.localeCompare(b));
    optionsFor($('pickerMeal'), usedMeals, 'Anything goes');
    optionsFor($('libraryMeal'), usedMeals, 'All meals');
    optionsFor($('pickerCreator'), creators, 'All creators');
  }

  function renderStats() {
    $('recipeCount').textContent = String(recipes.length);
    $('creatorCount').textContent = String(new Set(recipes.map((r) => r.creator.toLocaleLowerCase()).filter(Boolean)).size);
    $('mealCount').textContent = String(new Set(recipes.map((r) => r.meal)).size);
  }

  function clearSelectionIfMissing() {
    if (selectedRecipeId && !recipes.some((recipe) => recipe.id === selectedRecipeId)) {
      selectedRecipeId = '';
      showEmptyResult();
    }
  }

  function showEmptyResult(message, detail) {
    const result = $('pickResult');
    result.replaceChildren();
    const block = el('div', 'result-empty');
    block.append(el('div', 'result-illustration', '☷'), el('strong', '', message || 'Your next meal is a mystery.'), el('span', '', detail || 'Add a recipe to get started.'));
    result.append(block);
  }

  function skillRequirement(recipe) {
    if (recipe.skillType === SKILL_NONE) return 'No skill required';
    if (SKILLS.includes(recipe.skillType)) {
      return recipe.skillType + (recipe.skillLevel === null ? ' · level not specified' : ' · Level ' + recipe.skillLevel);
    }
    return '';
  }

  function updateSkillLevelField() {
    const enabled = SKILLS.includes($('recipeSkillType').value);
    $('recipeSkillLevel').disabled = !enabled;
    if (!enabled) $('recipeSkillLevel').value = '';
  }

  function renderResult(recipe) {
    const result = $('pickResult');
    result.replaceChildren();
    const block = el('div', 'result-filled');
    block.append(el('div', 'result-tiny', '✦ Today\'s lucky recipe ✦'));
    block.append(el('h3', 'result-title', recipe.name));
    block.append(el('p', 'result-meta', recipe.creator ? 'By ' + recipe.creator : 'From your recipe collection'));
    const tags = el('div', 'result-tags');
    tags.append(el('span', 'chip', recipe.meal));
    const requirement = skillRequirement(recipe);
    if (requirement) tags.append(el('span', 'chip chip-sand', requirement));
    block.append(tags);
    if (recipe.ingredients.length) {
      block.append(el('p', 'result-ingredients', 'Ingredients: ' + recipe.ingredients.join(', ')));
    }
    if (recipe.notes) block.append(el('p', 'result-ingredients', recipe.notes));
    if (recipe.url) {
      const link = el('a', 'result-link', 'View original recipe ↗');
      link.href = recipe.url;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      block.append(link);
    }
    result.append(block);
  }

  function matchingForPicker() {
    const meal = $('pickerMeal').value;
    const creator = $('pickerCreator').value;
    return recipes.filter((r) => (!meal || r.meal === meal) && (!creator || r.creator === creator));
  }

  function updatePickerState() {
    const matches = matchingForPicker();
    $('pickBtn').disabled = !matches.length;
    if (!matches.length) {
      selectedRecipeId = '';
      showEmptyResult(recipes.length ? 'No recipes match those filters.' : 'Your next meal is a mystery.',
        recipes.length ? 'Try another meal or creator.' : 'Add a recipe to get started.');
    } else if (selectedRecipeId) {
      const selected = matches.find((recipe) => recipe.id === selectedRecipeId);
      if (selected) renderResult(selected);
      else { selectedRecipeId = ''; showEmptyResult('Ready to choose?', 'Hit the button to pick a recipe.'); }
    } else if (recipes.length) {
      showEmptyResult('Ready to choose?', 'Hit the button to pick a recipe.');
    }
  }

  function invalidateBag() {
    selectionBag = [];
    bagSignature = '';
  }

  function shuffle(items) {
    const shuffled = items.slice();
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }

  function pickRecipe() {
    const matches = matchingForPicker();
    if (!matches.length) return;
    const signature = matches.map((r) => r.id).sort().join('|');
    if (signature !== bagSignature) {
      bagSignature = signature;
      selectionBag = [];
      previousPickId = '';
    }
    if (!selectionBag.length) {
      selectionBag = shuffle(matches.map((r) => r.id));
      if (selectionBag.length > 1 && selectionBag[selectionBag.length - 1] === previousPickId) {
        [selectionBag[0], selectionBag[selectionBag.length - 1]] = [selectionBag[selectionBag.length - 1], selectionBag[0]];
      }
    }
    const nextId = selectionBag.pop();
    const chosen = matches.find((r) => r.id === nextId);
    if (!chosen) return;
    previousPickId = nextId;
    selectedRecipeId = nextId;
    renderResult(chosen);
  }

  function matchesSearch(recipe, search) {
    if (!search) return true;
    return [recipe.name, recipe.creator, recipe.meal, recipe.notes, skillRequirement(recipe), ...recipe.ingredients].some((part) => part.toLocaleLowerCase().includes(search));
  }

  function renderLibrary() {
    const search = $('searchInput').value.toLocaleLowerCase().trim();
    const meal = $('libraryMeal').value;
    const filtered = recipes.filter((r) => (!meal || r.meal === meal) && matchesSearch(r, search))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
    page = Math.min(page, totalPages);
    const list = $('recipeList');
    list.replaceChildren();
    $('librarySummary').textContent = recipes.length ? filtered.length + ' of ' + recipes.length + ' recipes' : '';

    if (!recipes.length || !filtered.length) {
      const blank = el('div', 'empty-library');
      blank.append(el('div', 'empty-icon', recipes.length ? '⌕' : '✿'));
      blank.append(el('strong', '', recipes.length ? 'No matching dishes.' : 'Your recipe box is empty.'));
      blank.append(el('p', '', recipes.length ? 'Try a different search or meal category.' : 'Add your first Sims 4 CC recipe to start your collection.'));
      list.append(blank);
    } else {
      filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE).forEach((recipe) => {
        const card = el('article', 'recipe-card');
        const top = el('div', 'recipe-top');
        const heading = el('div');
        heading.append(el('h3', 'recipe-title', recipe.name), el('p', 'recipe-subtitle', recipe.creator ? 'By ' + recipe.creator : 'Creator not specified'));
        const actions = el('div', 'card-actions');
        const edit = el('button', 'icon-button', '✎');
        edit.type = 'button'; edit.title = 'Edit ' + recipe.name; edit.setAttribute('aria-label', edit.title);
        edit.addEventListener('click', () => openForm(recipe));
        const remove = el('button', 'icon-button', '×');
        remove.type = 'button'; remove.title = 'Delete ' + recipe.name; remove.setAttribute('aria-label', remove.title);
        remove.addEventListener('click', () => deleteRecipe(recipe));
        actions.append(edit, remove); top.append(heading, actions);
        card.append(top);
        const bottom = el('div', 'recipe-bottom');
        bottom.append(el('span', 'chip', recipe.meal));
        const requirement = skillRequirement(recipe);
        if (requirement) bottom.append(el('span', 'chip chip-sand', requirement));
        if (recipe.ingredients.length) bottom.append(el('span', 'chip chip-sand', recipe.ingredients.length + (recipe.ingredients.length === 1 ? ' ingredient' : ' ingredients')));
        if (recipe.url) {
          const link = el('a', 'card-link', 'Recipe link ↗');
          link.href = recipe.url; link.target = '_blank'; link.rel = 'noopener noreferrer'; bottom.append(link);
        }
        card.append(bottom);
        if (recipe.ingredients.length) card.append(el('p', 'ingredients-preview', recipe.ingredients.join(' · ')));
        if (recipe.notes) card.append(el('p', 'ingredients-preview', 'Notes: ' + recipe.notes));
        list.append(card);
      });
    }
    const paging = $('pagination');
    paging.hidden = totalPages <= 1;
    $('pageLabel').textContent = 'Page ' + page + ' of ' + totalPages;
    $('prevPage').disabled = page <= 1;
    $('nextPage').disabled = page >= totalPages;
  }

  function render() {
    renderStats();
    renderFilters();
    clearSelectionIfMissing();
    renderLibrary();
    updatePickerState();
  }

  function openForm(recipe) {
    editingId = recipe ? recipe.id : null;
    $('recipeForm').reset();
    $('dialogTitle').innerHTML = recipe ? 'Edit a <em>recipe.</em>' : 'Add a <em>recipe.</em>';
    $('saveRecipe').textContent = recipe ? 'Save changes' : 'Save recipe';
    $('recipeName').value = recipe ? recipe.name : '';
    $('recipeMeal').value = recipe ? recipe.meal : 'Dinner';
    $('recipeCreator').value = recipe ? recipe.creator : '';
    $('recipeSkillType').value = recipe ? recipe.skillType : '';
    $('recipeSkillLevel').value = recipe && recipe.skillLevel !== null ? String(recipe.skillLevel) : '';
    updateSkillLevelField();
    $('recipeIngredients').value = recipe ? recipe.ingredients.join('\n') : '';
    $('recipeUrl').value = recipe ? recipe.url : '';
    $('recipeNotes').value = recipe ? recipe.notes : '';
    $('recipeDialog').showModal();
    $('recipeName').focus();
  }

  function closeForm() {
    $('recipeDialog').close();
    editingId = null;
  }

  function duplicateKey(recipe) {
    return recipe.name.trim().toLocaleLowerCase() + '\u0001' + recipe.creator.trim().toLocaleLowerCase();
  }

  function submitForm(event) {
    event.preventDefault();
    const url = $('recipeUrl').value.trim();
    if (url && !normaliseUrl(url)) {
      $('recipeUrl').setCustomValidity('Please enter a valid http or https URL.');
      $('recipeUrl').reportValidity();
      return;
    }
    const existing = editingId ? recipes.find((recipe) => recipe.id === editingId) : null;
    const entry = normaliseRecipe({
      id: existing ? existing.id : makeId(),
      name: $('recipeName').value,
      meal: $('recipeMeal').value,
      creator: $('recipeCreator').value,
      skillType: $('recipeSkillType').value,
      skillLevel: $('recipeSkillLevel').value,
      ingredients: $('recipeIngredients').value,
      url,
      notes: $('recipeNotes').value,
      createdAt: existing ? existing.createdAt : new Date().toISOString()
    });
    if (!entry) return;
    const duplicate = recipes.find((recipe) => recipe.id !== editingId && duplicateKey(recipe) === duplicateKey(entry));
    if (duplicate && !confirm('A recipe with this name and creator already exists. Save another copy anyway?')) return;
    const next = existing ? recipes.map((recipe) => recipe.id === editingId ? entry : recipe) : [entry, ...recipes];
    if (saveRecipes(next)) {
      closeForm();
      showToast(existing ? 'Recipe updated.' : 'Recipe added to your collection.');
    }
  }

  function deleteRecipe(recipe) {
    if (!confirm('Delete "' + recipe.name + '" from your library? This cannot be undone unless you have a backup.')) return;
    if (saveRecipes(recipes.filter((item) => item.id !== recipe.id))) showToast('Recipe deleted.');
  }

  function exportBackup() {
    const payload = { format: 'little-sim-kitchen', version: 1, exportedAt: new Date().toISOString(), recipes };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const objectUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = objectUrl;
    link.download = 'sim-kitchen-recipes-' + new Date().toISOString().slice(0, 10) + '.json';
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(objectUrl), 15000);
    showToast('Your recipe backup was downloaded.');
  }

  async function importBackup(event) {
    const file = event.target.files && event.target.files[0];
    event.target.value = '';
    if (!file) return;
    if (file.size > 4 * 1024 * 1024) {
      alert('That file is too large. Please select a recipe backup smaller than 4 MB.');
      return;
    }
    let imported;
    try {
      const data = JSON.parse(await file.text());
      if (!data || !Array.isArray(data.recipes) || data.format !== 'little-sim-kitchen' || data.version !== 1) {
        throw new Error('Not a Little Sim Kitchen backup');
      }
      if (data.recipes.length > 15000) throw new Error('Too many entries');
      imported = data.recipes.map(normaliseRecipe).filter(Boolean);
    } catch (_) {
      alert('This file does not look like a valid Little Sim Kitchen JSON backup. Nothing was imported.');
      return;
    }
    if (!imported.length) {
      showToast('No recipes found in that backup.');
      return;
    }
    const names = new Set(recipes.map(duplicateKey));
    const ids = new Set(recipes.map((recipe) => recipe.id));
    const additions = [];
    for (const recipe of imported) {
      const key = duplicateKey(recipe);
      if (names.has(key)) continue;
      names.add(key);
      if (ids.has(recipe.id)) recipe.id = makeId();
      ids.add(recipe.id);
      additions.push(recipe);
    }
    if (!additions.length) {
      showToast('All recipes in that backup are already in your library.');
      return;
    }
    if (!confirm('Import ' + additions.length + ' new recipes? Existing recipes will be kept; duplicates by name and creator will be skipped.')) return;
    if (saveRecipes([...additions, ...recipes])) showToast('Imported ' + additions.length + ' new recipes.');
  }

  function init() {
    CATEGORIES.forEach((name) => $('recipeMeal').add(new Option(name, name)));
    SKILLS.forEach((name) => $('recipeSkillType').add(new Option(name, name)));
    for (let level = 1; level <= 10; level++) {
      $('recipeSkillLevel').add(new Option('Level ' + level, String(level)));
    }
    $('recipeSkillType').addEventListener('change', updateSkillLevelField);
    updateSkillLevelField();
    loadRecipes();
    render();
    $('addBtn').addEventListener('click', () => openForm(null));
    $('closeDialog').addEventListener('click', closeForm);
    $('cancelDialog').addEventListener('click', closeForm);
    $('recipeForm').addEventListener('submit', submitForm);
    $('recipeUrl').addEventListener('input', () => $('recipeUrl').setCustomValidity(''));
    $('recipeDialog').addEventListener('click', (event) => {
      if (event.target === $('recipeDialog')) closeForm();
    });
    $('pickBtn').addEventListener('click', pickRecipe);
    $('pickerMeal').addEventListener('change', () => { invalidateBag(); selectedRecipeId = ''; updatePickerState(); });
    $('pickerCreator').addEventListener('change', () => { invalidateBag(); selectedRecipeId = ''; updatePickerState(); });
    $('searchInput').addEventListener('input', () => { page = 1; renderLibrary(); });
    $('libraryMeal').addEventListener('change', () => { page = 1; renderLibrary(); });
    $('prevPage').addEventListener('click', () => { page--; renderLibrary(); });
    $('nextPage').addEventListener('click', () => { page++; renderLibrary(); });
    $('exportBtn').addEventListener('click', exportBackup);
    $('importFile').addEventListener('change', importBackup);
  }
  init();
})();
