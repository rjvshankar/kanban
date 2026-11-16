import { describe, expect, it } from 'vitest'
import { PHONE_PATTERN, formatPhone, normalizePhone } from './phone'

describe('formatPhone', () => {
  it.each([
    ['', ''],
    ['9', '(9'],
    ['912', '(912'],
    ['9123', '(912) 3'],
    ['912345', '(912) 345'],
    ['9123456', '(912) 345-6'],
    ['9123456789', '(912) 345-6789'],
  ])('%s -> %s', (input, expected) => expect(formatPhone(input)).toBe(expected))

  it('drops non-digits and ignores digits beyond 10', () => {
    expect(formatPhone('abc912-345 6789xyz')).toBe('(912) 345-6789')
    expect(formatPhone('91234567890123')).toBe('(912) 345-6789')
  })

  it('is stable when fed its own output (typing the next character)', () => {
    expect(formatPhone(formatPhone('9123') + '4')).toBe('(912) 34')
  })

  it('deleting a separator removes nothing but the separator', () => {
    expect(formatPhone('(912) ')).toBe('(912')
    expect(formatPhone('(912) 345-')).toBe('(912) 345')
  })
})

describe('normalizePhone', () => {
  it('drops a leading country code', () => {
    expect(normalizePhone('+1 912 345 6789')).toBe('(912) 345-6789')
    expect(normalizePhone('1-912-345-6789')).toBe('(912) 345-6789')
  })
  it('reformats other layouts and keeps a plain 10 digit number', () => {
    expect(normalizePhone('912.345.6789')).toBe('(912) 345-6789')
    expect(normalizePhone('9123456789')).toBe('(912) 345-6789')
  })
  it('leaves empty alone', () => expect(normalizePhone('')).toBe(''))
})

describe('PHONE_PATTERN', () => {
  const re = new RegExp(`^${PHONE_PATTERN}$`)
  it('accepts only the complete format', () => {
    expect(re.test('(912) 345-6789')).toBe(true)
    expect(re.test('(912) 345-678')).toBe(false)
    expect(re.test('912-345-6789')).toBe(false)
  })
})
