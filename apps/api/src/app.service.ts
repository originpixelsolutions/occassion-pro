import { Injectable } from '@nestjs/common'

@Injectable()
export class AppService {
  getStatus() {
    return {
      name: 'OccasionPro API',
      version: '1.0.0',
      status: 'operational',
      timestamp: new Date().toISOString(),
      docs: '/docs',
    }
  }
}
