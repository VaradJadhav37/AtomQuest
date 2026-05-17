import { useMemo } from 'react';
import * as d3 from 'd3';

interface User { id: number; name: string; email: string; role: string; department: string; manager_id: number | null; }
interface OrgTreeProps { users: User[]; }

export default function OrgTree({ users }: OrgTreeProps) {
  const { nodes, links, width, height } = useMemo(() => {
    if (!users || users.length === 0) return { nodes: [], links: [], width: 800, height: 600 };

    // Build hierarchy
    const rootUser = users.find(u => !u.manager_id);
    if (!rootUser) return { nodes: [], links: [], width: 800, height: 600 };

    const stratify = d3.stratify<User>().id(d => String(d.id)).parentId(d => d.manager_id ? String(d.manager_id) : null);
    
    // There might be users without a manager that aren't the root user if data is messy, filter them or assign to root.
    // For safety, only use users that can be traced to the root.
    let validUsers = [...users];
    
    try {
      const rootNode = stratify(validUsers);

      // Node size
      const nodeHeight = 100;
      const horizontalSpacing = 280;
      const verticalSpacing = 160;

      // Layout
      const treeLayout = d3.tree<User>().nodeSize([horizontalSpacing, verticalSpacing]);
      treeLayout(rootNode);

      // Find bounds to center the svg
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

      const w = Math.max(800, maxX - minX + horizontalSpacing * 2);
      const h = Math.max(600, maxY + verticalSpacing * 2);

      // Shift nodes to be strictly positive coordinates
      const xOffset = -minX + horizontalSpacing;
      const yOffset = nodeHeight;

      rootNode.each(d => {
        d.x = (d.x ?? 0) + xOffset;
        d.y = (d.y ?? 0) + yOffset;
      });

      return {
        nodes: rootNode.descendants(),
        links: rootNode.links(),
        width: w,
        height: h
      };
    } catch (e) {
      console.error("D3 stratify error:", e);
      return { nodes: [], links: [], width: 800, height: 600 };
    }
  }, [users]);

  if (nodes.length === 0) return <div style={{ padding: '40px', color: '#6b7280' }}>Invalid organization hierarchy data.</div>;

  const roleColor = (role: string) => ({ ADMIN: '#d97706', MANAGER: '#2563eb', EMPLOYEE: '#16a34a' }[role] || '#6b7280');
  const roleBg = (role: string) => ({ ADMIN: '#fef3c7', MANAGER: '#eff6ff', EMPLOYEE: '#f0fdf4' }[role] || '#f9fafb');

  return (
    <div style={{ width: '100%', overflowX: 'auto', background: '#fff', borderRadius: '16px', border: '1px solid #e8eaed', padding: '20px' }}>
      <svg width={width} height={height} style={{ display: 'block', minWidth: '100%' }}>
        <g>
          {links.map((link, i) => {
            // Draw smooth cubic bezier curve
            const sourceX = link.source.x ?? 0;
            const sourceY = link.source.y ?? 0;
            const targetX = link.target.x ?? 0;
            const targetY = link.target.y ?? 0;
            const d = `M ${sourceX},${sourceY + 40} C ${sourceX},${(sourceY + targetY) / 2} ${targetX},${(sourceY + targetY) / 2} ${targetX},${targetY - 40}`;
            return <path key={`link-${i}`} d={d} fill="none" stroke="#cbd5e1" strokeWidth="2" />;
          })}
          
          {nodes.map(node => {
            const rColor = roleColor(node.data.role);
            const rBg = roleBg(node.data.role);
            return (
              <g key={`node-${node.id}`} transform={`translate(${node.x},${node.y})`}>
                <rect x={-100} y={-40} width={200} height={80} rx={12} fill="#ffffff" stroke={rColor} strokeWidth="1.5" style={{ filter: 'drop-shadow(0 4px 6px rgba(0,0,0,0.05))' }} />
                
                <text x={-84} y={-15} fontSize="14" fontWeight="bold" fill="#111827" fontFamily="DM Sans, sans-serif">{node.data.name}</text>
                
                <rect x={70} y={-28} width={20} height={18} rx={4} fill={rBg} />
                <text x={80} y={-15} fontSize="9" fontWeight="bold" fill={rColor} textAnchor="middle" fontFamily="DM Sans, sans-serif">{node.data.role.charAt(0)}</text>
                
                <text x={-84} y={5} fontSize="11" fill="#6b7280" fontFamily="DM Sans, sans-serif">{node.data.department}</text>
                <text x={-84} y={20} fontSize="10" fill="#9ca3af" fontFamily="DM Sans, sans-serif">{node.data.email}</text>
              </g>
            );
          })}
        </g>
      </svg>
    </div>
  );
}
