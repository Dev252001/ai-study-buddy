/**
 * Learnify — unique SVG brand mark.
 * A stylised open book whose pages form a spark/lightning bolt,
 * symbolising knowledge ignited by AI.
 */
export function BrandMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      {/* Left page */}
      <path
        d="M4 8C4 7.448 4.448 7 5 7H14C14.552 7 15 7.448 15 8V24C15 24 11 22.5 5 24.5C4.448 24.7 4 24.3 4 23.748V8Z"
        fill="currentColor"
        fillOpacity="0.85"
      />
      {/* Right page */}
      <path
        d="M28 8C28 7.448 27.552 7 27 7H18C17.448 7 17 7.448 17 8V24C17 24 21 22.5 27 24.5C27.552 24.7 28 24.3 28 23.748V8Z"
        fill="currentColor"
        fillOpacity="0.6"
      />
      {/* Spine */}
      <rect x="15" y="7" width="2" height="17.5" rx="1" fill="currentColor" />
      {/* Lightning spark */}
      <path
        d="M18.5 4L15.2 10H18L14.5 17L20.5 9.5H17.5L20.5 4H18.5Z"
        fill="white"
        fillOpacity="0.95"
      />
    </svg>
  )
}

/** Full wordmark — icon + text, used in the sidebar logo row */
export function BrandWordmark({
  showText = true,
  textClassName,
  iconClassName,
}: {
  showText?: boolean
  textClassName?: string
  iconClassName?: string
}) {
  return (
    <>
      <BrandMark className={iconClassName} />
      {showText && (
        <span className={textClassName}>
          Study<span style={{ opacity: 0.75 }}>Buddy</span>
          <span
            style={{
              display: 'inline-block',
              marginLeft: 3,
              fontSize: '0.65em',
              fontWeight: 800,
              letterSpacing: '-0.02em',
              verticalAlign: 'middle',
              background: 'linear-gradient(90deg, #5eead4 0%, #a78bfa 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}
          >
            AI
          </span>
        </span>
      )}
    </>
  )
}
