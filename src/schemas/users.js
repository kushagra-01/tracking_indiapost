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

module.exports = { createUserSchema, resetPasswordSchema, roleEnum };

