import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString, MaxLength } from 'class-validator';

export class DevLoginDto {
  @ApiProperty({ example: 'pessoa@certi.org.br' })
  @IsEmail()
  email: string;

  @ApiPropertyOptional({ description: 'Display name; defaults to the email local part' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;
}
