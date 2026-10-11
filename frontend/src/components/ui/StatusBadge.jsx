/**
 * StatusBadge — semantic status pill for applications and candidates
 *
 * Props:
 *   status {string} — one of the known statuses, or custom
 */
const statusStyles = {
  'Final Round':   'bg-blue-50 text-primary border border-blue-200/90',
  'Shortlisted':   'bg-blue-50 text-primary border border-blue-200/90 font-bold',
  'Interviewing':  'bg-purple-50 text-purple-700 border border-purple-200/90',
  'Under Review':  'bg-amber-50 text-amber-800 border border-amber-200/90',
  'HM Screen':     'bg-purple-50 text-purple-700 border border-purple-200/90',
  'HM Screen • Done': 'bg-purple-50 text-purple-700 border border-purple-200/90',
  'Applied':       'bg-surface-container-low text-secondary border border-outline-variant/70',
  'Rejected':      'bg-red-50 text-red-700 border border-red-200/90',
  'Withdrawn':     'bg-surface-container text-on-surface-variant border border-outline-variant/60',
  'Offer':         'bg-emerald-50 text-emerald-700 border border-emerald-200/90 font-bold',
  'Interview':     'bg-purple-50 text-purple-700 border border-purple-200/90',
  'Live':          'bg-emerald-50 text-emerald-700 border border-emerald-200/90',
}

export default function StatusBadge({ status, className = '' }) {
  const style = statusStyles[status] ?? 'bg-surface-container text-on-surface-variant border border-outline-variant/60'

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-md text-[11px] font-semibold tracking-tight shadow-subtle ${style} ${className}`}
    >
      {status}
    </span>
  )
}
