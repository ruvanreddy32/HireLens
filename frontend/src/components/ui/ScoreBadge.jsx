/**
 * ScoreBadge — match percentage pill for job cards
 *
 * Props:
 *   score {number} 0–100
 */
export default function ScoreBadge({ score }) {
  const style =
    score >= 90
      ? 'bg-blue-50 text-primary'
      : score >= 75
      ? 'bg-surface-container text-on-surface-variant'
      : 'bg-surface-container-low text-on-surface-variant'

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold shrink-0 ${style}`}
    >
      {score}% Match
    </span>
  )
}
