# web: Dhaka Tesla Pool frontend

Next.js (App Router) + Tailwind. See the [root README](../README.md) for setup and architecture.

```bash
cp .env.example .env.local   # API_URL=http://localhost:4000
npm install
npm run dev                  # http://localhost:3000
```

Browser requests go to `/api/*` on this server, and `src/app/api/[...path]/route.ts`
forwards them to the Express API at `API_URL` (read at request time).
