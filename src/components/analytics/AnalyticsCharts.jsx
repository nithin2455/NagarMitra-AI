import React, { useState } from 'react';

/**
 * Responsive SVG Department Bar Chart
 */
export const DepartmentBarChart = ({ data = [], height = 260 }) => {
  const [hoveredDept, setHoveredDept] = useState(null);

  if (!data || data.length === 0) {
    return (
      <div style={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--slate-400)', fontSize: '0.875rem' }}>
        No department data to display.
      </div>
    );
  }

  const maxVal = Math.max(...data.map((d) => d.total || 0), 5);
  const chartHeight = height - 60;
  const paddingLeft = 40;
  const paddingRight = 20;
  const paddingTop = 20;
  const chartWidth = 500;
  const availableWidth = chartWidth - paddingLeft - paddingRight;
  const groupWidth = availableWidth / data.length;
  const barWidth = Math.min(22, groupWidth * 0.35);

  return (
    <div style={{ width: '100%', overflowX: 'auto' }}>
      <svg
        viewBox={`0 0 ${chartWidth} ${height}`}
        style={{ width: '100%', height: 'auto', minWidth: '380px', overflow: 'visible' }}
      >
        {/* Horizontal Gridlines */}
        {[0, 0.25, 0.5, 0.75, 1].map((pct, i) => {
          const y = paddingTop + chartHeight * (1 - pct);
          const labelVal = Math.round(maxVal * pct);
          return (
            <g key={i}>
              <line
                x1={paddingLeft}
                y1={y}
                x2={chartWidth - paddingRight}
                y2={y}
                stroke="var(--slate-200)"
                strokeDasharray={pct === 0 ? 'none' : '3 3'}
                strokeWidth={pct === 0 ? '1.5' : '1'}
              />
              <text
                x={paddingLeft - 8}
                y={y + 4}
                textAnchor="end"
                fontSize="10"
                fill="var(--slate-400)"
                fontFamily="var(--font-sans)"
              >
                {labelVal}
              </text>
            </g>
          );
        })}

        {/* Bars */}
        {data.map((d, i) => {
          const totalVal = d.total || 0;
          const resolvedVal = d.resolved || 0;
          const totalBarHeight = (totalVal / maxVal) * chartHeight;
          const resolvedBarHeight = (resolvedVal / maxVal) * chartHeight;

          const groupX = paddingLeft + i * groupWidth + groupWidth / 2;
          const totalX = groupX - barWidth - 2;
          const resolvedX = groupX + 2;

          const totalY = paddingTop + chartHeight - totalBarHeight;
          const resolvedY = paddingTop + chartHeight - resolvedBarHeight;

          const isHovered = hoveredDept === d.departmentId;

          return (
            <g
              key={d.departmentId || i}
              onMouseEnter={() => setHoveredDept(d.departmentId)}
              onMouseLeave={() => setHoveredDept(null)}
              style={{ cursor: 'pointer' }}
            >
              {/* Total Bar */}
              <rect
                x={totalX}
                y={totalY}
                width={barWidth}
                height={Math.max(2, totalBarHeight)}
                rx="3"
                fill="var(--primary-600)"
                opacity={isHovered ? 1 : 0.85}
              />

              {/* Resolved Bar */}
              <rect
                x={resolvedX}
                y={resolvedY}
                width={barWidth}
                height={Math.max(2, resolvedBarHeight)}
                rx="3"
                fill="var(--success-solid)"
                opacity={isHovered ? 1 : 0.85}
              />

              {/* Tooltip / Value on Hover */}
              {isHovered && (
                <g>
                  <text
                    x={groupX}
                    y={Math.min(totalY, resolvedY) - 8}
                    textAnchor="middle"
                    fontSize="11"
                    fontWeight="700"
                    fill="var(--slate-800)"
                  >
                    {totalVal} total / {resolvedVal} res
                  </text>
                </g>
              )}

              {/* X Axis Label */}
              <text
                x={groupX}
                y={height - 12}
                textAnchor="middle"
                fontSize="10"
                fill="var(--slate-600)"
                fontWeight={isHovered ? '700' : '500'}
                fontFamily="var(--font-sans)"
              >
                {d.departmentCode ? d.departmentCode.replace('DEPT_', '') : d.departmentName?.split(' ')[0]}
              </text>
            </g>
          );
        })}
      </svg>

      {/* Legend */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: '1.5rem', marginTop: '0.5rem', fontSize: '0.8rem', color: 'var(--slate-600)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <span style={{ width: '12px', height: '12px', background: 'var(--primary-600)', borderRadius: '2px', display: 'inline-block' }} />
          <span>Total Complaints</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <span style={{ width: '12px', height: '12px', background: 'var(--success-solid)', borderRadius: '2px', display: 'inline-block' }} />
          <span>Resolved & Closed</span>
        </div>
      </div>
    </div>
  );
};

/**
 * Responsive SVG Donut Chart for Status Breakdown
 */
export const StatusDonutChart = ({ data = [], total = 0, size = 220 }) => {
  const [hoveredSlice, setHoveredSlice] = useState(null);

  if (!data || data.length === 0 || total === 0) {
    return (
      <div style={{ height: size, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--slate-400)', fontSize: '0.875rem' }}>
        No complaint status data.
      </div>
    );
  }

  const radius = 80;
  const innerRadius = 52;
  const center = size / 2;

  // Calculate arc slices
  let cumulativeAngle = 0;
  const slices = data.map((d) => {
    const fraction = total > 0 ? d.count / total : 0;
    const angle = fraction * 360;
    const startAngle = cumulativeAngle;
    const endAngle = cumulativeAngle + angle;
    cumulativeAngle += angle;

    const startRad = ((startAngle - 90) * Math.PI) / 180;
    const endRad = ((endAngle - 90) * Math.PI) / 180;

    const x1 = center + radius * Math.cos(startRad);
    const y1 = center + radius * Math.sin(startRad);
    const x2 = center + radius * Math.cos(endRad);
    const y2 = center + radius * Math.sin(endRad);

    const x3 = center + innerRadius * Math.cos(endRad);
    const y3 = center + innerRadius * Math.sin(endRad);
    const x4 = center + innerRadius * Math.cos(startRad);
    const y4 = center + innerRadius * Math.sin(startRad);

    const largeArc = angle > 180 ? 1 : 0;

    const pathData =
      fraction >= 0.999
        ? `M ${center} ${center - radius} A ${radius} ${radius} 0 1 0 ${center} ${center + radius} A ${radius} ${radius} 0 1 0 ${center} ${center - radius} M ${center} ${center - innerRadius} A ${innerRadius} ${innerRadius} 0 1 1 ${center} ${center + innerRadius} A ${innerRadius} ${innerRadius} 0 1 1 ${center} ${center - innerRadius} Z`
        : `M ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2} L ${x3} ${y3} A ${innerRadius} ${innerRadius} 0 ${largeArc} 0 ${x4} ${y4} Z`;

    return {
      ...d,
      pathData,
      fraction,
      percentage: Number((fraction * 100).toFixed(1)),
    };
  });

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap', gap: '1.5rem' }}>
      <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
        <svg viewBox={`0 0 ${size} ${size}`} style={{ width: '100%', height: '100%' }}>
          {slices.map((slice, i) => {
            const isHovered = hoveredSlice === slice.status;
            return (
              <path
                key={slice.status || i}
                d={slice.pathData}
                fill={slice.color}
                opacity={isHovered ? 1 : 0.88}
                onMouseEnter={() => setHoveredSlice(slice.status)}
                onMouseLeave={() => setHoveredSlice(null)}
                style={{
                  cursor: 'pointer',
                  transition: 'opacity 0.2s',
                }}
              />
            );
          })}
        </svg>

        {/* Center Total Counter */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            pointerEvents: 'none',
          }}
        >
          <span style={{ fontSize: '1.45rem', fontWeight: 800, color: 'var(--slate-900)' }}>{total}</span>
          <span style={{ fontSize: '0.725rem', color: 'var(--slate-500)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Total
          </span>
        </div>
      </div>

      {/* Legend & Breakdown */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', minWidth: '180px' }}>
        {slices.map((slice) => {
          const isHovered = hoveredSlice === slice.status;
          return (
            <div
              key={slice.status}
              onMouseEnter={() => setHoveredSlice(slice.status)}
              onMouseLeave={() => setHoveredSlice(null)}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                fontSize: '0.825rem',
                padding: '0.25rem 0.4rem',
                borderRadius: 'var(--radius-sm)',
                background: isHovered ? 'var(--slate-100)' : 'transparent',
                cursor: 'pointer',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span
                  style={{
                    width: '10px',
                    height: '10px',
                    borderRadius: '2px',
                    background: slice.color,
                    display: 'inline-block',
                  }}
                />
                <span style={{ color: 'var(--slate-700)', fontWeight: isHovered ? 700 : 500 }}>
                  {slice.status}
                </span>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', color: 'var(--slate-600)' }}>
                <strong>{slice.count}</strong>
                <span style={{ color: 'var(--slate-400)', minWidth: '38px', textAlign: 'right' }}>
                  ({slice.percentage}%)
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

/**
 * Responsive Priority Distribution Component
 */
export const PriorityDistributionChart = ({ data = [], total = 0 }) => {
  if (!data || data.length === 0 || total === 0) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--slate-400)', fontSize: '0.875rem' }}>
        No priority distribution data.
      </div>
    );
  }

  return (
    <div>
      {/* Segmented Stacked Bar */}
      <div
        style={{
          display: 'flex',
          height: '24px',
          borderRadius: 'var(--radius-md)',
          overflow: 'hidden',
          marginBottom: '1.25rem',
          background: 'var(--slate-100)',
        }}
      >
        {data.map((item) => {
          if (item.count === 0) return null;
          return (
            <div
              key={item.key}
              style={{
                width: `${item.percentage}%`,
                background: item.color,
                transition: 'width 0.3s ease',
              }}
              title={`${item.priority}: ${item.count} (${item.percentage}%)`}
            />
          );
        })}
      </div>

      {/* Breakdown Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '0.75rem' }}>
        {data.map((item) => (
          <div
            key={item.key}
            style={{
              padding: '0.75rem',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--slate-200)',
              background: 'var(--slate-50)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.25rem' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: item.color }} />
              <span style={{ fontSize: '0.8rem', color: 'var(--slate-600)', fontWeight: 600 }}>{item.priority}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.35rem' }}>
              <span style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--slate-900)' }}>{item.count}</span>
              <span style={{ fontSize: '0.75rem', color: 'var(--slate-500)' }}>({item.percentage}%)</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
