import { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import api from '../api/client';
import { useFarm } from '../context/FarmContext';

const CATEGORIES = ['water', 'energy', 'maintenance', 'fertilization'];

export default function Costs() {
  const { farmId } = useFarm();
  const [plots, setPlots] = useState([]);
  const [costs, setCosts] = useState([]);
  const [summary, setSummary] = useState([]);
  const [form, setForm] = useState({ plot_id: '', description: '', amount: '', date: '', category: 'water' });
  const [error, setError] = useState('');

  useEffect(() => {
    if (!farmId) return;
    api.get('/plots', { params: { farm_id: farmId } }).then((res) => {
      setPlots(res.data);
      setForm((f) => ({ ...f, plot_id: f.plot_id || (res.data[0] ? String(res.data[0].id) : '') }));
    });
    loadCosts();
    loadSummary();
  }, [farmId]);

  const loadCosts = () => api.get('/costs').then((res) => setCosts(res.data));
  const loadSummary = () => api.get('/costs/summary', { params: { farm_id: farmId } }).then((res) => setSummary(res.data));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await api.post('/costs', { ...form, plot_id: Number(form.plot_id), amount: parseFloat(form.amount) });
      setForm({ ...form, description: '', amount: '', date: '' });
      loadCosts();
      loadSummary();
    } catch (err) {
      setError(err.response?.data?.error || 'Não foi possível registar o custo.');
    }
  };

  const handleDelete = async (id) => {
    await api.delete(`/costs/${id}`);
    loadCosts();
    loadSummary();
  };

  const plotIds = new Set(plots.map((p) => p.id));
  const farmCosts = costs.filter((c) => plotIds.has(c.plot_id));

  const chartData = Object.values(
    summary.reduce((acc, row) => {
      acc[row.month] = acc[row.month] || { month: row.month };
      acc[row.month][row.category] = Number(row.total);
      return acc;
    }, {})
  ).sort((a, b) => a.month.localeCompare(b.month));

  return (
    <div>
      <h1 className="page-title">Custos Operacionais</h1>

      <div className="panel">
        <h2>Novo registo</h2>
        <form className="inline-form" onSubmit={handleSubmit}>
          <select value={form.plot_id} onChange={(e) => setForm({ ...form, plot_id: e.target.value })} required>
            {plots.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
            {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <input placeholder="Descrição" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          <input placeholder="Valor (€)" type="number" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} required />
          <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} required />
          <button className="btn-primary" type="submit">Registar</button>
        </form>
        {error && <div className="form-error">{error}</div>}
      </div>

      {chartData.length > 0 && (
        <div className="panel">
          <h2>Resumo mensal</h2>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip />
              <Legend />
              {CATEGORIES.map((c, i) => (
                <Bar key={c} dataKey={c} stackId="a" fill={['#2f855a', '#3182ce', '#dd6b20', '#805ad5'][i]} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      <div className="panel">
        <table className="data-table">
          <thead><tr><th>Talhão</th><th>Categoria</th><th>Descrição</th><th>Valor</th><th>Data</th><th></th></tr></thead>
          <tbody>
            {farmCosts.map((c) => (
              <tr key={c.id}>
                <td>{c.plot_name}</td>
                <td>{c.category}</td>
                <td>{c.description || '—'}</td>
                <td>{Number(c.amount).toFixed(2)} €</td>
                <td>{new Date(c.date).toLocaleDateString('pt-PT')}</td>
                <td><button className="btn-ghost" onClick={() => handleDelete(c.id)}>Eliminar</button></td>
              </tr>
            ))}
            {farmCosts.length === 0 && <tr><td colSpan={6}>Sem registos de custos.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
