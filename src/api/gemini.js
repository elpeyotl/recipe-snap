const API_KEY = import.meta.env.VITE_GEMINI_API_KEY

const LANGUAGE_NAMES = {
  en: 'English',
  de: 'German',
  es: 'Spanish',
  fr: 'French',
  it: 'Italian',
  nl: 'Dutch',
  pt: 'Portuguese'
}

function buildPrompt(dietaryFilters, servings, maxTime, language) {
  let prompt = `You are an experienced chef. Analyze this image of food ingredients and:

1. Identify all visible ingredients
2. Suggest 3-5 REAL, well-known recipes from established cuisines (e.g. Italian, Mexican, Asian, French, American comfort food, etc.)

CRITICAL RULES:
- Only suggest dishes that actually exist and are commonly prepared. No invented or experimental combinations.
- Group ingredients that naturally belong together. Not every ingredient needs to be used in every recipe.
- If some ingredients don't fit together (e.g. chocolate next to vegetables), use them in SEPARATE recipes or leave them out entirely.
- Each recipe should use a coherent subset of the available ingredients that makes culinary sense.
- Prefer classic, recognizable dishes over creative fusions.`

  if (language && language !== 'en') {
    prompt += `\n\nIMPORTANT: Respond entirely in ${LANGUAGE_NAMES[language] || 'English'}. All recipe names, descriptions, ingredients, steps, and suggested additions must be in ${LANGUAGE_NAMES[language] || 'English'}. Only the imageSearch field should remain in English for image lookup.`
  }

  if (dietaryFilters) {
    prompt += `\n\nIMPORTANT: Only suggest ${dietaryFilters} recipes. Do not include any recipes that don't fit these dietary requirements.`
  }

  if (maxTime && maxTime > 0) {
    prompt += `\n\nIMPORTANT: Only suggest recipes that can be prepared in ${maxTime} minutes or less (total cooking time including prep).`
  }

  if (servings && servings !== 2) {
    prompt += `\n\nAdjust all ingredient quantities for ${servings} servings.`
  }

  prompt += `

Respond ONLY with valid JSON in this exact format:
{
  "ingredients": ["ingredient1", "ingredient2", ...],
  "recipes": [
    {
      "name": "Recipe Name",
      "imageSearch": "simple common dish name for image search (e.g. 'pasta carbonara', 'chicken stir fry', 'vegetable soup')",
      "time": "20 mins",
      "difficulty": "Easy",
      "description": "Brief description of the dish",
      "ingredients": ["ingredient with amount", ...],
      "steps": ["Step 1 instruction", "Step 2 instruction", ...],
      "suggestedAdditions": ["ingredient1", "ingredient2"]
    }
  ]
}

For suggestedAdditions: Suggest 1-3 common ingredients NOT in the photo that would enhance this recipe (e.g., "coconut milk", "fresh basil", "parmesan cheese"). Only suggest if they would genuinely improve the dish. Leave empty array if recipe is already complete.

IMPORTANT for imageSearch: Use a simple, common, well-known dish name that would return good food photos (e.g. "fried rice", "omelette", "salad bowl", "grilled chicken"). Avoid unique or creative names.

IMPORTANT: Only suggest real dishes that people actually cook. Think of recipes you'd find in a cookbook or on a popular cooking website. Do NOT force incompatible ingredients together. It's better to use fewer ingredients well than to create a strange combination using all of them. Assume the user has basic pantry staples (salt, pepper, oil, common spices).`

  return prompt
}

export async function analyzeImage(imageDataUrl, dietaryFilters = '', servings = 2, maxTime = 0, language = 'en') {
  if (!API_KEY) {
    throw new Error('Gemini API key not configured. Add VITE_GEMINI_API_KEY to your .env file.')
  }

  // Extract base64 data from data URL
  const base64Data = imageDataUrl.split(',')[1]
  const mimeType = imageDataUrl.split(';')[0].split(':')[1]

  const prompt = buildPrompt(dietaryFilters, servings, maxTime, language)

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${API_KEY}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: prompt },
              {
                inline_data: {
                  mime_type: mimeType,
                  data: base64Data,
                },
              },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.4,
          maxOutputTokens: 2048,
        },
      }),
    }
  )

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error?.message || 'Failed to analyze image')
  }

  const data = await response.json()

  // Extract the text response
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text
  if (!text) {
    throw new Error('No response from Gemini')
  }

  // Parse JSON from response (handle markdown code blocks)
  let jsonStr = text
  if (text.includes('```json')) {
    jsonStr = text.split('```json')[1].split('```')[0]
  } else if (text.includes('```')) {
    jsonStr = text.split('```')[1].split('```')[0]
  }

  try {
    return JSON.parse(jsonStr.trim())
  } catch (e) {
    throw new Error('Failed to parse recipe data')
  }
}

