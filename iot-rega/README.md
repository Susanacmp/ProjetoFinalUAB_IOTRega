# 🌿 IoT Rega — Plataforma de Gestão de Rega Vitivinícola

> Projeto Final de Curso — Licenciatura em Engenharia Informática
> Universidade Aberta | António Pacheco | nº 2100357 | Susana Pedro | nº 2202973

---

## 📐 Arquitectura

```
┌─────────────────────────────────────────────────────────┐
│                     FRONTEND (React)                     │
│          WebSIG (Leaflet) + Dashboards (Recharts)        │
└──────────────────────┬──────────────────────────────────┘
                       │ REST API (HTTP/JSON)
┌──────────────────────▼──────────────────────────────────┐
│                  BACKEND (Node.js/Express)                │
│   Auth JWT │ CRUD │ Alertas │ Weather │ Dashboard API    │
└─────┬──────────────────┬────────────────────────────────┘
      │                  │
┌─────▼──────┐   ┌───────▼────────────────────────────────┐
│ PostgreSQL │   │              MQTT Broker               │
│  PostGIS   │   │  (Mosquitto / simulação integrada)      │
│TimescaleDB │   └──────────────────────┬─────────────────┘
└────────────┘                          │
                               ┌────────▼────────┐
                               │  Sensores IoT   │
                               │  (LoRa / simulados) │
                               └─────────────────┘
```

---

## 🚀 Início Rápido (Docker — recomendado)

