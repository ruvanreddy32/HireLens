/**
 * SectionHeader — title + subtitle + optional right action
 *
 * Props:
 *   title    {string}
 *   subtitle {string}
 *   right    {ReactNode}  optional right-aligned slot
 */
export default function SectionHeader({ title, subtitle, right }) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <h2 className="text-base font-semibold text-on-surface">{title}</h2>
        {subtitle && (
          <p className="text-xs text-on-surface-variant font-medium mt-0.5">{subtitle}</p>
        )}
      </div>
      {right && <div className="shrink-0">{right}</div>}
    </div>
  )
}
