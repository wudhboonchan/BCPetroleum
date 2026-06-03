import { useState, useEffect } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { auth } from '../lib/auth.js';
import Modal from './Modal.jsx';

const NAV = [
  { to: '/',            label: 'แดชบอร์ด' },
  { to: '/daily',       label: 'รายวัน' },
  { to: '/credit',      label: 'เงินเชื่อ' },
  { to: '/cash',        label: 'เงินสด' },
  { to: '/accounting',  label: 'บัญชี' },
  { to: '/customers',   label: 'ลูกค้า' },
  { to: '/reports',     label: 'รายงาน' },
];

export default function TopBar() {
  const [clock, setClock] = useState('');
  const [dropOpen, setDropOpen] = useState(false);
  const [logoutModal, setLogoutModal] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const user = auth.getUser();

  useEffect(() => {
    const tick = () => setClock(new Date().toTimeString().slice(0, 5));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const close = (e) => {
      if (!e.target.closest('.user-profile-container')) setDropOpen(false);
    };
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, []);

  const avatar = (user?.name || user?.username || 'U')[0].toUpperCase();

  return (
    <>
      <header className="top-bar">
        <NavLink to="/" className="top-bar-brand">
          <div className="brand-mark" />
          <span>BC Petroleum</span>
        </NavLink>

        <nav className={`top-bar-nav${mobileOpen ? ' mobile-open' : ''}`}>
          {NAV.map(({ to, label }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
              onClick={() => setMobileOpen(false)}
            >
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="top-bar-actions">
          <span className="live-clock mono">{clock}</span>
          <div className="user-profile-container">
            <button
              className="user-profile"
              onClick={(e) => { e.stopPropagation(); setDropOpen(o => !o); }}
            >
              <div className="user-avatar">{avatar}</div>
              <span style={{ fontSize: 13, color: 'var(--ink-2)' }}>{user?.name || user?.username}</span>
              <span className="dropdown-arrow">▾</span>
            </button>
            <div className={`user-dropdown${dropOpen ? ' open' : ''}`}>
              <button className="dropdown-item" onClick={() => { setDropOpen(false); setLogoutModal(true); }}>
                ออกจากระบบ
              </button>
            </div>
          </div>
        </div>
      </header>

      {logoutModal && (
        <Modal
          title="ออกจากระบบ"
          message="คุณต้องการออกจากระบบใช่หรือไม่?"
          onConfirm={() => auth.logout()}
          onCancel={() => setLogoutModal(false)}
        />
      )}
    </>
  );
}
