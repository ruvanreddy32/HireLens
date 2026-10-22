import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { registerInput } from 'src/auth/schemas/register.schema';
import * as bcrypt from 'bcrypt';
import { loginInput } from './schemas/login.schema';
import { JwtService } from '@nestjs/jwt';
import * as crypto from 'crypto';
import 'dotenv/config';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  private async generateTokens(user: {
    id: string;
    email: string;
    role: string;
  }) {
    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };

    const accessSecret = process.env.JWT_SECRET as string;
    const refreshSecret = process.env.JWT_REFRESH_SECRET as string;
    const accessExpiry = (process.env.JWT_EXPIRES_IN || '15m') as any;
    const refreshExpiry = (process.env.JWT_REFRESH_EXPIRES_IN || '7d') as any;

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret: accessSecret,
        expiresIn: accessExpiry,
      }),
      this.jwtService.signAsync(
        { sub: user.id, jti: crypto.randomUUID() },
        {
          secret: refreshSecret,
          expiresIn: refreshExpiry,
        },
      ),
    ]);

    // Securely hash the refresh token before storing in database
    const hashedRefreshToken = await bcrypt.hash(refreshToken, 10);
    await this.prisma.user.update({
      where: { id: user.id },
      data: { refreshToken: hashedRefreshToken },
    });

    return {
      accessToken,
      refreshToken,
    };
  }

  async register(data: registerInput) {
    const existingUser = await this.prisma.user.findUnique({
      where: { email: data.email },
    });
    if (existingUser) {
      throw new ConflictException('User with this email already exists');
    }

    const hashedPassword = await bcrypt.hash(data.password, 12);

    const user = await this.prisma.user.create({
      data: {
        name: data.name,
        email: data.email,
        password: hashedPassword,
        role: data.role,
      },
    });

    const tokens = await this.generateTokens(user);

    return {
      ...tokens,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        createdAt: user.createdAt,
      },
    };
  }

  async login(data: loginInput) {
    const existingUser = await this.prisma.user.findUnique({
      where: { email: data.email },
    });
    if (!existingUser) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const passMatch = await bcrypt.compare(
      data.password,
      existingUser.password,
    );
    if (!passMatch) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const tokens = await this.generateTokens(existingUser);

    return {
      ...tokens,
      user: {
        id: existingUser.id,
        name: existingUser.name,
        email: existingUser.email,
        role: existingUser.role,
      },
    };
  }

  async refreshTokens(refreshToken: string) {
    if (!refreshToken) {
      throw new UnauthorizedException('Refresh token is required');
    }

    const accessSecret = process.env.JWT_SECRET || 'ruvanreddy177';
    const refreshSecret =
      process.env.JWT_REFRESH_SECRET || `${accessSecret}_refresh`;

    let payload: { sub: string };
    try {
      payload = await this.jwtService.verifyAsync(refreshToken, {
        secret: refreshSecret,
      });
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
    });

    if (!user || !user.refreshToken) {
      throw new UnauthorizedException(
        'Access denied: Session expired or logged out',
      );
    }

    const isMatch = await bcrypt.compare(refreshToken, user.refreshToken);
    if (!isMatch) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    // Refresh Token Rotation: issue brand new pair
    return this.generateTokens(user);
  }

  async logout(userId: string) {
    await this.prisma.user.update({
      where: { id: userId },
      data: { refreshToken: null },
    });
    return { message: 'Logged out successfully' };
  }

  async getMe(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        role: true,
        createdAt: true,
        updatedAt: true,
        email: true,
      },
    });
    if (!user) {
      throw new UnauthorizedException('User no longer exists');
    }
    return user;
  }
}
