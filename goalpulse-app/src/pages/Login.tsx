import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { SignInButton, SignUpButton } from '@clerk/react';
import { Check } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const SANS = "'Inter', 'DM Sans', system-ui, sans-serif";

function SmallLogo() {
  return (
    <div
      style={{
        width: '32px',
        height: '32px',
        background: '#111827',
        borderRadius: '8px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '18px',
        fontWeight: '900',
        color: 'white',
        fontStyle: 'italic',
        fontFamily: SANS,
      }}
    >
      G
    </div>
  );
}

function BrandOrbit() {
  return (
    <div className="login-orbit-wrap" aria-hidden="true">
      <div className="login-orbit login-orbit-outer" />
      <div className="login-orbit login-orbit-inner" />
      <div className="login-orbit-node login-orbit-node-a" />
      <div className="login-orbit-node login-orbit-node-b" />
      <div className="login-orbit-node login-orbit-node-c" />
      <div className="login-monogram">G</div>
    </div>
  );
}

function FloatingStat({ label, value, tone, delay }: { label: string; value: string; tone: string; delay: number }) {
  return (
    <div className="login-float-card" style={{ animationDelay: `${delay}s`, borderColor: `${tone}26` }}>
      <div className="login-float-value" style={{ color: tone }}>{value}</div>
      <div className="login-float-label">{label}</div>
    </div>
  );
}

type AuthMode = 'sign-in' | 'sign-up';

export default function Login({ mode = 'sign-in' }: { mode?: AuthMode }) {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const demoAccounts = [
    { role: 'Employee', email: 'employee@goalkeeper.com' },
    { role: 'Manager', email: 'manager@goalkeeper.com' },
    { role: 'Admin', email: 'admin@goalkeeper.com' },
  ];
  const activeRole = demoAccounts.find(acc => acc.email === email)?.role ?? null;
  const clerkActionLabel = mode === 'sign-in' ? 'Sign in with Clerk' : 'Sign up with Clerk';
  const footerPrompt = mode === 'sign-in' ? "Don't have an account?" : 'Already have an account?';
  const footerLinkLabel = mode === 'sign-in' ? 'Sign up' : 'Sign in';
  const footerLinkTo = mode === 'sign-in' ? '/sign-up' : '/login';

  const fillDemo = (demoEmail: string) => {
    setEmail(demoEmail);
    setPassword('Demo@1234');
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login(email, password);
      navigate('/dashboard');
    } catch (err: any) {
      console.error(err);
      setError(err.response?.data?.error || err.message || 'Login failed. Please check credentials and ensure the backend is running.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-shell">
      <div className="login-surface" />
      <div className="login-grid" />
      <div className="login-glow login-glow-a" />
      <div className="login-glow login-glow-b" />

      <section className="login-hero">
        <div className="login-brandbar anim-login-rise">
          <SmallLogo />
          <span className="login-brandname">GoalKeeper</span>
        </div>

        <div className="login-hero-copy anim-login-rise" style={{ animationDelay: '0.08s' }}>
          <div className="login-eyebrow">Quarterly goal management</div>
          <h1 className="login-headline">Clear goals. Real progress. No noise.</h1>
          <p className="login-subcopy">
            Track objectives, approvals, and check-ins in one place with motion that feels calm,
            not flashy.
          </p>
        </div>

        <div className="login-hero-visual anim-login-rise" style={{ animationDelay: '0.16s' }}>
          <BrandOrbit />
          <FloatingStat label="Approval flow" value="Clerk + Demo" tone="#2563eb" delay={0.2} />
          <FloatingStat label="Check-ins" value="Tracked" tone="#16a34a" delay={0.35} />
          <FloatingStat label="Access" value="Ready" tone="#8b5cf6" delay={0.5} />
        </div>
      </section>

      <section className="login-panel anim-login-enter">
        <div className="login-card">
          <div className="login-card-top">
            <div className="login-card-badge">{mode === 'sign-in' ? 'Secure access' : 'Create access'}</div>
            <div className="login-card-brand">
              <SmallLogo />
              <span>GoalKeeper</span>
            </div>
            <h2>{mode === 'sign-in' ? 'Sign in' : 'Create account'}</h2>
            <p>{mode === 'sign-in' ? 'Use one of the seeded demo accounts below to enter the app fast.' : 'Use one of the seeded demo accounts below or create a new account.'}</p>
          </div>

          {mode === 'sign-in' ? (
            <SignInButton mode="modal">
              <button type="button" className="login-clerk-launch">
                {clerkActionLabel}
              </button>
            </SignInButton>
          ) : (
            <SignUpButton mode="modal">
              <button type="button" className="login-clerk-launch">
                {clerkActionLabel}
              </button>
            </SignUpButton>
          )}

          <div className="login-role-grid">
            {demoAccounts.map((acc, index) => (
              <button
                key={acc.email}
                onClick={() => fillDemo(acc.email)}
                type="button"
                className={`login-role-button${activeRole === acc.role ? ' is-selected' : ''}`}
                style={{ animationDelay: `${0.08 * index}s` }}
                aria-pressed={activeRole === acc.role}
              >
                <span>{acc.role}</span>
                {activeRole === acc.role && <Check size={14} aria-hidden="true" />}
              </button>
            ))}
          </div>

          {error && <div className="login-error">{error}</div>}

          <form onSubmit={handleSubmit} className="login-form">
            <label>Email address</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              placeholder="Enter your email address"
            />

            <label>Password</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              placeholder="Enter your password"
            />

            <button type="submit" disabled={loading} className="login-submit">
              <span>{loading ? 'Signing in...' : 'Continue'}</span>
              {!loading && <span className="login-submit-arrow">Proceed</span>}
            </button>
          </form>
        </div>

        <div className="login-footer">
          <div>
            {footerPrompt} <Link to={footerLinkTo}>{footerLinkLabel}</Link>
          </div>
          <div className="login-secured">
            Secured by <span>GoalKeeper</span>
          </div>
        </div>
      </section>
    </div>
  );
}
