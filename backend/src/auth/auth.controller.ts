import { Body, Controller, Post, Req, Get,ValidationPipe, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { ZodValidationPipe } from 'src/common/pipes/zod-validator.pipe';
import { registerInput, registerSchema } from './schemas/register.schema';
import { loginInput, loginSchema } from './schemas/login.schema';
import { Request } from 'express';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { AuthenticatedRequest } from './interfaces/authenticated-request.interface';

@Controller('auth')
export class AuthController {
    constructor(
        private readonly authService:AuthService
    ){}

    @Post('register')
    async register(@Body(new ZodValidationPipe(registerSchema)) body:registerInput){
        return this.authService.register(body);
    }
    @Post('login')
    async login(@Body(new ZodValidationPipe(loginSchema)) body:loginInput){
        return this.authService.login(body);
    }
    @UseGuards(JwtAuthGuard)
    @Get('me')
    async getMe(@Req() req: AuthenticatedRequest){
        return this.authService.getMe(req.user.userId);
    }
}
