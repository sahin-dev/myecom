import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCallback);

export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const hash = (await scrypt(password, salt, 64)) as Buffer;
  return `${salt}:${hash.toString("hex")}`;
}

export async function verifyPassword(password: string, stored: string) {
  const [salt, key] = stored.split(":");
  if (!salt || !key) return false;

  const storedBuffer = Buffer.from(key, "hex");
  const suppliedBuffer = (await scrypt(password, salt, 64)) as Buffer;
  return (
    storedBuffer.length === suppliedBuffer.length &&
    timingSafeEqual(storedBuffer, suppliedBuffer)
  );
}
