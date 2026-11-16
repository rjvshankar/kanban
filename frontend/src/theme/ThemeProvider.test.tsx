import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { THEME_COOKIE, readThemeCookie, writeThemeCookie } from './theme'
import { ThemeProvider } from './ThemeProvider'
import { useTheme } from './theme-context'

function Probe() {
  const { theme, setTheme } = useTheme()
  return (
    <>
      <span data-testid="theme">{theme}</span>
      <button onClick={() => setTheme('dark')}>dark</button>
      <button onClick={() => setTheme('light')}>light</button>
    </>
  )
}

// Replaces matchMedia so tests control the OS setting; returns a function that flips it.
function mockSystem(dark: boolean) {
  let listener: (() => void) | undefined
  const media = {
    matches: dark,
    addEventListener: (_: string, l: () => void) => (listener = l),
    removeEventListener: vi.fn(),
  }
  window.matchMedia = vi.fn(() => media) as unknown as typeof window.matchMedia
  return (next: boolean) => {
    media.matches = next
    listener?.()
  }
}

const clearCookie = () => (document.cookie = `${THEME_COOKIE}=; Path=/; Max-Age=0`)
const renderProbe = () => render(<ThemeProvider><Probe /></ThemeProvider>)

describe('ThemeProvider', () => {
  beforeEach(() => {
    clearCookie()
    document.documentElement.classList.remove('dark')
  })
  afterEach(clearCookie)

  it('follows the OS setting when there is no cookie', () => {
    mockSystem(true)
    renderProbe()
    expect(screen.getByTestId('theme')).toHaveTextContent('dark')
    expect(document.documentElement).toHaveClass('dark')
  })

  it('a saved cookie beats the OS setting', () => {
    mockSystem(true)
    writeThemeCookie('light')
    renderProbe()
    expect(screen.getByTestId('theme')).toHaveTextContent('light')
    expect(document.documentElement).not.toHaveClass('dark')
  })

  it('choosing a theme applies it and saves it in the cookie', async () => {
    mockSystem(false)
    renderProbe()
    await userEvent.click(screen.getByText('dark'))
    expect(document.documentElement).toHaveClass('dark')
    expect(readThemeCookie()).toBe('dark')
    await userEvent.click(screen.getByText('light'))
    expect(document.documentElement).not.toHaveClass('dark')
    expect(readThemeCookie()).toBe('light')
  })

  it('tracks live OS changes until the user has chosen', async () => {
    const flip = mockSystem(false)
    renderProbe()
    act(() => flip(true))
    expect(screen.getByTestId('theme')).toHaveTextContent('dark')

    await userEvent.click(screen.getByText('light'))
    act(() => flip(true))
    expect(screen.getByTestId('theme')).toHaveTextContent('light')
  })

  it('ignores a garbage cookie value', () => {
    mockSystem(false)
    document.cookie = `${THEME_COOKIE}=purple; Path=/`
    renderProbe()
    expect(screen.getByTestId('theme')).toHaveTextContent('light')
  })

  it('useTheme throws outside the provider', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() => render(<Probe />)).toThrow(/ThemeProvider/)
  })
})
