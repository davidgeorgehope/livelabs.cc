import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { Header } from '@/components/Header'

// Mock the useAuth hook
const mockLogout = vi.fn()
let mockAuthState = {
  user: null as { id: number; email: string; name: string; is_author: boolean } | null,
  token: null as string | null,
  isLoading: false,
  login: vi.fn(),
  register: vi.fn(),
  logout: mockLogout,
}

vi.mock('@/components/AuthProvider', () => ({
  useAuth: () => mockAuthState,
}))

describe('Header', () => {
  beforeEach(() => {
    mockAuthState = {
      user: null,
      token: null,
      isLoading: false,
      login: vi.fn(),
      register: vi.fn(),
      logout: mockLogout,
    }
    mockLogout.mockClear()
  })

  it('renders the logo', () => {
    render(<Header />)
    expect(screen.getByText('LiveLabs')).toBeInTheDocument()
  })

  it('shows login and signup buttons when not authenticated', () => {
    render(<Header />)
    expect(screen.getByText('Login')).toBeInTheDocument()
    expect(screen.getByText('Sign Up')).toBeInTheDocument()
  })

  it('shows loading state when isLoading is true', () => {
    mockAuthState.isLoading = true
    render(<Header />)
    // Loading placeholder should be visible
    const loadingElement = document.querySelector('.animate-pulse')
    expect(loadingElement).toBeInTheDocument()
  })

  it('shows user name and logout when authenticated', () => {
    mockAuthState.user = {
      id: 1,
      email: 'test@example.com',
      name: 'Test User',
      is_author: false,
    }
    mockAuthState.token = 'test-token'

    render(<Header />)
    expect(screen.getByText('Test User')).toBeInTheDocument()
    expect(screen.getByText('Logout')).toBeInTheDocument()
  })

  it('shows My Learning link when authenticated', () => {
    mockAuthState.user = {
      id: 1,
      email: 'test@example.com',
      name: 'Test User',
      is_author: false,
    }

    render(<Header />)
    expect(screen.getByText('My Learning')).toBeInTheDocument()
  })

  it('shows Author link when user is an author', () => {
    mockAuthState.user = {
      id: 1,
      email: 'author@example.com',
      name: 'Author User',
      is_author: true,
    }

    render(<Header />)
    expect(screen.getByText('Author')).toBeInTheDocument()
  })

  it('does not show Author link when user is not an author', () => {
    mockAuthState.user = {
      id: 1,
      email: 'test@example.com',
      name: 'Test User',
      is_author: false,
    }

    render(<Header />)
    expect(screen.queryByText('Author')).not.toBeInTheDocument()
  })

  it('calls logout when logout button is clicked', () => {
    mockAuthState.user = {
      id: 1,
      email: 'test@example.com',
      name: 'Test User',
      is_author: false,
    }

    render(<Header />)
    fireEvent.click(screen.getByText('Logout'))
    expect(mockLogout).toHaveBeenCalled()
  })
})
