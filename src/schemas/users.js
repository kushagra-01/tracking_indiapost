const { z } = require("zod");
const { usernameSchema, passwordSchema } = require("./auth");

const roleEnum = z.enum(["user"]);

const createUserSchema = z
  .object({
    username: usernameSchema,
    password: passwordSchema,
    role: roleEnum.optional()
  })
  .strict();

const resetPasswordSchema = z
  .object({
    password: passwordSchema
  })
  .strict();

const updateUserSchema = z
  .object({
    active: z.boolean().optional(),
    password: passwordSchema.optional()
  })
  .strict()
  .refine((v) => v.active !== undefined || v.password !== undefined, {
    message: "Provide active and/or password"
  });

const profilePasswordSchema = z
  .object({
    currentPassword: passwordSchema,
    password: passwordSchema
  })
  .strict();

module.exports = {
  createUserSchema,
  resetPasswordSchema,
  updateUserSchema,
  profilePasswordSchema,
  roleEnum
};
