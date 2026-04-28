import prisma from '../lib/prisma';

interface AuditParams {
  entityType: string;
  entityId: string;
  action: string;
  performedById: string;
  previousValue?: object | null;
  newValue?: object | null;
}

export async function logAudit(params: AuditParams) {
  await prisma.auditLog.create({
    data: {
      entityType: params.entityType,
      entityId: params.entityId,
      action: params.action,
      performedById: params.performedById,
      previousValue: params.previousValue ?? undefined,
      newValue: params.newValue ?? undefined,
    },
  });
}
