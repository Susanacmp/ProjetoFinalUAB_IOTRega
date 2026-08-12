import { useState } from 'react';
import api from '../api/client';
import { useFarm } from '../context/FarmContext';

export default function Farms() {
  const { farms, refreshFarms, setFarmId } = useFarm();
  const [form, setForm] = useState({ name: '', description: '', latitude: '', longitude: '' });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleChange = (field) => (e) => setForm({ ...form, [field]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const res = await api.post('/farms', {
        name: form.name,
        description: form.description || undefined,
        latitude: parseFloat(form.latitude),
        longitude: parseFloat(form.longitude),
      });
      setForm({ name: '', description: '', latitude: '', longitude: '' });
      await refreshFarms();
      setFarmId(String(res.data.id));
    } catch (err) {
      setError(err.response?.data?.error || 'Não foi possível criar a exploração.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Eliminar esta exploração e todos os seus dados?')) return;
    await api.delete(`/farms/${id}`);
    await refreshFarms();
  };

  return (
    <div>
      <h1 className="page-title">Explorações Agrícolas</h1>

      <div className="panel">
        <h2>Nova exploração</h2>
        <form className="inline-form" onSubmit={handleSubmit}>
          <input placeholder="Nome" value={form.name} onChange={handleChange('name')} required />
          <input placeholder="Descrição" value={form.description} onChange={handleChange('description')} />
          <input placeholder="Latitude" type="number" step="any" value={form.latitude} onChange={handleChange('latitude')} required />
          <input placeholder="Longitude" type="number" step="any" value={form.longitude} onChange={handleChange('longitude')} required />
          <button className="btn-primary" type="submit" disabled={submitting}>Criar</button>
        </form>
        {error && <div className="form-error">{error}</div>}
      </div>

      <div className="panel">
        <table className="data-table">
          <thead>
            <tr><th>Nome</th><th>Descrição</th><th>Talhões</th><th></th></tr>
          </thead>
          <tbody>
            {farms.map((f) => (
              <tr key={f.id}>
                <td>{f.name}</td>
                <td>{f.description || '—'}</td>
                <td>{f.plot_count}</td>
                <td><button className="btn-ghost" onClick={() => handleDelete(f.id)}>Eliminar</button></td>
              </tr>
            ))}
            {farms.length === 0 && (
              <tr><td colSpan={4}>Ainda não existem explorações.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
