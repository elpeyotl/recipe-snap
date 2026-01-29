# Recipe Snap - Documentation

## App Overview

Recipe Snap is a PWA that helps users discover recipes based on ingredients they photograph. Take a photo of what's in your fridge, and get personalized recipe suggestions with AI-generated images.

**Live URL:** https://recipe-snap-sand.vercel.app

---

## User Flow

### 1. Camera View (Home)
- User sees a camera button with the prompt "What's in your fridge?"
- Active dietary filters are displayed if set
- Tap camera to take/upload a photo of ingredients

### 2. Preview View
- Shows the captured photo
- User can **Retake** or **Find Recipes**
- Error state with retry button if analysis fails

### 3. Loading View
- Spinner with progress text: "Analyzing ingredients..."
- Transitions to results as soon as recipe data is ready

### 4. Results View
- **Detected Ingredients** - Editable chips showing identified ingredients
  - Tap chip to edit inline
  - X button to remove
  - "+ Add" button for new ingredients
  - "Regenerate recipes" button appears when modified
- **Recipe Ideas** - Cards with:
  - AI-generated food image (loads asynchronously)
  - Recipe name, time, difficulty
  - Brief description
  - Heart button to save to favorites

### 5. Recipe Detail View
- Large hero image
- Recipe name with favorite/share actions
- Adjustable servings (scales ingredient quantities)
- Ingredients list
- Step-by-step instructions
- "Enhance with" suggestions (optional ingredients)
- "Scan new ingredients" button

### 6. Favorites View
- Saved recipes stored in localStorage
- Same card layout as results
- Access from header heart icon

### 7. Settings View
- Dark mode toggle (default: on)
- Default servings
- Max cooking time filter
- Recipe language selector (7 languages)
- Dietary preferences (vegetarian, vegan, gluten-free, dairy-free)

### 8. Paywall Flow
- Users get **3 free snaps** before paywall appears
- Camera view shows remaining free snaps counter
- After free snaps exhausted, PaywallModal appears with:
  - Buy Me a Coffee link for support
  - Unlock code input for unlimited access
- Unlocked state persists in localStorage

---

## Technical Architecture

### Frontend
- **Framework:** Vue 3 (Composition API)
- **Build:** Vite 7
- **PWA:** vite-plugin-pwa (offline support, installable)
- **Styling:** Vanilla CSS with CSS variables for theming
- **Analytics:** Vercel Analytics

### APIs

#### Gemini API (Google AI)
- **Model:** `gemini-2.0-flash`
- **Endpoints:**
  - `analyzeImage()` - Analyze photo, identify ingredients, suggest recipes
  - `regenerateFromIngredients()` - Generate recipes from text ingredient list

#### Unsplash API
- **Endpoint:** `fetchRecipeImage()` - Fetch food photography for each recipe
- Uses recipe name as search query
- Free tier with attribution

### Data Flow
```
Photo → Gemini (analyze) → Ingredients + Recipes JSON
                              ↓
                        Show results immediately
                              ↓
                        Load images async (parallel)
                              ↓
                        Update cards as images arrive
```

---

## API Cost Breakdown

### Per Snap (3-5 recipes)

| API Call | Model | Est. Tokens/Images | Cost |
|----------|-------|-------------------|------|
| Analyze ingredients | gemini-2.0-flash | ~1,500 tokens | ~$0.0005 |
| Generate image 1 | gemini-2.5-flash-image | 1 image | ~$0.02 |
| Generate image 2 | gemini-2.5-flash-image | 1 image | ~$0.02 |
| Generate image 3 | gemini-2.5-flash-image | 1 image | ~$0.02 |
| Generate image 4 (if 4+ recipes) | gemini-2.5-flash-image | 1 image | ~$0.02 |
| Generate image 5 (if 5 recipes) | gemini-2.5-flash-image | 1 image | ~$0.02 |

**Total per snap: $0.06 - $0.10**

### Monthly Projections

| Usage | Snaps/Month | Est. Cost |
|-------|-------------|-----------|
| Light | 100 | $6 - $10 |
| Moderate | 500 | $30 - $50 |
| Heavy | 1,000 | $60 - $100 |

### Cost Breakdown by Component
- **Text analysis:** ~1% of total cost (nearly free)
- **Image generation:** ~99% of total cost

### Cost Reduction Options

1. **Use stock photos instead of AI generation**
   - Unsplash/Pexels API (free)
   - Use `imageSearch` field from Gemini response as search query
   - Reduces cost to ~$0.001 per snap

2. **Lazy load images**
   - Only generate image when user clicks a recipe card
   - Most users might only view 1-2 recipes

3. **Persistent caching**
   - Store generated images in localStorage/IndexedDB
   - Cache by recipe name hash
   - Reuse images for common dishes

4. **Limit recipes**
   - Request only 3 recipes instead of 3-5
   - Reduces image generation by 40%

---

## Environment Variables

```env
GEMINI_API_KEY=your_gemini_api_key_here
```

| Variable | Description |
|----------|-------------|
| `GEMINI_API_KEY` | Google Gemini API key (server-side only, used by Vercel API routes) |

---

## File Structure

```
recipe-snap/
├── public/
│   ├── logo.png              # App logo
│   ├── favicon-32.png        # Browser favicon
│   ├── apple-touch-icon.png  # iOS home screen icon
│   ├── pwa-192x192.png       # PWA icon (small)
│   └── pwa-512x512.png       # PWA icon (large)
├── src/
│   ├── api/
│   │   ├── gemini.js         # Gemini API calls
│   │   └── imageGen.js       # Unsplash image fetching
│   ├── components/
│   │   └── PaywallModal.vue  # Paywall modal component
│   ├── composables/
│   │   ├── useMonetization.js # Snap counting & paywall logic
│   │   └── usePlatform.js     # Platform detection (web/native)
│   ├── App.vue               # Main component
│   ├── main.js               # Entry point + analytics
│   └── style.css             # All styles
├── index.html
├── vite.config.js
├── package.json
└── .env                      # API keys (not committed)
```

---

## Key Features

### Implemented
- [x] Camera/photo capture
- [x] Ingredient detection via Gemini
- [x] Recipe suggestions with Unsplash images
- [x] Async image loading (non-blocking)
- [x] Editable ingredient chips
- [x] Recipe regeneration from modified ingredients
- [x] Favorite recipes (localStorage)
- [x] Share recipe button
- [x] Share app button (header)
- [x] Dark mode (default)
- [x] Serving size adjustment with scaling
- [x] Dietary filters
- [x] Max cooking time filter
- [x] Multi-language support (7 languages)
- [x] PWA (offline, installable)
- [x] Haptic feedback
- [x] Vercel Analytics
- [x] Monetization (3 free snaps + paywall)
- [x] Unlock code support
- [x] PNG icons (favicon, PWA, Apple touch)

### Potential Future Features
- [ ] Persistent image cache (IndexedDB)
- [ ] Recipe history
- [ ] Ingredient pantry management
- [ ] Shopping list generation
- [ ] Nutritional information
- [ ] Voice-guided cooking mode
- [ ] Social sharing with images

---

## Deployment

Hosted on **Vercel** with automatic deployments from GitHub.

- Push to `main` branch triggers deployment
- Environment variables set in Vercel dashboard
- Analytics automatically enabled

---

## Support

- **Buy Me a Coffee:** https://buymeacoffee.com/elpeyotl
- **GitHub Issues:** For bug reports and feature requests
