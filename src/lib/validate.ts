import { z } from "zod";
z.config({ jitless: true });

/**
 * Standard Place ID format validation.
 * Accepts Google Place IDs (typically 27-256 chars base64/url-safe) and test IDs.
 */
export const placeIdSchema = z
  .string()
  .trim()
  .min(3, "Place ID troppo corto")
  .max(512, "Place ID troppo lungo")
  .regex(/^[A-Za-z0-9_\-:\.]+$/, "Formato Place ID non valido")
  .refine(
    (val) => !["__proto__", "constructor", "prototype"].includes(val),
    "Place ID riservato non valido"
  );
