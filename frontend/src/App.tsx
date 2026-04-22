import { BrowserRouter, Routes, Route, NavLink, Navigate } from 'react-router-dom';
import { useWallet } from './context/WalletContext';
import Dashboard from './pages/Dashboard';
import UploadRegister from './pages/UploadRegister';
import ContentRegistry from './pages/ContentRegistry';
// import SimilarityCheck from './pages/SimilarityCheck';
// import RoyaltyCalculator from './pages/RoyaltyCalculator';
import DisputeEvidence from './pages/DisputeEvidence';
import GovernanceDashboard from './pages/GovernanceDashboard';
import Login from './pages/Login';
import UserProfile from './pages/UserProfile';

const NAV_ITEMS = [
  { to: '/',          icon: '📊', label: 'Dashboard' },
  { to: '/upload',    icon: '📤', label: 'Create Post' },
  { to: '/registry',  icon: '📚', label: 'Registry' },
  { to: '/governance',icon: '🏛️', label: 'DAO Governance' },
  { to: '/profile',   icon: '👤', label: 'My Profile' },
  { to: '/dispute',   icon: '⚖️', label: 'Forensic Scan' },
];

function Sidebar() {
  const { logout } = useWallet();
  
  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <div className="logo-icon">©</div>
        <div className="logo-text">Copyright</div>
      </div>

      <nav className="nav-section">
        {NAV_ITEMS.map(({ to, icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
          >
            <i>{icon}</i>
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>

      <div style={{ padding: '20px', borderTop: '1px solid var(--border)' }}>
        <button onClick={logout} className="nav-item" style={{ width: '100%', cursor: 'pointer', border: 'none', background: 'transparent' }}>
          <i>🚪</i>
          <span>Logout</span>
        </button>
      </div>
    </aside>
  );
}

function AuthenticatedLayout({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useWallet();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="layout">
      <Sidebar />
      <main className="main-wrapper">
        <header style={{ marginBottom: '40px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div className="badge-premium badge-original" style={{ marginBottom: '8px' }}>Network: Base Sepolia</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ color: 'var(--text-main)', fontSize: '14px', fontFamily: 'JetBrains Mono', background: 'rgba(255,255,255,0.05)', padding: '6px 12px', borderRadius: '8px' }}>
              {/* @ts-ignore */}
              {window.ethereum?.selectedAddress ? `${window.ethereum.selectedAddress.substring(0,6)}...${window.ethereum.selectedAddress.substring(38)}` : 'Connected'}
            </div>
          </div>
        </header>
        {children}
      </main>
    </div>
  );
}

export default function App() {
  const { isAuthenticated } = useWallet();

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={isAuthenticated ? <Navigate to="/" replace /> : <Login />} />
        
        <Route path="/" element={<AuthenticatedLayout><Dashboard /></AuthenticatedLayout>} />
        <Route path="/upload" element={<AuthenticatedLayout><UploadRegister /></AuthenticatedLayout>} />
        <Route path="/registry" element={<AuthenticatedLayout><ContentRegistry /></AuthenticatedLayout>} />
        <Route path="/profile" element={<AuthenticatedLayout><UserProfile /></AuthenticatedLayout>} />
        <Route path="/governance" element={<AuthenticatedLayout><GovernanceDashboard /></AuthenticatedLayout>} />
        <Route path="/dispute" element={<AuthenticatedLayout><DisputeEvidence /></AuthenticatedLayout>} />
        
        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
