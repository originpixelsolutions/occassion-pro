import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common'
import { RunsheetService } from './runsheet.service'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import { TenantGuard } from '../auth/guards/tenant.guard'
import {
  CreateRunsheetItemDto,
  UpdateRunsheetItemDto,
  ReorderItemsDto,
  UpdateItemStatusDto,
  AddCommentDto,
  SaveVersionDto,
  ExportRunsheetDto,
} from './dto/runsheet.dto'

@Controller(':tenant/events/:eventId/runsheet')
@UseGuards(JwtAuthGuard, TenantGuard)
export class RunsheetController {
  constructor(private readonly runsheetService: RunsheetService) {}

  // GET /[tenant]/events/[eventId]/runsheet
  // Get or create the runsheet for this event (with all items)
  @Get()
  async getRunsheet(@Param('eventId') eventId: string, @Request() req: any) {
    const tenantId: string = req.tenant.id
    await this.runsheetService.getOrCreate(eventId, tenantId, req.user.id)
    return this.runsheetService.getWithItems(eventId, tenantId)
  }

  // POST /[tenant]/events/[eventId]/runsheet/items
  @Post('items')
  async createItem(
    @Param('eventId') eventId: string,
    @Body() dto: CreateRunsheetItemDto,
    @Request() req: any,
  ) {
    const tenantId: string = req.tenant.id
    const runsheet = await this.runsheetService.getOrCreate(eventId, tenantId, req.user.id)
    return this.runsheetService.createItem(runsheet.id, dto, req.user.id)
  }

  // PATCH /[tenant]/events/[eventId]/runsheet/items/:itemId
  @Patch('items/:itemId')
  async updateItem(
    @Param('eventId') eventId: string,
    @Param('itemId') itemId: string,
    @Body() dto: UpdateRunsheetItemDto,
    @Request() req: any,
  ) {
    const tenantId: string = req.tenant.id
    const runsheet = await this.runsheetService.getOrCreate(eventId, tenantId, req.user.id)
    return this.runsheetService.updateItem(itemId, dto, runsheet.id, req.user.id)
  }

  // DELETE /[tenant]/events/[eventId]/runsheet/items/:itemId
  @Delete('items/:itemId')
  async deleteItem(
    @Param('eventId') eventId: string,
    @Param('itemId') itemId: string,
    @Request() req: any,
  ) {
    const tenantId: string = req.tenant.id
    const runsheet = await this.runsheetService.getOrCreate(eventId, tenantId, req.user.id)
    return this.runsheetService.deleteItem(itemId, runsheet.id, req.user.id)
  }

  // POST /[tenant]/events/[eventId]/runsheet/items/reorder
  @Post('items/reorder')
  async reorderItems(
    @Param('eventId') eventId: string,
    @Body() dto: ReorderItemsDto,
    @Request() req: any,
  ) {
    const tenantId: string = req.tenant.id
    const runsheet = await this.runsheetService.getOrCreate(eventId, tenantId, req.user.id)
    return this.runsheetService.reorderItems(runsheet.id, dto, req.user.id)
  }

  // PATCH /[tenant]/events/[eventId]/runsheet/items/:itemId/status
  @Patch('items/:itemId/status')
  async updateStatus(
    @Param('eventId') eventId: string,
    @Param('itemId') itemId: string,
    @Body() dto: UpdateItemStatusDto,
    @Request() req: any,
  ) {
    const tenantId: string = req.tenant.id
    const runsheet = await this.runsheetService.getOrCreate(eventId, tenantId, req.user.id)
    return this.runsheetService.updateStatus(itemId, dto, runsheet.id, req.user.id)
  }

  // GET /[tenant]/events/[eventId]/runsheet/items/:itemId/comments
  @Get('items/:itemId/comments')
  async getComments(@Param('itemId') itemId: string) {
    return this.runsheetService.getComments(itemId)
  }

  // POST /[tenant]/events/[eventId]/runsheet/items/:itemId/comments
  @Post('items/:itemId/comments')
  async addComment(
    @Param('itemId') itemId: string,
    @Body() dto: AddCommentDto,
    @Request() req: any,
  ) {
    return this.runsheetService.addComment(itemId, req.user.id, dto)
  }

  // POST /[tenant]/events/[eventId]/runsheet/lock
  @Post('lock')
  async lock(@Param('eventId') eventId: string, @Request() req: any) {
    const tenantId: string = req.tenant.id
    const runsheet = await this.runsheetService.getOrCreate(eventId, tenantId, req.user.id)
    return this.runsheetService.lockRunsheet(runsheet.id, req.user.id)
  }

  // POST /[tenant]/events/[eventId]/runsheet/unlock
  @Post('unlock')
  async unlock(@Param('eventId') eventId: string, @Request() req: any) {
    const tenantId: string = req.tenant.id
    const runsheet = await this.runsheetService.getOrCreate(eventId, tenantId, req.user.id)
    return this.runsheetService.unlockRunsheet(runsheet.id, req.user.id)
  }

  // POST /[tenant]/events/[eventId]/runsheet/versions
  @Post('versions')
  async saveVersion(
    @Param('eventId') eventId: string,
    @Body() dto: SaveVersionDto,
    @Request() req: any,
  ) {
    const tenantId: string = req.tenant.id
    const runsheet = await this.runsheetService.getOrCreate(eventId, tenantId, req.user.id)
    return this.runsheetService.saveVersion(runsheet.id, req.user.id, dto)
  }

  // GET /[tenant]/events/[eventId]/runsheet/versions
  @Get('versions')
  async getVersionHistory(@Param('eventId') eventId: string, @Request() req: any) {
    const tenantId: string = req.tenant.id
    const runsheet = await this.runsheetService.getOrCreate(eventId, tenantId, req.user.id)
    return this.runsheetService.getVersionHistory(runsheet.id)
  }

  // POST /[tenant]/events/[eventId]/runsheet/versions/:versionId/restore
  @Post('versions/:versionId/restore')
  async restoreVersion(
    @Param('eventId') eventId: string,
    @Param('versionId') versionId: string,
    @Request() req: any,
  ) {
    const tenantId: string = req.tenant.id
    const runsheet = await this.runsheetService.getOrCreate(eventId, tenantId, req.user.id)
    return this.runsheetService.restoreVersion(runsheet.id, versionId, req.user.id)
  }

  // GET /[tenant]/events/[eventId]/runsheet/export?format=pdf|excel
  @Get('export')
  async exportRunsheet(
    @Param('eventId') eventId: string,
    @Query('format') format: 'pdf' | 'excel' = 'pdf',
    @Request() req: any,
  ) {
    const tenantId: string = req.tenant.id
    return this.runsheetService.exportRunsheet(eventId, tenantId, format)
  }
}
