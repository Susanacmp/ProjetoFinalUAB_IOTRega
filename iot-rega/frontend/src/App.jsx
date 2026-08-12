import { Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { FarmProvider } from './context/FarmContext';
import ProtectedRoute from './components/ProtectedRoute';
import Layout from './components/Layout';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import Farms from './pages/Farms';
import PlotsMap from './pages/PlotsMap';
import Sensors from './pages/Sensors';
import SensorDetail from './pages/SensorDetail';
import Alerts from './pages/Alerts';
import Rules from './pages/Rules';
import Costs from './pages/Costs';
import Weather from './pages/Weather';

export default function App() {
  return (
    <AuthProvider>
      <FarmProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />

          <Route
            path="/"
            element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }
          >
            <Route index element={<Dashboard />} />
            <Route path="farms" element={<Farms />} />
            <Route path="plots" element={<PlotsMap />} />
            <Route path="sensors" element={<Sensors />} />
            <Route path="sensors/:id" element={<SensorDetail />} />
            <Route path="alerts" element={<Alerts />} />
            <Route path="rules" element={<Rules />} />
            <Route path="costs" element={<Costs />} />
            <Route path="weather" element={<Weather />} />
          </Route>
        </Routes>
      </FarmProvider>
    </AuthProvider>
  );
}
