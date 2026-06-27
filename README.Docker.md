# Docker / Oracle Free Tier Notes

This repo is configured for a small single-VM deployment.

## Services

- `web`: Nginx serving the built React app and proxying `/api`
- `api`: Fastify + Prisma backend
- `db`: PostgreSQL 16 with a persistent Docker volume

## Local compose run

```bash
cp .env.example .env
docker compose up --build
```

Edit `.env` before using this outside local development. Use long random values for `POSTGRES_PASSWORD`, `JWT_SECRET`, and `COOKIE_SECRET`.

## Oracle VM run shape

On the Oracle VM:

```bash
sudo mkdir -p /opt/fin-track
cd /opt/fin-track
git clone https://github.com/rust-sec/Fin_Track.git .
cp .env.example .env
docker compose up -d --build
```

Open inbound port 80 in both the Oracle security list and the VM firewall.
