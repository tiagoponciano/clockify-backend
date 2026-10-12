import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ClientsService } from './clients.service';
import { CreateClientDto } from './dto/create-client.dto';
import { UpdateClientDto } from './dto/update-client.dto';
import { ClientResponseDto } from './dto/client-response.dto';
import { ListClientsQueryDto } from './dto/list-clients-query.dto';
import { Roles } from '../common/decorators/roles.decorator';
import { RESOURCE_MANAGEMENT_ROLES } from '../types';

@ApiTags('clients')
@ApiBearerAuth()
@Controller('clients')
export class ClientsController {
  constructor(private readonly clientsService: ClientsService) {}

  @Post()
  @Roles(...RESOURCE_MANAGEMENT_ROLES)
  create(@Body() dto: CreateClientDto): Promise<ClientResponseDto> {
    return this.clientsService.create(dto);
  }

  @Get()
  findAll(@Query() query: ListClientsQueryDto): Promise<ClientResponseDto[]> {
    return this.clientsService.findAll(query.includeInactive);
  }

  @Get(':id')
  findOne(@Param('id') id: string): Promise<ClientResponseDto> {
    return this.clientsService.findOne(id);
  }

  @Patch(':id')
  @Roles(...RESOURCE_MANAGEMENT_ROLES)
  update(@Param('id') id: string, @Body() dto: UpdateClientDto): Promise<ClientResponseDto> {
    return this.clientsService.update(id, dto);
  }

  @Delete(':id')
  @Roles(...RESOURCE_MANAGEMENT_ROLES)
  remove(@Param('id') id: string): Promise<void> {
    return this.clientsService.softDelete(id);
  }
}
