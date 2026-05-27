import jwt, { SignOptions } from 'jsonwebtoken';

const SECRET = process.env.JWT_SECRET || 'changeme_secret';
// If JWT_EXPIRY is a plain integer string (e.g. "3600"), parse as seconds (number).
// If it has a unit (e.g. "8h"), pass as-is. Default: 8 hours.
const _expiry = process.env.JWT_EXPIRY || '8h';
const EXPIRY = (/^\d+$/.test(_expiry)
  ? parseInt(_expiry, 10)
  : _expiry) as SignOptions['expiresIn'];

export interface TokenPayload {
  userId: string;
  role: string;
  branchId: string | null;
  clusterNumber: number | null;
}

export function signToken(payload: TokenPayload): string {
  return jwt.sign(payload, SECRET, { expiresIn: EXPIRY });
}

export function verifyToken(token: string): TokenPayload {
  return jwt.verify(token, SECRET) as TokenPayload;
}
