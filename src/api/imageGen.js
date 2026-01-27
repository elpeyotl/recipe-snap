const API_KEY = import.meta.env.VITE_GEMINI_API_KEY

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

  if (!API_KEY) {
    return PLACEHOLDER_IMAGE
  }

  try {
    console.log('Generating image with Nano Banana for:', recipeName)

    // Build a detailed prompt if we have full recipe info
    let prompt
    if (typeof recipe === 'object' && recipe.ingredients) {
      const ingredientsList = recipe.ingredients.slice(0, 6).join(', ')
      prompt = `Generate a beautiful, appetizing food photography image of this recipe:

Recipe: ${recipe.name}
Main ingredients: ${ingredientsList}
Description: ${recipe.description || ''}

The dish should be plated nicely on a clean plate or bowl, professionally lit, shot from above or at a 45-degree angle. Professional food photography style, appetizing and delicious looking.`
    } else {
      prompt = `Generate a beautiful, appetizing food photography image of "${recipeName}". The dish should be plated nicely on a clean plate, with good lighting, shot from above or at a 45-degree angle. Professional food photography style.`
    }

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent?key=${API_KEY}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                { text: prompt }
              ]
            }
          ],
          generationConfig: {
            responseModalities: ["TEXT", "IMAGE"]
          }
        })
      }
    )

    if (!response.ok) {
      const error = await response.json()
      console.error('Image generation error:', error)
      imageCache.set(cacheKey, PLACEHOLDER_IMAGE)
      return PLACEHOLDER_IMAGE
    }

    const data = await response.json()

    // Extract image from response
    const parts = data.candidates?.[0]?.content?.parts
    if (parts) {
      for (const part of parts) {
        if (part.inlineData) {
          const imageUrl = `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`
          console.log('Image generated successfully')
          imageCache.set(cacheKey, imageUrl)
          return imageUrl
        }
      }
    }

    imageCache.set(cacheKey, PLACEHOLDER_IMAGE)
    return PLACEHOLDER_IMAGE
  } catch (err) {
    console.error('Image generation failed:', err)
    imageCache.set(cacheKey, PLACEHOLDER_IMAGE)
    return PLACEHOLDER_IMAGE
  }
}
