interface ScoreRingProps {
  score: number
  label: string
  size?: 'large' | 'small'
}

export function ScoreRing({ score, label, size = 'large' }: ScoreRingProps) {
  const normalizedScore = Math.min(100, Math.max(0, score))

  return (
    <div className={`score-ring score-ring--${size}`} role="img" aria-label={`${score} out of 100: ${label}`}>
      <svg viewBox="0 0 120 120" aria-hidden="true">
        <circle className="score-ring__track" cx="60" cy="60" r="52" pathLength="100" />
        <circle
          className="score-ring__value"
          cx="60"
          cy="60"
          r="52"
          pathLength="100"
          strokeDasharray="100"
          strokeDashoffset={100 - normalizedScore}
        />
      </svg>
      <span className="score-ring__number">{score}</span>
      <span className="score-ring__unit">/100</span>
    </div>
  )
}
