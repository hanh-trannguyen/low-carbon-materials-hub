import { z } from "zod";

export const lifecycleModules = [
  "A1-A3",
  "A4",
  "A5",
  "B1-B7",
  "C1",
  "C2",
  "C3",
  "C4",
  "D"
] as const;

export const fieldStatuses = [
  "reported",
  "not_declared",
  "not_found",
  "ambiguous"
] as const;

export const verificationStatuses = [
  "supported",
  "contradicted",
  "not_found",
  "ambiguous"
] as const;

export const sourceSchema = z.object({
  page: z.number().int().positive(),
  quote: z.string().min(1)
});

export const sourcedNumberSchema = z.object({
  value: z.number().nullable(),
  unit: z.string().nullable(),
  status: z.enum(fieldStatuses),
  source: sourceSchema.nullable()
});

export const lifecycleGwpSchema = z.object({
  module: z.enum(lifecycleModules),
  value: z.number().nullable(),
  unit: z.string().nullable(),
  status: z.enum(fieldStatuses),
  source: sourceSchema.nullable(),
  verification: z.object({
    status: z.enum(verificationStatuses),
    confidence: z.number().min(0).max(1)
  })
});

export const epdSchema = z.object({
  id: z.string().min(1),
  sourcePdf: z.string().min(1),
  productName: z.string().min(1),
  manufacturer: z.string().min(1),
  declaredUnit: z.string().nullable().transform((val) => {
    if (val === "1 m3") return "1 m³";
    return val;
  }),
  manufacturingLocation: z.string().nullable(),
  compressiveStrength: sourcedNumberSchema,
  lifeCycleGwp: z.array(lifecycleGwpSchema),
  comparabilityNotes: z.array(z.string()),
  dataQualityFlags: z.array(z.string())
}).superRefine((epd, ctx) => {
  for (const [index, gwp] of epd.lifeCycleGwp.entries()) {
    if (gwp.status === "reported") {
      if (gwp.value === null || gwp.unit === null || gwp.source === null) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["lifeCycleGwp", index],
          message: "reported GWP values require value, unit, and source"
        });
      } else if (["A1-A3", "A4", "A5"].includes(gwp.module) && gwp.value < 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["lifeCycleGwp", index, "value"],
          message: `GWP value for ${gwp.module} must be non-negative. OCR may have misread a table border or hyphen as a minus sign.`
        });
      }
    } else if (gwp.value !== null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["lifeCycleGwp", index, "value"],
        message: "non-reported GWP values must be null"
      });
    }
  }

  if (
    epd.compressiveStrength.status === "reported" &&
    (epd.compressiveStrength.value === null ||
      epd.compressiveStrength.unit === null ||
      epd.compressiveStrength.source === null)
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["compressiveStrength"],
      message: "reported compressive strength requires value, unit, and source"
    });
  }
});

export type LifecycleModule = (typeof lifecycleModules)[number];
export type FieldStatus = (typeof fieldStatuses)[number];
export type Epd = z.infer<typeof epdSchema>;
