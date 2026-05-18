import { useNavigate } from 'react-router-dom';
import { Home } from 'lucide-react';

export default function NotFound() {
  const navigate = useNavigate();

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      minHeight: '100vh', background: '#f8f9fb', fontFamily: "'Inter', system-ui, sans-serif", padding: '20px', textAlign: 'center'
    }}>
      <div style={{ fontSize: '100px', fontWeight: '800', fontFamily: "'Bebas Neue', sans-serif", color: '#111827', lineHeight: 1 }}>
        404
      </div>
      <h1 style={{ fontSize: '24px', fontWeight: '700', color: '#111827', marginTop: '16px', marginBottom: '8px' }}>
        Page not found
      </h1>
      <p style={{ fontSize: '15px', color: '#6b7280', maxWidth: '400px', marginBottom: '32px', lineHeight: 1.5 }}>
        Sorry, we couldn't find the page you're looking for. It might have been moved or doesn't exist.
      </p>
      <button 
        onClick={() => navigate('/')}
        style={{
          display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 24px',
          background: '#111827', color: '#fff', border: 'none', borderRadius: '12px',
          fontSize: '15px', fontWeight: '600', cursor: 'pointer', transition: 'background 0.2s'
        }}
      >
        <Home size={18} />
        Back to Dashboard
      </button>
    </div>
  );
}
