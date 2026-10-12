import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './user.entity';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
  ) {}

  findByEmail(email: string): Promise<User | null> {
    return this.usersRepository.findOne({ where: { email: email.toLowerCase() } });
  }

  findByGoogleSub(googleSub: string): Promise<User | null> {
    return this.usersRepository.findOne({ where: { googleSub } });
  }

  findById(id: string): Promise<User | null> {
    return this.usersRepository.findOne({ where: { id } });
  }

  async findAllActive(): Promise<
    Array<{
      id: string;
      email: string;
      acronym: string;
      name: string;
      avatarUrl: string | null;
      role: User['role'];
      isActive: boolean;
    }>
  > {
    const users = await this.usersRepository.find({
      where: { isActive: true },
      order: { name: 'ASC' },
    });
    return users.map((user) => ({
      id: user.id,
      email: user.email,
      acronym: user.acronym,
      name: user.name,
      avatarUrl: user.avatarUrl,
      role: user.role,
      isActive: user.isActive,
    }));
  }

  async setActive(id: string, isActive: boolean): Promise<User> {
    const user = await this.findById(id);
    if (!user) {
      throw new NotFoundException(`User ${id} not found`);
    }
    user.isActive = isActive;
    return this.usersRepository.save(user);
  }

  async updateAcronym(id: string, acronym: string): Promise<User> {
    const user = await this.findById(id);
    if (!user) {
      throw new NotFoundException(`User ${id} not found`);
    }
    user.acronym = acronym;
    return this.usersRepository.save(user);
  }

  async upsertFromGoogle(profile: {
    googleSub: string;
    email: string;
    name: string;
    avatarUrl?: string | null;
  }): Promise<User> {
    const email = profile.email.toLowerCase();
    const existingBySub = await this.findByGoogleSub(profile.googleSub);

    if (existingBySub) {
      existingBySub.email = email;
      existingBySub.name = profile.name;
      existingBySub.avatarUrl = profile.avatarUrl ?? existingBySub.avatarUrl;
      return this.usersRepository.save(existingBySub);
    }

    const existingByEmail = await this.findByEmail(email);
    if (existingByEmail) {
      existingByEmail.googleSub = profile.googleSub;
      existingByEmail.name = profile.name;
      existingByEmail.avatarUrl = profile.avatarUrl ?? existingByEmail.avatarUrl;
      return this.usersRepository.save(existingByEmail);
    }

    const acronym = email.split('@')[0];
    const user = this.usersRepository.create({
      googleSub: profile.googleSub,
      email,
      acronym,
      name: profile.name,
      avatarUrl: profile.avatarUrl ?? null,
      clockifyId: null,
    });
    return this.usersRepository.save(user);
  }
}
