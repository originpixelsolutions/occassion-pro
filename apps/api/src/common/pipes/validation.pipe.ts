import {
  ValidationPipe as NestValidationPipe,
  ValidationPipeOptions,
  BadRequestException,
} from '@nestjs/common'
import { ValidationError } from 'class-validator'

/**
 * OccasionPro Global Validation Pipe
 *
 * Extends NestJS ValidationPipe with:
 * - whitelist: true             — strip properties not in DTO
 * - forbidNonWhitelisted: true  — 400 if unknown properties present
 * - transform: true             — auto-transform to DTO class instances
 * - transformOptions.enableImplicitConversion: true — string→number coercion
 * - Custom error formatter: flattens nested errors into a human-readable array
 *
 * Usage: applied globally in main.ts via app.useGlobalPipes()
 */
export class OccasionProValidationPipe extends NestValidationPipe {
  constructor(options?: ValidationPipeOptions) {
    super({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
        excludeExtraneousValues: false,
      },
      stopAtFirstError: false,
      // Custom exception factory for consistent error shape
      exceptionFactory: (errors: ValidationError[]) => {
        const messages = flattenValidationErrors(errors)
        return new BadRequestException({
          statusCode: 400,
          error: 'Validation Failed',
          message: messages,
        })
      },
      ...options,
    })
  }
}

/**
 * Recursively flattens nested class-validator errors into a flat string array.
 * e.g. { guests: { email: ['must be an email'] } } → ['guests.email must be an email']
 */
function flattenValidationErrors(
  errors: ValidationError[],
  parentPath = '',
): string[] {
  const messages: string[] = []

  for (const error of errors) {
    const path = parentPath ? `${parentPath}.${error.property}` : error.property

    if (error.constraints) {
      for (const msg of Object.values(error.constraints)) {
        messages.push(`${path}: ${msg}`)
      }
    }

    if (error.children && error.children.length > 0) {
      messages.push(...flattenValidationErrors(error.children, path))
    }
  }

  return messages
}
