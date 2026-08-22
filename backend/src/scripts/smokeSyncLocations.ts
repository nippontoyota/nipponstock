/**
 * Smoke-test POST /stock/sync-locations auth + validation (no DB writes).
 * Run: LOCATION_SYNC_SECRET=testsecret npx ts-node --transpile-only src/scripts/smokeSyncLocations.ts
 */
import express from 'express';
import stockRouter from '../routes/stock';

process.env.LOCATION_SYNC_SECRET = process.env.LOCATION_SYNC_SECRET || 'test-sync-secret';

const app = express();
app.use(express.json({ limit: '1mb' }));
app.use('/stock', stockRouter);

const server = app.listen(0, async () => {
  const addr = server.address();
  if (!addr || typeof addr === 'string') throw new Error('no port');
  const base = `http://127.0.0.1:${addr.port}`;
  const secret = process.env.LOCATION_SYNC_SECRET!;

  const cases: { name: string; init: RequestInit; expectStatus: number }[] = [
    {
      name: 'rejects missing auth',
      init: { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"updates":[]}' },
      expectStatus: 401,
    },
    {
      name: 'rejects wrong secret',
      init: {
        method: 'POST',
        headers: { Authorization: 'Bearer wrong', 'Content-Type': 'application/json' },
        body: '{"updates":[]}',
      },
      expectStatus: 401,
    },
    {
      name: 'rejects bad body',
      init: {
        method: 'POST',
        headers: { Authorization: `Bearer ${secret}`, 'Content-Type': 'application/json' },
        body: '{"updates":"nope"}',
      },
      expectStatus: 400,
    },
  ];

  let failed = 0;
  for (const c of cases) {
    const res = await fetch(`${base}/stock/sync-locations`, c.init);
    if (res.status !== c.expectStatus) {
      console.error(`FAIL ${c.name}: got ${res.status}, want ${c.expectStatus}`);
      failed += 1;
    } else {
      console.log(`OK   ${c.name} (${res.status})`);
    }
  }

  // Empty updates with valid secret hits DB — only if DATABASE_URL set.
  if (process.env.DATABASE_URL) {
    const res = await fetch(`${base}/stock/sync-locations`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${secret}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ updates: [] }),
    });
    if (res.status !== 200) {
      console.error(`FAIL empty updates: got ${res.status}`, await res.text());
      failed += 1;
    } else {
      const body = await res.json();
      console.log('OK   empty updates', body);
      if (body.total !== 0 || body.updated !== 0) {
        console.error('FAIL empty updates body shape', body);
        failed += 1;
      }
    }
  } else {
    console.log('SKIP empty-updates DB check (DATABASE_URL unset)');
  }

  server.close();
  process.exit(failed ? 1 : 0);
});
