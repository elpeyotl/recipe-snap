// Cache generated images
const imageCache = new Map()

// Placeholder image for when generation fails
const PLACEHOLDER_IMAGE = 'data:image/svg+xml,' + encodeURIComponent(`
<svg width="400" height="300" xmlns="http://www.w3.org/2000/svg">
  <rect width="100%" height="100%" fill="#f0f0f0"/>
  <text x="50%" y="45%" text-anchor="middle" fill="#999" font-family="system-ui" font-size="18">🍽️</text>
  <text x="50%" y="60%" text-anchor="middle" fill="#999" font-family="system-ui" font-size="14">Image unavailable</text>
</svg>
`)

export async function fetchRecipeImage(recipe) {
  // Handle both string (recipe name) and object (full recipe)
  const recipeName = typeof recipe === 'string' ? recipe : recipe.name
  const cacheKey = recipeName

  if (imageCache.has(cacheKey)) {
    return imageCache.get(cacheKey)
  }

  try {
    console.log('Generating image for:', recipeName)

    const ingredients = typeof recipe === 'object' && recipe.ingredients
      ? recipe.ingredients.slice(0, 6)
      : []
    const description = typeof recipe === 'object' ? (recipe.description || '') : ''

    const response = await fetch('/api/generate-image', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        recipeName,
        ingredients,
        description
      })
    })

    if (!response.ok) {
      console.error('Image generation error:', response.status)
      imageCache.set(cacheKey, PLACEHOLDER_IMAGE)
      return PLACEHOLDER_IMAGE
    }

    const data = await response.json()

    if (data.mimeType && data.data) {
      const imageUrl = `data:${data.mimeType};base64,${data.data}`
      console.log('Image generated successfully')
      imageCache.set(cacheKey, imageUrl)
      return imageUrl
    }

    imageCache.set(cacheKey, PLACEHOLDER_IMAGE)
    return PLACEHOLDER_IMAGE
  } catch (err) {
    console.error('Image generation failed:', err)
    imageCache.set(cacheKey, PLACEHOLDER_IMAGE)
    return PLACEHOLDER_IMAGE
  }
}
