import {
    ArgumentMetadata,
    BadRequestException,
    Injectable,
    PipeTransform,
  } from '@nestjs/common';
  
  import { ZodSchema } from 'zod';
  
  @Injectable()
  export class ZodValidationPipe
    implements PipeTransform
  {
    constructor(private readonly schema: ZodSchema) {}
  
    transform(value: unknown, metadata: ArgumentMetadata) {
      const result = this.schema.safeParse(value);
  
      if (!result.success) {
        throw new BadRequestException({
          message: 'Validation failed',
          errors: result.error.issues,
        });
      }
  
      return result.data;
    }
  }