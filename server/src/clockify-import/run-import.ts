import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { ClockifyImportService } from './clockify-import.service';

async function main(): Promise<void> {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['log', 'error', 'warn'],
  });

  try {
    const importer = app.get(ClockifyImportService);
    await importer.run();
  } finally {
    await app.close();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
