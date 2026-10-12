export const configuration = () => ({
  nodeEnv: process.env.NODE_ENV ?? 'development',
  apiPort: parseInt(process.env.API_PORT ?? '3000', 10),
  frontendUrl: process.env.FRONTEND_URL ?? 'http://localhost:3001',
  authRequired: (process.env.AUTH_REQUIRED ?? 'true') !== 'false',
  allowedEmailDomain: process.env.ALLOWED_EMAIL_DOMAIN ?? 'certi.org.br',
  jwtSecret: process.env.JWT_SECRET ?? 'change-me-in-development',
  google: {
    clientId: process.env.GOOGLE_CLIENT_ID ?? '',
    clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? '',
    callbackUrl:
      process.env.GOOGLE_CALLBACK_URL ?? 'http://localhost:3000/api/auth/google/callback',
  },
  database: {
    host: process.env.DATABASE_HOST ?? 'localhost',
    port: parseInt(process.env.DATABASE_PORT ?? '3307', 10),
    username: process.env.DATABASE_USER ?? 'clockify',
    password: process.env.DATABASE_PASSWORD ?? 'clockify',
    name: process.env.DATABASE_NAME ?? 'clockify',
  },
  clockify: {
    apiKey: process.env.CLOCKIFY_API_KEY ?? '',
    workspaceId: process.env.CLOCKIFY_WORKSPACE_ID ?? '',
  },
});
