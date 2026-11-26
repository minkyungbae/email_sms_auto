/**
 * @file DashboardUI.tsx
 * @author 배민경
 * @created 2026-11-23
 * @updated 2026-11-23
 * @description 대시보드의 Icon, MetricCard, ConnectionRow 관리
 */

// =======================================
// 1. 아이콘 타입
// 20261123 추가
// =======================================
export type IconName =
  | 'dashboard'
  | 'book'
  | 'chart'
  | 'database'
  | 'calendar'
  | 'refresh'
  | 'chevron'
  | 'layers'
  | 'info'
  | 'file'
  | 'grid'
  | 'bell'
  | 'building' // 20261126 추가: 수요처 정보
  | 'users'    // 20261126 추가: 운영 인력
  | 'clipboard' // 20261126 추가: 강사 배정
  | 'wallet'   // 20261126 추가: 강사비
  | 'box'      // 20261126 추가: 교구재

type IconProps = {
  name: IconName
  size?: number
  strokeWidth?: number
}

// =======================================
// 2. 공통 아이콘 컴포넌트
// 20261123 추가
// =======================================

export function Icon({
  name,
  size = 18,
  strokeWidth = 1.8,
}: IconProps) {
  const shared = {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true as const,
  }

  switch (name) {
    case 'dashboard':
      return (
        <svg {...shared}>
          <rect x="3" y="3" width="8" height="8" rx="2" />
          <rect x="13" y="3" width="8" height="5" rx="2" />
          <rect x="13" y="10" width="8" height="11" rx="2" />
          <rect x="3" y="13" width="8" height="8" rx="2" />
        </svg>
      )

    case 'book':
      return (
        <svg {...shared}>
          <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v16H6.5A2.5 2.5 0 0 0 4 21.5z" />
          <path d="M4 5.5v16M8 7h8M8 11h7" />
        </svg>
      )

    case 'chart':
      return (
        <svg {...shared}>
          <path d="M3 3v18h18" />
          <path d="m7 14 4-4 3 3 6-7" />
          <path d="M16 6h4v4" />
        </svg>
      )

    case 'database':
      return (
        <svg {...shared}>
          <ellipse cx="12" cy="5" rx="8" ry="3" />
          <path d="M4 5v14c0 1.7 3.6 3 8 3s8-1.3 8-3V5" />
          <path d="M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3" />
        </svg>
      )

    case 'calendar':
      return (
        <svg {...shared}>
          <rect x="3" y="5" width="18" height="16" rx="2" />
          <path d="M16 3v4M8 3v4M3 10h18" />
        </svg>
      )

    case 'refresh':
      return (
        <svg {...shared}>
          <path d="M20 7v5h-5M4 17v-5h5" />
          <path d="M5.6 9A7 7 0 0 1 17.3 6L20 12M4 12l2.7 6A7 7 0 0 0 18.4 15" />
        </svg>
      )

    case 'chevron':
      return (
        <svg {...shared}>
          <path d="m9 18 6-6-6-6" />
        </svg>
      )

    case 'layers':
      return (
        <svg {...shared}>
          <path d="m12 3 9 5-9 5-9-5 9-5Z" />
          <path d="m3 12 9 5 9-5M3 16l9 5 9-5" />
        </svg>
      )

    case 'info':
      return (
        <svg {...shared}>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 11v5M12 8h.01" />
        </svg>
      )

    case 'file':
      return (
        <svg {...shared}>
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <path d="M14 2v6h6M8 13h8M8 17h8" />
        </svg>
      )

    case 'grid':
      return (
        <svg {...shared}>
          <rect x="3" y="3" width="7" height="7" rx="1.5" />
          <rect x="14" y="3" width="7" height="7" rx="1.5" />
          <rect x="3" y="14" width="7" height="7" rx="1.5" />
          <rect x="14" y="14" width="7" height="7" rx="1.5" />
        </svg>
      )

    case 'bell':
      return (
        <svg {...shared}>
          <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" />
        </svg>
      )

    // 20261126 추가: 운영 데이터 메뉴 아이콘
    case 'building':
      return (
        <svg {...shared}>
          <path d="M4 21V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v16M16 9h2a2 2 0 0 1 2 2v10M3 21h18" />
          <path d="M8 7h4M8 11h4M8 15h4" />
        </svg>
      )

    case 'users':
      return (
        <svg {...shared}>
          <circle cx="9" cy="8" r="3.5" />
          <path d="M2.5 20a6.5 6.5 0 0 1 13 0M16 4.6a3.5 3.5 0 0 1 0 6.8M18 14.2a6.5 6.5 0 0 1 3.5 5.8" />
        </svg>
      )

    case 'clipboard':
      return (
        <svg {...shared}>
          <rect x="5" y="4" width="14" height="17" rx="2" />
          <path d="M9 4V3h6v1M9 11h6M9 15h4" />
        </svg>
      )

    case 'wallet':
      return (
        <svg {...shared}>
          <path d="M19 7V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-3" />
          <path d="M21 9h-5a3 3 0 0 0 0 6h5zM3 7h16" />
        </svg>
      )

    case 'box':
      return (
        <svg {...shared}>
          <path d="m12 3 8 4.5v9L12 21l-8-4.5v-9L12 3Z" />
          <path d="m4 7.5 8 4.5 8-4.5M12 12v9" />
        </svg>
      )

    default:
      return null
  }
}

// =======================================
// 3. 핵심 지표 카드 타입
// 20261123 추가
// =======================================

type MetricCardProps = {
  label: string
  value: string
  detail: string
  icon: IconName
  tone: 'blue' | 'violet' | 'mint' | 'amber'
}

// =======================================
// 4. 핵심 지표 카드 컴포넌트
// 20261123 추가
// =======================================

export function MetricCard({
  label,
  value,
  detail,
  icon,
  tone,
}: MetricCardProps) {
  return (
    <article className="metric-card">
      <div className={`metric-icon metric-icon-${tone}`}>
        <Icon name={icon} size={19} />
      </div>

      <p className="metric-label">{label}</p>

      <p className={`metric-value ${value === '연동 대기' ? 'metric-value-text' : ''}`}>
        {value}
      </p>

      <p className="metric-detail">{detail}</p>
    </article>
  )
}

// =======================================
// 5. 데이터 연결 행 타입
// 20261123 추가
// =======================================

type ConnectionRowProps = {
  name: string
  description: string
  status: string
  statusType: 'ready' | 'waiting'
  icon: IconName
}

// =======================================
// 6. 데이터 연결 행 컴포넌트
// 20261123 추가
// =======================================

export function ConnectionRow({
  name,
  description,
  status,
  statusType,
  icon,
}: ConnectionRowProps) {
  return (
    <div className="connection-row">
      <div className="connection-icon">
        <Icon name={icon} size={17} />
      </div>

      <div className="connection-copy">
        <strong>{name}</strong>
        <span>{description}</span>
      </div>

      <span className={`status-pill status-${statusType}`}>
        <span className="status-dot" />
        {status}
      </span>
    </div>
  )
}