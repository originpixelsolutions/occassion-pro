import { NotificationsModule } from '../notifications/notifications.module'
import { Module } from '@nestjs/common'
import { InvoicesController } from './invoices/invoices.controller'
import { InvoicesService } from './invoices/invoices.service'
import { ExpensesController } from './expenses/expenses.controller'
import { ExpensesService } from './expenses/expenses.service'
import { PaymentsController } from './payments/payments.controller'
import { PaymentsService } from './payments/payments.service'
import { BudgetsController } from './budgets/budgets.controller'
import { BudgetsService } from './budgets/budgets.service'
import { RazorpayService } from './razorpay/razorpay.service'
import { RazorpayController } from './razorpay/razorpay.controller'

@Module({
  imports: [NotificationsModule],
  controllers: [
    InvoicesController,
    ExpensesController,
    PaymentsController,
    BudgetsController,
    RazorpayController,
  ],
  providers: [
    InvoicesService,
    ExpensesService,
    PaymentsService,
    BudgetsService,
    RazorpayService,
  ],
  exports: [RazorpayService],
})
export class FinanceModule {}
