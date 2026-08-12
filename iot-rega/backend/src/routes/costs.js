// src/routes/costs.js
const express = require('express');
const { query } = require('../config/database');
const { asyncHandler } = require('../middleware/errorHandler');
const router = express.Router();

// GET /api/costs?plot_id=X&year=2024
router.get('/', asyncHandler(async (req, res) => {
  const { plot_id, year } = req.query;
  const params = [req.user.id];
  let filter = '';
  if (plot_id) { filter += ` AND c.plot_id = $${params.length+1}`; params.push(plot_id); }
  if (year)    { filter += ` AND EXTRACT(YEAR FROM c.date) = $${params.length+1}`; params.push(year); }

  const result = await query(
    `SELECT c.*, p.name AS plot_name
     FROM cost_record c
     JOIN plot p ON p.id = c.plot_id
     JOIN user_farm uf ON uf.farm_id = p.farm_id
     WHERE uf.user_id = $1 ${filter}
     ORDER BY c.date DESC`, params
  );
  res.json(result.rows);
}));

// GET /api/costs/summary?farm_id=X  — resumo por categoria/mês
router.get('/summary', asyncHandler(async (req, res) => {
  const { farm_id } = req.query;
  const result = await query(
    `SELECT
       TO_CHAR(c.date,'YYYY-MM') AS month,
       c.category,
       SUM(c.amount) AS total,
       COUNT(*) AS records
     FROM cost_record c
     JOIN plot p ON p.id = c.plot_id
     WHERE p.farm_id = $1
     GROUP BY month, c.category
     ORDER BY month DESC`, [farm_id]
  );
  res.json(result.rows);
}));

router.post('/', asyncHandler(async (req, res) => {
  const { plot_id, description, amount, date, category } = req.body;
  const result = await query(
    `INSERT INTO cost_record (plot_id, description, amount, date, category)
     VALUES ($1,$2,$3,$4,$5) RETURNING *`,
    [plot_id, description || null, amount, date, category || 'water']
  );
  res.status(201).json(result.rows[0]);
}));

router.delete('/:id', asyncHandler(async (req, res) => {
  await query('DELETE FROM cost_record WHERE id = $1', [req.params.id]);
  res.json({ message: 'Registo eliminado' });
}));

module.exports = router;
