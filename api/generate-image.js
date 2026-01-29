const API_KEY = process.env.GEMINI_API_KEY

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  if (!API_KEY) {
    return res.status(500).json({ error: 'Gemini API key not configured' })
  }

  try {
    const { recipeName, ingredients, description } = req.body

    if (!recipeName) {
      return res.status(400).json({ error: 'Missing recipe name' })
    }

    let prompt
    if (ingredients?.length) {
      const ingredientsList = ingredients.slice(0, 6).join(', ')
      prompt = `Generate a beautiful, appetizing food photography image of this recipe:

Recipe: ${recipeName}
Main ingredients: ${ingredientsList}
Description: ${description || ''}

The dish should be plated nicely on a clean plate or bowl, professionally lit, shot from above or at a 45-degree angle. Professional food photography style, appetizing and delicious looking.`
    } else {
      prompt = `Generate a beautiful, appetizing food photography image of "${recipeName}". The dish should be plated nicely on a clean plate, with good lighting, shot from above or at a 45-degree angle. Professional food photography style.`
    }

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent?key=${API_KEY}`,
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
      const error = await response.json()
      console.error('Image generation error:', error)
      return res.status(502).json({ error: 'Failed to generate image' })
    }

    const data = await response.json()
    const parts = data.candidates?.[0]?.content?.parts

    if (parts) {
      for (const part of parts) {
        if (part.inlineData) {
          return res.status(200).json({
            mimeType: part.inlineData.mimeType,
            data: part.inlineData.data
          })
        }
      }
    }

    return res.status(502).json({ error: 'No image generated' })
  } catch (err) {
    console.error('Image generation failed:', err)
    return res.status(500).json({ error: 'Failed to generate image' })
  }
}
