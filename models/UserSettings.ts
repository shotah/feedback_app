import mongoose from "mongoose";
import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

const { Schema, model, models } = mongoose;

const UserSettingsSchema = new Schema(
  {
    userId: { type: String, required: true, unique: true, index: true },
    llmProvider: {
      type: String,
      enum: ["openai", "anthropic"],
      default: "openai",
    },
    llmApiKeyEncrypted: { type: String },
    llmModel: { type: String, maxlength: 100, default: "" },
    /** Fine-grained or classic PAT; encrypted same as LLM key. Used for future PR/API automation. */
    githubPatEncrypted: { type: String },
    /** Target repo for automation, e.g. `acme/cyoa`. */
    githubDefaultRepo: { type: String, maxlength: 200, default: "" },
    githubDefaultBranch: { type: String, maxlength: 255, default: "main" },
  },
  { timestamps: true },
);

export const UserSettings =
  models.UserSettings ?? model("UserSettings", UserSettingsSchema);

function getEncryptionKey(): Buffer {
  const secret = process.env.AUTH_SECRET ?? "";
  const key = Buffer.alloc(32);
  Buffer.from(secret, "base64").copy(key);
  return key;
}

export function encryptApiKey(plaintext: string): string {
  const iv = randomBytes(16);
  const cipher = createCipheriv("aes-256-cbc", getEncryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  return iv.toString("hex") + ":" + encrypted.toString("hex");
}

export function decryptApiKey(ciphertext: string): string {
  const [ivHex, encHex] = ciphertext.split(":");
  if (!ivHex || !encHex) throw new Error("Malformed encrypted key");
  const iv = Buffer.from(ivHex, "hex");
  const encrypted = Buffer.from(encHex, "hex");
  const decipher = createDecipheriv("aes-256-cbc", getEncryptionKey(), iv);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
}
