import { useMemo } from 'react';
import * as d3 from 'd3';

type CascadeNode = {
  id: string;
  kind: 'company' | 'objective' | 'department' | 'employee' | 'goal';
  label: string;
  progress?: number;
  goalCount?: number;
  score?: number;
  weightage?: number;
  status?: string;
  target_value?: string;
  actual_value?: string;
  thrust_area?: string;
  department?: string;
  employee?: string;
  email?: string;
  explanation?: { summary: string; formula: string; score: number; type: string };
  children?: CascadeNode[];
};

interface Props {
  tree: CascadeNode | null;
  onNodeClick?: (node: CascadeNode) => void;
}

const KIND_COLORS: Record<CascadeNode['kind'], string> = {
  company: '#0f172a',
  objective: '#2563eb',
  department: '#7c3aed',
  employee: '#16a34a',
  goal: '#d97706',
};

export default function GoalCascadeTree({ tree, onNodeClick }: Props) {
  const layout = useMemo(() => {
    if (!tree) return { nodes: [], links: [], width: 900, height: 420 };

    try {
      const root = d3.hierarchy<CascadeNode>(tree, node => node.children || []);
      const treeLayout = d3.tree<CascadeNode>().nodeSize([210, 128]);
      treeLayout(root);

      let minX = Infinity;
      let maxX = -Infinity;
      let maxY = -Infinity;
      root.each(node => {
        minX = Math.min(minX, node.x ?? 0);
        maxX = Math.max(maxX, node.x ?? 0);
        maxY = Math.max(maxY, node.y ?? 0);
      });

      const xOffset = 140 - minX;
      const yOffset = 48;
      root.each(node => {
        node.x = (node.x ?? 0) + xOffset;
        node.y = (node.y ?? 0) + yOffset;
      });

      return {
        nodes: root.descendants(),
        links: root.links(),
        width: Math.max(900, maxX - minX + 280),
        height: Math.max(420, maxY + 220),
      };
    } catch (err) {
      console.error('Goal cascade layout failed:', err);
      return { nodes: [], links: [], width: 900, height: 420 };
    }
  }, [tree]);

  if (!tree || layout.nodes.length === 0) {
    return (
      <div style={{ padding: '36px', borderRadius: 24, border: '1px dashed #dbe2ea', background: '#fff', color: '#64748b' }}>
        No goal cascade data available yet.
      </div>
    );
  }

  return (
    <div style={{ width: '100%', overflowX: 'auto', background: '#fff', borderRadius: 24, border: '1px solid rgba(148, 163, 184, 0.18)', padding: 20 }}>
      <svg width={layout.width} height={layout.height} style={{ display: 'block', minWidth: '100%' }}>
        <g>
          {layout.links.map((link, i) => (
            <path
              key={`goal-link-${i}`}
              d={`M ${link.source.x ?? 0},${(link.source.y ?? 0) + 34} C ${(link.source.x ?? 0)},${((link.source.y ?? 0) + (link.target.y ?? 0)) / 2} ${(link.target.x ?? 0)},${((link.source.y ?? 0) + (link.target.y ?? 0)) / 2} ${(link.target.x ?? 0)},${(link.target.y ?? 0) - 34}`}
              fill="none"
              stroke="#dbe2ea"
              strokeWidth="2"
            />
          ))}

          {layout.nodes.map(node => {
            const data = node.data;
            const color = KIND_COLORS[data.kind] || '#64748b';
            const fill = data.kind === 'company' ? '#0f172a' : `${color}10`;
            const textColor = data.kind === 'company' ? '#fff' : '#0f172a';
            return (
              <g
                key={data.id}
                transform={`translate(${node.x},${node.y})`}
                onClick={() => onNodeClick?.(data)}
                style={{ cursor: onNodeClick ? 'pointer' : 'default' }}
              >
                <rect x={-108} y={-34} width={216} height={68} rx={16} fill={fill} stroke={color} strokeWidth={1.4} />
                <text x={-88} y={-8} fontSize="14" fontWeight={800} fill={textColor} fontFamily="'Inter', system-ui, sans-serif">
                  {data.label}
                </text>
                <text x={-88} y={12} fontSize="10" fill={data.kind === 'company' ? 'rgba(255,255,255,0.72)' : '#64748b'} fontFamily="'Inter', system-ui, sans-serif">
                  {data.kind === 'goal'
                    ? `${data.status || 'UNKNOWN'} · ${data.progress ?? data.score ?? 0}%`
                    : `${data.goalCount || 0} goals · ${data.progress ?? 0}%`}
                </text>
                <rect x={72} y={-22} width={24} height={24} rx={8} fill={data.kind === 'company' ? 'rgba(255,255,255,0.14)' : `${color}18`} />
                <text x={84} y={-6} textAnchor="middle" fontSize="9" fontWeight={800} fill={data.kind === 'company' ? '#fff' : color} fontFamily="'Inter', system-ui, sans-serif">
                  {data.kind === 'goal' ? 'G' : data.kind.charAt(0).toUpperCase()}
                </text>
              </g>
            );
          })}
        </g>
      </svg>
    </div>
  );
}
