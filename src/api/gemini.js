// Resize image to fit within Vercel's 4.5MB request body limit
function resizeImage(dataUrl, maxWidth = 1280, quality = 0.7) {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => {
      const canvas = document.createElement('canvas')
      let { width, height } = img
      if (width > maxWidth) {
        height = Math.round((height * maxWidth) / width)
        width = maxWidth
      }
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')
      ctx.drawImage(img, 0, 0, width, height)
      resolve(canvas.toDataURL('image/jpeg', quality))
    }
    img.src = dataUrl
  })
}

export async function analyzeImage(imageDataUrl, dietaryFilters = '', servings = 2, maxTime = 0, language = 'en') {
  // Resize to keep payload under Vercel's 4.5MB limit
  const resized = await resizeImage(imageDataUrl)
  const base64Data = resized.split(',')[1]
  const mimeType = resized.split(';')[0].split(':')[1]

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
