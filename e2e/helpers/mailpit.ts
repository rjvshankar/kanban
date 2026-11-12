// Reads the fake inbox (Mailpit) so tests can follow the password-reset link like a real user.
import { expect } from '@playwright/test'
import { env } from './env'

interface Summary { ID: string }

/** Waits for the newest email sent to `address` and returns its plain-text body. */
export async function waitForEmail(address: string): Promise<string> {
  let body = ''
  await expect.poll(async () => {
    const res = await fetch(`${env.mailpitUrl}/api/v1/search?query=${encodeURIComponent(`to:${address}`)}`)
    const { messages } = (await res.json()) as { messages: Summary[] }
    if (messages.length === 0) return false
    const msg = await (await fetch(`${env.mailpitUrl}/api/v1/message/${messages[0].ID}`)).json() as { Text: string }
    body = msg.Text
    return true
  }, { message: `no email arrived for ${address}`, timeout: 10_000 }).toBe(true)
  return body
}

export async function emailCount(address: string): Promise<number> {
  const res = await fetch(`${env.mailpitUrl}/api/v1/search?query=${encodeURIComponent(`to:${address}`)}`)
  return ((await res.json()) as { messages: Summary[] }).messages.length
}

/** Pulls the reset link out of the email text. */
export const resetLinkFrom = (body: string) => body.match(/https?:\/\/\S+reset-password\?token=[\w-]+/)![0]
