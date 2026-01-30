const PLACEHOLDER_IMAGE = 'data:image/svg+xml,' + encodeURIComponent(`
<svg width="400" height="300" xmlns="http://www.w3.org/2000/svg">
  <rect width="100%" height="100%" fill="#f0f0f0"/>
  <text x="50%" y="45%" text-anchor="middle" fill="#999" font-family="system-ui" font-size="18">🍽️</text>
  <text x="50%" y="60%" text-anchor="middle" fill="#999" font-family="system-ui" font-size="14">Image unavailable</text>
</svg>
`)

function resizeImage(dataUrl: string, maxWidth = 1280, quality = 0.7): Promise<string> {
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
      const ctx = canvas.getContext('2d')!
      ctx.drawImage(img, 0, 0, width, height)
      resolve(canvas.toDataURL('image/jpeg', quality))
    }
    img.src = dataUrl
  })
}

export function useGemini() {
  const { getCachedImage, setCachedImage } = useImageCache()

  async function analyzeImage(
    imageDataUrl: string,
    dietaryFilters = '',
    servings = 2,
    maxTime = 0,
    language = 'en'
  ) {
    const resized = await resizeImage(imageDataUrl)
    const base64Data = resized.split(',')[1]
    const mimeType = resized.split(';')[0].split(':')[1]

    const response = await $fetch('/api/analyze-image', {
      method: 'POST',
      body: {
        imageData: base64Data,
        mimeType,
        dietaryFilters,
        servings,
        maxTime,
        language
      }
    })

    return response
  }

  async function regenerateFromIngredients(
    ingredients: string[],
    dietaryFilters = '',
    servings = 2,
    maxTime = 0,
    language = 'en'
  ) {
    const response = await $fetch('/api/regenerate-recipes', {
      method: 'POST',
      body: {
        ingredients,
        dietaryFilters,
        servings,
        maxTime,
        language
      }
    })

    return response
  }

  async function fetchRecipeImage(recipe: any): Promise<string> {
    const recipeName = typeof recipe === 'string' ? recipe : recipe.name

    const cached = await getCachedImage(recipeName)
    if (cached) return cached

    try {
      const ingredients = typeof recipe === 'object' && recipe.ingredients
        ? recipe.ingredients.slice(0, 6)
        : []
      const description = typeof recipe === 'object' ? (recipe.description || '') : ''

      const data: any = await $fetch('/api/generate-image', {
        method: 'POST',
        body: {
          recipeName,
          ingredients,
          description
        }
      })

      if (data.mimeType && data.data) {
        const imageUrl = `data:${data.mimeType};base64,${data.data}`
        setCachedImage(recipeName, imageUrl)
        return imageUrl
      }

      return PLACEHOLDER_IMAGE
    } catch (err) {
      console.error('Image generation failed:', err)
      return PLACEHOLDER_IMAGE
    }
  }

  return {
    analyzeImage,
    regenerateFromIngredients,
    fetchRecipeImage
  }
}
