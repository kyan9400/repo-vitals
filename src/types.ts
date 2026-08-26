export interface GitHubUser {
  login: string
  avatar_url: string
  html_url: string
  name: string | null
  bio: string | null
  blog: string
  location: string | null
  public_repos: number
  followers: number
  following: number
  created_at: string
}

export interface GitHubRepository {
  id: number
  name: string
  full_name: string
  html_url: string
  description: string | null
  homepage: string | null
  language: string | null
  fork: boolean
  archived: boolean
  disabled: boolean
  stargazers_count: number
  forks_count: number
  open_issues_count: number
  size: number
  pushed_at: string
  updated_at: string
  created_at: string
  default_branch: string
  topics: string[]
  license: {
    name: string
    spdx_id: string
  } | null
  owner: {
    login: string
  }
}

export type SignalStatus = 'pass' | 'partial' | 'fail'

export interface AuditSignal {
  id: string
  label: string
  status: SignalStatus
  earned: number
  maximum: number
  detail: string
}

export interface RepositoryAudit {
  repository: GitHubRepository
  score: number
  signals: AuditSignal[]
}

export interface Recommendation {
  title: string
  detail: string
  repository?: GitHubRepository
  priority: 'high' | 'medium' | 'low'
}

export interface RateLimit {
  remaining: number | null
  limit: number | null
  resetAt: string | null
}

export interface AuditResult {
  user: GitHubUser
  repositories: GitHubRepository[]
  audits: RepositoryAudit[]
  generatedAt: string
  rateLimit: RateLimit
}
