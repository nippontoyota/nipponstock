import jwt from 'jsonwebtoken';

const SECRET = process.env.JWT_SECRET || 'changeme_secret';
const EXPIRY = process.env.JWT_EXPIRY || '8h';

export interface TokenPayload {
  userId: string;
  role: string;
  branchId: string | null;
}

export function signToken(payload: TokenPayload): string {
  return jwt.sign(payload, SECRET, { expiresIn: EXPIRY });
}

export function verifyToken(token: string): TokenPayload {
  return jwt.verify(token, SECRET) as TokenPayload;
}
