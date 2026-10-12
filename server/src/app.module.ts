import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { AuthModule } from './auth/auth.module';
import { ActiveUserGuard } from './auth/guards/active-user.guard';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';
import { configuration } from './config/configuration';
import { RolesGuard } from './common/guards/roles.guard';
import { DatabaseModule } from './database/database.module';
import { HealthController } from './health.controller';
import { UsersModule } from './users/users.module';
import { ClientsModule } from './clients/clients.module';
import { ProjectsModule } from './projects/projects.module';
import { TagsModule } from './tags/tags.module';
import { TimeEntriesModule } from './time-entries/time-entries.module';
import { ReportsModule } from './reports/reports.module';
import { ClockifyImportModule } from './clockify-import/clockify-import.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '../.env'],
      load: [configuration],
    }),
    DatabaseModule,
    UsersModule,
    ClientsModule,
    ProjectsModule,
    TagsModule,
    TimeEntriesModule,
    ReportsModule,
    ClockifyImportModule,
    AuthModule,
  ],
  controllers: [HealthController],
  providers: [
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: ActiveUserGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
