import {
  ArrowUpRight,
  Check,
  CircleMinus,
  Clock3,
  Code2,
  Star,
  X,
} from 'lucide-react'
import type { AuditSignal, RepositoryAudit } from '../types'
import { formatRelativeDate, getScoreLabel } from '../lib/scoring'

const FEATURED_SIGNALS = ['readme', 'workflow', 'license', 'homepage']

function SignalIcon({ signal }: { signal: AuditSignal }) {
  if (signal.status === 'pass') return <Check aria-hidden="true" />
  if (signal.status === 'partial') return <CircleMinus aria-hidden="true" />
  return <X aria-hidden="true" />
}

interface RepositoryCardProps {
  audit: RepositoryAudit
  rank: number
}

export function RepositoryCard({ audit, rank }: RepositoryCardProps) {
  const { repository, score, signals } = audit
  const featuredSignals = signals.filter((signal) => FEATURED_SIGNALS.includes(signal.id))

  return (
    <article className="repo-card">
      <div className="repo-card__topline">
        <span className="eyebrow">Pin candidate {String(rank).padStart(2, '0')}</span>
        <span className="repo-card__score" aria-label={`Repository score ${score} out of 100`}>
          <strong>{score}</strong>/100
        </span>
      </div>

      <div>
        <h3>
          <a href={repository.html_url} target="_blank" rel="noreferrer">
            {repository.name}
            <ArrowUpRight aria-hidden="true" />
          </a>
        </h3>
        <p className="repo-card__verdict">{getScoreLabel(score)}</p>
      </div>

      <p className={`repo-card__description${repository.description ? '' : ' is-missing'}`}>
        {repository.description || 'No description yet — the project needs a sharper first sentence.'}
      </p>

      <dl className="repo-card__facts">
        <div>
          <dt className="sr-only">Primary language</dt>
          <dd>
            <Code2 aria-hidden="true" /> {repository.language || 'Mixed'}
          </dd>
        </div>
        <div>
          <dt className="sr-only">Stars</dt>
          <dd>
            <Star aria-hidden="true" /> {repository.stargazers_count}
          </dd>
        </div>
        <div>
          <dt className="sr-only">Last push</dt>
          <dd>
            <Clock3 aria-hidden="true" /> {formatRelativeDate(repository.pushed_at)}
          </dd>
        </div>
      </dl>

      <ul className="signal-list" aria-label="Key repository signals">
        {featuredSignals.map((signal) => (
          <li key={signal.id} className={`signal signal--${signal.status}`} title={signal.detail}>
            <SignalIcon signal={signal} />
            <span>{signal.label}</span>
          </li>
        ))}
      </ul>

      {repository.topics.length > 0 && (
        <ul className="topic-list" aria-label="Repository topics">
          {repository.topics.slice(0, 4).map((topic) => (
            <li key={topic}>{topic}</li>
          ))}
        </ul>
      )}
    </article>
  )
}
