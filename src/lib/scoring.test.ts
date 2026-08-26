import { describe, expect, it } from 'vitest'
import type { GitHubRepository, GitHubUser } from '../types'
import {
  auditRepository,
  getPinCandidates,
  getPortfolioScore,
  getProfileScore,
  getRecommendations,
} from './scoring'

const NOW = new Date('2026-08-26T12:00:00.000Z')

function repository(overrides: Partial<GitHubRepository> = {}): GitHubRepository {
  return {
    id: 1,
    name: 'shipping-console',
    full_name: 'developer/shipping-console',
    html_url: 'https://github.com/developer/shipping-console',
    description: 'An operations console for tracking shipments across multiple carriers.',
    homepage: 'https://shipping-console.example.com',
    language: 'TypeScript',
    fork: false,
    archived: false,
    disabled: false,
    stargazers_count: 12,
    forks_count: 2,
    open_issues_count: 1,
    size: 500,
    pushed_at: '2026-08-20T12:00:00.000Z',
    updated_at: '2026-08-20T12:00:00.000Z',
    created_at: '2026-01-10T12:00:00.000Z',
    default_branch: 'main',
    topics: ['react', 'logistics', 'dashboard'],
    license: { name: 'MIT License', spdx_id: 'MIT' },
    owner: { login: 'developer' },
    ...overrides,
  }
}

const completeUser: GitHubUser = {
  login: 'developer',
  avatar_url: 'https://avatars.githubusercontent.com/u/1',
  html_url: 'https://github.com/developer',
  name: 'Developer Name',
  bio: 'Product-minded software engineer',
  blog: 'https://developer.example.com',
  location: 'Berlin',
  public_repos: 12,
  followers: 5,
  following: 3,
  created_at: '2020-01-01T00:00:00.000Z',
}

describe('repository scoring', () => {
  it('awards 100 points when every visible signal is present', () => {
    const audit = auditRepository(repository(), { hasReadme: true, hasWorkflow: true }, NOW)

    expect(audit.score).toBe(100)
    expect(audit.signals.every((signal) => signal.status === 'pass')).toBe(true)
  })

  it('uses partial credit for a short description, sparse topics, older work, and small projects', () => {
    const audit = auditRepository(
      repository({
        description: 'Small tool',
        homepage: null,
        topics: ['cli'],
        pushed_at: '2025-12-01T12:00:00.000Z',
        size: 12,
      }),
      { hasReadme: true, hasWorkflow: false },
      NOW,
    )

    expect(audit.score).toBe(57)
    expect(audit.signals.find((signal) => signal.id === 'description')?.status).toBe('partial')
    expect(audit.signals.find((signal) => signal.id === 'recency')?.status).toBe('partial')
  })

  it('ranks stronger repositories before popular but weaker ones', () => {
    const strong = auditRepository(repository({ id: 1, name: 'strong', stargazers_count: 0 }), {
      hasReadme: true,
      hasWorkflow: true,
    }, NOW)
    const popular = auditRepository(
      repository({ id: 2, name: 'popular', stargazers_count: 500, homepage: null }),
      { hasReadme: false, hasWorkflow: false },
      NOW,
    )

    expect(getPinCandidates([popular, strong])[0].repository.name).toBe('strong')
  })
})

describe('portfolio scoring and recommendations', () => {
  it('gives a complete profile full profile points', () => {
    expect(getProfileScore(completeUser)).toBe(100)
  })

  it('combines repository evidence and profile completeness', () => {
    const audit = auditRepository(repository(), { hasReadme: true, hasWorkflow: true }, NOW)
    expect(getPortfolioScore(completeUser, [audit])).toBe(100)
  })

  it('turns missing evidence into a short, non-duplicated action list', () => {
    const incompleteUser = { ...completeUser, blog: '' }
    const audit = auditRepository(
      repository({ description: null, homepage: null, license: null, topics: [] }),
      { hasReadme: false, hasWorkflow: false },
      NOW,
    )
    const recommendations = getRecommendations(incompleteUser, [audit])

    expect(recommendations).toHaveLength(6)
    expect(recommendations[0].title).toBe('Add a portfolio or contact link')
    expect(new Set(recommendations.map((item) => item.title)).size).toBe(recommendations.length)
  })
})
