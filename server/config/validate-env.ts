/**
 * Environment variable validation for production
 */

export interface EnvConfig {
  MONGODB_URI: string;
  OPENAI_API_KEY: string;
  SMTP_HOST: string;
  SMTP_PORT: string;
  SMTP_USER: string;
  SMTP_PASS: string;
  PORT: string;
  NODE_ENV: string;
}

const requiredEnvVars = [
  'MONGODB_URI',
  'OPENAI_API_KEY',
  'SMTP_HOST',
  'SMTP_PORT',
  'SMTP_USER',
  'SMTP_PASS',
] as const;

export function validateEnv(): EnvConfig {
  const missingVars: string[] = [];

  for (const varName of requiredEnvVars) {
    if (!process.env[varName]) {
      missingVars.push(varName);
    }
  }

  if (missingVars.length > 0) {
    console.error('❌ Missing required environment variables:');
    missingVars.forEach(varName => {
      console.error(`   - ${varName}`);
    });
    console.error('\n💡 Copy .env.example to .env.local and fill in the values');
    process.exit(1);
  }

  // Validate MongoDB URI format
  if (!process.env.MONGODB_URI?.includes('mongodb')) {
    console.error('❌ MONGODB_URI must be a valid MongoDB connection string');
    process.exit(1);
  }

  // Validate OpenAI API key format
  if (!process.env.OPENAI_API_KEY?.startsWith('sk-')) {
    console.warn('⚠️  OPENAI_API_KEY should start with "sk-"');
  }

  console.log('✅ Environment variables validated');

  return {
    MONGODB_URI: process.env.MONGODB_URI!,
    OPENAI_API_KEY: process.env.OPENAI_API_KEY!,
    SMTP_HOST: process.env.SMTP_HOST!,
    SMTP_PORT: process.env.SMTP_PORT!,
    SMTP_USER: process.env.SMTP_USER!,
    SMTP_PASS: process.env.SMTP_PASS!,
    PORT: process.env.PORT || '3001',
    NODE_ENV: process.env.NODE_ENV || 'development',
  };
}
