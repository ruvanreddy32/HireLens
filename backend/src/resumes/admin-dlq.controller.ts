import {
    Controller,
    Get,
    Post,
    Delete,
    Param,
    Query,
    UseGuards,
    ParseIntPipe,
    DefaultValuePipe,
} from '@nestjs/common';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { RolesGuard } from 'src/auth/guards/roles.guard';
import { Roles } from 'src/auth/decorators/roles.decorator';
import { DlqService } from './dlq.service';

@Controller('admin/dlq')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class AdminDlqController {
    constructor(private readonly dlqService: DlqService) { }

    @Get()
    async getDlqJobs(
        @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
        @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    ) {
        return this.dlqService.getDlqJobs(page, limit);
    }

    @Get('stats')
    async getDlqStats() {
        return this.dlqService.getDlqStats();
    }

    @Post(':jobId/retry')
    async retryJob(@Param('jobId') jobId: string) {
        return this.dlqService.retryJob(jobId);
    }

    @Post('retry-all')
    async retryAll() {
        return this.dlqService.retryAll();
    }

    @Delete(':jobId')
    async dismissJob(@Param('jobId') jobId: string) {
        return this.dlqService.dismissJob(jobId);
    }
}
