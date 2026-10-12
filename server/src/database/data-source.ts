import 'reflect-metadata';
import { config } from 'dotenv';
import { DataSource } from 'typeorm';
import { entities } from './entities';

config({ path: '../.env' });
config();

export const AppDataSource = new DataSource({
  type: 'mysql',
  host: process.env.DATABASE_HOST ?? 'localhost',
  port: parseInt(process.env.DATABASE_PORT ?? '3307', 10),
  username: process.env.DATABASE_USER ?? 'clockify',
  password: process.env.DATABASE_PASSWORD ?? 'clockify',
  database: process.env.DATABASE_NAME ?? 'clockify',
  entities,
  migrations: ['src/database/migrations/*.ts'],
  synchronize: false,
  logging: process.env.NODE_ENV === 'development',
});
