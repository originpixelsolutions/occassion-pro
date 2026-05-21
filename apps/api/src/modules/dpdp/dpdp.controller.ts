import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  Req,
  HttpCode,
  HttpStatus,
  UseGuards,
  BadRequestException,
} from '@nestjs/common'
import { Request } from 'express'
import { DpdpService, ConsentType, RequestType, RequestStatus } from './dpdp.service'
import { JwtAuthGuard }  from '../../common/guards/jwt-auth.guard'
import { RolesGuard }    from '../../common/guards/roles.guard'
import { Roles }         from '../../common/decorators/roles.decorator'

// ─── DTOs ─────────────────────────────────────────────────────────────────────

class RecordConsentBody {
  tenantId!:     string
  eventId?:      string
  subjectType!:  string
  subjectId?:    string
  subjectEmail!: string
  consentType!:  ConsentType
  consentGiven!: boolean
  consentText!:  string
  version?:      string
}

class WithdrawConsentBody {
  subjectEmail!: string
  tenantId!:     string
  consentType!:  ConsentType
}

class SubmitDataRequestBody {
  requestorEmail!: string
  requestType!:    RequestType
  tenantId?:       string
  notes?:          string
}

class ProcessRequestBody {
  action!: 'processing' | 'completed' | 'rejected'
  notes?:  string
}

// ─── Public endpoints (no auth) ───────────────────────────────────────────────

@Controller()
export class DpdpPublicController {
  constructor(private readonly dpdpService: DpdpService) {}

  /** POST /public/consent — Record explicit consent */
  @Post('public/consent')
  @HttpCode(HttpStatus.CREATED)
  async recordConsent(@Body() body: RecordConsentBody, @Req() req: Request) {
    if (!body.tenantId || !body.subjectEmail || !body.consentType) {
      throw new BadRequestException('tenantId, subjectEmail and consentType are required')
    }

    const ip        = (req.headers['x-forwarded-for'] as string)?.split(',')[0] ?? req.ip ?? ''
    const userAgent = req.headers['user-agent'] ?? ''

    await this.dpdpService.recordConsent({
      tenantId:     body.tenantId,
      eventId:      body.eventId,
      subjectType:  body.subjectType as any,
      subjectId:    body.subjectId,
      subjectEmail: body.subjectEmail,
      consentType:  body.consentType,
      consentGiven: body.consentGiven ?? true,
      consentText:  body.consentText  ?? '',
      ip,
      userAgent,
      version:      body.version,
    })

    return { success: true }
  }

  /** DELETE /public/consent — Withdraw consent */
  @Delete('public/consent')
  @HttpCode(HttpStatus.OK)
  async withdrawConsent(@Body() body: WithdrawConsentBody) {
    if (!body.subjectEmail || !body.tenantId || !body.consentType) {
      throw new BadRequestException('subjectEmail, tenantId and consentType are required')
    }
    await this.dpdpService.withdrawConsent(body.subjectEmail, body.tenantId, body.consentType)
    return { success: true }
  }

  /** POST /public/data-requests — Submit an access/erasure/correction request */
  @Post('public/data-requests')
  @HttpCode(HttpStatus.CREATED)
  async submitDataRequest(@Body() body: SubmitDataRequestBody) {
    if (!body.requestorEmail || !body.requestType) {
      throw new BadRequestException('requestorEmail and requestType are required')
    }
    const result = await this.dpdpService.submitDataRequest(body)
    return {
      success:   true,
      id:        result.id,
      reference: result.reference,
      message:   'Your request has been received. We will respond within 30 days.',
    }
  }

  /** GET /public/privacy-policy — Fetch current policy (used by ConsentCheckbox modal) */
  @Get('public/privacy-policy')
  async getPrivacyPolicy() {
    return this.dpdpService.getCurrentPrivacyPolicy()
  }
}

// ─── Protected endpoints (super admin / owner) ────────────────────────────────

@Controller('dpdp')
@UseGuards(JwtAuthGuard, RolesGuard)
export class DpdpController {
  constructor(private readonly dpdpService: DpdpService) {}

  /** GET /dpdp/requests */
  @Get('requests')
  @Roles('super_admin', 'owner')
  async getRequests(
    @Query('tenantId')    tenantId?:    string,
    @Query('status')      status?:      string,
    @Query('requestType') requestType?: string,
    @Query('page')        page  = '1',
    @Query('limit')       limit = '50',
  ) {
    return this.dpdpService.getDataRequests({
      tenantId,
      status:      status      as RequestStatus | undefined,
      requestType: requestType as RequestType   | undefined,
      page:        parseInt(page,  10),
      limit:       parseInt(limit, 10),
    })
  }

  /** GET /dpdp/summary — counts for dashboard badge */
  @Get('summary')
  @Roles('super_admin', 'owner')
  async getSummary() {
    return this.dpdpService.getSummary()
  }

  /**
   * POST /dpdp/requests/:id/process
   * action = 'processing' | 'completed' | 'rejected'
   * For erasure/access, use dedicated sub-actions.
   */
  @Post('requests/:id/process')
  @Roles('super_admin', 'owner')
  async processRequest(
    @Param('id') id: string,
    @Body()      body: ProcessRequestBody,
    @Req()       req: any,
  ) {
    const handledBy = req.user?.sub ?? req.user?.id ?? 'system'

    if (body.action === 'completed') {
      // Attempt type-specific processing
      const { data } = await (this.dpdpService as any).serviceClient()
        .from('data_requests').select('request_type').eq('id', id).single()
        .catch(() => ({ data: null }))

      if (data?.request_type === 'erasure') {
        await this.dpdpService.processErasureRequest(id, handledBy)
        return { success: true, message: 'Erasure completed' }
      }
      if (data?.request_type === 'access') {
        await this.dpdpService.processAccessRequest(id, handledBy)
        return { success: true, message: 'Access bundle sent' }
      }
    }

    await this.dpdpService.updateRequestStatus(id, body.action as RequestStatus, handledBy, body.notes)
    return { success: true }
  }
}
