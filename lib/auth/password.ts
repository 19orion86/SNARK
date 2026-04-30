import bcrypt from "bcryptjs"

const MIN_SALT_ROUNDS = 12

function getSaltRounds(): number {
  const rawValue = Number(process.env.PASSWORD_SALT_ROUNDS ?? MIN_SALT_ROUNDS)
  if (Number.isNaN(rawValue)) return MIN_SALT_ROUNDS
  return Math.max(rawValue, MIN_SALT_ROUNDS)
}

export async function hashPassword(plainPassword: string): Promise<string> {
  return bcrypt.hash(plainPassword, getSaltRounds())
}

export async function verifyPassword(
  plainPassword: string,
  passwordHash: string
): Promise<boolean> {
  return bcrypt.compare(plainPassword, passwordHash)
}