### Pré-requisitos
- [Docker Desktop](https://www.docker.com/products/docker-desktop/)
- [Node.js 20+](https://nodejs.org/) (apenas se quiseres correr o frontend fora do Docker)

### 1. Arrancar todos os serviços
```bash
cd iot-rega
docker-compose up -d --build
```

Isto inicia:
- **PostgreSQL + PostGIS + TimescaleDB** na porta 5432 (schema e dados de demonstração aplicados automaticamente)
- **Mosquitto MQTT Broker** nas portas 1883 / 9001
- **Backend API** em http://localhost:3000
- **Frontend** em http://localhost:8080

### 2. Verificar que está a funcionar
```bash
curl http://localhost:3000/api/health
```

### 3. Iniciar sessão
Abre http://localhost:8080 e usa a conta de demonstração criada pelo `schema.sql`:
- **Email:** `admin@iotrega.pt`
- **Password:** `admin123`

Esta conta já tem uma exploração ("Quinta do Demo"), um talhão com polígono e 3 sensores associados, prontos a receber leituras do simulador.

---

## 💻 Desenvolvimento Local (sem Docker)

### Backend
```bash
cd backend
npm install
cp .env.example .env        # editar com as credenciais da tua BD local
psql -U postgres -c "CREATE DATABASE iotrega;"
npm run db:setup            # aplica db/schema.sql (extensões, tabelas, dados de demo)
npm run dev                 # http://localhost:3000
```

> Requer PostgreSQL com as extensões `postgis` e `timescaledb` instaladas.

### Frontend
```bash
cd frontend
npm install
npm run dev                 # http://localhost:5173
```

Em desenvolvimento, o Vite faz proxy de `/api/*` para `http://localhost:3000` (ver `vite.config.js`), pelo que não é necessário configurar CORS nem uma URL de API separada.

---

## 📡 API Endpoints

### Autenticação
| Método | Rota | Descrição |
|--------|------|-----------|
| POST | `/api/auth/register` | Registar utilizador |
| POST | `/api/auth/login` | Login (retorna JWT) |
| GET  | `/api/auth/me` | Dados do utilizador autenticado |

### Explorações (Farms)
| Método | Rota | Descrição |
|--------|------|-----------|
| GET  | `/api/farms` | Listar explorações |
| GET  | `/api/farms/:id` | Detalhe |
| POST | `/api/farms` | Criar |
| PUT  | `/api/farms/:id` | Actualizar |
| DELETE | `/api/farms/:id` | Eliminar |

### Talhões (Plots)
| Método | Rota | Descrição |
|--------|------|-----------|
| GET  | `/api/plots?farm_id=X` | Listar talhões |
| GET  | `/api/plots/geojson?farm_id=X` | FeatureCollection para mapa |
| POST | `/api/plots` | Criar talhão (com polígono GeoJSON) |
| PUT  | `/api/plots/:id` | Actualizar |
| DELETE | `/api/plots/:id` | Eliminar |

### Sensores
| Método | Rota | Descrição |
|--------|------|-----------|
| GET  | `/api/sensors?plot_id=X` | Sensores de um talhão |
| POST | `/api/sensors` | Registar sensor |
| PUT  | `/api/sensors/:id` | Actualizar |
| DELETE | `/api/sensors/:id` | Eliminar |

### Leituras (TimescaleDB)
| Método | Rota | Descrição |
|--------|------|-----------|
| GET  | `/api/readings?sensor_id=X&from=&to=` | Leituras em bruto |
| GET  | `/api/readings?sensor_id=X&interval=1h` | Leituras agregadas |
| GET  | `/api/readings/latest?plot_id=X` | Última leitura por sensor |
| GET  | `/api/readings/stats?sensor_id=X&period=24h` | Estatísticas |
| POST | `/api/readings` | Inserir leitura manual |
| POST | `/api/readings/bulk` | Inserção em lote |

### Dashboard
| Método | Rota | Descrição |
|--------|------|-----------|
| GET  | `/api/dashboard/summary?farm_id=X` | Resumo completo |
| GET  | `/api/dashboard/chart?sensor_id=X&period=24h` | Dados para gráfico |

### Alertas e Regras
| Método | Rota | Descrição |
|--------|------|-----------|
| GET  | `/api/alerts?resolved=false` | Alertas activos |
| PATCH | `/api/alerts/:id/resolve` | Resolver alerta |
| GET  | `/api/alerts/count` | Contagem por severidade |
| GET/POST/PUT/DELETE | `/api/rules` | CRUD de regras de alerta |

### Custos
| Método | Rota | Descrição |
|--------|------|-----------|
| GET  | `/api/costs?plot_id=X&year=Y` | Listar custos |
| GET  | `/api/costs/summary?farm_id=X` | Resumo mensal por categoria |
| POST | `/api/costs` | Registar custo |
| DELETE | `/api/costs/:id` | Eliminar |

### Clima
| Método | Rota | Descrição |
|--------|------|-----------|
| GET  | `/api/weather?plot_id=X` | Dados históricos |
| GET  | `/api/weather/forecast?plot_id=X` | Previsão 7 dias |
| POST | `/api/weather/refresh?plot_id=X` | Actualizar agora |

---

## 🤖 Simulador IoT

Com `SIMULATE_SENSORS=true` no `.env` (ou por omissão no `docker-compose.yml`), o backend gera automaticamente leituras realistas para todos os sensores registados, a cada `SIMULATE_INTERVAL_MS` (10s por omissão), publicando-as por MQTT (ou directamente na BD se não houver broker disponível).

Valores simulados por tipo:
- `temperature`: 10–38 °C
- `humidity`: 30–95 %
- `soil_moisture`: 10–80 %
- `rainfall`: 0–15 mm
- `wind_speed`: 0–40 km/h

Cada leitura simulada é avaliada em tempo real pelo motor de regras (`alertService`), pelo que os alertas de demonstração ("Humidade do solo baixa", "Temperatura crítica") podem disparar organicamente enquanto o simulador corre.

---

## 🖥️ Frontend

React (Vite) com:
- **Autenticação** — login/registo com JWT guardado em `localStorage`, rotas protegidas.
- **Dashboard** — indicadores (sensores activos, alertas, custo do mês, clima) e gráfico de leituras recentes (Recharts).
- **WebSIG** — mapa Leaflet por exploração, com desenho de polígonos de talhões (Leaflet.draw) e visualização das geometrias existentes.
- **Sensores** — CRUD por talhão e vista de detalhe com gráfico histórico (24h / 7d / 30d).
- **Alertas** — listagem e resolução.
- **Regras** — CRUD de regras de alerta (tipo de sensor, condição, limite, severidade).
- **Custos** — registo de custos operacionais e resumo mensal por categoria (gráfico de barras empilhado).
- **Clima** — histórico e previsão a 7 dias por talhão, com actualização manual via Open-Meteo.

---

## 🗂️ Estrutura do Projecto

```
iot-rega/
├── backend/
│   ├── src/
│   │   ├── app.js
│   │   ├── config/
│   │   │   ├── database.js
│   │   │   └── db-setup.js      ← aplica db/schema.sql (npm run db:setup)
│   │   ├── middleware/
│   │   │   ├── auth.js
│   │   │   └── errorHandler.js
│   │   ├── routes/
│   │   │   ├── auth.js, farms.js, plots.js, sensors.js,
│   │   │   ├── readings.js, weather.js, alerts.js,
│   │   │   └── rules.js, costs.js, dashboard.js
│   │   └── services/
│   │       ├── mqttService.js
│   │       ├── alertService.js
│   │       └── weatherService.js
│   ├── db/schema.sql
│   ├── Dockerfile
│   ├── package.json
│   └── .env.example
├── frontend/
│   ├── src/
│   │   ├── api/client.js        ← axios + interceptor JWT
│   │   ├── context/             ← AuthContext, FarmContext
│   │   ├── components/          ← Layout, ProtectedRoute, StatCard, DrawControl
│   │   └── pages/                ← Login, Register, Dashboard, Farms, PlotsMap,
│   │                                Sensors, SensorDetail, Alerts, Rules, Costs, Weather
│   ├── Dockerfile
│   └── nginx.conf
├── docker-compose.yml
├── mosquitto.conf
└── README.md
```

---

## 🛠️ Tecnologias

| Camada | Tecnologia |
|--------|-----------|
| Backend | Node.js + Express |
| Base de Dados | PostgreSQL 16 + PostGIS + TimescaleDB |
| Mensageria IoT | MQTT (Eclipse Mosquitto) |
| Autenticação | JWT (jsonwebtoken) + bcrypt |
| API Climática | Open-Meteo (gratuita) |
| Frontend | React + Vite + React Router |
| Mapas / WebSIG | Leaflet + Leaflet.draw |
| Gráficos | Recharts |
| Contentorização | Docker + Docker Compose (Nginx a servir o build do frontend) |

---

## ✅ Nota sobre verificação

O frontend foi validado num browser real (build de produção sem erros, ecrãs de login/registo, tratamento de erros de rede, redireccionamento de rotas protegidas). A validação ponta-a-ponta com dados reais (mapa, dashboards, sensores) requer uma base de dados PostgreSQL com PostGIS e TimescaleDB — nomeadamente via `docker-compose up`, que não foi possível correr no ambiente onde este código foi escrito por não ter o Docker Desktop instalado. Corre `docker-compose up -d --build` num ambiente com Docker para validação completa; o resto do sistema (rotas, schema, lógica de negócio) já tinha sido testado manualmente pelos autores, conforme descrito no relatório intermédio.

---

## 📋 Próximos Passos (evolução futura)

- [ ] Aplicação Mobile (React Native)
- [ ] Notificações externas (email / SMS) para alertas críticos
- [ ] Automatização da rega (accionamento de `irrigation_system` a partir de regras)
- [ ] Exportação PDF/CSV de relatórios
- [ ] Testes automatizados (Jest + Supertest no backend, Vitest no frontend)
- [ ] Integração com sensores físicos reais (actualmente suportado via MQTT + simulador)
