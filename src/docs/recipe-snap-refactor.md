# Recipe Snap Refactor: AI Images → Spoonacular API

## Why

Current model costs $0.06-0.10 per snap (AI-generated recipes + images).
New model costs ~$0.001 per snap (real recipes from Spoonacular API).

## Overview

**Keep:**
- Gemini 2.0 Flash for ingredient detection from photo
- Clean UI, dark mode, settings

**Replace:**
- AI recipe generation → Spoonacular `findByIngredients` endpoint
- AI image generation → Real recipe images from Spoonacular CDN

**Remove:**
- All Gemini 2.5 Flash Image calls
- "Generating image 1 of 3..." loading state

---

## 1. Set up Spoonacular

Sign up at https://spoonacular.com/food-api and get API key.

Add to `.env`:
```
VITE_SPOONACULAR_API_KEY=your_key_here
```

---

## 2. Create Spoonacular service

Create `src/services/spoonacular.js`:

```js
const API_KEY = import.meta.env.VITE_SPOONACULAR_API_KEY
const BASE_URL = 'https://api.spoonacular.com'

export const findRecipesByIngredients = async (ingredients, number = 3) => {
  const params = new URLSearchParams({
    apiKey: API_KEY,
    ingredients: ingredients.join(','),
    number: number,
    ranking: 1,
    ignorePantry: true
  })
  
  const response = await fetch(
    `${BASE_URL}/recipes/findByIngredients?${params}`
  )
  
  if (!response.ok) {
    if (response.status === 402) {
      throw new Error('API quota exceeded. Try again tomorrow.')
    }
    throw new Error('Failed to fetch recipes')
  }
  
  return response.json()
}

export const getRecipeDetails = async (recipeId) => {
  const params = new URLSearchParams({
    apiKey: API_KEY,
    includeNutrition: false
  })
  
  const response = await fetch(
    `${BASE_URL}/recipes/${recipeId}/information?${params}`
  )
  
  if (!response.ok) {
    throw new Error('Failed to fetch recipe details')
  }
  
  return response.json()
}
```

---

## 3. Update ingredient detection prompt

Keep Gemini for photo analysis, but simplify the prompt:

```js
const prompt = `Analyze this image and identify all food ingredients visible.
Return ONLY a JSON array of ingredient names in English, lowercase.
Example: ["chicken", "tomato", "onion", "garlic"]
No explanation, just the JSON array.`
```

---

## 4. Update recipe flow

### Old flow:
```
photo → analyzeImage() → generateRecipes() → generateImages() → display
```

### New flow:
```
photo → analyzeImage() → findRecipesByIngredients() → display cards
      → user taps card → getRecipeDetails() → display detail view
```

---

## 5. Data mapping

### Recipe cards (from `findByIngredients`)

Spoonacular returns:
```json
{
  "id": 632660,
  "title": "Quinoa Salad with Vegetables",
  "image": "https://img.spoonacular.com/recipes/632660-312x231.jpg",
  "usedIngredients": [
    { "name": "cucumber", "amount": 1, "unit": "" }
  ],
  "missedIngredients": [
    { "name": "feta cheese", "amount": 100, "unit": "g" }
  ],
  "usedIngredientCount": 2,
  "missedIngredientCount": 3
}
```

Map to your UI:
- `recipe.title` → Recipe name
- `recipe.image` → Card image (no AI generation!)
- `recipe.missedIngredients` → "Enhance with" chips

### Recipe detail (from `getRecipeDetails`)

Spoonacular returns:
```json
{
  "id": 632660,
  "title": "Quinoa Salad",
  "image": "https://img.spoonacular.com/recipes/632660-556x370.jpg",
  "servings": 4,
  "readyInMinutes": 25,
  "sourceUrl": "https://example.com/recipe",
  "extendedIngredients": [
    {
      "original": "1 cup quinoa",
      "name": "quinoa",
      "amount": 1,
      "unit": "cup"
    }
  ],
  "analyzedInstructions": [
    {
      "steps": [
        { "number": 1, "step": "Rinse the quinoa under cold water." },
        { "number": 2, "step": "Bring 2 cups of water to a boil." }
      ]
    }
  ]
}
```

