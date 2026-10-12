import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Client } from './client.entity';
import { ClientsService } from './clients.service';
import { ClientsController } from './clients.controller';
import { Project } from '../projects/project.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Client, Project])],
  controllers: [ClientsController],
  providers: [ClientsService],
  exports: [ClientsService, TypeOrmModule],
})
export class ClientsModule {}
