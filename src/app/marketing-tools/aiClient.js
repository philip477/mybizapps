// Shared browser helper for calling the server-side AI image route. The OpenAI
// key lives only on the server (/api/ai-generate); the client just posts a
// description + type and gets back a base64 data URL (or a friendly error).

// generateAiImage — returns { image, revisedPrompt } on success or throws an
// Error whose message is safe to show the user.
export async function generateAiImage({ type, description, style, companyName }) {
  let res
  try {
    res = await fetch('/api/ai-generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, description, style, companyName }),
    })
  } catch {
    throw new Error('Network error — could not reach the AI service.')
  }

  let data = {}
  try {
    data = await res.json()
  } catch {
    // fall through to status-based message
  }

  if (!res.ok) {
    throw new Error(data?.error || `AI generation failed (${res.status}).`)
  }
  if (!data?.image) {
    throw new Error('No image was returned. Please try again.')
  }
  return { image: data.image, revisedPrompt: data.revisedPrompt || null }
}
