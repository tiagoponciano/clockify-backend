import {
  Controller,
  ForbiddenException,
  Get,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
  Body,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import type { Response } from 'express';
import { Public } from '../common/decorators/public.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { User } from '../users/user.entity';
import { AuthService } from './auth.service';
import { DevLoginDto } from './dto/dev-login.dto';
import { GoogleProfilePayload } from './strategies/google.strategy';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
  ) {}

  @Public()
  @Get('google')
  @UseGuards(AuthGuard('google'))
  googleAuth(): void {
    return;
  }

  @Public()
  @Get('google/callback')
  @UseGuards(AuthGuard('google'))
  async googleCallback(@Req() req: { user: GoogleProfilePayload }, @Res() res: Response) {
    const frontendUrl = this.configService.get<string>('frontendUrl') ?? 'http://localhost:3001';

    try {
      const result = await this.authService.loginWithGoogle(req.user);
      const url = new URL('/auth/callback', frontendUrl);
      url.searchParams.set('token', result.accessToken);
      return res.redirect(url.toString());
    } catch (error) {
      if (error instanceof ForbiddenException) {
        const url = new URL('/unauthorized', frontendUrl);
        if (req.user?.email) {
          url.searchParams.set('email', req.user.email);
        }
        return res.redirect(url.toString());
      }

      const url = new URL('/login', frontendUrl);
      url.searchParams.set('error', 'auth_failed');
      return res.redirect(url.toString());
    }
  }

  @Public()
  @Post('dev-login')
  devLogin(@Body() dto: DevLoginDto) {
    if (this.configService.get<string>('nodeEnv') === 'production') {
      throw new UnauthorizedException('Development login is disabled in production');
    }
    return this.authService.loginForDevelopment(dto.email, dto.name);
  }

  @ApiBearerAuth()
  @Get('me')
  me(@CurrentUser() user?: User) {
    if (!user) {
      return { message: 'Authentication is not required in this environment' };
    }
    return {
      id: user.id,
      email: user.email,
      acronym: user.acronym,
      name: user.name,
      avatarUrl: user.avatarUrl,
      role: user.role,
      isActive: user.isActive,
    };
  }
}
