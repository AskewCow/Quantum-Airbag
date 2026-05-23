import { assert } from "chai";
import { ml_dsa65 } from "@noble/post-quantum/ml-dsa";
import * as crypto from "crypto";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";

// Helpers mirroring client/src/index.ts logic — tested independently of CLI wiring

function generateKeypairToFile(filePath: string) {
  const seed = crypto.getRandomValues(new Uint8Array(32));
  const keypair = ml_dsa65.keygen(seed);
  fs.writeFileSync(filePath, JSON.stringify({
    publicKey: Array.from(keypair.publicKey),
    secretKey: Array.from(keypair.secretKey),
  }));
  return keypair;
}

function signPayload(secretKey: Uint8Array, payload: Uint8Array) {
  const signature = ml_dsa65.sign(secretKey, payload);
  const sigHash = crypto.createHash("sha256").update(signature).digest();
  return { signature, sigHash };
}

describe("client — PQC key management", () => {
  let tmpDir: string;
  let keyPath: string;

  before(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "qa-test-"));
    keyPath = path.join(tmpDir, "pqc-keypair.json");
  });

  after(() => {
    fs.rmSync(tmpDir, { recursive: true });
  });

  describe("key generation", () => {
    it("generates a keypair and writes it to disk", () => {
      generateKeypairToFile(keyPath);
      assert.isTrue(fs.existsSync(keyPath));
    });

    it("saved public key is 1952 bytes (ML-DSA-65 spec)", () => {
      const raw = JSON.parse(fs.readFileSync(keyPath, "utf-8"));
      assert.equal(raw.publicKey.length, 1952);
    });

    it("saved secret key is 4032 bytes (ML-DSA-65 spec)", () => {
      const raw = JSON.parse(fs.readFileSync(keyPath, "utf-8"));
      assert.equal(raw.secretKey.length, 4032);
    });

    it("two generated keypairs have different public keys", () => {
      const path2 = path.join(tmpDir, "pqc-keypair-2.json");
      generateKeypairToFile(keyPath);
      generateKeypairToFile(path2);
      const k1 = JSON.parse(fs.readFileSync(keyPath, "utf-8")).publicKey;
      const k2 = JSON.parse(fs.readFileSync(path2, "utf-8")).publicKey;
      assert.notDeepEqual(k1, k2);
    });
  });

  describe("signing", () => {
    let secretKey: Uint8Array;
    let publicKey: Uint8Array;

    before(() => {
      const kp = generateKeypairToFile(keyPath);
      secretKey = kp.secretKey;
      publicKey = kp.publicKey;
    });

    it("produces a signature larger than Solana's tx limit (1232 bytes)", () => {
      const payload = Buffer.from("test-withdrawal-payload");
      const { signature } = signPayload(secretKey, payload);
      assert.isAbove(signature.length, 1232, "signature must exceed Solana tx limit");
    });

    it("hash commitment is exactly 32 bytes", () => {
      const payload = Buffer.from("test-withdrawal-payload");
      const { sigHash } = signPayload(secretKey, payload);
      assert.equal(sigHash.length, 32);
    });

    it("same payload produces deterministic hash commitment", () => {
      const payload = Buffer.from("deterministic-test");
      const { sigHash: h1 } = signPayload(secretKey, payload);
      const { sigHash: h2 } = signPayload(secretKey, payload);
      assert.equal(h1.toString("hex"), h2.toString("hex"));
    });

    it("different payloads produce different hash commitments", () => {
      const { sigHash: h1 } = signPayload(secretKey, Buffer.from("payload-a"));
      const { sigHash: h2 } = signPayload(secretKey, Buffer.from("payload-b"));
      assert.notEqual(h1.toString("hex"), h2.toString("hex"));
    });

    it("signature verifies against the public key", () => {
      const payload = Buffer.from("verify-me");
      const { signature } = signPayload(secretKey, payload);
      const valid = ml_dsa65.verify(publicKey, payload, signature);
      assert.isTrue(valid);
    });

    it("signature fails verification against a different public key", () => {
      const seed2 = crypto.getRandomValues(new Uint8Array(32));
      const otherKp = ml_dsa65.keygen(seed2);
      const payload = Buffer.from("verify-me");
      const { signature } = signPayload(secretKey, payload);
      const valid = ml_dsa65.verify(otherKp.publicKey, payload, signature);
      assert.isFalse(valid);
    });
  });

  describe("key rotation", () => {
    it("rotated keypair has different public key from original", () => {
      const original = generateKeypairToFile(keyPath);
      const rotatedPath = keyPath.replace(".json", "-rotated.json");
      generateKeypairToFile(rotatedPath);
      const rotated = JSON.parse(fs.readFileSync(rotatedPath, "utf-8"));
      assert.notDeepEqual(Array.from(original.publicKey), rotated.publicKey);
    });
  });
});
