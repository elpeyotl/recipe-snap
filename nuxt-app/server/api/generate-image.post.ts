export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()
  const body = await readBody(event)
  const { recipeName, ingredients, description } = body

  if (!recipeName) {
    throw createError({ statusCode: 400, message: 'Missing recipe name' })
  }
  if (!config.geminiApiKey) {
    throw createError({ statusCode: 500, message: 'Gemini API key not configured' })
  }

  let prompt: string
  if (ingredients?.length) {
    const ingredientsList = ingredients.slice(0, 6).join(', ')
    prompt = `Generate a beautiful, appetizing food photography image of this recipe:\n\nRecipe: ${recipeName}\nMain ingredients: ${ingredientsList}\nDescription: ${description || ''}\n\nThe dish should be plated nicely on a clean plate or bowl, professionally lit, shot from above or at a 45-degree angle. Professional food photography style, appetizing and delicious looking.`
  } else {
    prompt = `Generate a beautiful, appetizing food photography image of "${recipeName}". The dish should be plated nicely on a clean plate, with good lighting, shot from above or at a 45-degree angle. Professional food photography style.`
  }

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent?key=${config.geminiApiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { responseModalities: ['TEXT', 'IMAGE'] }
      })
    }
  )

  if (!response.ok) {
    throw createError({ statusCode: 502, message: 'Failed to generate image' })
  }

  const data = await response.json()
  const parts = data.candidates?.[0]?.content?.parts
  if (parts) {
    for (const part of parts) {
      if (part.inlineData) {
        return { mimeType: part.inlineData.mimeType, data: part.inlineData.data }
      }
    }
  }

  throw createError({ statusCode: 502, message: 'No image generated' })
})
