import { ApiProperty } from '@nestjs/swagger';
import { IsEmail } from 'class-validator';

export class DevLoginDto {
  @ApiProperty({ example: 'pessoa@certi.org.br' })
  @IsEmail()
  email: string;
}
