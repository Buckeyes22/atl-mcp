import { generateKeyPairSync } from "node:crypto";
import { createHash } from "node:crypto";
import { createGitRefKeyRegistryRepository } from "../src/storage/repositories/keyRegistryRepository.js";

async function main(): Promise<void> {
  const repoPath = process.cwd();
  const { publicKey, privateKey } = generateKeyPairSync("ed25519");
  const publicKeyPem = publicKey.export({ type: "spki", format: "pem" }).toString();
  const privateKeyPem = privateKey.export({ type: "pkcs8", format: "pem" }).toString();
  const keyId = createHash("sha256").update(publicKeyPem).digest("hex").slice(0, 16);
  await createGitRefKeyRegistryRepository({ repoPath }).registerPublicKey({ keyId, publicKeyPem });
  process.stdout.write(JSON.stringify({ keyId, publicKeyPem, privateKeyPem }, null, 2) + "\n");
}

main().catch((err) => {
  process.stderr.write(`audit key init failed: ${err instanceof Error ? err.stack ?? err.message : String(err)}\n`);
  process.exit(1);
});
