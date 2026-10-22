import {
  ConflictException,
  Injectable,
  Logger,
  OnModuleInit,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectModel } from '@nestjs/mongoose';
import * as bcrypt from 'bcrypt';
import { Model } from 'mongoose';
import { JwtUser, Role } from '../common/roles';
import { LoginDto, RegisterDto } from './auth.dto';
import { User } from './user.schema';

const SALT_ROUNDS = 10;

@Injectable()
export class AuthService implements OnModuleInit {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @InjectModel(User.name) private readonly users: Model<User>,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  // Seeds the admin from env on startup; registration only ever creates users.
  async onModuleInit() {
    const email = this.config.get<string>('ADMIN_EMAIL');
    const password = this.config.get<string>('ADMIN_PASSWORD');
    if (!email || !password) {
      this.logger.warn(
        'ADMIN_EMAIL/ADMIN_PASSWORD not set, skipping admin seed',
      );
      return;
    }
    if (await this.users.exists({ email: email.toLowerCase() })) return;
    await this.users.create({
      name: this.config.get<string>('ADMIN_NAME', 'Admin'),
      email,
      password: await bcrypt.hash(password, SALT_ROUNDS),
      role: Role.Admin,
    });
    this.logger.log(`Seeded admin ${email}`);
  }

  async register(dto: RegisterDto) {
    if (await this.users.exists({ email: dto.email.toLowerCase() })) {
      throw new ConflictException('Email already registered');
    }
    const user = await this.users.create({
      ...dto,
      password: await bcrypt.hash(dto.password, SALT_ROUNDS),
      role: Role.User,
    });
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
    };
  }

  async login(dto: LoginDto) {
    const user = await this.users
      .findOne({ email: dto.email.toLowerCase() })
      .select('+password');
    if (!user || !(await bcrypt.compare(dto.password, user.password))) {
      throw new UnauthorizedException('Invalid email or password');
    }
    const payload: JwtUser = { sub: user.id, role: user.role };
    return { accessToken: await this.jwt.signAsync(payload) };
  }
}
