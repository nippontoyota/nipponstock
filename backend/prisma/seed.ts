import { PrismaClient, Role } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // ── Admin user ────────────────────────────────────────────────────────
  const adminHash = await bcrypt.hash('Admin@1234', 12);
  const admin = await prisma.user.upsert({
    where: { loginId: 'admin' },
    update: {},
    create: {
      loginId: 'admin',
      passwordHash: adminHash,
      role: Role.ADMIN,
      fullName: 'System Admin',
      isActive: true,
    },
  });
  console.log(`✓ Admin user created — loginId: "admin"  password: "Admin@1234"`);

  // ── Global default blocking duration (7 days) ─────────────────────────
  await prisma.globalConfig.upsert({
    where: { key: 'default_blocking_days' },
    update: {},
    create: {
      key: 'default_blocking_days',
      value: '7',
      updatedById: admin.id,
    },
  });
  console.log('✓ Global config: default_blocking_days = 7');

  console.log('\nSeed complete. Login with:');
  console.log('  Login ID : admin');
  console.log('  Password : Admin@1234');
  console.log('\nChange the password after first login!');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
