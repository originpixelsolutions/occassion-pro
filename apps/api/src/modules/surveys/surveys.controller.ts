import { Controller, Get, Post, Patch, Delete, Param, Body, Headers, UseGuards, HttpCode, HttpStatus } from '@nestjs/common'
import { SurveysService } from './surveys.service'
import { AuthGuard } from '../auth/auth.guard'

@Controller({ path: 'surveys', version: '1' })
@UseGuards(AuthGuard)
export class SurveysController {
  constructor(private readonly svc: SurveysService) {}

  @Get('events/:eventId/stats')
  stats(@Param('eventId') eid: string, @Headers('x-tenant-id') tid: string, @Headers('authorization') auth: string) { return this.svc.getStats(eid, tid, auth?.replace('Bearer ','')) }

  @Get('events/:eventId')
  list(@Param('eventId') eid: string, @Headers('x-tenant-id') tid: string, @Headers('authorization') auth: string) { return this.svc.listSurveys(eid, tid, auth?.replace('Bearer ','')) }

  @Get(':id')
  get(@Param('id') id: string, @Headers('x-tenant-id') tid: string, @Headers('authorization') auth: string) { return this.svc.getSurveyWithQuestions(id, tid, auth?.replace('Bearer ','')) }

  @Post()
  create(@Headers('x-tenant-id') tid: string, @Headers('authorization') auth: string, @Body() body: any) { return this.svc.createSurvey(tid, auth?.replace('Bearer ',''), body) }

  @Patch(':id')
  update(@Param('id') id: string, @Headers('x-tenant-id') tid: string, @Headers('authorization') auth: string, @Body() body: any) { return this.svc.updateSurvey(id, tid, auth?.replace('Bearer ',''), body) }

  @Post(':id/questions')
  saveQuestions(@Param('id') id: string, @Headers('x-tenant-id') tid: string, @Headers('authorization') auth: string, @Body() body: { questions: any[] }) { return this.svc.saveQuestions(id, tid, auth?.replace('Bearer ',''), body.questions) }

  @Get(':id/responses')
  getResponses(@Param('id') id: string, @Headers('x-tenant-id') tid: string, @Headers('authorization') auth: string) { return this.svc.getResponses(id, tid, auth?.replace('Bearer ','')) }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  delete(@Param('id') id: string, @Headers('x-tenant-id') tid: string, @Headers('authorization') auth: string) { return this.svc.deleteSurvey(id, tid, auth?.replace('Bearer ','')) }
}
