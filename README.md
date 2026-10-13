# EventHive — Docker, GitHub, Jenkins and Ansible

EventHive is a Node.js + Express event-ticket booking app using MongoDB. This project includes:
- **Docker**: packages the app into a container.
- **Docker Compose**: starts the app and MongoDB locally; Prometheus and Grafana are included for monitoring.
- **GitHub Actions**: runs basic validation and builds the Docker image on pushes and pull requests.
- **Jenkins**: runs tests, builds the image, pushes it to Docker Hub on `main`, then deploys it with Ansible.
- **Ansible**: installs Docker on an Ubuntu deployment server and starts the published image with Docker Compose.

> The CI and deployment pipeline needs your own GitHub repository, Docker Hub account, Jenkins server and Ubuntu deployment machine. Those external accounts/servers cannot be configured automatically by the project ZIP.

## 1. Requirements

Install:
1. Git
2. Node.js 20 or later (for running tests locally)
3. Docker Desktop (Windows/Mac) or Docker Engine + Docker Compose (Linux)
4. A GitHub account and Docker Hub account
5. For deployment only: Jenkins agent with Docker CLI/daemon, Ansible, Node.js 20, and SSH access to an Ubuntu server

## 2. Run EventHive locally with Docker

Open a terminal in the `eventhive` project folder.

**Windows PowerShell**
```powershell
Copy-Item .env.example .env
```

Open `.env` and replace `JWT_SECRET` with a long random value (at least 32 characters). Then run:
```powershell
docker compose up --build -d
docker compose ps
```

Open:
- App: http://localhost:3000
- Health check: http://localhost:3000/health
- Prometheus: http://localhost:9090
- Grafana: http://localhost:3001

To view logs:
```powershell
docker compose logs -f app
```
To stop the containers:
```powershell
docker compose down
```
To stop and also delete the database volume (this permanently deletes local MongoDB data):
```powershell
docker compose down -v
```

Demo admin login: `admin@eventhive.com` / `admin123`. Change this default admin account/password behavior before using the application publicly. Do not expose the demo credentials on a public deployment.

## 3. Push the project to GitHub

1. Create a **new empty repository** on GitHub, for example `eventhive`.
2. In the project folder, run:
```bash
git init
git add .
git commit -m "Add EventHive app and DevOps pipeline"
git branch -M main
git remote add origin https://github.com/YOUR_GITHUB_USERNAME/eventhive.git
git push -u origin main
```
Replace `YOUR_GITHUB_USERNAME` with your GitHub username. If the folder is already a Git repository, skip `git init` and check `git remote -v` first.

### GitHub Actions

The workflow is at `.github/workflows/ci-cd.yml`. After pushing, open the repository's **Actions** tab. It runs `npm install`, `npm test`, and `docker build`. It does not deploy; Jenkins is responsible for deployment, avoiding two competing deployment pipelines.

## 4. Set up Docker Hub

1. Create a repository named `eventhive` on Docker Hub.
2. Create a Docker Hub access token.
3. Keep the username and token ready for Jenkins credentials. Never commit tokens to Git.

The Jenkins pipeline publishes two tags: `latest` and the Jenkins build number. The Docker Hub repository must be public for the deployment playbook as written, because the target server pulls the image without logging in. If you need a private repository, configure Docker Hub login on the target host before deployment.

## 5. Set up the Jenkins agent

The machine/agent that runs this pipeline needs:
- Git
- Node.js 20 and npm
- Docker installed and the Jenkins user allowed to run Docker
- Ansible installed (`ansible-playbook --version`)
- SSH connectivity to the Ubuntu target server

Install the Jenkins **Pipeline** and **Credentials Binding** plugins if not already installed. Create a **Multibranch Pipeline** job (recommended) and add your GitHub repository as the branch source, scan the repository branches, and keep the script path as `Jenkinsfile`. Jenkins will use the `main` branch for publishing and deployment.

### Add these Jenkins credentials

Go to **Manage Jenkins → Credentials** and create:

| Credential ID | Type | Value |
|---|---|---|
| `dockerhub-credentials` | Username with password | Docker Hub username + access token as password |
| `eventhive-deploy-ssh` | SSH Username with private key | SSH username and private key for your Ubuntu server |
| `eventhive-jwt-secret` | Secret text | Long random secret, at least 32 characters |

Credential IDs must match exactly. Do not paste secret values into the Jenkinsfile or GitHub repository.

Also configure a Jenkins environment variable named `DEPLOY_HOST` containing the public IP or DNS name of your Ubuntu server. The server must accept SSH from the Jenkins agent, and the SSH user must have sudo privileges. Ensure the server's firewall allows inbound TCP port 3000 if you want to access the app directly.

## 6. How the Jenkins + Ansible deployment works

When a commit is pushed to `main`, Jenkins:
1. Checks out the repository.
2. Installs npm dependencies and runs `npm test`.
3. Builds the Docker image.
4. Logs into Docker Hub using Jenkins credentials and pushes versioned and `latest` tags.
5. Runs `ansible/deploy.yml` against `DEPLOY_HOST`.
6. Ansible installs Docker and the Compose plugin, copies `docker-compose.prod.yml`, writes deployment environment variables, pulls the image and starts the services.
7. Ansible checks `http://127.0.0.1:3000/health` and fails the build if the health check does not pass.

The target host is expected to be Ubuntu/Debian-based, with SSH and sudo access. Package names can vary on non-Ubuntu distributions.

## 7. Test the pipeline

1. Make a small change to `README.md`.
2. Commit and push to `main`.
3. Check **GitHub → Actions** for the validation/build result.
4. Check the Jenkins build console for the push and deployment stages.
5. Open `http://YOUR_SERVER_IP:3000/health`; expected response:
```json
{"status":"ok"}
```
6. Open `http://YOUR_SERVER_IP:3000` to use EventHive.

## Troubleshooting

- **Docker command not found**: install Docker Desktop/Engine and restart the terminal.
- **Docker permission denied on Jenkins**: grant the Jenkins agent user access to Docker, then restart the agent. This is a powerful permission; only do this on a trusted Jenkins machine.
- **Ansible SSH failure**: check `DEPLOY_HOST`, the SSH credential, authorized keys, firewall rules, and sudo access.
- **Docker Hub push denied**: confirm the `dockerhub-credentials` ID, access token, and repository name.
- **Port already in use**: stop the process/container using 3000, 9090 or 3001, or edit the host-side port mapping.
- **MongoDB startup timing**: Compose waits for MongoDB's health check before starting the app.
- **App starts but database is empty**: MongoDB data is stored in the `mongo-data` Docker volume.

## Important security note

This is a learning/demo project. Before exposing it to the internet, replace the demo admin credentials, use HTTPS and a firewall, review authentication/password hashing, and protect MongoDB and Grafana from public access. The `.env` file is ignored by Git; keep secrets out of source control.
