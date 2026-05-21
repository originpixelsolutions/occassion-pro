import {
  Controller, Get, Post, Patch, Delete, Put,
  Param, Body, Query, Headers, UseGuards,
} from '@nestjs/common'
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger'
import { AuthGuard } from '../../common/guards/auth.guard'
import { MessagingService } from './messaging.service'

@ApiTags('Messaging')
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller({ path: 'messaging', version: '1' })
export class MessagingController {
  constructor(private readonly svc: MessagingService) {}

  private tok(auth: string) { return auth?.replace('Bearer ', '') }

  // ── Threads ───────────────────────────────────────────────────────────────

  @Get('threads')
  @ApiOperation({ summary: 'List message threads' })
  listThreads(
    @Headers('authorization') auth: string,
    @Headers('x-tenant-id') tenantId: string,
    @Query('event_id') eventId?: string,
    @Query('type') type?: string,
  ) {
    return this.svc.listThreads(tenantId, this.tok(auth), eventId, type)
  }

  @Get('threads/:id')
  @ApiOperation({ summary: 'Get thread by ID' })
  getThread(
    @Param('id') id: string,
    @Headers('authorization') auth: string,
    @Headers('x-tenant-id') tenantId: string,
  ) {
    return this.svc.getThread(id, tenantId, this.tok(auth))
  }

  @Post('threads')
  @ApiOperation({ summary: 'Create a new thread' })
  createThread(
    @Headers('authorization') auth: string,
    @Headers('x-tenant-id') tenantId: string,
    @Body() body: {
      event_id?: string; subject: string; thread_type?: string
      participants?: string[]; initial_message?: string; created_by?: string
    },
  ) {
    return this.svc.createThread(tenantId, this.tok(auth), body)
  }

  @Patch('threads/:id')
  @ApiOperation({ summary: 'Update thread subject/status/participants' })
  updateThread(
    @Param('id') id: string,
    @Headers('authorization') auth: string,
    @Headers('x-tenant-id') tenantId: string,
    @Body() body: { subject?: string; status?: string; participants?: string[] },
  ) {
    return this.svc.updateThread(id, tenantId, this.tok(auth), body)
  }

  @Delete('threads/:id')
  @ApiOperation({ summary: 'Delete a thread' })
  deleteThread(
    @Param('id') id: string,
    @Headers('authorization') auth: string,
    @Headers('x-tenant-id') tenantId: string,
  ) {
    return this.svc.deleteThread(id, tenantId, this.tok(auth))
  }

  // ── Messages ──────────────────────────────────────────────────────────────

  @Get('threads/:threadId/messages')
  @ApiOperation({ summary: 'Get messages in a thread' })
  getMessages(
    @Param('threadId') threadId: string,
    @Headers('authorization') auth: string,
    @Headers('x-tenant-id') tenantId: string,
    @Query('limit') limit?: string,
    @Query('before') before?: string,
  ) {
    return this.svc.getMessages(threadId, tenantId, this.tok(auth), limit ? +limit : 50, before)
  }

  @Post('threads/:threadId/messages')
  @ApiOperation({ summary: 'Send a message to a thread' })
  sendMessage(
    @Param('threadId') threadId: string,
    @Headers('authorization') auth: string,
    @Headers('x-tenant-id') tenantId: string,
    @Body() body: {
      sender_id?: string; sender_name?: string; message: string
      message_type?: string; attachments?: any[]; reply_to_id?: string; event_id?: string
    },
  ) {
    return this.svc.sendMessage(threadId, tenantId, this.tok(auth), body)
  }

  @Post('threads/:threadId/read')
  @ApiOperation({ summary: 'Mark all messages in thread as read' })
  markRead(
    @Param('threadId') threadId: string,
    @Headers('authorization') auth: string,
    @Headers('x-tenant-id') tenantId: string,
    @Body() body: { profile_id: string },
  ) {
    return this.svc.markRead(threadId, body.profile_id, tenantId, this.tok(auth))
  }

