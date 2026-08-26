import type {
  AuditSignal,
  GitHubRepository,
  GitHubUser,
  Recommendation,
  RepositoryAudit,
} from '../types'

const DAY_IN_MS = 86_400_000

function signal(
  id: string,
  label: string,
  earned: number,
  maximum: number,
  detail: string,
): AuditSignal {
  const status = earned === maximum ? 'pass' : earned > 0 ? 'partial' : 'fail'
  return { id, label, earned, maximum, detail, status }
}

export function daysSince(date: string, now = new Date()): number {
  return Math.max(0, Math.floor((now.getTime() - new Date(date).getTime()) / DAY_IN_MS))
}

export function auditRepository(
  repository: GitHubRepository,
  evidence: { hasReadme: boolean; hasWorkflow: boolean },
  now = new Date(),
): RepositoryAudit {
  const descriptionLength = repository.description?.trim().length ?? 0
  const topicCount = repository.topics?.length ?? 0
  const ageInDays = daysSince(repository.pushed_at, now)

  const signals: AuditSignal[] = [
    signal(
      'readme',
      'README',
      evidence.hasReadme ? 20 : 0,
      20,
      evidence.hasReadme ? 'Project documentation is present.' : 'No repository README found.',
    ),
    signal(
      'workflow',
      'Automated checks',
      evidence.hasWorkflow ? 15 : 0,
      15,
      evidence.hasWorkflow ? 'GitHub Actions workflow detected.' : 'No GitHub Actions workflow detected.',
    ),
    signal(
      'description',
      'Description',
      descriptionLength >= 40 ? 10 : descriptionLength > 0 ? 5 : 0,
      10,
      descriptionLength >= 40
        ? 'The repository purpose is clear at a glance.'
        : descriptionLength > 0
          ? 'The description could explain the outcome more clearly.'
          : 'The repository has no description.',
    ),
    signal(
      'license',
      'License',
      repository.license ? 10 : 0,
      10,
      repository.license
        ? `${repository.license.spdx_id} license is declared.`
        : 'No license is declared.',
    ),
    signal(
      'homepage',
      'Live link',
      repository.homepage?.trim() ? 10 : 0,
      10,
      repository.homepage?.trim()
        ? 'A project or documentation link is available.'
        : 'No live demo or documentation link is set.',
    ),
    signal(
      'topics',
      'Topics',
      topicCount >= 3 ? 10 : topicCount > 0 ? 5 : 0,
      10,
      topicCount >= 3
        ? `${topicCount} searchable topics are set.`
        : topicCount > 0
          ? 'Add a few more specific topics for discovery.'
          : 'No repository topics are set.',
    ),
    signal(
      'recency',
      'Recency',
      ageInDays <= 180 ? 10 : ageInDays <= 365 ? 5 : 0,
      10,
      ageInDays <= 180
        ? 'Updated within the last six months.'
        : ageInDays <= 365
          ? 'Updated within the last year.'
          : 'No push in more than a year.',
    ),
    signal(
      'original',
      'Original work',
      repository.fork ? 0 : 5,
      5,
      repository.fork ? 'This repository is a fork.' : 'This is an original repository.',
    ),
    signal(
      'active',
      'Active',
      repository.archived || repository.disabled ? 0 : 5,
      5,
      repository.archived || repository.disabled
        ? 'The repository is archived or disabled.'
        : 'The repository is open for continued work.',
    ),
    signal(
      'substance',
      'Project depth',
      repository.size >= 100 ? 5 : repository.size > 0 ? 2 : 0,
      5,
      repository.size >= 100
        ? 'Repository size suggests a substantive implementation.'
        : 'The implementation appears very small.',
    ),
  ]

  return {
    repository,
    signals,
    score: signals.reduce((total, item) => total + item.earned, 0),
  }
}

export function getProfileScore(user: GitHubUser): number {
  const completeFields = [
    Boolean(user.name?.trim()),
    Boolean(user.bio?.trim()),
    Boolean(user.blog?.trim()),
    Boolean(user.location?.trim()),
    user.public_repos >= 4,
  ].filter(Boolean).length

  return completeFields * 20
}

