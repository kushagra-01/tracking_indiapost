const { z } = require("zod");

const usernameSchema = z.string().trim().min(3).max(40);
const passwordSchema = z.string().min(6).max(128);

const loginSchema = z
  .object({
    username: usernameSchema,
    password: passwordSchema
  })
  .strict();

module.exports = { loginSchema, usernameSchema, passwordSchema };

