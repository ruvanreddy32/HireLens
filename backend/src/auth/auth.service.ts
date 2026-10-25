import { BadGatewayException, BadRequestException, ConflictException, Injectable, UnauthorizedException, } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { registerInput } from 'src/auth/schemas/register.schema';
import * as bcrypt from 'bcrypt';
import { loginInput } from './schemas/login.schema';
import { JwtService } from '@nestjs/jwt';
import * as crypto from 'crypto';
import 'dotenv/config';
import { Prisma } from '@prisma/client';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) { }
  //generates access token and refresh token
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

    const accessToken = await this.jwtService.signAsync(payload,
      {
        secret: accessSecret,
        expiresIn: accessExpiry
      });
    const refreshToken = await this.jwtService.signAsync(
      {
        sub: user.id, jti: crypto.randomUUID()
      }, {
      secret: refreshSecret,
      expiresIn: refreshExpiry
    });

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
  //generate fresh set of tokens using refresh token
  async refreshTokens(refreshToken: string) {
    if (!refreshToken) {
      throw new UnauthorizedException('Refresh token is required');
    }
    const refreshSecret = process.env.JWT_REFRESH_SECRET;

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
        githubProfile: true,
      },
    });
    if (!user) {
      throw new UnauthorizedException('User no longer exists');
    }
    return user;
  }

  //generates a github redirect url with state parameter (which is a jwt token)
  async getGithubOAuthUrl(userId: string) {
    const clientId = process.env.GITHUB_CLIENT_ID;
    const callbackURL = process.env.GITHUB_CALLBACK_URL;
    if (!clientId || !callbackURL) {
      throw new BadGatewayException('GitHub OAuth credentials not configured');
    }
    const state = await this.jwtService.signAsync({ userId, "purpose": "github_oauth" },
      { secret: process.env.JWT_SECRET, expiresIn: "10m", }
    );
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: callbackURL,
      scope: "read:user",
      state,
    });
    return { url: `https://github.com/login/oauth/authorize?${params.toString()}` };
  }
  //this is done when github authroizes the user and sends a code and state(JWT from getGitHubOAuthUrl)
  async handleGithubCallback(code: string, state: string): Promise<{ redirectUrl: string }> {

    const frontendUrl = process.env.FRONTEND_URL;
    if (!frontendUrl){
      throw new BadGatewayException("frontend url not configured");
    } 
    // 1.validates the state (JWT) sent from github i.e generated from getGithubOAuthUrl
    let decodedState: { userId: string, purpose: string };
    try {
      decodedState = await this.jwtService.verifyAsync(state, { secret: process.env.JWT_SECRET });
    }
    catch {
      throw new UnauthorizedException("Invalid or expired state parameter");
    }

    const { userId } = decodedState;
    const clientId = process.env.GITHUB_CLIENT_ID;
    const clientSecret = process.env.GITHUB_CLIENT_SECRET;
    const callbackUrl = process.env.GITHUB_CALLBACK_URL;
    // 2. Exchange code for access token (Ephemeral(temporary i.e not stored in db anywhere, just once use) Token)
    let tokenData: any;
    try {
      const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          client_id: clientId,
          client_secret: clientSecret,
          code,
          redirect_uri: callbackUrl,
        }),
        signal: AbortSignal.timeout(8000),
      });
      if (!tokenRes.ok) {
        throw new BadGatewayException(`GitHub token exchange HTTP error: ${tokenRes.status}`);
      }
      tokenData = await tokenRes.json();
    } catch (err: any) {
      throw new BadGatewayException(`Failed to connect to GitHub OAuth token service: ${err.message}`);
    }
    if (tokenData.error) {
      throw new BadRequestException(`GitHub OAuth error: ${tokenData.error_description || tokenData.error}`);
    }

    const accessToken = tokenData.access_token;
    if (!accessToken) {
      throw new BadGatewayException('GitHub did not return an access token');
    }
    try {
      // 3. Fetch authenticated user profile using Bearer token(i.e. github access token)
      const userRes = await fetch('https://api.github.com/user', {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'User-Agent': 'HireLens-Verification-Engine',
          Accept: 'application/vnd.github.v3+json',
        },
        signal: AbortSignal.timeout(8000),
      });
      if (!userRes.ok) {
        throw new BadGatewayException(`Failed to retrieve GitHub profile (HTTP ${userRes.status})`);
      }
      const userData = (await userRes.json()) as any;
      // 4. Collision check: ensure no other user has claimed this GitHub identity
      const existingUser = await this.prisma.user.findFirst({
        where: {
          id: { not: userId },
          githubProfile: {
            path: ['username'],
            equals: userData.login,
          },
        },
      });
      if (existingUser) {
        throw new ConflictException('This GitHub account is already linked to another candidate profile');
      }
      // 5. Fetch repositories (first page of 100, owner-only, sorted by update)
      const reposRes = await fetch(
        'https://api.github.com/user/repos?per_page=100&type=owner&sort=updated',
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'User-Agent': 'HireLens-Verification-Engine',
            Accept: 'application/vnd.github.v3+json',
          },
          signal: AbortSignal.timeout(10000),
        },
      );
      if (!reposRes.ok) {
        throw new BadGatewayException(`Failed to retrieve user repositories from GitHub (HTTP ${reposRes.status})`);
      }
      const repos = (await reposRes.json()) as any[];
      // 6. Filter only non-forked repositories and extract their lowercase names
      const nonForkRepos = Array.isArray(repos) ? repos.filter((r) => !r.fork) : [];
      const repoNames = nonForkRepos.map((r) => r.name.toLowerCase());

      const telemetry = {
        verified: true,
        username: userData.login,
        avatarUrl: userData.avatar_url,
        htmlUrl: userData.html_url,
        repoNames,
        lastSyncedAt: new Date().toISOString(),
      };
      // 7. Persist telemetry to User table (Ephemeral token is discarded and NEVER saved)
      await this.prisma.user.update({
        where: { id: userId },
        data: { githubProfile: telemetry },
      });
      // Synchronize telemetry to candidate's parsed resumes
      await this.syncTelemetryToCandidateResumes(userId, telemetry);
      return { redirectUrl: `${frontendUrl}/profile?github=success` };
    } catch (err: any) {
      if (
        err instanceof BadRequestException ||
        err instanceof UnauthorizedException ||
        err instanceof ConflictException ||
        err instanceof BadGatewayException
      ) {
        throw err;
      }
      throw new BadGatewayException(`GitHub ingestion failed: ${err.message}`);
    }
  }
  /**
   * Resets candidate's GitHub telemetry to null.
   */
  async unlinkGithub(userId: string) {
    await this.prisma.user.update({
      where: { id: userId },
      data: { githubProfile: Prisma.DbNull },
    });
    // Clear telemetry from candidate's parsed resumes
    await this.syncTelemetryToCandidateResumes(userId, null);
    return { success: true, message: 'GitHub account unlinked successfully' };
  }

  async syncGithubTelemetry(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { githubProfile: true },
    });
    if (!user || !user.githubProfile) {
      throw new BadRequestException('No verified GitHub profile linked to this account');
    }
    const currentProfile = user.githubProfile as Record<string, any>;
    const lastSynced = currentProfile.lastSyncedAt ? new Date(currentProfile.lastSyncedAt).getTime() : 0;
    const cooldownMs = 24 * 60 * 60 * 1000; // 24 hours
    const elapsed = Date.now() - lastSynced;
    if (elapsed < cooldownMs) {
      const remainingHours = Math.ceil((cooldownMs - elapsed) / (1000 * 60 * 60));
      throw new BadRequestException(
        `GitHub telemetry was synced recently. You can re-sync once every 24 hours (try again in ${remainingHours} hours).`,
      );
    }
    const username = currentProfile.username;
    if (!username) {
      throw new BadRequestException('GitHub profile data is missing username');
    }
    try {
      // Fetch fresh public repository metrics
      const reposRes = await fetch(
        `https://api.github.com/users/${username}/repos?per_page=100&type=owner&sort=updated`,
        {
          headers: {
            'User-Agent': 'HireLens-Verification-Engine',
            Accept: 'application/vnd.github.v3+json',
          },
          signal: AbortSignal.timeout(10000),
        },
      );
      if (!reposRes.ok) {
        if (reposRes.status === 403 || reposRes.status === 429) {
          throw new BadGatewayException('GitHub API rate limit exceeded during re-sync. Please try again later.');
        }
        throw new BadGatewayException(`Failed to fetch updated repositories from GitHub (HTTP ${reposRes.status})`);
      }
      const repos = (await reposRes.json()) as any[];
      const nonForkRepos = Array.isArray(repos) ? repos.filter((r) => !r.fork) : [];
      const repoNames = nonForkRepos.map((r) => r.name.toLowerCase());
      const updatedTelemetry = {
        ...currentProfile,
        repoNames,
        lastSyncedAt: new Date().toISOString(),
      };
      await this.prisma.user.update({
        where: { id: userId },
        data: { githubProfile: updatedTelemetry },
      });
      // Synchronize updated telemetry to candidate's parsed resumes
      await this.syncTelemetryToCandidateResumes(userId, updatedTelemetry);
      return {
        success: true,
        message: 'GitHub telemetry refreshed successfully',
        profile: updatedTelemetry,
      };
    } catch (err: any) {
      if (err instanceof BadRequestException || err instanceof BadGatewayException) {
        throw err;
      }
      throw new BadGatewayException(`Failed to refresh GitHub telemetry: ${err.message}`);
    }
  }

  /**
   * Synchronizes verified GitHub telemetry across all resumes belonging to this candidate.
   * If telemetry is null, clears github_telemetry from all resumes.
   */
  private async syncTelemetryToCandidateResumes(
    userId: string,
    telemetry: Record<string, any> | null,
  ) {
    const resumes = await this.prisma.resume.findMany({
      where: { userId },
      select: { id: true, parsedData: true },
    });

    for (const resume of resumes) {
      const parsedData = (resume.parsedData as Record<string, any>) || {};
      const updatedParsedData = telemetry
        ? { ...parsedData, github_telemetry: telemetry }
        : { ...parsedData, github_telemetry: null };

      await this.prisma.resume.update({
        where: { id: resume.id },
        data: { parsedData: updatedParsedData },
      });
    }
  }
}
