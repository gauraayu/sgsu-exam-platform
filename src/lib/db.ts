import { setServers } from "node:dns";
import mongoose from "mongoose";

/**
 * Some ISP/router DNS servers refuse the SRV lookup that Atlas `mongodb+srv://` strings need
 * ("querySrv ECONNREFUSED"). For SRV URIs we use public resolvers instead.
 * Override with MONGODB_DNS_SERVERS="ip,ip", or set it to "off" to keep the system DNS.
 */
function applyReliableDns(uri: string) {
  const setting = (process.env.MONGODB_DNS_SERVERS ?? "1.1.1.1,8.8.8.8").trim();
  if (!uri.startsWith("mongodb+srv://") || setting.toLowerCase() === "off" || !setting) return;
  try {
    setServers(setting.split(",").map((x) => x.trim()).filter(Boolean));
  } catch {
    /* keep system DNS if the list is invalid */
  }
}

type Cache = { conn: typeof mongoose | null; promise: Promise<typeof mongoose> | null };

const globalForMongoose = globalThis as unknown as { __sgsuMongoose?: Cache };
const cache: Cache = globalForMongoose.__sgsuMongoose ?? { conn: null, promise: null };
globalForMongoose.__sgsuMongoose = cache;

/**
 * Returns a shared Mongoose connection. The connection is cached on globalThis so that
 * hot reloads in development and warm serverless invocations reuse one pool.
 */
export async function connectDB(uri = process.env.MONGODB_URI): Promise<typeof mongoose> {
  if (cache.conn && mongoose.connection.readyState === 1) return cache.conn;
  if (!uri) throw new Error("MONGODB_URI is not configured.");
  if (!cache.promise) {
    applyReliableDns(uri);
    mongoose.set("strictQuery", true);
    cache.promise = mongoose
      .connect(uri, {
        maxPoolSize: Number(process.env.MONGODB_POOL_SIZE || 10),
        serverSelectionTimeoutMS: 10_000,
        autoIndex: true,
      })
      .catch((err) => {
        cache.promise = null;
        throw err;
      });
  }
  cache.conn = await cache.promise;
  return cache.conn;
}

export async function disconnectDB() {
  if (cache.conn) await mongoose.disconnect();
  cache.conn = null;
  cache.promise = null;
}
