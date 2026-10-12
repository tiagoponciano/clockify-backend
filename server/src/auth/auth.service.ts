import { ForbiddenException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { User } from '../users/user.entity';
import { UsersService } from '../users/users.service';
import { GoogleProfilePayload } from './strategies/google.strategy';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  assertAllowedDomain(hd: string | undefined): void {
    const domain = this.configService.get<string>('allowedEmailDomain') ?? 'certi.org.br';
    if (!hd || hd.toLowerCase() !== domain.toLowerCase()) {
      throw new ForbiddenException(`Only @${domain} Google Workspace accounts are allowed`);
    }
  }

  async loginWithGoogle(profile: GoogleProfilePayload) {
    this.assertAllowedDomain(profile.hd);
    const user = await this.usersService.upsertFromGoogle(profile);

    if (!user.isActive) {
      throw new ForbiddenException('Your account has been deactivated. Contact an administrator.');
    }

    return this.buildAuthResponse(user);
  }

  async loginForDevelopment(email: string, name?: string) {
    const domain = this.configService.get<string>('allowedEmailDomain') ?? 'certi.org.br';
    if (!email.toLowerCase().endsWith(`@${domain.toLowerCase()}`)) {
      throw new ForbiddenException(`Only @${domain} emails are allowed`);
    }

    const user = await this.usersService.upsertFromGoogle({
      googleSub: `dev:${email.toLowerCase()}`,
      email,
      name: name?.trim() || email.split('@')[0],
      avatarUrl: null,
    });

    if (!user.isActive) {
      throw new ForbiddenException('Your account has been deactivated. Contact an administrator.');
    }

    return this.buildAuthResponse(user);
  }

  private buildAuthResponse(user: User) {
    return {
      accessToken: this.jwtService.sign({ sub: user.id, email: user.email }),
      user: this.toPublicUser(user),
    };
  }

  private toPublicUser(user: User) {
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
