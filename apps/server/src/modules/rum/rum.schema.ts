import mongoose, { Document, Schema } from 'mongoose';

export interface IRumRawEvent extends Document {
  eventId: string;
  projectId: string;
  type: 'page_view' | 'web_vital' | 'heartbeat';
  path: string;
  referrerSource: string;
  sessionHash: string;
  visitorHash: string;
  ttfbMs: number | null;
  fcpMs: number | null;
  lcpMs: number | null;
  browserName: string;
  osName: string;
  deviceType: 'mobile' | 'desktop' | 'tablet' | 'bot' | 'unknown';
  countryCode: string;
  regionCode: string;
  timestamp: Date;
  sdkVersion: string;
  ingestedAt: Date;
}

const RumRawEventSchema = new Schema<IRumRawEvent>(
  {
    eventId: { type: String, required: true, unique: true, index: true },
    projectId: { type: String, required: true, index: true },
    type: { type: String, required: true, enum: ['page_view', 'web_vital', 'heartbeat'] },
    path: { type: String, required: true, maxlength: 1024 },
    referrerSource: { type: String, required: true, maxlength: 255 },
    sessionHash: { type: String, required: true, maxlength: 64 },
    visitorHash: { type: String, required: true, maxlength: 64 },
    ttfbMs: { type: Number, default: null },
    fcpMs: { type: Number, default: null },
    lcpMs: { type: Number, default: null },
    browserName: { type: String, required: true, maxlength: 32 },
    osName: { type: String, required: true, maxlength: 32 },
    deviceType: { type: String, required: true, enum: ['mobile', 'desktop', 'tablet', 'bot', 'unknown'] },
    countryCode: { type: String, required: true, maxlength: 2 },
    regionCode: { type: String, required: true, maxlength: 16 },
    timestamp: { type: Date, required: true, index: true },
    sdkVersion: { type: String, required: true, maxlength: 16 },
    ingestedAt: { type: Date, required: true, default: () => new Date() },
  },
  {
    collection: 'rum_raw_events',
    timestamps: false,
  }
);

RumRawEventSchema.index({ ingestedAt: 1 }, { expireAfterSeconds: 604800 });
RumRawEventSchema.index({ projectId: 1, timestamp: -1 });
RumRawEventSchema.index({ projectId: 1, path: 1, timestamp: -1 });

export const RumRawEvent = mongoose.model<IRumRawEvent>('RumRawEvent', RumRawEventSchema);
