import type { AuditResult } from '../types'
import {
  getPinCandidates,
  getPortfolioScore,
  getRecommendations,
  getScoreLabel,
} from './scoring'

function escapeCell(value: string): string {
  return value.replaceAll('|', '\\|').replaceAll('\n', ' ')
}

export function reportFilename(result: AuditResult, extension: 'md' | 'json'): string {
  return `${result.user.login.toLowerCase()}-repo-vitals.${extension}`
}

export function buildMarkdownReport(result: AuditResult): string {
  const score = getPortfolioScore(result.user, result.audits)
  const candidates = getPinCandidates(result.audits)
  const recommendations = getRecommendations(result.user, result.audits)
  const audited = [...result.audits].sort((left, right) => right.score - left.score)

  const lines = [
    `# RepoVitals report for @${result.user.login}`,
    '',
    `**Portfolio score:** ${score}/100 — ${getScoreLabel(score)}`,
    `**Generated:** ${new Date(result.generatedAt).toISOString()}`,
    '',
    '## Recommended showcase',
    '',
  ]

  if (candidates.length === 0) {
    lines.push('No active original repositories were available to rank.')
  } else {
    for (const [index, audit] of candidates.entries()) {
      lines.push(
        `${index + 1}. [${audit.repository.name}](${audit.repository.html_url}) — ${audit.score}/100`,
      )
    }
  }

  lines.push('', '## Highest-leverage actions', '')
  if (recommendations.length === 0) {
    lines.push('Every measured signal is covered by the audited work.')
  } else {
    for (const recommendation of recommendations) {
      lines.push(`- **${recommendation.title}** (${recommendation.priority}) — ${recommendation.detail}`)
    }
  }

  lines.push(
    '',
    '## Repository evidence',
    '',
    '| Repository | Score | Missing signals |',
    '|---|---:|---|',
  )
  for (const audit of audited) {
    const missing = audit.signals
      .filter((signal) => signal.status === 'fail')
      .map((signal) => signal.label)
      .join(', ')
    lines.push(
      `| [${escapeCell(audit.repository.name)}](${audit.repository.html_url}) | ${audit.score}/100 | ${escapeCell(missing || 'None')} |`,
    )
  }

  lines.push('', '_Generated from public GitHub data by RepoVitals._', '')
  return lines.join('\n')
}
