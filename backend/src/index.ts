import 'dotenv/config';
import express, { NextFunction, Request, Response } from 'express';
import http from 'http';
import cors from 'cors';
import { Server } from 'socket.io';

// Prevent unhandled promise rejections (e.g. Supabase P1017) from crashing the process
process.on('unhandledRejection', (reason) => {
  console.error('[unhandledRejection]', reason);
});

import { setIO } from './services/events';
import { startExpiryJob } from './services/expiry';
import { startVisibilitySnapshotJob, captureVisibilitySnapshot } from './services/visibilitySnapshot';

import authRouter from './routes/auth';
import stockRouter from './routes/stock';
import blockingRouter from './routes/blocking';
import analyticsRouter from './routes/analytics';
import configRouter from './routes/config';
import usersRouter from './routes/users';
import branchesRouter from './routes/branches';
import carsRouter from './routes/cars';
import vehicleRequestsRouter from './routes/vehicleRequests';
import financeRouter from './routes/finance';
import financeHeadRouter from './routes/financeHead';
import clusterManagerRouter from './routes/clusterManager';
import ceoRouter from './routes/ceo';
import deliveryRouter from './routes/delivery';
import adminRouter from './routes/admin';

const app = express();
const server = http.createServer(app);

const allowedOrigins = [
  process.env.FRONTEND_URL || 'http://localhost:5173',
  'http://localhost:3000',
  'https://market-share.bharath-c.workers.dev'
];

const io = new Server(server, {
  cors: { origin: allowedOrigins, credentials: true },
});

setIO(io);

const corsOptions = {
  origin: function (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
};

app.use(cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Static uploads (if local storage is used)
app.use('/uploads', express.static('uploads'));

app.use('/auth', authRouter);
app.use('/stock', stockRouter);
app.use('/blocking', blockingRouter);
app.use('/analytics', analyticsRouter);
app.use('/config', configRouter);
app.use('/users', usersRouter);
app.use('/branches', branchesRouter);
app.use('/cars', carsRouter);
app.use('/vehicle-requests', vehicleRequestsRouter);
app.use('/finance', financeRouter);
app.use('/finance-head', financeHeadRouter);
app.use('/cluster-manager', clusterManagerRouter);
app.use('/ceo', ceoRouter);
app.use('/delivery', deliveryRouter);
app.use('/admin', adminRouter);

app.get('/health', (_req, res) => res.json({ ok: true }));

import prisma from './lib/prisma';
app.get('/public/mtd-tally', async (_req, res) => {
  const { BRANCH_GROUPS } = await import('./lib/branchGroups');
  const rows = await prisma.branchMtdTally.findMany({
    where: { branchCode: { in: BRANCH_GROUPS.map((g) => g.branchCode) } },
  });
  const byCode = new Map(rows.map((r) => [r.branchCode, r]));

  const result: Record<string, number> = {};
  for (const g of BRANCH_GROUPS) {
    result[g.display] = byCode.get(g.branchCode)?.mtdTally ?? 0;
  }
  res.json(result);
});

// Global error handler — catches errors passed via next(err) or thrown in async routes
// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error('[express error]', err);
  if (!res.headersSent) res.status(500).json({ error: 'Internal server error' });
});

io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);
  socket.on('disconnect', () => console.log('Client disconnected:', socket.id));
});

startExpiryJob();
startVisibilitySnapshotJob();
captureVisibilitySnapshot().catch((err) => console.error('Initial visibility snapshot failed:', err));

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
