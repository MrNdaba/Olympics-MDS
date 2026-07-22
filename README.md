# MDS — Master Delivery System

MDS is the Dakar 2026 Youth Olympic Games delivery and collection booking platform.

## Local Development

Install dependencies:

```bash
npm ci
```

Start the development server:

```bash
npm run dev
```

Open http://localhost:3000 in your browser.

## Core Scripts

- `npm run dev` - start local dev server
- `npm run build` - production build
- `npm run start` - run production build locally
- `npm run lint` - run ESLint
- `npm run vercel-build` - Prisma client generation + Next.js build for Vercel

## Database

Local development uses SQLite through Prisma.

For Vercel production deployments, use Postgres (recommended). See deployment guide below.

## Vercel Deployment

See the dedicated deployment guide:

- [VERCEL_DEPLOYMENT.md](./VERCEL_DEPLOYMENT.md)
