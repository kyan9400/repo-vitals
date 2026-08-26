import { useCallback, useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import {
  Activity,
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  CheckCircle2,
  Check,
  CircleAlert,
  Code2,
  Download,
  FileText,
  GitBranch,
  Globe2,
  MapPin,
  Link2,
  RefreshCw,
  Search,
  Workflow,
} from 'lucide-react'
import { RepositoryCard } from './components/RepositoryCard'
import { ScoreRing } from './components/ScoreRing'
import { auditGitHubAccount, GitHubApiError } from './lib/github'
import { buildMarkdownReport, reportFilename } from './lib/report'
import {
  formatRelativeDate,
  getPinCandidates,
  getPortfolioScore,
  getRecommendations,
  getScoreLabel,
} from './lib/scoring'
import type { AuditResult } from './types'

const DEFAULT_USERNAME = 'kyan9400'

function getInitialUsername(): string {
  return new URLSearchParams(window.location.search).get('user')?.trim() || DEFAULT_USERNAME
}

function readableError(error: unknown): string {
  if (error instanceof GitHubApiError) {
    if (error.status === 403 && error.resetAt) {
      return `GitHub's public API limit was reached. Try again after ${new Date(error.resetAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}.`
    }
    return error.message
  }
  return 'The audit could not be completed. Check your connection and try again.'
}

function LoadingState() {
  return (
    <section className="loading-state" aria-label="Audit in progress">
      <div className="loading-state__pulse" aria-hidden="true" />
      <div>
        <p className="eyebrow">Audit in progress</p>
        <h2>Reading the public evidence.</h2>
        <p>Checking recent original repositories for documentation, automation, and presentation.</p>
      </div>
    </section>
  )
}

function EmptyState() {
  return (
    <section className="empty-state">
      <span className="empty-state__number">01</span>
      <div>
        <p className="eyebrow">Start with a username</p>
        <h2>See your profile like a hiring team does.</h2>
        <p>
          RepoVitals reads public GitHub data only. No login, token, or repository access is required.
        </p>
      </div>
    </section>
  )
}

function Dashboard({ result, onRefresh }: { result: AuditResult; onRefresh: () => void }) {
  const [exportStatus, setExportStatus] = useState<string | null>(null)
  const portfolioScore = useMemo(
    () => getPortfolioScore(result.user, result.audits),
    [result.audits, result.user],
  )
  const candidates = useMemo(() => getPinCandidates(result.audits), [result.audits])
  const recommendations = useMemo(
    () => getRecommendations(result.user, result.audits),
    [result.audits, result.user],
  )
  const originalRepositories = result.repositories.filter((repository) => !repository.fork)
  const recentlyActive = originalRepositories.filter(
    (repository) =>
      new Date(result.generatedAt).getTime() - new Date(repository.pushed_at).getTime() <=
      365 * 86_400_000,
  )
  const totalStars = result.repositories.reduce(
    (total, repository) => total + repository.stargazers_count,
    0,
  )
  const languages = new Set(result.repositories.map((repository) => repository.language).filter(Boolean))

  function downloadReport(contents: string, filename: string, type: string) {
    const file = new Blob([contents], { type })
    const url = URL.createObjectURL(file)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = filename
    anchor.click()
    URL.revokeObjectURL(url)
    setExportStatus(`${filename} downloaded`)
  }

  async function copyShareLink() {
    try {
      const url = new URL(window.location.href)
      url.searchParams.set('user', result.user.login)
      await navigator.clipboard.writeText(url.toString())
      setExportStatus('Share link copied')
    } catch {
      setExportStatus('Copy unavailable in this browser')
    }
  }

  return (
    <main id="audit-results" className="dashboard" tabIndex={-1}>
      <section className="profile-summary" aria-labelledby="profile-heading">
        <div className="profile-summary__identity">
          <img src={result.user.avatar_url} alt="" width="88" height="88" />
          <div>
            <p className="eyebrow">Public portfolio report</p>
            <h2 id="profile-heading">{result.user.name || result.user.login}</h2>
            <p>
              @{result.user.login}
              {result.user.location && (
                <span className="location">
                  <MapPin aria-hidden="true" /> {result.user.location}
                </span>
              )}
            </p>
          </div>
        </div>
        <div className="profile-summary__actions">
          <button type="button" className="text-button" onClick={onRefresh}>
            <RefreshCw aria-hidden="true" /> Refresh data
          </button>
          <a href={result.user.html_url} target="_blank" rel="noreferrer" className="text-link">
            Open GitHub <ArrowUpRight aria-hidden="true" />
          </a>
        </div>
      </section>

      <section className="scoreboard" aria-labelledby="score-heading">
        <div className="scoreboard__intro">
          <p className="eyebrow">Portfolio health</p>
          <h2 id="score-heading">{getScoreLabel(portfolioScore)}</h2>
          <p>
            The score combines the six strongest audited repositories with profile completeness. Every
            point maps to a visible public signal.
          </p>
          <a href="#methodology" className="inline-link">
            How scoring works <ArrowRight aria-hidden="true" />
          </a>
        </div>
        <ScoreRing score={portfolioScore} label={getScoreLabel(portfolioScore)} />
        <dl className="metrics-grid">
          <div>
            <dt>Original repos</dt>
            <dd>{originalRepositories.length}</dd>
          </div>
          <div>
            <dt>Active this year</dt>
            <dd>{recentlyActive.length}</dd>
          </div>
          <div>
            <dt>Total stars</dt>
            <dd>{totalStars}</dd>
          </div>
          <div>
            <dt>Languages</dt>
            <dd>{languages.size}</dd>
          </div>
        </dl>
      </section>

      <section className="report-strip" aria-labelledby="report-heading">
        <div>
          <p className="eyebrow">Portable evidence</p>
          <h2 id="report-heading">Take the audit into your next review.</h2>
          <p>Share the live scorecard or export a durable Markdown or JSON snapshot.</p>
        </div>
        <div className="report-actions">
          <button type="button" onClick={() => void copyShareLink()}>
            {exportStatus === 'Share link copied' ? <Check aria-hidden="true" /> : <Link2 aria-hidden="true" />}
            Copy link
          </button>
          <button
            type="button"
            onClick={() =>
              downloadReport(
                buildMarkdownReport(result),
                reportFilename(result, 'md'),
                'text/markdown',
              )
            }
          >
            <FileText aria-hidden="true" /> Markdown
          </button>
          <button
            type="button"
            onClick={() =>
              downloadReport(
                `${JSON.stringify(result, null, 2)}\n`,
                reportFilename(result, 'json'),
                'application/json',
              )
            }
          >
            <Download aria-hidden="true" /> JSON
          </button>
        </div>
        <p className="report-status" aria-live="polite">{exportStatus}</p>
      </section>

      <section className="section-block" aria-labelledby="pin-heading">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Recommended showcase</p>
            <h2 id="pin-heading">The six repositories worth pinning.</h2>
          </div>
          <p>Ranked by quality signals, then stars and recency. Forks and archived work are excluded.</p>
        </div>
        {candidates.length > 0 ? (
          <div className="repo-grid">
            {candidates.map((audit, index) => (
              <RepositoryCard key={audit.repository.id} audit={audit} rank={index + 1} />
            ))}
          </div>
        ) : (
          <p className="notice">No active original repositories were available to audit.</p>
        )}
      </section>

      <section className="section-block action-section" aria-labelledby="actions-heading">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Highest-leverage work</p>
            <h2 id="actions-heading">What to improve next.</h2>
          </div>
          <p>A short queue built from missing signals in the repositories most likely to be seen.</p>
        </div>
        {recommendations.length > 0 ? (
          <ol className="action-list">
            {recommendations.map((recommendation, index) => (
              <li key={`${recommendation.title}-${index}`}>
                <span className={`priority priority--${recommendation.priority}`}>
                  {recommendation.priority}
                </span>
                <div>
                  <h3>{recommendation.title}</h3>
                  <p>{recommendation.detail}</p>
                </div>
                {recommendation.repository && (
                  <a
                    href={`${recommendation.repository.html_url}/settings`}
                    target="_blank"
                    rel="noreferrer"
                    aria-label={`Open settings for ${recommendation.repository.name}`}
                  >
                    <ArrowUpRight aria-hidden="true" />
                  </a>
                )}
              </li>
            ))}
          </ol>
        ) : (
          <p className="notice notice--success">
            <CheckCircle2 aria-hidden="true" /> The audited work covers every measured signal.
          </p>
        )}
      </section>

      <section className="section-block" aria-labelledby="all-repos-heading">
        <div className="section-heading section-heading--compact">
          <div>
            <p className="eyebrow">Evidence ledger</p>
            <h2 id="all-repos-heading">All audited repositories.</h2>
          </div>
          <p>{result.audits.length} most recently pushed, active, original repositories.</p>
        </div>
        <div className="audit-table-wrap">
          <table className="audit-table">
            <thead>
              <tr>
                <th scope="col">Repository</th>
                <th scope="col">Language</th>
                <th scope="col">Last push</th>
                <th scope="col">Missing</th>
                <th scope="col">Score</th>
              </tr>
            </thead>
            <tbody>
              {[...result.audits]
                .sort((left, right) => right.score - left.score)
                .map((audit) => (
                  <tr key={audit.repository.id}>
                    <th scope="row">
                      <a href={audit.repository.html_url} target="_blank" rel="noreferrer">
                        {audit.repository.name}
                      </a>
                    </th>
                    <td>{audit.repository.language || '—'}</td>
                    <td>{formatRelativeDate(audit.repository.pushed_at)}</td>
                    <td>{audit.signals.filter((signal) => signal.status === 'fail').length}</td>
                    <td>
                      <strong>{audit.score}</strong>/100
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </section>

      <section id="methodology" className="methodology" aria-labelledby="methodology-heading">
        <div>
          <p className="eyebrow">Methodology</p>
          <h2 id="methodology-heading">Useful signals, plain arithmetic.</h2>
        </div>
        <div className="methodology__grid">
          <article>
            <BookOpen aria-hidden="true" />
            <h3>Project clarity · 40 pts</h3>
            <p>README 20, description 10, topics 10.</p>
          </article>
          <article>
            <Workflow aria-hidden="true" />
            <h3>Engineering proof · 35 pts</h3>
            <p>Automated checks 15, license 10, project depth 5, active status 5.</p>
          </article>
          <article>
            <Globe2 aria-hidden="true" />
            <h3>Portfolio value · 25 pts</h3>
            <p>Live link 10, recency 10, original work 5.</p>
          </article>
        </div>
        <p className="methodology__note">
          The overall score is 75% the average of the six strongest repositories and 25% profile
          completeness. Popularity is shown for context but does not buy points.
        </p>
      </section>

      <p className="audit-meta">
        Audited {new Date(result.generatedAt).toLocaleString()} · Public GitHub data · Cached locally for
        15 minutes
        {result.rateLimit.remaining !== null && result.rateLimit.limit !== null
          ? ` · ${result.rateLimit.remaining}/${result.rateLimit.limit} API requests remained before repository checks`
          : ''}
      </p>
    </main>
  )
}

export default function App() {
  const initialUsername = getInitialUsername()
  const [username, setUsername] = useState(initialUsername)
  const [result, setResult] = useState<AuditResult | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const runAudit = useCallback(async (targetUsername: string, force = false) => {
    const normalized = targetUsername.trim()
    setIsLoading(true)
    setError(null)

    try {
      const audit = await auditGitHubAccount(normalized, { force })
      setResult(audit)
      setUsername(audit.user.login)
      const url = new URL(window.location.href)
      url.searchParams.set('user', audit.user.login)
      window.history.replaceState({}, '', url)
    } catch (auditError) {
      setError(readableError(auditError))
      setResult(null)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    let ignore = false

    void auditGitHubAccount(initialUsername)
      .then((audit) => {
        if (ignore) return
        setResult(audit)
        setUsername(audit.user.login)
        setError(null)
      })
      .catch((auditError: unknown) => {
        if (ignore) return
        setResult(null)
        setError(readableError(auditError))
      })
      .finally(() => {
        if (!ignore) setIsLoading(false)
      })

    return () => {
      ignore = true
    }
  }, [initialUsername])

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    void runAudit(username)
  }

  return (
    <div className="app-shell">
      <header className="site-header">
        <a className="brand" href="./" aria-label="RepoVitals home">
          <span className="brand__mark" aria-hidden="true">
            <Activity />
          </span>
          <span>RepoVitals</span>
        </a>
        <div className="header-meta">
          <span>
            <span className="status-dot" aria-hidden="true" /> Public API
          </span>
          <a href="https://github.com/kyan9400/repo-vitals" target="_blank" rel="noreferrer">
            <GitBranch aria-hidden="true" /> Source
          </a>
        </div>
      </header>

      <section className="hero" aria-labelledby="hero-heading">
        <div className="hero__copy">
          <p className="eyebrow">GitHub portfolio diagnostic</p>
          <h1 id="hero-heading">
            Your GitHub is a product. <em>Ship it like one.</em>
          </h1>
          <p className="hero__lede">
            Find the work worth pinning, expose missing proof, and leave with a practical improvement
            plan—using public data only.
          </p>
        </div>
        <form className="audit-form" onSubmit={handleSubmit}>
          <label htmlFor="github-username">GitHub username</label>
          <div className="audit-form__control">
            <span aria-hidden="true">github.com/</span>
            <input
              id="github-username"
              name="username"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              autoComplete="off"
              spellCheck="false"
              placeholder="octocat"
              maxLength={39}
              required
            />
            <button type="submit" disabled={isLoading}>
              {isLoading ? <RefreshCw className="is-spinning" aria-hidden="true" /> : <Search aria-hidden="true" />}
              {isLoading ? 'Auditing' : 'Run audit'}
            </button>
          </div>
          <p>
            No account connection. No token. Results stay in your browser.
          </p>
        </form>
      </section>

      <div className="result-region" aria-live="polite" aria-busy={isLoading}>
        {error && (
          <div className="error-banner" role="alert">
            <CircleAlert aria-hidden="true" />
            <div>
              <strong>Audit unavailable</strong>
              <p>{error}</p>
            </div>
          </div>
        )}
        {isLoading ? (
          <LoadingState />
        ) : result ? (
          <Dashboard result={result} onRefresh={() => void runAudit(result.user.login, true)} />
        ) : (
          !error && <EmptyState />
        )}
      </div>

      <footer className="site-footer">
        <div>
          <span className="brand brand--small">
            <span className="brand__mark" aria-hidden="true">
              <Activity />
            </span>
            <span>RepoVitals</span>
          </span>
          <p>Built for developers who want their public work to speak clearly.</p>
        </div>
        <nav aria-label="Footer navigation">
          <a href="#methodology">Methodology</a>
          <a href="https://docs.github.com/en/rest/rate-limit/rate-limit" target="_blank" rel="noreferrer">
            API limits
          </a>
          <a href="https://github.com/kyan9400/repo-vitals/issues" target="_blank" rel="noreferrer">
            Feedback
          </a>
        </nav>
        <span className="footer-stamp">
          <Code2 aria-hidden="true" /> Open source
        </span>
      </footer>
    </div>
  )
}
