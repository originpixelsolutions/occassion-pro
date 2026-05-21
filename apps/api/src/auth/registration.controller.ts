/**
 * OccasionPro — Tenant Self-Service Registration Controller
 * Handles multi-step tenant sign-up:
 *   POST /auth/register         → create account (step 1)
 *   GET  /auth/check-slug       → check workspace slug availability
 *   POST /auth/setup-workspace  → configure workspace (step 2)
 *   POST /auth/start-trial      → select plan + start trial (step 3)
 *   GET  /plans/public          → list public-facing plans
 */

import {
  Controller, Post, Get, Body, Query, Headers,
  HttpCode, HttpStatus, BadRequestException, UnauthorizedException,
  UseInterceptors, UploadedFile,
} from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import { RegistrationService } from './registration.service'
import { IsEmail, IsString, MinLength, Matches } from 'class-validator'

// ─── DTOs ─────────────────────────────────────────────────────────────────────

class RegisterDto {
  @IsString() @MinLength(2) name: string
  @IsEmail() email: string
  @IsString() @MinLength(8) password: string
}

class SetupWorkspaceDto {
  @IsString() @MinLength(2) company_name: string
  @IsString() @Matches(/^[a-z0-9-]{2,30}$/, { message: 'Slug must be 2-30 lowercase letters, numbers, or hyphens' }) slug: string
  @IsString() timezone: string
}

class StartTrialDto {
  @IsString() plan_id: string
  @IsString() billing_cycle: 'monthly' | 'yearly'
}

// ─── CONTROLLER ───────────────────────────────────────────────────────────────

@Controller()
export class RegistrationController {
  constructor(private readonly registrationService: RegistrationService) {}

  /**
   * Step 1 — Create account
   * Returns a short-lived registration token (not a full access token yet)
   */
  @Post('auth/register')
  @HttpCode(HttpStatus.CREATED)
  async register(@Body() dto: RegisterDto) {
    return this.registrationService.createAccount(dto.name, dto.email, dto.password)
  }

  /**
   * Check workspace slug availability
   */
  @Get('auth/check-slug')
  async checkSlug(@Query('slug') slug: string) {
    if (!slug || !/^[a-z0-9-]{2,30}$/.test(slug)) {
      throw new BadRequestException('Invalid slug format')
    }
    const available = await this.registrationService.isSlugAvailable(slug)
    return { available, slug }
  }

  /**
   * Step 2 — Set up workspace
   * Requires registration token in Authorization header
   */
  @Post('auth/setup-workspace')
  @UseInterceptors(FileInterceptor('logo'))
  @HttpCode(HttpStatus.OK)
  async setupWorkspace(
    @Headers('authorization') auth: string,
    @Body() dto: SetupWorkspaceDto,
    @UploadedFile() logo?: Express.Multer.File,
  ) {
    const token = this.extractToken(auth)
    return this.registrationService.setupWorkspace(token, {
      company_name: dto.company_name,
      slug: dto.slug,
      timezone: dto.timezone,
      logo,
    })
  }

  /**
   * Step 3 — Select plan & start trial
   * Returns a full access token (registration complete)
   */
  @Post('auth/start-trial')
  @HttpCode(HttpStatus.OK)
  async startTrial(
    @Headers('authorization') auth: string,
    @Body() dto: StartTrialDto,
  ) {
    const token = this.extractToken(auth)
    return this.registrationService.startTrial(token, dto.plan_id, dto.billing_cycle)
  }

  /**
   * Public plan listing (shown on sign-up page)
   */
  @Get('plans/public')
  async getPublicPlans() {
    return this.registrationService.getPublicPlans()
  }

  // ─── Helpers ────────────────────────────────────────────────────────────────

  private extractToken(authHeader: string): string {
    if (!authHeader?.startsWith('Bearer ')) throw new UnauthorizedException('Missing token')
    return authHeader.slice(7)
  }
}
