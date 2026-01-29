# Recipe Snap

Vue 3 PWA that analyzes photos of ingredients and suggests recipes using AI.

## Tech Stack
- **Framework**: Vue 3 + Vite
- **Styling**: Plain CSS (mobile-first)
- **AI**: Gemini API (ingredient detection + recipe suggestions)
- **Images**: Nano Banana / Gemini 2.5 Flash Image (AI-generated recipe photos)
- **PWA**: vite-plugin-pwa

## Commands
- `npm run dev` - Start dev server
- `npm run build` - Production build
- `npm run preview` - Preview production build

## Project Structure
```
src/
  App.vue          # Main app component (all views)
  api/
    gemini.js      # Ingredient analysis API
    imageGen.js    # Nano Banana image generation
  style.css        # Global styles
```

## Environment Variables
```
GEMINI_API_KEY=your_gemini_api_key
```

## Core Features (Done)
- [x] Camera/photo capture
- [x] Ingredient detection via Gemini
- [x] Recipe suggestions with details
- [x] AI-generated images via Nano Banana
- [x] Recipe detail view with ingredients and steps
- [x] PWA support (offline, installable)

## TODO: Nice to Have
- [x] Save favorite recipes (localStorage)
- [x] Share recipe button
- [x] Loading skeleton/shimmer while images generate
- [x] Dark mode toggle
- [x] Recipe serving size adjustment
- [x] Dietary filter options (vegetarian, vegan, etc.)
- [x] Max cooking time filter

## TODO: Polish
- [x] Better loading state (progress indicator for image generation)
- [x] Error retry button
- [x] Haptic feedback on mobile
- [x] Empty state when no recipes found
