# EventHive (Mini) – Event ticketing with QR + DevOps pipeline

## Run locally
    docker compose up --build
App: http://localhost:3000 | Prometheus: :9090 | Grafana: :3001 (admin/admin)
Admin login: admin@eventhive.com / admin123

## Without Docker
    npm install && MONGO_URL=mongodb://localhost:27017/eventhive npm start

## CI/CD
GitHub → Jenkins → Docker Hub → Ansible. Full setup guide: [DEVOPS.md](DEVOPS.md)

## Grafana
Add data source Prometheus (http://prometheus:9090), then panel query: `eventhive_tickets_booked`

## Demo flow
1. Admin creates event  2. Student registers, books -> QR + ID
3. Admin pastes ID in Check-in -> Valid; paste again -> Already used; random text -> Invalid
4. Dashboard / Grafana show tickets booked
