import { Body, Controller, Post, Req, Get, UseGuards, HttpCode, HttpStatus, Redirect,Query,Delete,} from '@nestjs/common';
import { AuthService } from './auth.service';
import { ZodValidationPipe } from 'src/common/pipes/zod-validator.pipe';
import { registerInput, registerSchema } from './schemas/register.schema';
import { loginInput, loginSchema } from './schemas/login.schema';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { AuthenticatedRequest } from './interfaces/authenticated-request.interface';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  async register(
    @Body(new ZodValidationPipe(registerSchema)) body: registerInput,
  ) {
    return this.authService.register(body);
  }
  @Post('login')
  async login(@Body(new ZodValidationPipe(loginSchema)) body: loginInput) {
    return this.authService.login(body);
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(@Body('refreshToken') refreshToken: string) {
    return this.authService.refreshTokens(refreshToken);
  }

  @UseGuards(JwtAuthGuard)
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(@Req() req: AuthenticatedRequest) {
    return this.authService.logout(req.user.userId);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  async getMe(@Req() req: AuthenticatedRequest) {
    return this.authService.getMe(req.user.userId);
  }

  @UseGuards(JwtAuthGuard)
  @Get('github')
  async getGithubAuthUrl(@Req() req: AuthenticatedRequest) {
    return this.authService.getGithubOAuthUrl(req.user.userId);
  }
  @Get('github/callback')
  @Redirect()
  async handleGithubCallback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Query('error') error: string,
  ) {
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    // Handle user denial on GitHub consent screen
    if (error === 'access_denied') {
      return { url: `${frontendUrl}/profile?github=cancelled` };
    }
    const result = await this.authService.handleGithubCallback(code, state);
    return { url: result.redirectUrl };
  }
  @UseGuards(JwtAuthGuard)
  @Delete('github/unlink')
  async unlinkGithub(@Req() req: AuthenticatedRequest) {
    return this.authService.unlinkGithub(req.user.userId);
  }
  @UseGuards(JwtAuthGuard)
  @Post('github/sync')
  @HttpCode(HttpStatus.OK)
  async syncGithub(@Req() req: AuthenticatedRequest) {
    return this.authService.syncGithubTelemetry(req.user.userId);
  }

}
