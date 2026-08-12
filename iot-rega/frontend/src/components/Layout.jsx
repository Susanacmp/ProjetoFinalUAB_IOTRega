import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useFarm } from '../context/FarmContext';

const NAV_ITEMS = [
  { to: '/', label: 'Dashboard', end: true },
  { to: '/farms', label: 'Explorações' },
  { to: '/plots', label: 'Talhões (Mapa)' },
  { to: '/sensors', label: 'Sensores' },
  { to: '/alerts', label: 'Alertas' },
  { to: '/rules', label: 'Regras' },
  { to: '/costs', label: 'Custos' },
  { to: '/weather', label: 'Clima' },
];

export default function Layout() {
  const { user, logout } = useAuth();
  const { farms, farmId, setFarmId } = useFarm();

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">🌿 IoT Rega</div>
        <nav>
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) => 'nav-link' + (isActive ? ' active' : '')}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      </aside>

      <div className="main-area">
        <header className="topbar">
          <select
            className="farm-select"
            value={farmId}
            onChange={(e) => setFarmId(e.target.value)}
          >
            {farms.length === 0 && <option value="">Sem explorações</option>}
            {farms.map((f) => (
              <option key={f.id} value={f.id}>{f.name}</option>
            ))}
          </select>

          <div className="user-box">
            <span>{user?.name}</span>
            <button className="btn-ghost" onClick={logout}>Sair</button>
          </div>
        </header>

        <main className="content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
