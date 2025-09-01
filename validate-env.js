#!/usr/bin/env node

const requiredEnvVars = [
  'DB_HOST',
  'DB_USER', 
  'DB_PASSWORD',
  'DB_NAME',
  'JWT_SECRET',
  'PORT'
];

console.log('🔍 Validating environment variables...\n');

let allValid = true;

requiredEnvVars.forEach(varName => {
  if (!process.env[varName]) {
    console.error(`❌ Missing required environment variable: ${varName}`);
    allValid = false;
  } else {
    console.log(`✅ ${varName}: ${varName.includes('PASSWORD') ? '***' : process.env[varName]}`);
  }
});

if (allValid) {
  console.log('\n✅ All environment variables are valid!');
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🌐 Port: ${process.env.PORT}`);
  console.log(`🗄️  Database: ${process.env.DB_NAME}`);
} else {
  console.log('\n❌ Environment validation failed!');
  process.exit(1);
}
