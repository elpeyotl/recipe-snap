const LANGUAGE_NAMES: Record<string, string> = {
  en: 'English', de: 'German', es: 'Spanish', fr: 'French',
  it: 'Italian', nl: 'Dutch', pt: 'Portuguese'
}

function buildTextPrompt(ingredients: string[], dietaryFilters: string, servings: number, maxTime: number, language: string) {
  let prompt = `You are an experienced chef. Based on these ingredients: ${ingredients.join(', ')}

Suggest 3-5 REAL, well-known recipes from established cuisines.

CRITICAL RULES:
- Only suggest dishes that actually exist and are commonly prepared. No invented or experimental combinations.
- Group ingredients that naturally belong together. Not every ingredient needs to be used in every recipe.
- If some ingredients don't fit together, use them in SEPARATE recipes or leave them out entirely.
- Each recipe should use a coherent subset of the available ingredients that makes culinary sense.
- Prefer classic, recognizable dishes over creative fusions.`

  if (language && language !== 'en') {
    prompt += `\n\nIMPORTANT: Respond entirely in ${LANGUAGE_NAMES[language] || 'English'}. Only the imageSearch field should remain in English.`
  }
  if (dietaryFilters) {
    prompt += `\n\nIMPORTANT: Only suggest ${dietaryFilters} recipes.`
  }
  if (maxTime && maxTime > 0) {
    prompt += `\n\nIMPORTANT: Only suggest recipes that can be prepared in ${maxTime} minutes or less.`
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
      "imageSearch": "simple common dish name for image search",
      "time": "20 mins",
      "difficulty": "Easy",
      "description": "Brief description of the dish",
      "ingredients": ["ingredient with amount", ...],
      "steps": ["Step 1 instruction", "Step 2 instruction", ...],
      "suggestedAdditions": ["ingredient1", "ingredient2"]
    }
  ]
}

IMPORTANT: Only suggest real dishes. Assume basic pantry staples.`

  return prompt
}

function parseGeminiResponse(text: string) {
  let jsonStr = text
  if (text.includes('```json')) {
    jsonStr = text.split('```json')[1].split('```')[0]
  } else if (text.includes('```')) {
    jsonStr = text.split('```')[1].split('```')[0]
  }
  const trimmed = jsonStr.trim()
  if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) {
    throw createError({ statusCode: 422, message: 'No recipes could be generated from the provided ingredients. Please try different ingredients.' })
  }
  return JSON.parse(trimmed)
}

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()
  const body = await readBody(event)
  const { ingredients, dietaryFilters, servings, maxTime, language } = body

  if (!ingredients?.length) {
    throw createError({ statusCode: 400, message: 'Missing ingredients' })
  }
  if (!config.geminiApiKey) {
    throw createError({ statusCode: 500, message: 'Gemini API key not configured' })
  }

  const prompt = buildTextPrompt(ingredients, dietaryFilters || '', servings || 2, maxTime || 0, language || 'en')

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${config.geminiApiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.4, maxOutputTokens: 2048 }
      })
    }
  )

  if (!response.ok) {
    const error = await response.json()
    throw createError({ statusCode: 502, message: error.error?.message || 'Failed to generate recipes' })
  }

  const data = await response.json()
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text
  if (!text) {
    throw createError({ statusCode: 502, message: 'No response from Gemini' })
  }

  return parseGeminiResponse(text)
})