function buildTextPrompt(ingredients, dietaryFilters, servings, maxTime, language) {
  let prompt = `You are an experienced chef. Based on these ingredients: ${ingredients.join(', ')}

Suggest 3-5 REAL, well-known recipes from established cuisines.

CRITICAL RULES:
- Only suggest dishes that actually exist and are commonly prepared. No invented or experimental combinations.
- Group ingredients that naturally belong together. Not every ingredient needs to be used in every recipe.
- If some ingredients don't fit together (e.g. chocolate next to vegetables), use them in SEPARATE recipes or leave them out entirely.
- Each recipe should use a coherent subset of the available ingredients that makes culinary sense.
- Prefer classic, recognizable dishes over creative fusions.`

  if (language && language !== 'en') {
    prompt += `\n\nIMPORTANT: Respond entirely in ${LANGUAGE_NAMES[language] || 'English'}. All recipe names, descriptions, ingredients, steps, and suggested additions must be in ${LANGUAGE_NAMES[language] || 'English'}. Only the imageSearch field should remain in English for image lookup.`
  }

  if (dietaryFilters) {
    prompt += `\n\nIMPORTANT: Only suggest ${dietaryFilters} recipes. Do not include any recipes that don't fit these dietary requirements.`
  }

  if (maxTime && maxTime > 0) {
    prompt += `\n\nIMPORTANT: Only suggest recipes that can be prepared in ${maxTime} minutes or less (total cooking time including prep).`
  }

  if (servings && servings !== 2) {
    prompt += `\n\nAdjust all ingredient quantities for ${servings} servings.`
  }

  prompt += `

Respond ONLY with valid JSON in this exact format:
{
  "recipes": [
    {
      "name": "Recipe Name",
      "imageSearch": "simple common dish name for image search (e.g. 'pasta carbonara', 'chicken stir fry', 'vegetable soup')",
      "time": "20 mins",
      "difficulty": "Easy",
      "description": "Brief description of the dish",
      "ingredients": ["ingredient with amount", ...],
      "steps": ["Step 1 instruction", "Step 2 instruction", ...],
      "suggestedAdditions": ["ingredient1", "ingredient2"]
    }
  ]
}

For suggestedAdditions: Suggest 1-3 common ingredients NOT provided that would enhance this recipe. Only suggest if they would genuinely improve the dish. Leave empty array if recipe is already complete.

IMPORTANT for imageSearch: Use a simple, common, well-known dish name that would return good food photos.

IMPORTANT: Only suggest real dishes that people actually cook. Think of recipes you'd find in a cookbook or on a popular cooking website. Do NOT force incompatible ingredients together. It's better to use fewer ingredients well than to create a strange combination using all of them. Assume the user has basic pantry staples (salt, pepper, oil, common spices).`

  return prompt
}

export async function regenerateFromIngredients(ingredients, dietaryFilters = '', servings = 2, maxTime = 0, language = 'en') {
  if (!API_KEY) {
    throw new Error('Gemini API key not configured. Add VITE_GEMINI_API_KEY to your .env file.')
  }

  const prompt = buildTextPrompt(ingredients, dietaryFilters, servings, maxTime, language)

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${API_KEY}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: prompt },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.4,
          maxOutputTokens: 2048,
        },
      }),
    }
  )

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error?.message || 'Failed to generate recipes')
  }

  const data = await response.json()

  const text = data.candidates?.[0]?.content?.parts?.[0]?.text
  if (!text) {
    throw new Error('No response from Gemini')
  }

  let jsonStr = text
  if (text.includes('```json')) {
    jsonStr = text.split('```json')[1].split('```')[0]
  } else if (text.includes('```')) {
    jsonStr = text.split('```')[1].split('```')[0]
  }

  try {
    return JSON.parse(jsonStr.trim())
  } catch (e) {
    throw new Error('Failed to parse recipe data')
  }
}
