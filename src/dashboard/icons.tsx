const strokeProps = {
  width: 20,
  height: 20,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.7,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
}

export function NavIcon({ name }: { name: string }) {
  switch (name) {
    case 'grid':
      return (
        <svg {...strokeProps}>
          <rect x="3.5" y="3.5" width="7" height="7" rx="1.5" />
          <rect x="13.5" y="3.5" width="7" height="7" rx="1.5" />
          <rect x="3.5" y="13.5" width="7" height="7" rx="1.5" />
          <rect x="13.5" y="13.5" width="7" height="7" rx="1.5" />
        </svg>
      )
    case 'users':
      return (
        <svg {...strokeProps}>
          <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="3.2" />
          <path d="M22 21v-2a3.5 3.5 0 0 0-2.5-3.3" />
          <path d="M16.5 3.8a3.2 3.2 0 0 1 0 6.2" />
        </svg>
      )
    case 'credit':
      return (
        <svg {...strokeProps}>
          <rect x="3" y="6" width="18" height="12" rx="2.5" />
          <path d="M3 10h18" />
          <path d="M12 13v3M10.5 14.5h3" />
        </svg>
      )
    case 'debit':
      return (
        <svg {...strokeProps}>
          <circle cx="12" cy="12" r="8.5" />
          <path d="M12 7.5v5l3 2" />
        </svg>
      )
    case 'cashbook':
      return (
        <svg {...strokeProps}>
          <rect x="3.5" y="5" width="17" height="14" rx="2" />
          <path d="M3.5 9h17M8 13h3M8 16h5" />
        </svg>
      )
    case 'swap':
      return (
        <svg {...strokeProps}>
          <path d="M7 7h12l-3-3" />
          <path d="M17 17H5l3 3" />
        </svg>
      )
    case 'sales':
      return (
        <svg {...strokeProps}>
          <path d="M4 19V5" />
          <path d="M4 19h16" />
          <path d="M8 15v-4" />
          <path d="M12 15V8" />
          <path d="M16 15v-6" />
        </svg>
      )
    case 'doc':
      return (
        <svg {...strokeProps}>
          <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
          <path d="M14 3v5h5M8 13h8M8 17h6" />
        </svg>
      )
    case 'ledger':
      return (
        <svg {...strokeProps}>
          <path d="M6 4h11a2 2 0 0 1 2 2v14H8a2 2 0 0 1-2-2V4Z" />
          <path d="M6 4a2 2 0 0 0-2 2v12" />
          <path d="M10 9h7M10 13h7M10 17h4" />
        </svg>
      )
    case 'pump':
      return (
        <svg {...strokeProps}>
          <path d="M4 20V7.5A2.5 2.5 0 0 1 6.5 5H12a2.5 2.5 0 0 1 2.5 2.5V20" />
          <path d="M4 20h10.5" />
          <path d="M7 9h5M7 12.5h5" />
          <path d="M14.5 10h1.8a2 2 0 0 1 2 2v5.5a1.5 1.5 0 0 0 3 0V9.5L19 7.5" />
        </svg>
      )
    case 'gear':
      return (
        <svg {...strokeProps}>
          <circle cx="12" cy="12" r="3" />
          <path d="M12 3.5v2.2M12 18.3v2.2M4.9 6.5l1.6 1.6M17.5 15.9l1.6 1.6M3.5 12h2.2M18.3 12h2.2M4.9 17.5l1.6-1.6M17.5 8.1l1.6-1.6" />
        </svg>
      )
    default:
      return null
  }
}

export function StatIcon({ name }: { name: string }) {
  const props = {
    width: 22,
    height: 22,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  }
  if (name === 'customers') {
    return (
      <svg {...props}>
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="3" />
        <path d="M22 21v-2a3.5 3.5 0 0 0-2.6-3.3M16.4 4a3 3 0 0 1 0 6" />
      </svg>
    )
  }
  if (name === 'credit') {
    return (
      <svg {...props}>
        <path d="M12 5v14M5 12h14" />
      </svg>
    )
  }
  if (name === 'debit') {
    return (
      <svg {...props}>
        <path d="M5 12h14" />
      </svg>
    )
  }
  return (
    <svg {...props}>
      <rect x="4" y="5" width="16" height="14" rx="2" />
      <path d="M8 9h8M8 13h5" />
    </svg>
  )
}

export function BottomIcon({ name }: { name: string }) {
  const props = {
    width: 22,
    height: 22,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  }
  if (name === 'home') {
    return (
      <svg {...props}>
        <path d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1v-9.5Z" />
      </svg>
    )
  }
  if (name === 'users') {
    return (
      <svg {...props}>
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="3" />
        <path d="M22 21v-2a3.5 3.5 0 0 0-2.6-3.3M16.4 4a3 3 0 0 1 0 6" />
      </svg>
    )
  }
  if (name === 'swap') {
    return (
      <svg {...props}>
        <path d="M7 7h12l-3-3" />
        <path d="M17 17H5l3 3" />
      </svg>
    )
  }
  if (name === 'doc') {
    return (
      <svg {...props}>
        <path d="M4 19V9l4-5h8l4 5v10a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1Z" />
        <path d="M8 19v-6h8v6M9 9h6" />
      </svg>
    )
  }
  return (
    <svg {...props}>
      <circle cx="5" cy="12" r="1.6" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="1.6" fill="currentColor" stroke="none" />
      <circle cx="19" cy="12" r="1.6" fill="currentColor" stroke="none" />
    </svg>
  )
}

export function CustomerMark() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M9 11a3.2 3.2 0 1 0 0-6.4A3.2 3.2 0 0 0 9 11Z" fill="#F5C518" />
      <path
        d="M9 12.5c-2.9 0-5.3 1.6-5.3 3.6V18h10.6v-1.9c0-2-2.4-3.6-5.3-3.6Z"
        fill="#F5C518"
      />
      <path d="M16.2 11a2.6 2.6 0 1 0 0-5.2 2.6 2.6 0 0 0 0 5.2Z" fill="#F5C518" opacity="0.85" />
      <path
        d="M16.3 12.7c1.9.15 3.5 1.35 3.5 2.9V18H17"
        stroke="#F5C518"
        strokeWidth="1.8"
        strokeLinecap="round"
        opacity="0.85"
      />
    </svg>
  )
}
