/**
 * OccasionPro — Notifications Controller
 *
 * REST API for the notification centre.
 * All routes require standard authentication (req.user.sub = recipientId).
 */

import {
  Controller,
  Get,
  Post,
  Patch,
  Put,
  Delete,
  Param,
  Query,
  Body,
  Req,
  HttpCode,
  HttpStatus,
  ParseIntPipe,
  DefaultValuePipe,
} from '@nestjs/common'
import { NotificationsService, NotificationPreference, RecipientType } from './notifications.service'

class MarkReadDto {
  ids: string[]
}

class UpdatePreferencesDto {
  preferences: NotificationPreference[]
  recipient_type: RecipientType
}

class RegisterDeviceTokenDto {
  token: string
  platform: 'ios' | 'android' | 'web'
}

@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  /**
   * GET /notifications/unread
   * Returns unread count + latest unread items (for bell badge + dropdown preview).
   */
  @Get('unread')
  async getUnread(
    @Req() req: any,
    @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit: number,
  ) {
    const recipientId: string = req.user.sub
    return this.notificationsService.getUnread(recipientId, limit)
  }

  /**
   * GET /notifications
   * Full paginated notification history.
   */
  @Get()
  async getAll(
    @Req() req: any,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(25), ParseIntPipe) limit: number,
  ) {
    const recipientId: string = req.user.sub
    return this.notificationsService.getAll(recipientId, page, limit)
  }

  /**
   * PATCH /notifications/read
   * Mark specific notification IDs as read.
   */
  @Patch('read')
  @HttpCode(HttpStatus.OK)
  async markRead(
    @Req() req: any,
    @Body() body: MarkReadDto,
  ) {
    const recipientId: string = req.user.sub
    return this.notificationsService.markRead(recipientId, body.ids)
  }

  /**
   * PATCH /notifications/read-all
   * Mark all notifications as read for this user.
   */
  @Patch('read-all')
  @HttpCode(HttpStatus.OK)
  async markAllRead(@Req() req: any) {
    const recipientId: string = req.user.sub
    const tenantId: string = req.tenantId
    return this.notificationsService.markAllRead(recipientId, tenantId)
  }

  /**
   * GET /notifications/preferences
   * Get per-module notification preferences for the current user.
   */
  @Get('preferences')
  async getPreferences(@Req() req: any) {
    const userId: string = req.user.sub
    const tenantId: string = req.tenantId
    return this.notificationsService.getPreferences(userId, tenantId)
  }

  /**
   * PUT /notifications/preferences
   * Upsert notification preferences for the current user.
   */
  @Put('preferences')
  @HttpCode(HttpStatus.OK)
  async updatePreferences(
    @Req() req: any,
    @Body() body: UpdatePreferencesDto,
  ) {
    const userId: string = req.user.sub
    const tenantId: string = req.tenantId
    return this.notificationsService.updatePreferences(
      userId,
      body.recipient_type,
      tenantId,
      body.preferences,
    )
  }

  /**
   * POST /notifications/device-token
   * Register or refresh an Expo push token for the authenticated user.
   * Called by the mobile app after notification permissions are granted.
   */
  @Post('device-token')
  @HttpCode(HttpStatus.OK)
  async registerDeviceToken(
    @Req() req: any,
    @Body() body: RegisterDeviceTokenDto,
  ) {
    const userId: string = req.user.sub
    const tenantId: string = req.tenantId
    return this.notificationsService.registerDeviceToken(userId, tenantId, body.token, body.platform)
  }

  /**
   * DELETE /notifications/device-token/:token
   * Deregister a push token (e.g. on logout).
   */
  @Delete('device-token/:token')
  @HttpCode(HttpStatus.OK)
  async removeDeviceToken(
    @Req() req: any,
    @Param('token') token: string,
  ) {
    const userId: string = req.user.sub
    return this.notificationsService.removeDeviceToken(userId, token)
  }

  /**
   * PATCH /notifications/:id/read
   * Mark a single notification as read (mobile-friendly route).
   */
  @Patch(':id/read')
  @HttpCode(HttpStatus.OK)
  async markOneRead(
    @Req() req: any,
    @Param('id') id: string,
  ) {
    const recipientId: string = req.user.sub
    return this.notificationsService.markRead(recipientId, [id])
  }

  /**
   * POST /notifications/mark-all-read
   * Mark all notifications as read — alias used by mobile app.
   */
  @Post('mark-all-read')
  @HttpCode(HttpStatus.OK)
  async markAllReadPost(@Req() req: any) {
    const recipientId: string = req.user.sub
    const tenantId: string = req.tenantId
    return this.notificationsService.markAllRead(recipientId, tenantId)
  }
}
