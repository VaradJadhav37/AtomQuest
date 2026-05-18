import { useMemo, useState, useRef, useEffect } from 'react';
import * as d3 from 'd3';
import { ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';

interface User { id: number; name: string; email: string; role: string; department: string; manager_id: number | null; }
interface OrgTreeProps { users: User[]; }

export default function OrgTree({ users }: OrgTreeProps) {
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
    if (nodes.length > 0) {
      const allX = nodes.map(n => n.x ?? 0);
      const minXVal = Math.min(...allX);
      const maxXVal = Math.max(...allX);
      const midX = (minXVal + maxXVal) / 2;
      const containerWidth = containerRef.current?.clientWidth || 1000;
      setPan({ x: (containerWidth / 2) - midX * 0.85, y: 60 });
      setZoom(0.85);
    } else {
      setZoom(0.85);
      setPan({ x: 100, y: 40 });
    }
  };

  // Auto-center when users change
  useEffect(() => {
    // Small delay to ensure container clientWidth is populated in the DOM
    const timer = setTimeout(() => {
      handleReset();
    }, 50);
    return () => clearTimeout(timer);
  }, [users]);

  const { nodes, links } = useMemo(() => {
    if (!users || users.length === 0) return { nodes: [], links: [] };

    // Find the manager-less root
    const rootUser = users.find(u => !u.manager_id);
    if (!rootUser) return { nodes: [], links: [] };

    const stratify = d3.stratify<User>().id(d => String(d.id)).parentId(d => d.manager_id ? String(d.manager_id) : null);
    
    // Safety check: Filter out orphan nodes that do not trace back to a valid manager in the system
    const userIds = new Set(users.map(u => u.id));
    const validUsers = users.filter(u => !u.manager_id || userIds.has(u.manager_id));
    
    try {
      const rootNode = stratify(validUsers);

      // Node size for tree layout
      const nodeHeight = 100;
      const horizontalSpacing = 300;
      const verticalSpacing = 160;

      // Apply collapse status before layout
      const applyCollapse = (node: d3.HierarchyNode<User>) => {
        if (collapsedIds.has(node.id || '')) {
          (node as any)._children = node.children;
          node.children = undefined;
        } else {
          if ((node as any)._children) {
            node.children = (node as any)._children;
          }
          if (node.children) {
            node.children.forEach(applyCollapse);
          }
        }
      };
      applyCollapse(rootNode);

      // Tree Layout calculation
      const treeLayout = d3.tree<User>().nodeSize([horizontalSpacing, verticalSpacing]);
      treeLayout(rootNode);

      // Find bounds
      let minX = Infinity;
      let maxX = -Infinity;
      let maxY = -Infinity;

      rootNode.each(d => {
        const x = d.x ?? 0;
        const y = d.y ?? 0;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      });

      // Shift nodes to center positive coordinates
      const xOffset = -minX + horizontalSpacing;
      const yOffset = nodeHeight;

      rootNode.each(d => {
        d.x = (d.x ?? 0) + xOffset;
        d.y = (d.y ?? 0) + yOffset;
      });

      return {
        nodes: rootNode.descendants(),
        links: rootNode.links()
      };
    } catch (e) {
      console.error("D3 stratify error:", e);
      return { nodes: [], links: [] };
    }
  }, [users, collapsedIds]);

  if (nodes.length === 0) return <div style={{ padding: '40px', color: '#6b7280' }}>Invalid organization hierarchy data.</div>;

  const roleColor = (role: string) => ({ ADMIN: '#d97706', MANAGER: '#2563eb', EMPLOYEE: '#16a34a' }[role] || '#6b7280');
  const roleBg = (role: string) => ({ ADMIN: '#fef3c7', MANAGER: '#eff6ff', EMPLOYEE: '#f0fdf4' }[role] || '#f9fafb');

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
        Drag to Pan · Scroll / Click Controls to Zoom · Click Node Controls to Toggle Nodes
      </div>

      <svg 
        width="100%" 
        height="560px" 
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        style={{ cursor: isDragging ? 'grabbing' : 'grab', userSelect: 'none', display: 'block' }}
      >
        {/* Dynamic Transformed Viewport */}
        <g transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}>
          
          {/* SVG Connector Lines */}
          {links.map((link, i) => {
            const sourceX = link.source.x ?? 0;
            const sourceY = link.source.y ?? 0;
            const targetX = link.target.x ?? 0;
            const targetY = link.target.y ?? 0;
            
            // Draw clean cubic bezier path linking node centers
            const d = `M ${sourceX},${sourceY + 38} C ${sourceX},${(sourceY + targetY) / 2} ${targetX},${(sourceY + targetY) / 2} ${targetX},${targetY - 38}`;
            return (
              <path 
                key={`link-${i}`} 
                d={d} 
                fill="none" 
                stroke="#cbd5e1" 
                strokeWidth="2" 
                strokeDasharray={collapsedIds.has(link.source.id || '') ? '4 4' : 'none'}
                style={{ transition: 'all 0.25s ease' }}
              />
            );
          })}
          
          {/* Interactive Cards via foreignObject */}
          {nodes.map(node => {
            const rColor = roleColor(node.data.role);
            const rBg = roleBg(node.data.role);
            const hasChildren = node.children || (node as any)._children;
            const isCollapsed = collapsedIds.has(node.id || '');

            return (
              <g key={`node-${node.id}`} transform={`translate(${node.x},${node.y})`}>
                
                {/* HTML Card Container */}
                <foreignObject
                  x={-125}
                  y={-40}
                  width={250}
                  height={80}
                  style={{ overflow: 'visible' }}
                >
                  <div 
                    style={{
                      background: '#ffffff',
                      border: `2px solid ${isCollapsed ? '#cbd5e1' : rColor}`,
                      borderRadius: '14px',
                      padding: '10px 12px',
                      boxShadow: isCollapsed 
                        ? '0 4px 10px rgba(0,0,0,0.03)'
                        : '0 10px 25px -5px rgba(15, 23, 42, 0.08), 0 8px 10px -6px rgba(15, 23, 42, 0.06)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
                      borderStyle: isCollapsed ? 'dashed' : 'solid',
                      position: 'relative',
                      boxSizing: 'border-box',
                      height: '80px'
                    }}
                  >
                    {/* Collapsible toggle bubble directly attached to the bottom */}
                    {hasChildren && (
                      <button 
                        className="collapse-btn"
                        onClick={(e) => { e.stopPropagation(); toggleCollapse(node.id || ''); }}
                        style={{
                          position: 'absolute',
                          bottom: '-12px',
                          left: '50%',
                          transform: 'translateX(-50%)',
                          width: '22px',
                          height: '22px',
                          borderRadius: '50%',
                          background: isCollapsed ? '#64748b' : rColor,
                          color: '#ffffff',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '13px',
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

                    {/* Left: Avatar Circle */}
                    <div style={{
                      width: '38px',
                      height: '38px',
                      borderRadius: '50%',
                      background: `linear-gradient(135deg, ${rColor}15, ${rColor}25)`,
                      color: rColor,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '14px',
                      fontWeight: '800',
                      flexShrink: 0,
                      border: `1.5px solid ${rColor}30`
                    }}>
                      {node.data.name.charAt(0)}
                    </div>

                    {/* Middle: Details */}
                    <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', flex: 1, textAlign: 'left', lineHeight: '1.25' }}>
                      <div style={{ fontSize: '13px', fontWeight: '800', color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {node.data.name}
                      </div>
                      <div style={{ fontSize: '10px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.02em', marginTop: '1px' }}>
                        {node.data.department}
                      </div>
                      <div style={{ fontSize: '10px', color: '#94a3b8', marginTop: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {node.data.email}
                      </div>
                    </div>

                    {/* Right Badge: Role tag */}
                    <div style={{
                      alignSelf: 'flex-start',
                      padding: '2px 5px',
                      borderRadius: '5px',
                      fontSize: '8px',
                      fontWeight: '800',
                      color: rColor,
                      background: rBg,
                      textTransform: 'uppercase',
                      letterSpacing: '0.04em',
                      flexShrink: 0
                    }}>
                      {node.data.role.slice(0, 3)}
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
