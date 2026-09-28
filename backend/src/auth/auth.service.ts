import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import {registerInput} from 'src/auth/schemas/register.schema'
import * as bcrypt from 'bcrypt'
import { loginInput } from './schemas/login.schema';
import { JwtService } from '@nestjs/jwt';
@Injectable()
export class AuthService {
    constructor (private readonly prisma:PrismaService,private readonly jwtService:JwtService){}

    async register(data:registerInput){
        const existingUser=await this.prisma.user.findUnique({where:{email:data.email,}});
        if(existingUser){
            throw new ConflictException("user with this email already exists");
        }

        const hashedPassword=await bcrypt.hash(data.password,12);

        const user=await this.prisma.user.create({
            data:{
                name:data.name,
                email:data.email,
                password:hashedPassword,
                role:data.role,
            },
        });

        return{
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role,
            createdAt: user.createdAt,
        }
    }
    async login(data:loginInput){
        const existingUser=await this.prisma.user.findUnique({where:{email:data.email}});
        if(!existingUser){
            throw new UnauthorizedException("invalid email or password");
        }
        const passMatch=await bcrypt.compare(data.password,existingUser.password);
        if(!passMatch){
            throw new UnauthorizedException("invalid email or password");
        }
        const payload={
            sub:existingUser.id,
            email:existingUser.email,
            role:existingUser.role,
        };
        const accessToken =
        await this.jwtService.signAsync(payload);
  
      // 7. Return token + safe user information
      return {
        accessToken,
        user: {
          id: existingUser.id,
          name: existingUser.name,
          email: existingUser.email,
          role: existingUser.role,
        },
      };
    }

    async getMe(userId:string){
        const user=await this.prisma.user.findUnique({where:{id:userId},select:{
            id:true,
            name:true,
            role:true,
            createdAt:true,
            updatedAt:true,
            email:true
        }});
        if(!user){
            throw new UnauthorizedException("user no longer exists");
        }
        return user;
    }
}