export function getPortfolioScore(user: GitHubUser, audits: RepositoryAudit[]): number {
  if (audits.length === 0) return Math.round(getProfileScore(user) * 0.25)

  const leadingScores = [...audits]
    .sort((left, right) => right.score - left.score)
    .slice(0, 6)
    .map((audit) => audit.score)
  const repositoryScore =
    leadingScores.reduce((total, score) => total + score, 0) / leadingScores.length

  return Math.round(repositoryScore * 0.75 + getProfileScore(user) * 0.25)
}

export function getPinCandidates(audits: RepositoryAudit[]): RepositoryAudit[] {
  return [...audits]
    .sort((left, right) => {
      if (right.score !== left.score) return right.score - left.score
      if (right.repository.stargazers_count !== left.repository.stargazers_count) {
        return right.repository.stargazers_count - left.repository.stargazers_count
      }
      return new Date(right.repository.pushed_at).getTime() - new Date(left.repository.pushed_at).getTime()
    })
    .slice(0, 6)
}

export function getRecommendations(
  user: GitHubUser,
  audits: RepositoryAudit[],
): Recommendation[] {
  const recommendations: Recommendation[] = []
  const candidates = getPinCandidates(audits)

  if (!user.bio?.trim()) {
    recommendations.push({
      title: 'Write a focused profile bio',
      detail: 'State your role, strongest technical area, and the kind of problems you solve.',
      priority: 'high',
    })
  }

  if (!user.blog?.trim()) {
    recommendations.push({
      title: 'Add a portfolio or contact link',
      detail: 'Give hiring teams one direct path from your profile to a live portfolio or contact page.',
      priority: 'medium',
    })
  }

  const actionMap: Record<
    string,
    { title: string; detail: (repository: GitHubRepository) => string; priority: Recommendation['priority'] }
  > = {
    readme: {
      title: 'Document the project',
      detail: (repository) =>
        `Add a concise README to ${repository.name} with the problem, setup, architecture, and proof it works.`,
      priority: 'high',
    },
    workflow: {
      title: 'Make quality visible',
      detail: (repository) =>
        `Add an automated test or build workflow to ${repository.name} so every change is verified.`,
      priority: 'high',
    },
    description: {
      title: 'Sharpen the first impression',
      detail: (repository) =>
        `Rewrite ${repository.name}'s description around the user outcome, not just the technology.`,
      priority: 'medium',
    },
    license: {
      title: 'Clarify reuse',
      detail: (repository) => `Choose and add an appropriate license to ${repository.name}.`,
      priority: 'medium',
    },
    homepage: {
      title: 'Show the result',
      detail: (repository) =>
        `Add a live demo, package page, or documentation link to ${repository.name}.`,
      priority: 'medium',
    },
    topics: {
      title: 'Improve discovery',
      detail: (repository) =>
        `Add three to five specific GitHub topics to ${repository.name}.`,
      priority: 'low',
    },
  }

  for (const audit of candidates) {
    for (const item of audit.signals) {
      if (recommendations.length >= 6) break
      const action = actionMap[item.id]
      if (item.status === 'pass' || !action) continue
      if (recommendations.some((recommendation) => recommendation.title === action.title)) continue

      recommendations.push({
        title: action.title,
        detail: action.detail(audit.repository),
        repository: audit.repository,
        priority: action.priority,
      })
    }
  }

  return recommendations.slice(0, 6)
}

export function getScoreLabel(score: number): string {
  if (score >= 85) return 'Interview-ready'
  if (score >= 70) return 'Strong foundation'
  if (score >= 50) return 'Promising, uneven'
  return 'Needs a focused pass'
}

export function formatRelativeDate(date: string, now = new Date()): string {
  const days = daysSince(date, now)
  if (days === 0) return 'today'
  if (days === 1) return 'yesterday'
  if (days < 30) return `${days} days ago`
  if (days < 365) return `${Math.floor(days / 30)} months ago`
  const years = Math.floor(days / 365)
  return `${years} ${years === 1 ? 'year' : 'years'} ago`
}
