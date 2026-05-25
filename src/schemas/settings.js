const { z } = require("zod");

const durationSchema = z
  .object({
    value: z.coerce.number().int().positive().max(365 * 24),
    unit: z.enum(["hour", "day"])
  })
  .strict();

const updateSettingsSchema = z
  .object({
    consignmentCache: durationSchema.optional(),
    shareLinkExpiry: durationSchema.optional()
  })
  .strict()
  .refine((v) => v.consignmentCache !== undefined || v.shareLinkExpiry !== undefined, {
    message: "Provide consignmentCache and/or shareLinkExpiry"
  });

module.exports = { updateSettingsSchema, durationSchema };
