import { useAuth } from '../auth/auth-context'

// Placeholder until boards exist.
export default function HomePage() {
  const { user, logout } = useAuth()
  return (
    <main style={{ maxWidth: 600, margin: '10vh auto', padding: '0 1rem' }}>
      <h1>Welcome, {user?.firstName}</h1>
      <p>Boards will go here.</p>
      <button onClick={() => void logout()}>Log out</button>
    </main>
  )
}
