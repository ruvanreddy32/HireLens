/**
 * Card — standard white card container matching Stitch design
 *
 * Props:
 *   children  {ReactNode}
 *   className {string}    additional classes
 *   padding   {boolean}   apply default padding (default: true)
 */
export default function Card({ children, className = '', padding = true }) {
  return (
    <div
      className={`bg-surface-container-lowest rounded-2xl border border-outline-variant/70 shadow-card transition-all duration-200 ${padding ? 'p-4 sm:p-5' : ''} ${className}`}
    >
      {children}
    </div>
  )
}
