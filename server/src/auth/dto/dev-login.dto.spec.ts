import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { DevLoginDto } from './dev-login.dto';

// Same options as the global ValidationPipe in main.ts.
const validateBody = (body: object) =>
  validate(plainToInstance(DevLoginDto, body), { whitelist: true, forbidNonWhitelisted: true });

describe('DevLoginDto', () => {
  it('accepts the name the login form sends along with the email', async () => {
    expect(await validateBody({ email: 'dev@certi.org.br', name: 'Dev User' })).toHaveLength(0);
  });

  it('accepts an email alone', async () => {
    expect(await validateBody({ email: 'dev@certi.org.br' })).toHaveLength(0);
  });

  it('rejects an invalid email', async () => {
    expect(await validateBody({ email: 'not-an-email' })).not.toHaveLength(0);
  });
});
