-- ============================================================
-- IoT Rega Platform - Schema PostgreSQL + PostGIS + TimescaleDB
-- Autor: António Pacheco | nº 2100357 | Susana Pedro | nº 2202973 | UAB
-- ============================================================

CREATE EXTENSION IF NOT EXISTS postgis;
--CREATE EXTENSION IF NOT EXISTS timescaledb;

-- ------------------------------------------------------------
-- USERS
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS app_user (
  id          SERIAL PRIMARY KEY,
  name        VARCHAR(100) NOT NULL,
  email       VARCHAR(150) UNIQUE NOT NULL,
  password    TEXT NOT NULL,
  role        VARCHAR(20) DEFAULT 'user' CHECK (role IN ('admin','user','viewer')),
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ------------------------------------------------------------
-- FARMS (Explorações)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS farm (
  id          SERIAL PRIMARY KEY,
  name        VARCHAR(100) NOT NULL,
  description TEXT,
  location    GEOGRAPHY(Point, 4326),
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ------------------------------------------------------------
-- USER_FARM (relação N:M utilizador <-> exploração)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS user_farm (
  user_id  INT REFERENCES app_user(id) ON DELETE CASCADE,
  farm_id  INT REFERENCES farm(id) ON DELETE CASCADE,
  role     VARCHAR(50) DEFAULT 'member',
  PRIMARY KEY (user_id, farm_id)
);

-- ------------------------------------------------------------
-- PLOTS (Talhões)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS plot (
  id          SERIAL PRIMARY KEY,
  farm_id     INT NOT NULL REFERENCES farm(id) ON DELETE CASCADE,
  name        VARCHAR(100) NOT NULL,
  area        FLOAT,
  geometry    GEOMETRY(POLYGON, 4326),
  crop_type   VARCHAR(50) DEFAULT 'vinha',
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_plot_farm ON plot(farm_id);
CREATE INDEX IF NOT EXISTS idx_plot_geom ON plot USING GIST (geometry);

-- ------------------------------------------------------------
-- IRRIGATION SYSTEMS
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS irrigation_system (
  id       SERIAL PRIMARY KEY,
  plot_id  INT REFERENCES plot(id) ON DELETE CASCADE,
  type     VARCHAR(50) CHECK (type IN ('drip','sprinkler','surface')),
  capacity DOUBLE PRECISION,
  status   VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active','inactive','maintenance'))
);

-- ------------------------------------------------------------
-- SENSORS
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sensor (
  id           SERIAL PRIMARY KEY,
  plot_id      INT NOT NULL REFERENCES plot(id) ON DELETE CASCADE,
  name         VARCHAR(100),
  type         VARCHAR(50) NOT NULL CHECK (type IN ('humidity','temperature','soil_moisture','rainfall','wind_speed')),
  unit         VARCHAR(20),
  device_id    VARCHAR(100) UNIQUE,
  latitude     DOUBLE PRECISION,
  longitude    DOUBLE PRECISION,
  installed_at TIMESTAMP,
  active       BOOLEAN DEFAULT TRUE,
  created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_sensor_plot ON sensor(plot_id);
CREATE INDEX IF NOT EXISTS idx_sensor_type ON sensor(type);

-- ------------------------------------------------------------
-- SENSOR READINGS (TimescaleDB hypertable)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sensor_reading (
  time       TIMESTAMPTZ NOT NULL,
  sensor_id  INT NOT NULL REFERENCES sensor(id) ON DELETE CASCADE,
  value      DOUBLE PRECISION NOT NULL,
  quality    SMALLINT DEFAULT 1
);

CREATE INDEX IF NOT EXISTS idx_reading_sensor_time
ON sensor_reading(sensor_id, time DESC);
--SELECT create_hypertable('sensor_reading','time', if_not_exists => TRUE);

CREATE INDEX IF NOT EXISTS idx_reading_sensor_time ON sensor_reading(sensor_id, time DESC);

-- ------------------------------------------------------------
-- WEATHER DATA (dados reais/observados)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS weather_data (
  id           SERIAL PRIMARY KEY,
  plot_id      INT REFERENCES plot(id) ON DELETE CASCADE,
  time         TIMESTAMPTZ NOT NULL,
  temperature  DOUBLE PRECISION,
  humidity     DOUBLE PRECISION,
  rainfall     DOUBLE PRECISION,
  wind_speed   DOUBLE PRECISION,
  source       VARCHAR(50) DEFAULT 'openmeteo'
);

CREATE INDEX IF NOT EXISTS idx_weather_plot_time ON weather_data(plot_id, time DESC);

-- ------------------------------------------------------------
-- WEATHER FORECAST (previsão)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS weather_forecast (
  id               SERIAL PRIMARY KEY,
  plot_id          INT REFERENCES plot(id) ON DELETE CASCADE,
  forecast_time    TIMESTAMPTZ NOT NULL,
  temperature      DOUBLE PRECISION,
  rainfall         DOUBLE PRECISION,
  probability_rain DOUBLE PRECISION,
  fetched_at       TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- ------------------------------------------------------------
-- RULES (Regras de alerta)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS rule (
  id           SERIAL PRIMARY KEY,
  name         VARCHAR(100),
  sensor_type  VARCHAR(50) NOT NULL,
  threshold    DOUBLE PRECISION NOT NULL,
  condition    VARCHAR(10) CHECK (condition IN ('>','<','=','>=','<=')),
  severity     VARCHAR(20) DEFAULT 'warning' CHECK (severity IN ('info','warning','critical')),
  active       BOOLEAN DEFAULT TRUE,
  created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ------------------------------------------------------------
-- ALERTS
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS alert (
  id          SERIAL PRIMARY KEY,
  sensor_id   INT REFERENCES sensor(id) ON DELETE SET NULL,
  rule_id     INT REFERENCES rule(id) ON DELETE SET NULL,
  message     TEXT NOT NULL,
  value       DOUBLE PRECISION,
  severity    VARCHAR(20) DEFAULT 'warning',
  resolved    BOOLEAN DEFAULT FALSE,
  resolved_at TIMESTAMP,
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_alert_sensor  ON alert(sensor_id);
CREATE INDEX IF NOT EXISTS idx_alert_created ON alert(created_at DESC);

-- ------------------------------------------------------------
-- COST RECORDS
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS cost_record (
  id          SERIAL PRIMARY KEY,
  plot_id     INT REFERENCES plot(id) ON DELETE CASCADE,
  category    VARCHAR(50) DEFAULT 'water',
  description TEXT,
  amount      NUMERIC(10,2) NOT NULL,
  date        DATE NOT NULL,
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_cost_plot ON cost_record(plot_id);

-- ------------------------------------------------------------
-- SEED DATA (demo)
-- Password do utilizador Admin: "admin123"
-- ------------------------------------------------------------
INSERT INTO app_user (name, email, password, role)
VALUES ('Admin', 'admin@iotrega.pt',
        '$2a$10$DcNOoALDFw7ODgNNSwgcrOGhw1krQ0G.PEEllcRE4lvwJWn.EMGRG', 'admin')
ON CONFLICT (email) DO NOTHING;

INSERT INTO farm (name, description, location)
VALUES ('Quinta do Demo', 'Exploração vitivinícola de demonstração',
        ST_GeographyFromText('SRID=4326;POINT(-8.6291 41.1579)'))
ON CONFLICT DO NOTHING;

INSERT INTO user_farm (user_id, farm_id, role)
SELECT u.id, f.id, 'owner'
FROM app_user u, farm f
WHERE u.email = 'admin@iotrega.pt' AND f.name = 'Quinta do Demo'
ON CONFLICT DO NOTHING;

INSERT INTO plot (farm_id, name, area, geometry, crop_type)
SELECT f.id, 'Talhão 1', 2.4,
       ST_SetSRID(ST_GeomFromText(
         'POLYGON((-8.6305 41.1585, -8.6285 41.1585, -8.6285 41.1572, -8.6305 41.1572, -8.6305 41.1585))'
       ), 4326),
       'vinha'
FROM farm f WHERE f.name = 'Quinta do Demo'
ON CONFLICT DO NOTHING;

INSERT INTO sensor (plot_id, name, type, unit, device_id, active)
SELECT p.id, v.name, v.type, v.unit, v.device_id, TRUE
FROM plot p, (VALUES
  ('Temperatura T1', 'temperature',   '°C', 'sim-temp-01'),
  ('Humidade T1',    'humidity',      '%',  'sim-hum-01'),
  ('Hum. Solo T1',   'soil_moisture', '%',  'sim-soil-01')
) AS v(name, type, unit, device_id)
WHERE p.name = 'Talhão 1'
ON CONFLICT (device_id) DO NOTHING;

INSERT INTO rule (name, sensor_type, threshold, condition, severity)
VALUES
  ('Humidade do solo baixa', 'soil_moisture', 20, '<', 'warning'),
  ('Temperatura crítica',    'temperature',   35, '>', 'critical')
ON CONFLICT DO NOTHING;
