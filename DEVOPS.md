# EventHive – DevOps setup (GitHub → Jenkins → Docker Hub → Ansible)

```
git push ──► GitHub ──► (1) GitHub Actions: test + docker build check   (fast feedback / PRs)
                  │
                  └──► (2) webhook ──► Jenkins
                                        ├─ npm install / npm test
                                        ├─ docker build  (tags: <build>-<sha>, latest)
                                        ├─ docker push   ──► Docker Hub
                                        └─ ansible-playbook ──► server: pulls image, runs
                                                                 app + mongo + prometheus + grafana
```

| Tool | Where | Role |
|---|---|---|
| GitHub | repo + `.github/workflows/ci.yml` | source of truth, CI check, webhook to Jenkins |
| Jenkins | `Jenkinsfile`, `jenkins/` | orchestrates build → push → deploy |
| Docker | `Dockerfile`, `docker-compose.yml` | packaging; compose for local dev |
| Ansible | `ansible/` | provisions Docker on the server and deploys the stack |

## 1. Prerequisites
- A Docker Hub account (the image repo can be **public** – the server pulls without login).
- A Linux server (Ubuntu/Debian) reachable by SSH with sudo – for production deploys.
- Jenkins host with Docker installed (your laptop/VM is fine).

## 2. Start Jenkins
```bash
sudo mkdir -p /opt/eventhive            # used by the "local" deploy mode
cd jenkins && docker compose up -d --build
docker exec jenkins cat /var/jenkins_home/secrets/initialAdminPassword
```
Open http://localhost:8080, paste the password, choose **Select plugins to install → none needed** (plugins are pre-baked), create the admin user.

## 3. Add credentials (Manage Jenkins → Credentials → Global)
| ID (exact) | Kind | Value |
|---|---|---|
| `dockerhub-creds` | Username with password | Docker Hub username + access token |
| `eventhive-jwt-secret` | Secret text | long random string (e.g. `openssl rand -hex 32`) |
| `ansible-ssh-key` | SSH Username with private key | user `ubuntu` + private key for the server |

## 4. Edit three placeholders
1. `Jenkinsfile` → `IMAGE_NAME = 'yourdockerhubuser/eventhive'`
2. `ansible/group_vars/all.yml` → same default image name (optional, Jenkins overrides it)
3. `ansible/inventory/production.ini` → `YOUR_SERVER_IP` and SSH user

## 5. Create the pipeline job
New Item → **Pipeline** → *Pipeline script from SCM* → Git → your GitHub repo URL, branch `*/main`, script path `Jenkinsfile`.
Tick **GitHub hook trigger for GITScm polling**. Run **Build with Parameters** once manually.

## 6. GitHub webhook
Repo → Settings → Webhooks → Add:
- Payload URL: `http://<jenkins-public-address>:8080/github-webhook/`
- Content type: `application/json`, event: *Just the push event*

Jenkins on a laptop isn't reachable from GitHub – use a tunnel such as `ngrok http 8080`, or skip the webhook and click *Build Now* / use *Poll SCM*.

## 7. Deploy targets
- **production** (default): Ansible SSHes to the server, installs Docker if missing, renders `/opt/eventhive/docker-compose.yml`, pulls `IMAGE_NAME:IMAGE_TAG`, starts the stack, waits for the container health check.
- **local**: deploys onto the Docker host running Jenkins (through the mounted `docker.sock`). Handy for demos; Linux/WSL hosts only.

Open ports on the server firewall/security group: 3000 (app), 3001 (Grafana), 9090 (Prometheus – restrict to your IP).

## Run Ansible by hand (no Jenkins)
```bash
cd ansible
ansible-galaxy collection install -r requirements.yml
export JWT_SECRET=... IMAGE_NAME=youruser/eventhive IMAGE_TAG=latest
ansible-playbook -i inventory/production.ini playbook.yml --private-key ~/.ssh/key.pem
```

## Things to know
- **GitHub Actions is now CI-only.** I removed the Docker Hub push and Render deploy hook from the old `ci-cd.yml` so Actions and Jenkins don't both publish/deploy. The `DOCKERHUB_*` and `RENDER_DEPLOY_HOOK` GitHub secrets are no longer needed.
- Pushes and deploys only happen for the `main` branch.
- `jenkins/docker-compose.yml` runs Jenkins as root with the host Docker socket mounted – convenient, but that grants root-equivalent access to the host. Fine for a lab; harden for real use.
- `ansible.cfg` sets `host_key_checking = False` for convenience; pin host keys for production.
- Change the Grafana admin password by exporting `GRAFANA_ADMIN_PASSWORD` in the Jenkins job environment.
- The app still uses SHA-256 password hashing and a default admin (`admin123`) – unchanged, but worth fixing before real use.
