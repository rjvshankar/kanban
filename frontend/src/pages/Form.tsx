// Small shared building blocks for the auth forms: a centered card, a labeled input and an error line.

import { useId, type ComponentProps, type ReactNode } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

// Centered page container with a title.
export function FormCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <main className="grid min-h-screen place-items-center bg-muted/30 p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-xl">{title}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4">{children}</CardContent>
      </Card>
    </main>
  )
}

// A labeled text input; accepts any normal <input> props.
export function Field(props: ComponentProps<typeof Input> & { label: string }) {
  // Split the label text from the props that belong on the <input>.
  const { label, ...input } = props
  // Unique id that ties the label to its input (clicking the label focuses it).
  const id = useId()
  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} {...input} />
    </div>
  )
}

// Shows an error message, or nothing when message is null.
export function FormError({ message }: { message: string | null }) {
  return message ? <p role="alert" className="text-sm text-destructive">{message}</p> : null
}
