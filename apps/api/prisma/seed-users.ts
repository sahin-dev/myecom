import { PrismaClient, UserRole } from "@prisma/client";
import { config } from "dotenv";
import { resolve } from "node:path";
import { scrypt as scryptCallback, randomBytes } from "node:crypto";
import { promisify } from "node:util";

config({ path: resolve(__dirname, "../.env"), override: true });
config({ path: resolve(__dirname, "../../../.env") });

const prisma = new PrismaClient();
const scrypt = promisify(scryptCallback);

async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const hash = (await scrypt(password, salt, 64)) as Buffer;
  return `${salt}:${hash.toString("hex")}`;
}

async function main() {
  const accounts = [
    {
      name: "Store Administrator",
      email: "admin@myecom.local",
      password: "Admin123!",
      role: UserRole.ADMIN
    },
    {
      name: "Demo Customer",
      email: "customer@myecom.local",
      password: "Customer123!",
      role: UserRole.CUSTOMER
    }
  ];

  for (const account of accounts) {
    await prisma.user.upsert({
      where: { email: account.email },
      update: { name: account.name, role: account.role },
      create: {
        name: account.name,
        email: account.email,
        passwordHash: await hashPassword(account.password),
        role: account.role
      }
    });
  }
}

main()
  .then(async () => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
