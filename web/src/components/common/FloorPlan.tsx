import React from 'react'
import type { Room, Bed } from '../../types'
import { formatRupees } from '../../api'

interface FloorPlanProps {
  rooms: Room[]
  propertyName?: string
  onSelectBed: (bed: Bed) => void
  selectedBedId?: number | null
}

export const FloorPlan: React.FC<FloorPlanProps> = ({
  rooms,
  propertyName = 'Property Floor Plan',
  onSelectBed,
  selectedBedId,
}) => {
  // Bed coordinates inside each room: 4 rooms, 2 beds each
  const bedPositions: Record<number, { x: number; y: number }[]> = {
    1: [{ x: 60, y: 88 }, { x: 154, y: 88 }],
    2: [{ x: 400, y: 88 }, { x: 494, y: 88 }],
    3: [{ x: 60, y: 290 }, { x: 154, y: 290 }],
    4: [{ x: 450, y: 290 }, { x: 544, y: 290 }],
  }

  const roomsByNo = new Map<number, Room>(rooms.map(room => [room.room_no, room]))

  const getBedColor = (status: Bed['status'], isSelected: boolean) => {
    if (status === 'empty') {
      return {
        fill: isSelected ? '#d5f5df' : '#eaf8ef',
        stroke: '#2e9e5b',
        text: '#1b6e3c',
        chipFill: '#2e9e5b',
        chipText: '#ffffff',
        badge: 'Vacant',
      }
    }
    if (status === 'overdue') {
      return {
        fill: isSelected ? '#fed7d7' : '#fff0f0',
        stroke: '#c53030',
        text: '#9b2c2c',
        chipFill: '#c53030',
        chipText: '#ffffff',
        badge: 'Overdue',
      }
    }
    return {
      fill: isSelected ? '#d8e7fc' : '#eff5fe',
      stroke: '#1863dc',
      text: '#0f48a1',
      chipFill: '#1863dc',
      chipText: '#ffffff',
      badge: 'Occupied',
    }
  }

  const renderBed = (roomNo: number, bed: Bed, index: number) => {
    const pos = (bedPositions[roomNo] || [])[index]
    if (!pos) return null

    const isSelected = selectedBedId === bed.bed_id
    const c = getBedColor(bed.status, isSelected)
    const occupant = bed.tenant_name || (bed.status === 'empty' ? 'Vacant' : 'Occupied')

    return (
      <g
        key={bed.bed_id}
        className={`architect-bed ${isSelected ? 'is-selected' : ''}`}
        role="button"
        tabIndex={0}
        aria-label={`Room ${roomNo}, Bed ${bed.label}, Status: ${bed.status}`}
        onClick={() => onSelectBed(bed)}
        onKeyDown={e => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            onSelectBed(bed)
          }
        }}
        style={{ cursor: 'pointer', outline: 'none' }}
      >
        <title>{`Room ${roomNo}, Bed ${bed.label}: ${occupant} (${c.badge}). ${formatRupees(bed.base_yearly_price)}/year. Click to manage.`}</title>

        {/* Mattress outline */}
        <rect
          x={pos.x}
          y={pos.y}
          width="70"
          height="108"
          rx="6"
          fill={c.fill}
          stroke={c.stroke}
          strokeWidth={isSelected ? '2.8' : '2'}
        />

        {/* Pillow */}
        <rect
          x={pos.x + 9}
          y={pos.y + 8}
          width="52"
          height="24"
          rx="4"
          fill="#ffffff"
          stroke={c.stroke}
          strokeWidth="1.4"
        />

        {/* Bed fold sheet line */}
        <path
          d={`M ${pos.x + 9} ${pos.y + 22} H ${pos.x + 61}`}
          stroke={c.stroke}
          strokeWidth="1.2"
        />

        {/* Blanket fold / texture */}
        <rect
          x={pos.x + 9}
          y={pos.y + 80}
          width="52"
          height="18"
          rx="3"
          fill={c.stroke}
          opacity="0.18"
        />

        {/* Bed Label */}
        <text
          x={pos.x + 35}
          y={pos.y + 51}
          textAnchor="middle"
          fontSize="11"
          fontWeight="700"
          fontFamily="Inter, system-ui, sans-serif"
          fill={c.text}
        >
          Bed {bed.label}
        </text>

        {/* Status chip pill */}
        <rect
          x={pos.x + 10}
          y={pos.y + 59}
          width="50"
          height="14"
          rx="7"
          fill={c.chipFill}
        />
        <text
          x={pos.x + 35}
          y={pos.y + 69}
          textAnchor="middle"
          fontSize="8.5"
          fontWeight="600"
          fontFamily="Inter, system-ui, sans-serif"
          fill={c.chipText}
        >
          {c.badge.toUpperCase()}
        </text>
      </g>
    )
  }

  return (
    <div className="architect-plan-wrap">
      <svg
        className="architect-plan"
        viewBox="0 0 810 470"
        role="img"
        aria-label="Interactive architectural floor plan showing 4 rooms and 8 beds"
      >
        <defs>
          <pattern id="plan-grid" width="16" height="16" patternUnits="userSpaceOnUse">
            <path d="M 16 0 L 0 0 0 16" fill="none" stroke="#ebe8e1" strokeWidth="0.75" />
          </pattern>
        </defs>

        {/* Subtle grid background */}
        <rect x="0" y="0" width="810" height="470" fill="url(#plan-grid)" />

        {/* Exterior Building Perimeter Walls */}
        <rect
          x="28"
          y="26"
          width="674"
          height="408"
          fill="none"
          stroke="#17171c"
          strokeWidth="4"
        />

        {/* Interior Walls: Horizontal central hallway dividing North (R1/R2) & South (R3/R4) */}
        <line x1="28" y1="225" x2="698" y2="225" stroke="#17171c" strokeWidth="3" />

        {/* Vertical Walls: Dividing Room 1, Baths, and Room 2 */}
        {/* Room 1 Right Wall */}
        <line x1="270" y1="26" x2="270" y2="180" stroke="#17171c" strokeWidth="3" />
        {/* Wall between Room 1 Bath and Room 2 Bath */}
        <line x1="365" y1="26" x2="365" y2="180" stroke="#17171c" strokeWidth="2.5" />
        {/* Room 2 Attached Bath outer wall */}
        <line x1="610" y1="26" x2="610" y2="180" stroke="#17171c" strokeWidth="2.5" />

        {/* South wing: Common Washroom between Room 3 & Room 4 */}
        <line x1="270" y1="225" x2="270" y2="430" stroke="#17171c" strokeWidth="3" />
        <line x1="385" y1="225" x2="385" y2="430" stroke="#17171c" strokeWidth="3" />

        {/* Door Openings and Swing Arcs */}
        {/* Room 01 Door */}
        <path d="M 270 180 H 312" stroke="#75758a" strokeWidth="1.5" />
        <path d="M 270 180 A 42 42 0 0 1 312 222" fill="none" stroke="#a0a0ad" strokeDasharray="3 3" strokeWidth="1.2" />

        {/* Room 02 Door */}
        <path d="M 365 225 H 407" stroke="#75758a" strokeWidth="1.5" />
        <path d="M 365 225 A 42 42 0 0 0 407 267" fill="none" stroke="#a0a0ad" strokeDasharray="3 3" strokeWidth="1.2" />

        {/* Room 03 Door */}
        <path d="M 270 225 H 312" stroke="#75758a" strokeWidth="1.5" />
        <path d="M 270 225 A 42 42 0 0 1 312 267" fill="none" stroke="#a0a0ad" strokeDasharray="3 3" strokeWidth="1.2" />

        {/* Room 04 Door */}
        <path d="M 385 225 H 427" stroke="#75758a" strokeWidth="1.5" />
        <path d="M 385 225 A 42 42 0 0 0 427 267" fill="none" stroke="#a0a0ad" strokeDasharray="3 3" strokeWidth="1.2" />

        {/* Windows */}
        {/* Top Windows (Rooms 1 & 2) */}
        <line x1="75" y1="26" x2="155" y2="26" stroke="#1863dc" strokeWidth="3" />
        <line x1="435" y1="26" x2="515" y2="26" stroke="#1863dc" strokeWidth="3" />
        {/* Bottom Windows (Rooms 3 & 4) */}
        <line x1="75" y1="434" x2="155" y2="434" stroke="#1863dc" strokeWidth="3" />
        <line x1="500" y1="434" x2="580" y2="434" stroke="#1863dc" strokeWidth="3" />

        {/* Room Titles & Tags */}
        {/* Room 1 */}
        <g>
          <text x="44" y="52" fontSize="13" fontWeight="700" letterSpacing="0.04em" fill="#17171c">ROOM 01</text>
          <rect x="44" y="58" width="128" height="17" rx="3" fill="#eeece7" />
          <text x="48" y="70" fontSize="9.5" fontWeight="600" fill="#616161">ATTACHED BATHROOM</text>
        </g>

        {/* Room 2 */}
        <g>
          <text x="390" y="52" fontSize="13" fontWeight="700" letterSpacing="0.04em" fill="#17171c">ROOM 02</text>
          <rect x="390" y="58" width="128" height="17" rx="3" fill="#eeece7" />
          <text x="394" y="70" fontSize="9.5" fontWeight="600" fill="#616161">ATTACHED BATHROOM</text>
        </g>

        {/* Room 3 */}
        <g>
          <text x="44" y="254" fontSize="13" fontWeight="700" letterSpacing="0.04em" fill="#17171c">ROOM 03</text>
          <rect x="44" y="260" width="132" height="17" rx="3" fill="#eeece7" />
          <text x="48" y="272" fontSize="9.5" fontWeight="600" fill="#616161">SHARED COMMON WASHROOM</text>
        </g>

        {/* Room 4 */}
        <g>
          <text x="440" y="254" fontSize="13" fontWeight="700" letterSpacing="0.04em" fill="#17171c">ROOM 04</text>
          <rect x="440" y="260" width="132" height="17" rx="3" fill="#eeece7" />
          <text x="444" y="272" fontSize="9.5" fontWeight="600" fill="#616161">SHARED COMMON WASHROOM</text>
        </g>

        {/* Attached Bathroom 1 (inside Room 1 wing) */}
        <g className="plan-bathroom-box">
          <rect x="272" y="28" width="91" height="150" fill="#f7f7f5" stroke="#d9d9dd" strokeWidth="1" />
          <text x="317" y="52" textAnchor="middle" fontSize="10" fontWeight="700" fill="#212121">BATH 01</text>
          <text x="317" y="66" textAnchor="middle" fontSize="8" fill="#75758a">(Attached)</text>
          {/* Shower fixture & Basin */}
          <rect x="286" y="80" width="34" height="26" rx="6" fill="#fff" stroke="#93939f" strokeWidth="1.2" />
          <circle cx="303" cy="93" r="5" fill="none" stroke="#93939f" strokeWidth="1" />
          <circle cx="303" cy="93" r="1.5" fill="#93939f" />
          {/* Commode */}
          <ellipse cx="342" cy="130" rx="10" ry="14" fill="#fff" stroke="#93939f" strokeWidth="1.2" />
          <rect x="332" y="142" width="20" height="9" rx="2" fill="#fff" stroke="#93939f" strokeWidth="1" />
        </g>

        {/* Attached Bathroom 2 (inside Room 2 wing) */}
        <g className="plan-bathroom-box">
          <rect x="612" y="28" width="84" height="150" fill="#f7f7f5" stroke="#d9d9dd" strokeWidth="1" />
          <text x="654" y="52" textAnchor="middle" fontSize="10" fontWeight="700" fill="#212121">BATH 02</text>
          <text x="654" y="66" textAnchor="middle" fontSize="8" fill="#75758a">(Attached)</text>
          {/* Shower fixture & Basin */}
          <rect x="626" y="80" width="34" height="26" rx="6" fill="#fff" stroke="#93939f" strokeWidth="1.2" />
          <circle cx="643" cy="93" r="5" fill="none" stroke="#93939f" strokeWidth="1" />
          <circle cx="643" cy="93" r="1.5" fill="#93939f" />
          {/* Commode */}
          <ellipse cx="664" cy="130" rx="10" ry="14" fill="#fff" stroke="#93939f" strokeWidth="1.2" />
          <rect x="654" y="142" width="20" height="9" rx="2" fill="#fff" stroke="#93939f" strokeWidth="1" />
        </g>

        {/* COMMON WASHROOM (Serving Rooms 3 and 4) */}
        <g className="plan-common-washroom">
          <rect x="272" y="227" width="111" height="201" fill="#f4f3ef" stroke="#d9d9dd" strokeWidth="1.5" />
          {/* Visual highlight tag */}
          <rect x="282" y="240" width="91" height="20" rx="4" fill="#003c33" />
          <text x="327" y="254" textAnchor="middle" fontSize="9.5" fontWeight="700" fill="#ffffff" letterSpacing="0.03em">
            COMMON WASHROOM
          </text>
          <text x="327" y="272" textAnchor="middle" fontSize="8" fontWeight="600" fill="#616161">
            SHARED (ROOMS 3 & 4)
          </text>

          {/* Wash basin station */}
          <rect x="290" y="286" width="36" height="24" rx="5" fill="#fff" stroke="#75758a" strokeWidth="1.2" />
          <circle cx="308" cy="298" r="4.5" fill="none" stroke="#75758a" strokeWidth="1" />
          <circle cx="308" cy="298" r="1.5" fill="#75758a" />
          <text x="308" y="319" textAnchor="middle" fontSize="7.5" fill="#75758a">BASIN</text>

          {/* Double water closet stalls */}
          <rect x="336" y="286" width="38" height="52" rx="4" fill="#fff" stroke="#75758a" strokeWidth="1.2" />
          <ellipse cx="355" cy="308" rx="8" ry="11" fill="#f7f7f5" stroke="#75758a" strokeWidth="1" />
          <rect x="347" y="318" width="16" height="7" rx="1.5" fill="#fff" stroke="#75758a" strokeWidth="1" />
          <text x="355" y="347" textAnchor="middle" fontSize="7.5" fill="#75758a">WC</text>

          {/* Shower stall */}
          <rect x="290" y="354" width="46" height="48" rx="4" fill="#fff" stroke="#75758a" strokeWidth="1.2" />
          <circle cx="313" cy="378" r="8" fill="none" stroke="#75758a" strokeWidth="1" strokeDasharray="2 2" />
          <circle cx="313" cy="378" r="2" fill="#75758a" />
          <text x="313" y="394" textAnchor="middle" fontSize="7.5" fill="#75758a">SHOWER</text>
        </g>

        {/* Central Hallway Text */}
        <text
          x="195"
          y="218"
          textAnchor="middle"
          fontSize="9.5"
          fontWeight="600"
          letterSpacing="0.08em"
          fill="#93939f"
        >
          CENTRAL CORRIDOR / HALLWAY
        </text>
        <text
          x="530"
          y="218"
          textAnchor="middle"
          fontSize="9.5"
          fontWeight="600"
          letterSpacing="0.08em"
          fill="#93939f"
        >
          ACCESS PASSAGE
        </text>

        {/* Render all 8 beds */}
        {([1, 2, 3, 4] as const).map(n =>
          (roomsByNo.get(n)?.beds || []).map((bed, i) => renderBed(n, bed, i))
        )}

        {/* Main Entrance Marker */}
        <g className="plan-entrance">
          <path d="M 330 434 V 456 M 320 445 L 330 434 L 340 445" stroke="#17171c" strokeWidth="2.5" />
          <text x="330" y="466" textAnchor="middle" fontSize="10" fontWeight="700" letterSpacing="0.05em" fill="#17171c">
            MAIN ENTRANCE
          </text>
        </g>

        {/* Staircase Graphic */}
        <g className="plan-stairs">
          <rect x="712" y="210" width="70" height="200" fill="#f7f5f1" stroke="#17171c" strokeWidth="2" />
          <path
            d="M 712 235 H 782 M 712 260 H 782 M 712 285 H 782 M 712 310 H 782 M 712 335 H 782 M 712 360 H 782 M 712 385 H 782"
            stroke="#93939f"
            strokeWidth="1.2"
          />
          <path d="M 747 385 V 230 M 740 242 L 747 230 L 754 242" stroke="#17171c" strokeWidth="1.8" />
          <text x="747" y="222" textAnchor="middle" fontSize="9" fontWeight="700" fill="#17171c">
            STAIRS
          </text>
        </g>

        {/* Architectural North Arrow Compass */}
        <g className="plan-north" transform="translate(745, 75)">
          <circle cx="0" cy="0" r="18" fill="#fff" stroke="#17171c" strokeWidth="1.5" />
          <polygon points="0,-14 5,2 0,-2 -5,2" fill="#17171c" />
          <polygon points="0,14 5,2 0,-2 -5,2" fill="#d9d9dd" />
          <text x="0" y="-18" textAnchor="middle" fontSize="9" fontWeight="800" fill="#17171c">
            N
          </text>
        </g>
      </svg>
    </div>
  )
}
