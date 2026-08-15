// src/routes/plots.js
// CRUD de Talhões com suporte GeoJSON (PostGIS)

const express = require('express');
const { body, param } = require('express-validator');
const { query } = require('../config/database');
const { asyncHandler } = require('../middleware/errorHandler');

const router = express.Router();

// GET /api/plots?farm_id=X
router.get('/', asyncHandler(async (req, res) => {
  const { farm_id } = req.query;

  let sql = `
    SELECT p.*,
           ST_AsGeoJSON(p.geometry)::json AS geojson,
           COUNT(DISTINCT s.id) AS sensor_count
    FROM plot p
    JOIN farm f ON f.id = p.farm_id
    JOIN user_farm uf ON uf.farm_id = f.id
    LEFT JOIN sensor s ON s.plot_id = p.id
    WHERE uf.user_id = $1
  `;
  const params = [req.user.id];

  if (farm_id) {
    sql += ` AND p.farm_id = $2`;
    params.push(farm_id);
  }

  sql += ` GROUP BY p.id ORDER BY p.name`;

  const result = await query(sql, params);
  res.json(result.rows);
}));

// GET /api/plots/geojson?farm_id=X  (FeatureCollection para Leaflet)
router.get('/geojson', asyncHandler(async (req, res) => {
  const { farm_id } = req.query;
  const params = [req.user.id];
  let farmFilter = '';
  if (farm_id) { farmFilter = 'AND p.farm_id = $2'; params.push(farm_id); }

  const result = await query(
    `SELECT json_build_object(
       'type', 'FeatureCollection',
       'features', json_agg(
         json_build_object(
           'type', 'Feature',
           'geometry', ST_AsGeoJSON(p.geometry)::json,
           'properties', json_build_object(
             'id', p.id, 'name', p.name,
             'area', p.area, 'crop_type', p.crop_type,
             'farm_id', p.farm_id
           )
         )
       )
     ) AS geojson
     FROM plot p
     JOIN user_farm uf ON uf.farm_id = p.farm_id
     WHERE uf.user_id = $1 ${farmFilter}`,
    params
  );

  res.json(result.rows[0]?.geojson || { type: 'FeatureCollection', features: [] });
}));

// GET /api/plots/:id
router.get('/:id', param('id').isInt(), asyncHandler(async (req, res) => {
  const result = await query(
    `SELECT p.*, ST_AsGeoJSON(p.geometry)::json AS geojson
     FROM plot p
     JOIN user_farm uf ON uf.farm_id = p.farm_id
     WHERE p.id = $1 AND uf.user_id = $2`,
    [req.params.id, req.user.id]
  );
  if (!result.rows.length) return res.status(404).json({ error: 'Talhão não encontrado' });
  res.json(result.rows[0]);
}));

// POST /api/plots
router.post('/',
  body('farm_id').isInt(),
  body('name').notEmpty().trim(),
  body('geojson').notEmpty(), // GeoJSON polygon do Leaflet
  asyncHandler(async (req, res) => {
    const { farm_id, name, area, crop_type, geojson } = req.body;

    const result = await query(
      `INSERT INTO plot (farm_id, name, area, crop_type, geometry)
       VALUES ($1, $2, $3, $4, ST_SetSRID(ST_GeomFromGeoJSON($5), 4326))
       RETURNING id, farm_id, name, area, crop_type, created_at`,
      [farm_id, name, area || null, crop_type || 'vinha', JSON.stringify(geojson)]
    );
    res.status(201).json(result.rows[0]);
  })
);

// PUT /api/plots/:id
router.put('/:id', param('id').isInt(), asyncHandler(async (req, res) => {
  const { name, area, crop_type, geojson } = req.body;

  const result = await query(
    `UPDATE plot SET
       name      = COALESCE($1, name),
       area      = COALESCE($2, area),
       crop_type = COALESCE($3, crop_type),
       geometry  = CASE WHEN $4::text IS NOT NULL
                   THEN ST_SetSRID(ST_GeomFromGeoJSON($4), 4326)
                   ELSE geometry END
     WHERE id = $5
     RETURNING *`,
    [name || null, area || null, crop_type || null,
     geojson ? JSON.stringify(geojson) : null, req.params.id]
  );
  if (!result.rows.length) return res.status(404).json({ error: 'Talhão não encontrado' });
  res.json(result.rows[0]);
}));

// DELETE /api/plots/:id
router.delete(
  '/:id',
  param('id').isInt(),
  asyncHandler(async (req, res) => {
    const { id } = req.params;

    const result = await query(
      `
      DELETE FROM plot p
      USING farm f
      JOIN user_farm uf
        ON uf.farm_id = f.id
      WHERE p.id = $1
        AND p.farm_id = f.id
        AND uf.user_id = $2
      RETURNING p.id
      `,
      [id, req.user.id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({
        error: 'Talhão não encontrado ou sem acesso à exploração.'
      });
    }

    res.json({
      message: 'Talhão eliminado'
      
    });
  })
);

// PUT /api/plots/:id
// Atualiza os dados de um talhão, sem alterar a geometria
router.put('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { name, crop_type, area } = req.body;

  if (!name || !name.trim()) {
    return res.status(400).json({
      error: 'O nome do talhão é obrigatório.'
    });
  }

  const validCropTypes = [
    'vinha',
    'olival',
    'pomar',
    'hortícolas',
    'outro'
  ];

  if (crop_type && !validCropTypes.includes(crop_type)) {
    return res.status(400).json({
      error: 'Tipo de cultura inválido.'
    });
  }

  let parsedArea = null;

  if (area !== undefined && area !== null && area !== '') {
    parsedArea = Number(area);

    if (Number.isNaN(parsedArea) || parsedArea < 0) {
      return res.status(400).json({
        error: 'A área deve ser um número positivo.'
      });
    }
  }

  const result = await query(
    `
    UPDATE plot p
    SET
      name = $1,
      crop_type = $2,
      area = $3
    FROM farm f
    JOIN user_farm uf ON uf.farm_id = f.id
    WHERE
      p.id = $4
      AND p.farm_id = f.id
      AND uf.user_id = $5
    RETURNING
      p.id,
      p.farm_id,
      p.name,
      p.crop_type,
      p.area
    `,
    [
      name.trim(),
      crop_type || 'vinha',
      parsedArea,
      id,
      req.user.id
    ]
  );

  if (result.rows.length === 0) {
    return res.status(404).json({
      error: 'Talhão não encontrado.'
    });
  }

  res.json(result.rows[0]);
}));

module.exports = router;
