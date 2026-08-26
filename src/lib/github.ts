import type { AuditResult, GitHubRepository, GitHubUser, RateLimit } from '../types'
import { auditRepository } from './scoring'

const API_ROOT = 'https://api.github.com'
const CACHE_VERSION = 1
const CACHE_TTL = 15 * 60 * 1000
const MAX_AUDITED_REPOSITORIES = 12
const MAX_REPOSITORY_PAGES = 3
const activeAudits = new Map<string, Promise<AuditResult>>()

interface CachedAudit {
  version: number
  expiresAt: number
  result: AuditResult
}

interface GitTree {
  tree: Array<{
    path: string
    type: 'blob' | 'tree' | 'commit'
  }>
  truncated: boolean
}

export class GitHubApiError extends Error {
  status: number
  resetAt: string | null

  constructor(message: string, status: number, resetAt: string | null = null) {
    super(message)
    this.name = 'GitHubApiError'
    this.status = status
    this.resetAt = resetAt
  }
}

function parseRateLimit(response: Response): RateLimit {
  const remaining = response.headers.get('x-ratelimit-remaining')
  const limit = response.headers.get('x-ratelimit-limit')
  const reset = response.headers.get('x-ratelimit-reset')

  return {
    remaining: remaining ? Number(remaining) : null,
    limit: limit ? Number(limit) : null,
    resetAt: reset ? new Date(Number(reset) * 1000).toISOString() : null,
  }
}

async function fetchJson<T>(path: string): Promise<{ data: T; response: Response }> {
  const response = await fetch(`${API_ROOT}${path}`, {
    headers: {
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
  })

  if (!response.ok) {
    const rateLimit = parseRateLimit(response)
    let message = response.status === 404 ? 'That GitHub user could not be found.' : 'GitHub could not complete the audit.'

    try {
      const body = (await response.json()) as { message?: string }
      if (response.status !== 404 && body.message) message = body.message
    } catch {
      // The status-specific fallback above is enough when GitHub returns no JSON.
    }

    throw new GitHubApiError(message, response.status, rateLimit.resetAt)
  }

  return { data: (await response.json()) as T, response }
}

async function inspectRepository(repository: GitHubRepository): Promise<{
  hasReadme: boolean
  hasWorkflow: boolean
}> {
  const owner = encodeURIComponent(repository.owner.login)
  const name = encodeURIComponent(repository.name)
  const branch = encodeURIComponent(repository.default_branch)

  try {
    const { data } = await fetchJson<GitTree>(
      `/repos/${owner}/${name}/git/trees/${branch}?recursive=1`,
    )
    const filePaths = data.tree.filter((item) => item.type === 'blob').map((item) => item.path)

    return {
      hasReadme: filePaths.some((path) => /^readme(?:\.[^/]+)?$/i.test(path)),
      hasWorkflow: filePaths.some((path) => /^\.github\/workflows\/[^/]+\.ya?ml$/i.test(path)),
    }
  } catch (error) {
    if (error instanceof GitHubApiError && (error.status === 404 || error.status === 409)) {
      return { hasReadme: false, hasWorkflow: false }
    }
    throw error
  }
}

function cacheKey(username: string): string {
  return `repo-vitals:${CACHE_VERSION}:${username.toLowerCase()}`
}

function readCache(username: string): AuditResult | null {
  try {
    const raw = localStorage.getItem(cacheKey(username))
    if (!raw) return null
    const cached = JSON.parse(raw) as CachedAudit
    if (cached.version !== CACHE_VERSION || cached.expiresAt <= Date.now()) return null
    return cached.result
  } catch {
    return null
  }
}

function writeCache(username: string, result: AuditResult): void {
  try {
    const cached: CachedAudit = {
      version: CACHE_VERSION,
      expiresAt: Date.now() + CACHE_TTL,
      result,
    }
    localStorage.setItem(cacheKey(username), JSON.stringify(cached))
  } catch {
    // The audit still works when private browsing blocks local storage.
  }
}

export function isValidGitHubUsername(username: string): boolean {
  return /^(?!-)[a-z\d-]{1,39}(?<!-)$/i.test(username)
}

async function performAudit(
  username: string,
  options: { force?: boolean } = {},
): Promise<AuditResult> {
  const normalizedUsername = username.trim()
  if (!isValidGitHubUsername(normalizedUsername)) {
    throw new GitHubApiError('Enter a valid GitHub username.', 400)
  }

  if (!options.force) {
    const cached = readCache(normalizedUsername)
    if (cached) return cached
  }

  const userRequest = fetchJson<GitHubUser>(`/users/${encodeURIComponent(normalizedUsername)}`)
  const firstPageRequest = fetchJson<GitHubRepository[]>(
    `/users/${encodeURIComponent(normalizedUsername)}/repos?per_page=100&page=1&sort=pushed`,
  )
  const [{ data: user, response: userResponse }, firstPage] = await Promise.all([
    userRequest,
    firstPageRequest,
  ])

  const pageCount = Math.min(MAX_REPOSITORY_PAGES, Math.ceil(user.public_repos / 100))
  const additionalPages =
    pageCount > 1
      ? await Promise.all(
          Array.from({ length: pageCount - 1 }, (_, index) =>
            fetchJson<GitHubRepository[]>(
              `/users/${encodeURIComponent(normalizedUsername)}/repos?per_page=100&page=${index + 2}&sort=pushed`,
            ),
          ),
        )
      : []

  const repositories = [firstPage.data, ...additionalPages.map((page) => page.data)].flat()
  const candidates = repositories
    .filter((repository) => !repository.fork && !repository.archived && !repository.disabled)
    .sort(
      (left, right) =>
        new Date(right.pushed_at).getTime() - new Date(left.pushed_at).getTime(),
    )
    .slice(0, MAX_AUDITED_REPOSITORIES)

  const audits = await Promise.all(
    candidates.map(async (repository) => {
      const evidence = await inspectRepository(repository)
      return auditRepository(repository, evidence)
    }),
  )

  const result: AuditResult = {
    user,
    repositories,
    audits,
    generatedAt: new Date().toISOString(),
    rateLimit: parseRateLimit(userResponse),
  }

  writeCache(normalizedUsername, result)
  return result
}

export async function auditGitHubAccount(
  username: string,
  options: { force?: boolean } = {},
): Promise<AuditResult> {
  const key = username.trim().toLowerCase()
  if (!options.force) {
    const activeAudit = activeAudits.get(key)
    if (activeAudit) return activeAudit
  }

  const request = performAudit(username, options)
  if (!options.force) activeAudits.set(key, request)

  try {
    return await request
  } finally {
    if (activeAudits.get(key) === request) activeAudits.delete(key)
  }
}