Map to your UI:
- `details.extendedIngredients` → Ingredients list
- `details.analyzedInstructions[0].steps` → Instructions list
- `details.readyInMinutes` → Cooking time badge
- `details.servings` → Servings (for your +/- control)

---

## 6. Update "Enhance with" feature

This is now FREE from Spoonacular!

```js
// Old: AI-generated suggestions
const enhanceWith = ['Feta', 'Dill']

// New: directly from API response
const enhanceWith = recipe.missedIngredients.map(i => i.name)
```

---

## 7. Dietary filters

Pass user's dietary preferences to Spoonacular:

```js
// If user has dietary preferences set, use recipe search instead
export const searchRecipes = async (ingredients, diet = null) => {
  const params = new URLSearchParams({
    apiKey: API_KEY,
    includeIngredients: ingredients.join(','),
    number: 3,
    addRecipeInformation: true
  })
  
  if (diet) {
    params.append('diet', diet) // 'vegetarian', 'vegan', 'gluten free'
  }
  
  const response = await fetch(
    `${BASE_URL}/recipes/complexSearch?${params}`
  )
  
  return response.json()
}
```

Diet options: `vegetarian`, `vegan`, `gluten free`, `dairy free`, `ketogenic`, `paleo`

---

## 8. Loading states

Simplify loading since images load instantly:

```js
const stages = {
  IDLE: '',
  ANALYZING: 'Analyzing ingredients...',
  FETCHING: 'Finding recipes...'
}

const handleSnap = async (photo) => {
  setStage(stages.ANALYZING)
  const ingredients = await analyzeImageWithGemini(photo)
  
  setStage(stages.FETCHING)
  const recipes = await findRecipesByIngredients(ingredients, 3)
  
  setStage(stages.IDLE)
  // Navigate to results
}
```

---

## 9. Attribution requirement

Spoonacular requires attribution. Add to your app (footer or settings):

```
Recipe data powered by spoonacular.com
```

With a link to their site.

---

## 10. Language handling

Spoonacular returns English recipes only. Your app supports German.

For now: Keep recipes in English.

Later (optional): Use Gemini to translate recipe text if needed.

---

## 11. Files to modify

| File | Action |
|------|--------|
| `src/services/spoonacular.js` | CREATE - new API service |
| `src/services/gemini.js` | MODIFY - keep only ingredient detection, remove recipe/image generation |
| `src/components/RecipeCard.vue` | MODIFY - use Spoonacular data structure |
| `src/components/RecipeDetail.vue` | MODIFY - fetch details on mount, display Spoonacular format |
| `src/views/Results.vue` | MODIFY - update flow, remove image generation |
| Loading components | MODIFY - remove "Generating image X of 3" |

---

## 12. Delete/remove

- All Gemini 2.5 Flash Image API calls
- Image generation queue logic
- Image generation loading states
- AI recipe generation prompts

---

## 13. Test checklist

- [ ] Photo → ingredients detected correctly
- [ ] Ingredients → 3 recipes returned with images
- [ ] Recipe cards display: title, image, cooking time
- [ ] "Enhance with" shows missed ingredients from API
- [ ] Tap card → fetches and displays full recipe
- [ ] Ingredients list renders correctly
- [ ] Instructions list renders correctly  
- [ ] Servings +/- adjustment works
- [ ] Dietary filters passed to API
- [ ] Rate limit error handled gracefully
- [ ] Attribution visible somewhere in app

---

## 14. Cost comparison

| Item | Old | New |
|------|-----|-----|
| Ingredient detection | $0.0005 | $0.0005 |
| Recipe generation | $0.001 | FREE (API) |
| Image generation (×3) | $0.06 | FREE (API) |
| **Total per snap** | **~$0.08** | **~$0.001** |

80x cost reduction.
