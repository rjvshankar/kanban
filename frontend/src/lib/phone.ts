// US phone numbers: the user types only digits and the field shows "(912) 345-6789".

export const PHONE_PLACEHOLDER = '(xxx) xxx-xxxx'
// A complete formatted number (an empty field is also allowed by the input, since the phone is optional).
export const PHONE_PATTERN = String.raw`\(\d{3}\) \d{3}-\d{4}`

// Formats up to 10 digits progressively as they are typed: "(912", "(912) 345", "(912) 345-6789".
// Anything that is not a digit is dropped, extra digits are ignored.
export function formatPhone(input: string): string {
  const d = input.replace(/\D/g, '').slice(0, 10)
  if (d.length === 0) return ''
  if (d.length <= 3) return `(${d}`
  if (d.length <= 6) return `(${d.slice(0, 3)}) ${d.slice(3)}`
  return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`
}

// For pasted or previously stored values: drops a leading country code 1 ("+1 912 345 6789"), then formats.
export function normalizePhone(raw: string): string {
  const d = raw.replace(/\D/g, '')
  return formatPhone(d.length === 11 && d.startsWith('1') ? d.slice(1) : d)
}
