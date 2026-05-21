import {
  Controller, Get, Post, Patch, Param, Body, Query,
  UseGuards, HttpCode, HttpStatus, Ip, Headers,
} from '@nestjs/common'
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger'
import { RsvpService } from './rsvp.service'
import { AuthGuard } from '../../../common/guards/auth.guard'
import { TenantId, AccessToken, CurrentUserId } from '../../../common/decorators/tenant.decorator'

@ApiTags('RSVP Forms')
@ApiBearerAuth('access-token')
@UseGuards(AuthGuard)
@Controller({ path: 'events/:eventId/rsvp-forms', version: '1' })
export class RsvpController {
  constructor(private readonly svc: RsvpService) {}

  @Get()
  list(
    @Param('eventId') eventId: string,
    @TenantId() t: string,
    @AccessToken() token: string,
  ) {
    return this.svc.listForms(eventId, t, token)
  }

  @Post()
  create(
    @Param('eventId') eventId: string,
    @Body() dto: any,
    @TenantId() t: string,
    @AccessToken() token: string,
  ) {
    return this.svc.createForm(t, { ...dto, event_id: eventId }, token)
  }

  @Get(':formId')
  getOne(
    @Param('formId') id: string,
    @TenantId() t: string,
    @AccessToken() token: string,
  ) {
    return this.svc.getForm(id, t, token)
  }

  @Patch(':formId')
  update(
    @Param('formId') id: string,
    @Body() dto: any,
    @TenantId() t: string,
    @AccessToken() token: string,
  ) {
    return this.svc.updateForm(id, t, dto, token)
  }

  @Get(':formId/responses')
  listResponses(
    @Param('formId') formId: string,
    @TenantId() t: string,
    @AccessToken() token: string,
    @Query('attendance') attendance?: string,
    @Query('approvalStatus') approvalStatus?: string,
    @Query('page') page?: number,
    @Query('pageSize') pageSize?: number,
  ) {
    return this.svc.listResponses(formId, t, token, { attendance, approvalStatus, page, pageSize })
  }

  @Get(':formId/stats')
  stats(
    @Param('formId') formId: string,
    @TenantId() t: string,
    @AccessToken() token: string,
  ) {
    return this.svc.getResponseStats(formId, t, token)
  }

  @Post(':formId/responses/:responseId/approve')
  @HttpCode(HttpStatus.OK)
  approve(
    @Param('formId') _fid: string,
    @Param('responseId') id: string,
    @TenantId() t: string,
    @CurrentUserId() uid: string,
    @AccessToken() token: string,
  ) {
    return this.svc.approveResponse(id, t, uid, token)
  }

  @Post(':formId/responses/:responseId/reject')
  @HttpCode(HttpStatus.OK)
  reject(
    @Param('formId') _fid: string,
    @Param('responseId') id: string,
    @TenantId() t: string,
    @CurrentUserId() uid: string,
    @AccessToken() token: string,
  ) {
    return this.svc.rejectResponse(id, t, uid, token)
  }
}

// ─── Public RSVP endpoints — no auth ─────────────────────────────────────────

@ApiTags('RSVP — Public')
@Controller({ path: 'public/rsvp', version: '1' })
export class PublicRsvpController {
  constructor(private readonly svc: RsvpService) {}

  @Get(':slug')
  @ApiOperation({ summary: 'Get RSVP form by slug (public)' })
  getForm(
    @Param('slug') slug: string,
    @Query('password') password?: string,
  ) {
    return this.svc.getPublicForm(slug, password)
  }

  @Post(':slug/submit')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Submit RSVP response (public)' })
  submit(
    @Param('slug') slug: string,
    @Body() dto: any,
    @Ip() ip: string,
    @Headers('user-agent') ua: string,
  ) {
    return this.svc.submitResponse(slug, dto, { ip, userAgent: ua })
  }
}
