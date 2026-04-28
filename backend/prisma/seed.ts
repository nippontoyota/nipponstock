import { PrismaClient, Role } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  // Branches
  const branches = await Promise.all(
    [
      { name: 'Branch Alpha', location: 'Chennai' },
      { name: 'Branch Beta', location: 'Coimbatore' },
      { name: 'Branch Gamma', location: 'Madurai' },
      { name: 'Branch Delta', location: 'Trichy' },
      { name: 'Branch Epsilon', location: 'Salem' },
      { name: 'Branch Zeta', location: 'Tirunelveli' },
      { name: 'Branch Eta', location: 'Vellore' },
      { name: 'Branch Theta', location: 'Erode' },
      { name: 'Branch Iota', location: 'Tiruppur' },
      { name: 'Branch Kappa', location: 'Hosur' },
      { name: 'Branch Lambda', location: 'Ooty' },
      { name: 'Branch Mu', location: 'Kumbakonam' },
    ].map((b) =>
      prisma.branch.upsert({
        where: { id: b.name },
        update: {},
        create: b,
      })
    )
  );

  // Admin user
  const adminHash = await bcrypt.hash('Admin@1234', 12);
  await prisma.user.upsert({
    where: { loginId: 'admin' },
    update: {},
    create: {
      loginId: 'admin',
      passwordHash: adminHash,
      role: Role.ADMIN,
      fullName: 'System Admin',
    },
  });

  // One sales manager per branch
  for (let i = 0; i < branches.length; i++) {
    const branch = branches[i];
    const loginId = `sales${i + 1}`;
    const hash = await bcrypt.hash('Sales@1234', 12);
    await prisma.user.upsert({
      where: { loginId },
      update: {},
      create: {
        loginId,
        passwordHash: hash,
        role: Role.SALES_MANAGER,
        fullName: `Sales Manager ${i + 1}`,
        branchId: branch.id,
      },
    });
  }

  // Global default blocking duration
  await prisma.globalConfig.upsert({
    where: { key: 'default_blocking_days' },
    update: {},
    create: { key: 'default_blocking_days', value: '7' },
  });

  console.log('Seed complete.');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
