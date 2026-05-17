import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  ShieldCheck,
  Search,
  Bot,
  BarChart3,
  Code2,
  Globe,
  Stethoscope,
  Cloud,
  CheckCircle2,
  Activity,
  Zap,
} from 'lucide-react';

const TOOLCHAIN = [
  {
    icon: Activity,
    title: 'Goal sheets',
    copy: 'Create quarterly goals, keep weightage at 100%, and submit the sheet for approval.',
  },
  {
    icon: Search,
    title: 'Live check-ins',
    copy: 'Track actual progress against targets, add context, and keep every check-in tied to the goal.',
  },
  {
    icon: CheckCircle2,
    title: 'Manager reviews',
    copy: "Approve, reject, or comment on direct reports' goal sheets and keep the feedback loop clear.",
  },
  {
    icon: Bot,
    title: 'AI-assisted drafting',
    copy: 'Use the built-in coach to shape stronger goals and clearer descriptions before submission.',
  },
  {
    icon: BarChart3,
    title: 'Performance analytics',
    copy: 'Review trends, distributions, and manager effectiveness across teams and cycles.',
  },
  {
    icon: Code2,
    title: 'Admin reporting',
    copy: 'Export dashboards, search goals and cycles, and generate performance summaries when needed.',
  },
];

const SECURITY = [
  {
    icon: ShieldCheck,
    title: 'Role-based access',
    copy: 'Employees, managers, and admins each see the flows and controls they need.',
  },
  {
    icon: Globe,
    title: 'Org-wide visibility',
    copy: 'Goal sheets, team reviews, and analytics stay connected across the organization.',
  },
  {
    icon: Stethoscope,
    title: 'Clean review cycle',
    copy: 'Submit, approve, check in, and report on goals without jumping between tools.',
  },
  {
    icon: Cloud,
    title: 'Simple deployment',
    copy: 'The app is built around a focused workflow that keeps quarterly planning manageable.',
  },
];

function BrandMark() {
  return (
    <Link to="/" className="bt-brand">
      <div className="bt-brand-icon">G</div>
      GoalPulse
    </Link>
  );
}

