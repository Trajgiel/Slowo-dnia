/**
 * Text handed to speech synthesis: `…` is dropped and ` / ` (with any whitespace around the slash)
 * becomes `, ` so the voice pauses between variants (prototype `speak`).
 */
export function speechText(text: string): string {
  return text.replace(/…/g, '').replace(/\s\/\s/g, ', ')
}
