export async function analyzeImage(imageDataUrl, dietaryFilters = '', servings = 2, maxTime = 0, language = 'en') {
  // Extract base64 data from data URL
  const base64Data = imageDataUrl.split(',')[1]
  const mimeType = imageDataUrl.split(';')[0].split(':')[1]

  const response = await fetch('/api/analyze-image', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      imageData: base64Data,
      mimeType,
      dietaryFilters,
      servings,
      maxTime,
      language
    })
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Failed to analyze image')
  }

  return await response.json()
}

export async function regenerateFromIngredients(ingredients, dietaryFilters = '', servings = 2, maxTime = 0, language = 'en') {
  const response = await fetch('/api/regenerate-recipes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ingredients,
      dietaryFilters,
      servings,
      maxTime,
      language
    })
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Failed to generate recipes')
  }

  return await response.json()
}
