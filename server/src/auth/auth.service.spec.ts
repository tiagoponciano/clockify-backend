import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { AuthService } from './auth.service';
import { User } from '../users/user.entity';
import { UsersService } from '../users/users.service';

describe('AuthService.loginForDevelopment', () => {
  let usersService: jest.Mocked<UsersService>;
  let service: AuthService;

  beforeEach(() => {
    usersService = {
      upsertFromGoogle: jest.fn(async (profile) => ({ id: 'u1', isActive: true, ...profile }) as unknown as User),
    } as unknown as jest.Mocked<UsersService>;
    const jwtService = { sign: jest.fn(() => 'token') } as unknown as JwtService;
    const configService = { get: jest.fn(() => 'certi.org.br') } as unknown as ConfigService;
    service = new AuthService(usersService, jwtService, configService);
  });

  it('stores the name typed in the login form', async () => {
    await service.loginForDevelopment('dev@certi.org.br', 'Dev User');
    expect(usersService.upsertFromGoogle).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Dev User' }),
    );
  });

  it('falls back to the email local part when no name is given', async () => {
    await service.loginForDevelopment('dev@certi.org.br');
    expect(usersService.upsertFromGoogle).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'dev' }),
    );
  });

  it('falls back to the email local part when the name is blank', async () => {
    await service.loginForDevelopment('dev@certi.org.br', '   ');
    expect(usersService.upsertFromGoogle).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'dev' }),
    );
  });
});
