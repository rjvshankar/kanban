// Phone number input: type digits only, it formats itself as "(912) 345-6789". Optional, but if filled it must be complete.

import type { ComponentProps, ClipboardEvent } from 'react'
import { Input } from '@/components/ui/input'
import { PHONE_PATTERN, PHONE_PLACEHOLDER, formatPhone, normalizePhone } from '../lib/phone'

interface Props extends Omit<ComponentProps<typeof Input>, 'value' | 'onChange' | 'type' | 'pattern' | 'maxLength'> {
  // The formatted value ("" or "(912) 345-6789").
  value: string
  onValueChange: (formatted: string) => void
}

export default function PhoneInput({ value, onValueChange, ...rest }: Props) {
  // Pasting "+1 912 345 6789" must not become "(191) 234-5678": clean it up as a whole.
  function onPaste(e: ClipboardEvent<HTMLInputElement>) {
    e.preventDefault()
    onValueChange(normalizePhone(e.clipboardData.getData('text')))
  }

  return (
    <Input
      type="tel"
      inputMode="numeric"
      autoComplete="tel-national"
      placeholder={PHONE_PLACEHOLDER}
      maxLength={14}
      pattern={PHONE_PATTERN}
      title="Enter a 10-digit phone number, e.g. (912) 345-6789"
      {...rest}
      value={value}
      onChange={(e) => onValueChange(formatPhone(e.target.value))}
      onPaste={onPaste}
    />
  )
}
