const API_KEY = import.meta.env.VITE_GEMINI_API_KEY

function buildPrompt(dietaryFilters, servings, maxTime) {
  let prompt = `You are a helpful cooking assistant. Analyze this image of food ingredients and:

1. Identify all visible ingredients
2. Suggest 3-5 recipes that can be made with these ingredients`

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
      "steps": ["Step 1 instruction", "Step 2 instruction", ...]
    }
  ]
}

IMPORTANT for imageSearch: Use a simple, common, well-known dish name that would return good food photos (e.g. "fried rice", "omelette", "salad bowl", "grilled chicken"). Avoid unique or creative names.

Keep recipes practical and achievable. Assume the user has basic pantry staples (salt, pepper, oil, common spices).`

  return prompt
}

export async function analyzeImage(imageDataUrl, dietaryFilters = '', servings = 2, maxTime = 0) {
  if (!API_KEY) {
    throw new Error('Gemini API key not configured. Add VITE_GEMINI_API_KEY to your .env file.')
  }

  // Extract base64 data from data URL
  const base64Data = imageDataUrl.split(',')[1]
  const mimeType = imageDataUrl.split(';')[0].split(':')[1]

  const prompt = buildPrompt(dietaryFilters, servings, maxTime)

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
          temperature: 0.7,
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
