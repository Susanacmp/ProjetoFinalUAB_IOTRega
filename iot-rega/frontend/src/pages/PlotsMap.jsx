import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, GeoJSON } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet-draw/dist/leaflet.draw.css';
import api from '../api/client';
import { useFarm } from '../context/FarmContext';
import DrawControl from '../components/DrawControl';

const CROP_TYPES = ['vinha', 'olival', 'pomar', 'hortícolas', 'outro'];
const DEFAULT_CENTER = [41.1579, -8.6291];

export default function PlotsMap() {
  const { farmId, farms } = useFarm();
  const [geojson, setGeojson] = useState(null);
  const [plots, setPlots] = useState([]);
  const [pending, setPending] = useState(null); // { geometry, layer }
  const [form, setForm] = useState({ name: '', crop_type: 'vinha', area: '' });
  const [error, setError] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    if (!farmId) return;
    api.get('/plots/geojson', { params: { farm_id: farmId } }).then((res) => setGeojson(res.data));
    api.get('/plots', { params: { farm_id: farmId } }).then((res) => setPlots(res.data));
  }, [farmId, refreshKey]);

  const farm = farms.find((f) => String(f.id) === String(farmId));
  let center = DEFAULT_CENTER;
  if (farm?.location_geojson) {
    const coords = JSON.parse(farm.location_geojson).coordinates;
    center = [coords[1], coords[0]];
  }

  const handleCreated = (geometry, layer) => {
    setPending({ geometry, layer });
    setForm({ name: '', crop_type: 'vinha', area: '' });
    setError('');
  };

  const handleCancel = () => {
    pending?.layer?.remove();
    setPending(null);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await api.post('/plots', {
        farm_id: Number(farmId),
        name: form.name,
        crop_type: form.crop_type,
        area: form.area ? parseFloat(form.area) : undefined,
        geojson: pending.geometry,
      });
      pending.layer?.remove();
      setPending(null);
      setRefreshKey((k) => k + 1);
    } catch (err) {
      setError(err.response?.data?.error || 'Não foi possível guardar o talhão.');
    }
  };

  if (farms.length === 0) {
    return (
      <div className="empty-state">
        <h2>Sem explorações</h2>
        <p>Cria primeiro uma exploração agrícola.</p>
      </div>
    );
  }

  return (
    <div>
      <h1 className="page-title">Talhões — Mapa (WebSIG)</h1>
      <p className="hint-text">Usa a ferramenta de polígono no mapa (canto superior direito) para desenhar um novo talhão.</p>

      <div className="map-wrapper">
        <MapContainer center={center} zoom={15} style={{ height: '520px', width: '100%' }}>
          <TileLayer
            attribution='&copy; OpenStreetMap contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          {geojson && geojson.features?.length > 0 && (
            <GeoJSON
              key={refreshKey}
              data={geojson}
              style={{ color: '#2f855a', weight: 2, fillOpacity: 0.25 }}
              onEachFeature={(feature, layer) => {
                const p = feature.properties;
                layer.bindPopup(`<b>${p.name}</b><br/>${p.crop_type || ''}${p.area ? ` — ${p.area} ha` : ''}`);
              }}
            />
          )}
          <DrawControl onCreated={handleCreated} />
        </MapContainer>
      </div>

      {pending && (
        <div className="panel">
          <h2>Novo talhão</h2>
          <form className="inline-form" onSubmit={handleSave}>
            <input
              placeholder="Nome do talhão"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
            />
            <select value={form.crop_type} onChange={(e) => setForm({ ...form, crop_type: e.target.value })}>
              {CROP_TYPES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <input
              placeholder="Área (ha)"
              type="number" step="any"
              value={form.area}
              onChange={(e) => setForm({ ...form, area: e.target.value })}
            />
            <button className="btn-primary" type="submit">Guardar</button>
            <button className="btn-ghost" type="button" onClick={handleCancel}>Cancelar</button>
          </form>
          {error && <div className="form-error">{error}</div>}
        </div>
      )}

      <div className="panel">
        <h2>Talhões desta exploração</h2>
        <table className="data-table">
          <thead><tr><th>Nome</th><th>Cultura</th><th>Área (ha)</th><th>Sensores</th></tr></thead>
          <tbody>
            {plots.map((p) => (
              <tr key={p.id}>
                <td>{p.name}</td>
                <td>{p.crop_type}</td>
                <td>{p.area ?? '—'}</td>
                <td>{p.sensor_count}</td>
              </tr>
            ))}
            {plots.length === 0 && <tr><td colSpan={4}>Sem talhões ainda.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
