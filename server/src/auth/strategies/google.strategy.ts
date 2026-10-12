import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Profile, Strategy } from 'passport-google-oauth20';

export interface GoogleProfilePayload {
  googleSub: string;
  email: string;
  name: string;
  avatarUrl: string | null;
  hd: string | undefined;
}

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(configService: ConfigService) {
    super({
      clientID: configService.get<string>('google.clientId') || 'dev-client-id',
      clientSecret: configService.get<string>('google.clientSecret') || 'dev-client-secret',
      callbackURL: configService.get<string>('google.callbackUrl'),
      scope: ['email', 'profile'],
    });
  }

  validate(_accessToken: string, _refreshToken: string, profile: Profile): GoogleProfilePayload {
    const email = profile.emails?.[0]?.value;
    if (!email) {
      throw new Error('Google profile did not include an email');
    }

    const json = profile._json as { hd?: string };

    return {
      googleSub: profile.id,
      email,
      name: profile.displayName,
      avatarUrl: profile.photos?.[0]?.value ?? null,
      hd: json.hd,
    };
  }
}
