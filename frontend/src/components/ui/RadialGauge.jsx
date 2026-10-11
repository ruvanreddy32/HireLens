/**
 * RadialGauge — SVG circular progress indicator
 *
 * size="lg": large hero gauge (w-32), uses <circle> element
 * size="sm": small card gauge (w-12), uses <path> element
 *
 * Props:
 *   score  {number}  0–100
 *   size   {"lg"|"sm"}
 *   color  {string}  Tailwind text color class (default: "text-primary")
 *   trackColor {string} Tailwind text color class for track
 */
export default function RadialGauge({
  score,
  size = 'sm',
  color = 'text-primary',
  trackColor = 'text-surface-container',
}) {
  if (size === 'lg' || size === 'md') {
    const isMd = size === 'md'
    const radius = isMd ? 34 : 50
    const viewBoxSize = isMd ? 80 : 120
    const center = viewBoxSize / 2
    const strokeW = isMd ? 7 : 10
    const circumference = 2 * Math.PI * radius
    const dashOffset = circumference * (1 - score / 100)

    return (
      <div className={`relative ${isMd ? 'w-20 h-20' : 'w-32 h-32'} flex items-center justify-center flex-shrink-0`}>
        <svg
          className="w-full h-full -rotate-90"
          viewBox={`0 0 ${viewBoxSize} ${viewBoxSize}`}
        >
          <circle
            className={trackColor}
            cx={center} cy={center} r={radius}
            fill="transparent"
            stroke="currentColor"
            strokeWidth={strokeW}
            opacity={0.35}
          />
          <circle
            className={color}
            cx={center} cy={center} r={radius}
            fill="transparent"
            stroke="currentColor"
            strokeWidth={strokeW}
            strokeDasharray={circumference}
            strokeDashoffset={dashOffset}
            strokeLinecap="round"
            style={{ transition: 'stroke-dashoffset 0.8s ease' }}
          />
        </svg>
        <div className="absolute flex flex-col items-center justify-center text-center">
          <span className={`${isMd ? 'text-xl' : 'text-3xl'} font-bold tracking-tight text-on-surface leading-none`}>
            {score}
          </span>
          <span className={`${isMd ? 'text-[9px]' : 'text-[11px]'} uppercase font-bold text-primary mt-0.5`}>
            {isMd ? '%' : '/ 100'}
          </span>
        </div>
      </div>
    )
  }

  // Small variant: path element, viewBox 36x36, stroke-dasharray trick
  const dashArray = `${score}, 100`

  return (
    <div className="relative w-12 h-12 flex items-center justify-center flex-shrink-0">
      <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
        <path
          className={trackColor}
          d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
          fill="none"
          stroke="currentColor"
          strokeWidth="3.5"
        />
        <path
          className={color}
          d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
          fill="none"
          stroke="currentColor"
          strokeDasharray={dashArray}
          strokeLinecap="round"
          strokeWidth="3.5"
          style={{ transition: 'stroke-dasharray 0.8s ease' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={`text-[13px] leading-none font-bold ${color}`}>
          {score}%
        </span>
      </div>
    </div>
  )
}
