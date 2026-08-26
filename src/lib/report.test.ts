import { describe, expect, it } from 'vitest'
import type { AuditResult } from '../types'
import { buildMarkdownReport, reportFilename } from './report'

const result: AuditResult = {
  user: {
    login: 'Hassan-AK',
    avatar_url: '',
    html_url: 'https://github.com/Hassan-AK',
    name: 'Hassan',
    bio: 'Developer',
    blog: 'https://example.com',
    location: 'Moscow',
    public_repos: 8,
    followers: 3,
    following: 4,
    created_at: '2021-01-01T00:00:00Z',
  },
  repositories: [],
  audits: [
    {
      repository: {
        id: 1,
        name: 'useful-tool',
        full_name: 'Hassan-AK/useful-tool',
        html_url: 'https://github.com/Hassan-AK/useful-tool',
        description: 'A useful developer tool with a clear outcome.',
        homepage: null,
        language: 'TypeScript',
        fork: false,
        archived: false,
        disabled: false,
        stargazers_count: 0,
        forks_count: 0,
        open_issues_count: 0,
        size: 500,
        pushed_at: '2026-08-01T00:00:00Z',
        updated_at: '2026-08-01T00:00:00Z',
        created_at: '2026-01-01T00:00:00Z',
        default_branch: 'main',
        topics: ['typescript', 'developer-tools', 'github'],
        license: { name: 'MIT', spdx_id: 'MIT' },
        owner: { login: 'Hassan-AK' },
      },
      score: 85,
      signals: [
        { id: 'readme', label: 'README', status: 'pass', earned: 20, maximum: 20, detail: '' },
        { id: 'homepage', label: 'Live link', status: 'fail', earned: 0, maximum: 10, detail: '' },
      ],
    },
  ],
  generatedAt: '2026-08-26T08:00:00Z',
  rateLimit: { remaining: 40, limit: 60, resetAt: null },
}

describe('portable reports', () => {
  it('builds a deterministic Markdown summary with evidence and actions', () => {
    const report = buildMarkdownReport(result)

    expect(report).toContain('# RepoVitals report for @Hassan-AK')
    expect(report).toContain('[useful-tool](https://github.com/Hassan-AK/useful-tool)')
    expect(report).toContain('Show the result')
    expect(report).toContain('Live link')
  })

  it('creates filesystem-friendly filenames', () => {
    expect(reportFilename(result, 'md')).toBe('hassan-ak-repo-vitals.md')
    expect(reportFilename(result, 'json')).toBe('hassan-ak-repo-vitals.json')
  })
})
