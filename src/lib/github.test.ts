import { beforeEach, describe, expect, it, vi } from 'vitest'
import { auditGitHubAccount, isValidGitHubUsername } from './github'

beforeEach(() => {
  localStorage.clear()
  vi.restoreAllMocks()
})

describe('GitHub username validation', () => {
  it.each(['octocat', 'github-actions', 'a', 'User123'])('accepts %s', (username) => {
    expect(isValidGitHubUsername(username)).toBe(true)
  })

  it.each(['', '-octocat', 'octocat-', 'two words', 'name_with_underscore', 'a'.repeat(40)])(
    'rejects %s',
    (username) => {
      expect(isValidGitHubUsername(username)).toBe(false)
    },
  )
})

describe('GitHub audit client', () => {
  it('uses one file-tree request per repository to detect documentation and CI', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = String(input)
      const headers = {
        'content-type': 'application/json',
        'x-ratelimit-remaining': '57',
        'x-ratelimit-limit': '60',
        'x-ratelimit-reset': '1787716800',
      }

      if (url.includes('/users/portfolio-test/repos')) {
        return new Response(
          JSON.stringify([
            {
              id: 1,
              name: 'proof-of-work',
              full_name: 'portfolio-test/proof-of-work',
              html_url: 'https://github.com/portfolio-test/proof-of-work',
              description: 'A complete example project with visible engineering quality signals.',
              homepage: 'https://portfolio-test.example.com',
              language: 'TypeScript',
              fork: false,
              archived: false,
              disabled: false,
              stargazers_count: 3,
              forks_count: 0,
              open_issues_count: 0,
              size: 300,
              pushed_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
              created_at: '2026-01-01T00:00:00.000Z',
              default_branch: 'main',
              topics: ['react', 'typescript', 'portfolio'],
              license: { name: 'MIT License', spdx_id: 'MIT' },
              owner: { login: 'portfolio-test' },
            },
          ]),
          { status: 200, headers },
        )
      }

      if (url.endsWith('/users/portfolio-test')) {
        return new Response(
          JSON.stringify({
            login: 'portfolio-test',
            avatar_url: 'https://avatars.githubusercontent.com/u/1',
            html_url: 'https://github.com/portfolio-test',
            name: 'Portfolio Test',
            bio: 'Developer',
            blog: 'https://portfolio-test.example.com',
            location: 'Remote',
            public_repos: 1,
            followers: 0,
            following: 0,
            created_at: '2026-01-01T00:00:00.000Z',
          }),
          { status: 200, headers },
        )
      }

      if (url.includes('/git/trees/main?recursive=1')) {
        return new Response(
          JSON.stringify({
            truncated: false,
            tree: [
              { path: 'README.md', type: 'blob' },
              { path: '.github/workflows/ci.yml', type: 'blob' },
              { path: 'src/main.tsx', type: 'blob' },
            ],
          }),
          { status: 200, headers },
        )
      }

      return new Response(JSON.stringify({ message: 'Not found' }), { status: 404, headers })
    })

    const result = await auditGitHubAccount('portfolio-test', { force: true })

    expect(result.audits).toHaveLength(1)
    expect(result.audits[0].score).toBe(100)
    expect(fetchMock).toHaveBeenCalledTimes(3)
    expect(fetchMock.mock.calls.some(([url]) => String(url).includes('/git/trees/main?recursive=1'))).toBe(true)
  })
})
