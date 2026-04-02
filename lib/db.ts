import mongoose from "mongoose";

const globalForMongoose = globalThis as unknown as {
  mongooseConn?: { conn: typeof mongoose | null; promise: Promise<typeof mongoose> | null };
};

function getCache() {
  if (!globalForMongoose.mongooseConn) {
    globalForMongoose.mongooseConn = { conn: null, promise: null };
  }
  return globalForMongoose.mongooseConn;
}

export async function connectDb(): Promise<typeof mongoose> {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error("MONGODB_URI is not set");
  }
  const cached = getCache();
  if (cached.conn) return cached.conn;
  if (!cached.promise) {
    cached.promise = mongoose.connect(uri);
  }
  cached.conn = await cached.promise;
  return cached.conn;
}
