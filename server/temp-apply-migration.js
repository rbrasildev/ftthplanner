require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

async function main() {
  const sqlFile = path.join(__dirname, 'migration.sql');
  const sql = fs.readFileSync(sqlFile, 'utf8');
    
  const statements = sql
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('--'));

  console.log(`Starting migration with ${statements.length} statements...`);

  for (const statement of statements) {
    try {
      console.log(`Executing statement: ${statement.substring(0, 100)}...`);
      await prisma.$executeRawUnsafe(statement);
      console.log('✅ Success');
    } catch (error) {
      console.error(`❌ Error: ${error.message}`);
      // PostgreSQL error codes: 42701 = duplicate_column, 42P07 = duplicate_table/relation
      if (error.message.includes('42701') || error.message.includes('42P07') || 
          error.message.includes('already exists') || error.message.includes('already a column')) {
        console.warn('⚠️ Skipping as it already exists.');
      } else {
        throw error;
      }
    }
  }

  console.log('🚀 Migration process finished!');
}

main()
  .catch((e) => {
    console.error('💥 Fatal Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