  @Delete('messages/:id')
  @ApiOperation({ summary: 'Delete a message' })
  deleteMessage(
    @Param('id') id: string,
    @Headers('authorization') auth: string,
    @Headers('x-tenant-id') tenantId: string,
  ) {
    return this.svc.deleteMessage(id, tenantId, this.tok(auth))
  }

  @Get('unread')
  @ApiOperation({ summary: 'Get unread message count for a profile' })
  getUnreadCount(
    @Headers('authorization') auth: string,
    @Headers('x-tenant-id') tenantId: string,
    @Query('profile_id') profileId: string,
    @Query('event_id') eventId?: string,
  ) {
    return this.svc.getUnreadCount(profileId, tenantId, this.tok(auth), eventId)
  }

  // ── Broadcasts ────────────────────────────────────────────────────────────

  @Get('broadcasts')
  @ApiOperation({ summary: 'List broadcasts' })
  listBroadcasts(
    @Headers('authorization') auth: string,
    @Headers('x-tenant-id') tenantId: string,
    @Query('event_id') eventId?: string,
  ) {
    return this.svc.listBroadcasts(tenantId, this.tok(auth), eventId)
  }

  @Post('broadcasts')
  @ApiOperation({ summary: 'Create a broadcast' })
  createBroadcast(
    @Headers('authorization') auth: string,
    @Headers('x-tenant-id') tenantId: string,
    @Body() body: {
      event_id?: string; title: string; message: string; audience: string
      audience_filter?: any; channels?: string[]; scheduled_at?: string; created_by?: string
    },
  ) {
    return this.svc.createBroadcast(tenantId, this.tok(auth), body)
  }

  @Post('broadcasts/:id/send')
  @ApiOperation({ summary: 'Send a broadcast immediately' })
  sendBroadcast(
    @Param('id') id: string,
    @Headers('authorization') auth: string,
    @Headers('x-tenant-id') tenantId: string,
  ) {
    return this.svc.sendBroadcast(id, tenantId, this.tok(auth))
  }

  @Delete('broadcasts/:id')
  @ApiOperation({ summary: 'Delete a broadcast' })
  deleteBroadcast(
    @Param('id') id: string,
    @Headers('authorization') auth: string,
    @Headers('x-tenant-id') tenantId: string,
  ) {
    return this.svc.deleteBroadcast(id, tenantId, this.tok(auth))
  }

  // ── Announcements ─────────────────────────────────────────────────────────

  @Get('announcements')
  @ApiOperation({ summary: 'List announcements' })
  listAnnouncements(
    @Headers('authorization') auth: string,
    @Headers('x-tenant-id') tenantId: string,
    @Query('event_id') eventId?: string,
  ) {
    return this.svc.listAnnouncements(tenantId, this.tok(auth), eventId)
  }

  @Post('announcements')
  @ApiOperation({ summary: 'Create an announcement' })
  createAnnouncement(
    @Headers('authorization') auth: string,
    @Headers('x-tenant-id') tenantId: string,
    @Body() body: {
      event_id: string; title: string; body: string; priority?: string
      is_pinned?: boolean; expires_at?: string; created_by?: string
    },
  ) {
    return this.svc.createAnnouncement(tenantId, this.tok(auth), body)
  }

  @Patch('announcements/:id')
  @ApiOperation({ summary: 'Update an announcement' })
  updateAnnouncement(
    @Param('id') id: string,
    @Headers('authorization') auth: string,
    @Headers('x-tenant-id') tenantId: string,
    @Body() body: { title?: string; body?: string; priority?: string; is_pinned?: boolean; expires_at?: string },
  ) {
    return this.svc.updateAnnouncement(id, tenantId, this.tok(auth), body)
  }

  @Delete('announcements/:id')
  @ApiOperation({ summary: 'Delete an announcement' })
  deleteAnnouncement(
    @Param('id') id: string,
    @Headers('authorization') auth: string,
    @Headers('x-tenant-id') tenantId: string,
  ) {
    return this.svc.deleteAnnouncement(id, tenantId, this.tok(auth))
  }
}
