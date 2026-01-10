import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// We'll test the API functions by mocking fetch
const mockFetch = vi.fn()
global.fetch = mockFetch

// Import after mocking
import { auth, tracks } from './api'

describe('API Client', () => {
  beforeEach(() => {
    mockFetch.mockClear()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('auth.login', () => {
    it('sends correct request and returns token', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ access_token: 'test-token', token_type: 'bearer' }),
      })

      const result = await auth.login({ email: 'test@example.com', password: 'password' })

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/auth/login',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
          }),
          body: JSON.stringify({ email: 'test@example.com', password: 'password' }),
        })
      )
      expect(result.access_token).toBe('test-token')
    })

    it('throws error on failed login', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({ detail: 'Invalid credentials' }),
      })

      await expect(auth.login({ email: 'test@example.com', password: 'wrong' }))
        .rejects.toThrow('Invalid credentials')
    })
  })

  describe('auth.me', () => {
    it('sends authorization header', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          id: 1,
          email: 'test@example.com',
          name: 'Test User',
          is_author: false,
        }),
      })

      await auth.me('test-token')

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/auth/me',
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer test-token',
          }),
        })
      )
    })
  })

  describe('tracks.listPublic', () => {
    it('fetches public tracks', async () => {
      const mockTracks = [
        { id: 1, slug: 'track-1', title: 'Track 1' },
        { id: 2, slug: 'track-2', title: 'Track 2' },
      ]

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockTracks,
      })

      const result = await tracks.listPublic()

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/tracks/public',
        expect.objectContaining({
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
          }),
        })
      )
      expect(result).toEqual(mockTracks)
    })
  })

  describe('tracks.create', () => {
    it('creates a track with authentication', async () => {
      const newTrack = {
        title: 'New Track',
        slug: 'new-track',
        description: 'A new track',
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: async () => ({ id: 1, ...newTrack }),
      })

      await tracks.create(newTrack, 'auth-token')

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/tracks',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            Authorization: 'Bearer auth-token',
            'Content-Type': 'application/json',
          }),
          body: JSON.stringify(newTrack),
        })
      )
    })
  })

  describe('error handling', () => {
    it('handles network errors', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'))

      await expect(auth.login({ email: 'test@example.com', password: 'pass' }))
        .rejects.toThrow('Network error')
    })

    it('handles non-JSON error responses', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => { throw new Error('Invalid JSON') },
      })

      await expect(auth.login({ email: 'test@example.com', password: 'pass' }))
        .rejects.toThrow('An error occurred')
    })
  })
})
