import mongoose from "mongoose";

const { Schema, model, models } = mongoose;

export const FEEDBACK_KINDS = ["feature", "bug", "other"] as const;
export type FeedbackKind = (typeof FEEDBACK_KINDS)[number];

const AiOutputSchema = new Schema(
  {
    refused: { type: Boolean, default: false },
    summary: { type: String, default: "" },
    proposedSteps: { type: [String], default: [] },
    risks: { type: [String], default: [] },
    outOfScope: { type: [String], default: [] },
    doNotDo: { type: [String], default: [] },
  },
  { _id: false },
);

const FeedbackSchema = new Schema(
  {
    userId: { type: String, required: true, index: true },
    title: { type: String, maxlength: 200, default: "" },
    kind: {
      type: String,
      enum: FEEDBACK_KINDS,
      default: "other",
    },
    text: { type: String, required: true, maxlength: 8000 },
    contextWhere: { type: String, maxlength: 2000 },
    contextPage: { type: String, maxlength: 500 },
    contextSteps: { type: String, maxlength: 4000 },
    status: {
      type: String,
      enum: ["pending", "processing", "done", "approved", "applying", "applied", "error"],
      default: "pending",
    },
    aiOutput: { type: AiOutputSchema, required: false },
    aiRaw: { type: String },
    approvedPlan: { type: [String], default: undefined },
    codeOutput: { type: String },
    applyResult: { type: String },
    appliedAt: { type: Date },
    errorMessage: { type: String },
    githubIssueUrl: { type: String },
    githubIssueNumber: { type: Number },
    source: { type: String, enum: ["ui", "api"], required: true },
  },
  { timestamps: true },
);

FeedbackSchema.index({ userId: 1, createdAt: -1 });

export type FeedbackDoc = mongoose.InferSchemaType<typeof FeedbackSchema>;

export const Feedback = models.Feedback ?? model("Feedback", FeedbackSchema);
