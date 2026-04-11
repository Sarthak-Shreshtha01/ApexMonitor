import mongoose, { Schema, Document } from 'mongoose';

export interface IApiLog extends Document {
  reqId:       string;      
  projectId:   string;      
  method:      string;      
  endpoint:    string;      
  statusCode:  number;      
  latencyMs:   number;      
  ip:          string;      
  userAgent:   string;      
  region:      string;      
  timestamp:   Date;        
  sdkVersion:  string;      
  tags:        string[];    
}

const ApiLogSchema = new Schema<IApiLog>({
  reqId:      { type: String, required: true, unique: true, index: true },
  projectId:  { type: String, required: true, index: true },
  method:     { type: String, required: true, enum: ['GET','POST','PUT','DELETE','PATCH','OPTIONS'] },
  endpoint:   { type: String, required: true, maxlength: 512 },
  statusCode: { type: Number, required: true, min: 100, max: 599 },
  latencyMs:  { type: Number, required: true, min: 0 },
  ip:         { type: String, required: true },
  userAgent:  { type: String, default: '', maxlength: 512 },
  region:     { type: String, default: 'XX' },
  timestamp:  { type: Date, required: true },
  sdkVersion: { type: String, default: 'unknown' },
  tags:       { type: [String], default: [], validate: (v: string[]) => v.length <= 10 },
}, {
  collection: 'api_logs',
  timestamps: false, // We manage 'timestamp' manually from the SDK payload
});

// Optimization: Compound indexes for fast dashboard drill-downs
ApiLogSchema.index({ projectId: 1, timestamp: -1 });
ApiLogSchema.index({ projectId: 1, endpoint: 1, timestamp: -1 });
ApiLogSchema.index({ projectId: 1, statusCode: 1, timestamp: -1 });

// TTL Index: Auto-delete documents older than 90 days (7,776,000 seconds)
ApiLogSchema.index({ timestamp: 1 }, { expireAfterSeconds: 7_776_000 });

export const ApiLog = mongoose.model<IApiLog>('ApiLog', ApiLogSchema);