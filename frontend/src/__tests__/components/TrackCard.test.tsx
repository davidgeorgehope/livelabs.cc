import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { TrackCard } from '@/components/TrackCard'
import { Track } from '@/lib/api'

const mockTrack: Track = {
  id: 1,
  slug: 'test-track',
  title: 'Test Track Title',
  description: 'This is a test track description',
  docker_image: 'test-image:latest',
  is_published: true,
  author_id: 1,
  org_id: 1,
  env_template: [
    { name: 'API_KEY', description: 'API Key', required: true },
    { name: 'SECRET', description: 'Secret', required: false },
  ],
  created_at: '2024-01-01T00:00:00Z',
}

describe('TrackCard', () => {
  it('renders track title', () => {
    render(<TrackCard track={mockTrack} />)
    expect(screen.getByText('Test Track Title')).toBeInTheDocument()
  })

  it('renders track description', () => {
    render(<TrackCard track={mockTrack} />)
    expect(screen.getByText('This is a test track description')).toBeInTheDocument()
  })

  it('shows "No description" when description is empty', () => {
    const trackWithoutDesc = { ...mockTrack, description: '' }
    render(<TrackCard track={trackWithoutDesc} />)
    expect(screen.getByText('No description')).toBeInTheDocument()
  })

  it('displays correct number of required variables', () => {
    render(<TrackCard track={mockTrack} />)
    expect(screen.getByText('2 required variables')).toBeInTheDocument()
  })

  it('links to the track page', () => {
    render(<TrackCard track={mockTrack} />)
    const link = screen.getByRole('link')
    expect(link).toHaveAttribute('href', '/tracks/test-track')
  })

  it('handles track with no env template', () => {
    const trackNoEnv = { ...mockTrack, env_template: [] }
    render(<TrackCard track={trackNoEnv} />)
    expect(screen.getByText('0 required variables')).toBeInTheDocument()
  })
})
