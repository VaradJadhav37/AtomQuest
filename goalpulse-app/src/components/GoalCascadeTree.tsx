import { useMemo, useState, useRef, useEffect } from 'react';
import * as d3 from 'd3';
import { ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';

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
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(new Set());
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  
  const containerRef = useRef<HTMLDivElement>(null);

  // Toggle node collapse/expand
  const toggleCollapse = (id: string) => {
    setCollapsedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Drag to pan handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('.collapse-btn')) return;
    setIsDragging(true);
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    setPan({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleZoom = (factor: number) => {
    setZoom(prev => Math.max(0.4, Math.min(2, prev * factor)));
  };

  const handleReset = () => {
    if (layout.nodes && layout.nodes.length > 0) {
      const allX = layout.nodes.map(n => n.x ?? 0);
      const minXVal = Math.min(...allX);
      const maxXVal = Math.max(...allX);
      const midX = (minXVal + maxXVal) / 2;
      const containerWidth = containerRef.current?.clientWidth || 1000;
      setPan({ x: (containerWidth / 2) - midX * 0.9, y: 60 });
      setZoom(0.9);
    } else {
      setZoom(0.9);
      setPan({ x: 80, y: 30 });
    }
  };

  // Auto-center on load or when tree changes
  useEffect(() => {
    const timer = setTimeout(() => {
      handleReset();
    }, 50);
    return () => clearTimeout(timer);
  }, [tree]);

  // Deep clone tree and prune collapsed nodes
  const preparedTree = useMemo(() => {
    if (!tree) return null;
    
    const prepare = (node: CascadeNode): CascadeNode => {
      const clone = { ...node };
      if (collapsedIds.has(node.id)) {
        clone.children = undefined;
      } else if (node.children) {
        clone.children = node.children.map(prepare);
      }
      return clone;
    };
    
    return prepare(tree);
  }, [tree, collapsedIds]);

  const layout = useMemo(() => {
    if (!preparedTree) return { nodes: [], links: [], width: 900, height: 420 };

    try {
      const root = d3.hierarchy<CascadeNode>(preparedTree, node => node.children || []);
      const treeLayout = d3.tree<CascadeNode>().nodeSize([240, 140]);
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
        width: Math.max(1000, maxX - minX + 280),
        height: Math.max(420, maxY + 220),
      };
    } catch (err) {
      console.error('Goal cascade layout failed:', err);
      return { nodes: [], links: [], width: 900, height: 420 };
    }
  }, [preparedTree]);

  if (!tree || layout.nodes.length === 0) {
    return (
      <div style={{ padding: '36px', borderRadius: 24, border: '1px dashed #dbe2ea', background: '#fff', color: '#64748b' }}>
        No goal cascade data available yet.
      </div>
    );
  }

  return (
    <div ref={containerRef} style={{ position: 'relative', width: '100%', background: '#f8fafc', borderRadius: '24px', border: '1px solid rgba(148, 163, 184, 0.18)', overflow: 'hidden', boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.02)' }}>
      
      {/* ── Interactive Controls ── */}
      <div style={{ position: 'absolute', top: '16px', right: '16px', display: 'flex', gap: '8px', zIndex: 10 }}>
        <button onClick={() => handleZoom(1.15)} title="Zoom In" style={{ width: '36px', height: '36px', borderRadius: '10px', background: '#ffffff', border: '1px solid rgba(226, 232, 240, 0.8)', display: 'flex', alignItems: 'center', justifySelf: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: '0 4px 12px rgba(15, 23, 42, 0.04)', color: '#64748b', transition: 'all 0.15s' }}>
          <ZoomIn size={16} />
        </button>
        <button onClick={() => handleZoom(0.85)} title="Zoom Out" style={{ width: '36px', height: '36px', borderRadius: '10px', background: '#ffffff', border: '1px solid rgba(226, 232, 240, 0.8)', display: 'flex', alignItems: 'center', justifySelf: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: '0 4px 12px rgba(15, 23, 42, 0.04)', color: '#64748b', transition: 'all 0.15s' }}>
          <ZoomOut size={16} />
        </button>
        <button onClick={handleReset} title="Recenter View" style={{ width: '36px', height: '36px', borderRadius: '10px', background: '#ffffff', border: '1px solid rgba(226, 232, 240, 0.8)', display: 'flex', alignItems: 'center', justifySelf: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: '0 4px 12px rgba(15, 23, 42, 0.04)', color: '#64748b', transition: 'all 0.15s' }}>
          <RotateCcw size={16} />
        </button>
      </div>

      <div style={{ position: 'absolute', bottom: '16px', left: '16px', fontSize: '11px', fontWeight: '600', color: '#94a3b8', pointerEvents: 'none', background: 'rgba(255,255,255,0.7)', padding: '4px 10px', borderRadius: '999px', backdropFilter: 'blur(4px)' }}>
        Drag to Pan · Scroll / Click Controls to Zoom · Click Node Controls to Toggle Goals
      </div>

      <svg 
        width="100%" 
        height="480px" 
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        style={{ cursor: isDragging ? 'grabbing' : 'grab', userSelect: 'none', display: 'block' }}
      >
        {/* Transformed Dynamic G */}
        <g transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}>
          
          {/* Connector Paths */}
          {layout.links.map((link, i) => (
            <path
              key={`goal-link-${i}`}
              d={`M ${link.source.x ?? 0},${(link.source.y ?? 0) + 34} C ${(link.source.x ?? 0)},${((link.source.y ?? 0) + (link.target.y ?? 0)) / 2} ${(link.target.x ?? 0)},${((link.source.y ?? 0) + (link.target.y ?? 0)) / 2} ${(link.target.x ?? 0)},${(link.target.y ?? 0) - 34}`}
              fill="none"
              stroke="#cbd5e1"
              strokeWidth="2"
              strokeDasharray={collapsedIds.has(link.source.data.id) ? '4 4' : 'none'}
              style={{ transition: 'all 0.25s ease' }}
            />
          ))}

          {/* Interactive foreignObjects */}
          {layout.nodes.map(node => {
            const data = node.data;
            const color = KIND_COLORS[data.kind] || '#64748b';
            
            // Check original tree node children count
            const findOriginalNode = (curr: CascadeNode): CascadeNode | null => {
              if (curr.id === data.id) return curr;
              if (curr.children) {
                for (const child of curr.children) {
                  const found = findOriginalNode(child);
                  if (found) return found;
                }
              }
              return null;
            };
            const originalNode = findOriginalNode(tree);
            const originalHasChildren = originalNode && originalNode.children && originalNode.children.length > 0;

            const isCollapsed = collapsedIds.has(data.id);
            const progressVal = data.progress ?? data.score ?? 0;

            return (
              <g
                key={data.id}
                transform={`translate(${node.x},${node.y})`}
                onClick={() => onNodeClick?.(data)}
                style={{ cursor: onNodeClick ? 'pointer' : 'default' }}
              >
                
                {/* HTML Premium Card */}
                <foreignObject
                  x={-110}
                  y={-34}
                  width={220}
                  height={68}
                  style={{ overflow: 'visible' }}
                >
                  <div 
                    style={{
                      background: data.kind === 'company' ? 'linear-gradient(135deg, #1e293b, #0f172a)' : '#ffffff',
                      border: `2px solid ${isCollapsed ? '#cbd5e1' : color}`,
                      borderRadius: '14px',
                      padding: '10px 14px',
                      boxShadow: isCollapsed 
                        ? '0 4px 10px rgba(0,0,0,0.03)'
                        : '0 10px 25px -5px rgba(15, 23, 42, 0.08), 0 8px 10px -6px rgba(15, 23, 42, 0.06)',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      height: '68px',
                      transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
                      borderStyle: isCollapsed ? 'dashed' : 'solid',
                      position: 'relative',
                      boxSizing: 'border-box'
                    }}
                  >
                    {/* Collapsible toggle bubble directly attached to the bottom */}
                    {originalHasChildren && (
                      <button 
                        className="collapse-btn"
                        onClick={(e) => { e.stopPropagation(); toggleCollapse(data.id); }}
                        style={{
                          position: 'absolute',
                          bottom: '-12px',
                          left: '50%',
                          transform: 'translateX(-50%)',
                          width: '20px',
                          height: '20px',
                          borderRadius: '50%',
                          background: isCollapsed ? '#64748b' : color,
                          color: '#ffffff',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '12px',
                          fontWeight: '800',
                          cursor: 'pointer',
                          boxShadow: '0 2px 6px rgba(15, 23, 42, 0.15)',
                          border: '2px solid #ffffff',
                          zIndex: 10,
                          padding: 0
                        }}
                      >
                        {isCollapsed ? '+' : '−'}
                      </button>
                    )}

                    {/* Top row: Label & Kind Badge */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', gap: '6px' }}>
                      <div style={{ 
                        fontSize: '12px', 
                        fontWeight: '800', 
                        color: data.kind === 'company' ? '#ffffff' : '#0f172a',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        textAlign: 'left',
                        flex: 1
                      }}>
                        {data.label}
                      </div>
                      
                      <div style={{
                        padding: '2px 5px',
                        borderRadius: '5px',
                        fontSize: '8px',
                        fontWeight: '800',
                        color: data.kind === 'company' ? '#ffffff' : color,
                        background: data.kind === 'company' ? 'rgba(255,255,255,0.15)' : `${color}15`,
                        textTransform: 'uppercase',
                        letterSpacing: '0.04em',
                        flexShrink: 0
                      }}>
                        {data.kind === 'company' ? 'COMP' : data.kind.slice(0, 4)}
                      </div>
                    </div>

                    {/* Bottom row: Progress Bar */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', gap: '6px', marginTop: '2px' }}>
                      <div style={{ flex: 1, background: data.kind === 'company' ? 'rgba(255,255,255,0.15)' : '#e2e8f0', height: '4px', borderRadius: '2px', overflow: 'hidden' }}>
                        <div style={{ 
                          width: `${progressVal}%`, 
                          background: data.kind === 'company' ? '#3b82f6' : color, 
                          height: '100%',
                          borderRadius: '2px'
                        }} />
                      </div>
                      
                      <div style={{ 
                        fontSize: '10px', 
                        fontWeight: '800', 
                        color: data.kind === 'company' ? 'rgba(255,255,255,0.85)' : '#64748b',
                        flexShrink: 0
                      }}>
                        {progressVal}%
                      </div>
                    </div>

                  </div>
                </foreignObject>

              </g>
            );
          })}
        </g>
      </svg>
    </div>
  );
}
