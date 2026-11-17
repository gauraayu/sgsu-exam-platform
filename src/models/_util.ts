import mongoose, { type Model, type Schema } from "mongoose";

/** Re-uses a compiled model across hot reloads / serverless warm starts. */
export function getModel<T>(name: string, schema: Schema<T>): Model<T> {
  return (mongoose.models[name] as Model<T>) ?? mongoose.model<T>(name, schema);
}