export default function Home() {
  const { user, logout } = useAuth();

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('in-view');
          }
        });
      },
      { threshold: 0.1, rootMargin: '0px 0px -50px 0px' }
    );

    const elements = document.querySelectorAll('.anim-fade-up');
    elements.forEach((el) => observer.observe(el));

    return () => {
      elements.forEach((el) => observer.unobserve(el));
    };
  }, []);

  return (
    <div className="bt-shell">
      <header className="bt-header bt-container">
        <BrandMark />
        <nav className="bt-nav">
          <a href="#workflow">Workflow</a>
          <a href="#features">Features</a>
          <a href="#analytics">Analytics</a>
          <a href="#security">Security</a>
          <a href="#contact">Contact</a>
        </nav>
        <div className="bt-actions">
          {!user ? (
            <>
              <Link to="/login" className="bt-btn bt-btn-secondary">Sign in</Link>
              <Link to="/login" className="bt-btn bt-btn-primary">Sign up</Link>
            </>
          ) : (
            <>
              <Link to="/dashboard" className="bt-btn bt-btn-secondary">Dashboard</Link>
              <button type="button" onClick={logout} className="bt-btn bt-btn-secondary">Sign Out</button>
            </>
          )}
        </div>
      </header>

      <main>
        <section className="bt-hero bt-container anim-fade-up">
          <div className="bt-hero-content">
            <h1>Quarterly goals <span>without the spreadsheet chaos</span></h1>
            <p className="anim-fade-up anim-delay-1">
              GoalPulse helps employees draft goal sheets, managers review them,
              and admins track progress, approvals, and performance in one place.
            </p>
            <div className="bt-hero-actions anim-fade-up anim-delay-2">
              {user ? (
                <Link to="/dashboard" className="bt-btn bt-btn-primary">Open dashboard</Link>
              ) : (
                <Link to="/login" className="bt-btn bt-btn-primary">Start tracking</Link>
              )}
              <a href="#workflow" className="bt-btn bt-btn-secondary">See how it works</a>
            </div>
          </div>
        </section>

        <section className="bt-pink-section" id="workflow">
          <div className="bt-container bt-pink-grid">
            <div className="bt-pink-content anim-fade-up">
              <h2>Built for the actual goal cycle: create, review, check in, and report.</h2>
              <div className="bt-pink-list">
                <div className="bt-pink-list-item anim-fade-up anim-delay-1">
                  <Activity size={20} />
                  <p><strong>Create a goal sheet:</strong> Add goals with target value, weightage, and thrust area before submission.</p>
                </div>
                <div className="bt-pink-list-item">
                  <CheckCircle2 size={20} />
                  <p><strong>Review with managers:</strong> Approve or reject direct reports' sheets and leave clear comments.</p>
                </div>
                <div className="bt-pink-list-item">
                  <Zap size={20} />
                  <p><strong>Check in on progress:</strong> Capture actuals, status, and context so the team can stay aligned.</p>
                </div>
              </div>
            </div>
            <div className="bt-pink-image-wrap anim-fade-up anim-delay-2">
              <img src="/dashboard.webp" alt="GoalPulse dashboard" />
            </div>
          </div>
        </section>

        <section className="bt-toolchain bt-container" id="features">
          <div className="bt-toolchain-header anim-fade-up">
            <h2>Everything you need to run goal management end to end</h2>
          </div>
          <div className="bt-toolchain-grid anim-fade-up anim-delay-1">
            {TOOLCHAIN.map((item, idx) => (
              <div
                key={idx}
                className="bt-tool-card anim-fade-up"
                style={{ transitionDelay: `${idx * 0.08}s` }}
              >
                <div className="bt-tool-icon">
                  <item.icon size={24} />
                </div>
                <h3>{item.title}</h3>
                <p>{item.copy}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="bt-green-section" id="analytics">
          <div className="bt-container">
            <div className="bt-green-content anim-fade-up">
              <h2>See goal health, team distribution, and manager effectiveness in one dashboard.</h2>
              <p>Use analytics to understand how goals are spread, where progress is slowing, and which teams need attention before the cycle closes.</p>
            </div>
            <div className="bt-metrics anim-fade-up anim-delay-1">
              <div className="bt-metric-title">
                100% <span>Goal sheet visibility</span>
              </div>
              <div className="bt-bar-row">
                <div className="bt-bar-label">DRAFT / PENDING</div>
                <div className="bt-bar-container">
                  <div className="bt-bar-fill red"></div>
                  <div className="bt-bar-value">Review queue</div>
                </div>
              </div>
              <div className="bt-bar-row">
                <div className="bt-bar-label">APPROVED / TRACKED</div>
                <div className="bt-bar-container" style={{ width: '85%' }}>
                  <div className="bt-bar-fill green"></div>
                  <div className="bt-bar-value">Active cycle</div>
                </div>
              </div>
            </div>
            <a href="#contact" className="bt-green-btn">Talk to us about rollout</a>
          </div>
        </section>

        <section className="bt-security bt-container" id="security">
          <div className="bt-security-header anim-fade-up">
            <h2>Designed for structured access and clean approvals</h2>
          </div>
          <div className="bt-security-grid anim-fade-up anim-delay-1">
            {SECURITY.map((item, idx) => (
              <div
                key={idx}
                className="bt-security-card anim-fade-up"
                style={{ transitionDelay: `${idx * 0.08}s` }}
              >
                <item.icon size={32} />
                <h4>{item.title}</h4>
                <p>{item.copy}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="bt-cta" id="contact">
          <div className="bt-container anim-fade-up">
            <h2>Bring your goals, approvals, and check-ins into one flow</h2>
            <Link to="/login" className="bt-cta-btn anim-fade-up anim-delay-1">Open GoalPulse</Link>
          </div>
        </section>
      </main>

      <footer className="bt-footer bt-container">
        <div className="bt-footer-grid">
          <div className="bt-footer-col">
            <BrandMark />
          </div>
          <div className="bt-footer-col">
            <h5>Product</h5>
            <div className="bt-footer-links">
              <a href="#workflow">Workflow</a>
              <a href="#features">Features</a>
              <a href="#analytics">Analytics</a>
              <a href="#security">Security</a>
            </div>
          </div>
          <div className="bt-footer-col">
            <h5>Company</h5>
            <div className="bt-footer-links">
              <a href="#contact">Contact</a>
              <a href="/login">Sign in</a>
            </div>
          </div>
          <div className="bt-footer-col">
            <h5>Views</h5>
            <div className="bt-footer-links">
              <a href="/dashboard">Dashboard</a>
              <a href="/goals">My Goals</a>
              <a href="/team">Team Goals</a>
              <a href="/analytics">Analytics</a>
            </div>
          </div>
        </div>
        <div className="bt-copyright">
          (c) {new Date().getFullYear()} GoalPulse. All rights reserved.
        </div>
      </footer>
    </div>
  );
}
