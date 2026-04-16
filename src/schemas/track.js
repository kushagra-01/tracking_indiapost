const { z } = require("zod");
const { maxConsignments } = require("../lib/config");

// Server batches upstream bulk calls as needed (see indiaPostClient BULK_MAX_PER_REQUEST).
const CONSIGNMENT_RE = /^[A-Z]{2}\d{9}[A-Z]{2}$/i;

const trackRequestSchema = z
  .object({
    consignments: z
      .array(
        z
          .string()
          .trim()
          .min(1)
          .max(20)
          .refine((v) => CONSIGNMENT_RE.test(v), {
            message: "Invalid consignment format (expected e.g. QM125388411IN)"
          })
      )
      .min(1)
      .max(maxConsignments)
  })
  .strict();

module.exports = { trackRequestSchema };

