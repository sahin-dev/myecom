# My Ecom

A full-stack ecommerce starter with a Next.js storefront, NestJS API, Prisma ORM, and MongoDB.

## Features

- Customer accounts with registration, sign in, profile editing, order history, wishlist, and notifications.
- Storefront with search, category filtering, product sections, brands, banners, cart, product checkout, and private order tracking.
- Role-protected admin console for creating brands, banners, and products with secure image uploads.
- Decision-ready admin analytics with comparison-period KPIs, sales trends, run-rate projections, customer retention signals, product performance, and low-stock alerts.
- Order operations workspace with search, status/payment filters, CSV export, courier tracking, internal notes, customer notifications, and fulfillment history.
- Inventory controls for stock, price, cost basis, catalog visibility, trending placement, and margin-data coverage.
- Prisma MongoDB models for users, products, brands, banners, carts, orders, tracking events, and notifications.
- Two-color UI system: white plus a calm modern teal.

## Setup

```bash
pnpm install
cp .env.example apps/api/.env
cp .env.example apps/web/.env.local
docker compose up -d mongo
pnpm prisma:generate
pnpm prisma:seed
pnpm prisma:seed-users
pnpm dev
```

The web app runs on `http://localhost:3000` and the API runs on `http://localhost:4000`.

Admin console: `http://localhost:3000/admin`

Demo accounts:

```text
Admin:    admin@myecom.local / Admin123!
Customer: customer@myecom.local / Customer123!
```

## Environment

`apps/api/.env`

```bash
MONGODB_URI="mongodb://localhost:27017/my-ecom"
PORT=4000
API_PUBLIC_URL="http://localhost:4000"
JWT_SECRET="replace-with-a-long-random-production-secret"
```

`apps/web/.env.local`

```bash
NEXT_PUBLIC_API_URL="http://localhost:4000"
```

Uploaded JPG, PNG, and WebP files are limited to 5 MB and are served from the API's `/uploads` path.
