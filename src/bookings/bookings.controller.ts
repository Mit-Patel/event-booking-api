import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ParseObjectIdPipe } from '@nestjs/mongoose';
import { ApiBearerAuth, ApiParam, ApiTags } from '@nestjs/swagger';
import { Types } from 'mongoose';
import { JwtAuthGuard } from '../common/jwt-auth.guard';
import { JwtUser } from '../common/roles';
import { BookEventDto } from './booking.dto';
import { BookingsService } from './bookings.service';

type AuthedRequest = { user: JwtUser };

@ApiTags('bookings')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller()
export class BookingsController {
  constructor(private readonly bookings: BookingsService) {}

  @Post('events/:id/book')
  @ApiParam({ name: 'id', type: String })
  book(
    @Req() req: AuthedRequest,
    @Param('id', ParseObjectIdPipe) eventId: Types.ObjectId,
    @Body() dto: BookEventDto,
  ) {
    return this.bookings.book(req.user.sub, eventId, dto.seats);
  }

  @Get('bookings/me')
  findMine(@Req() req: AuthedRequest) {
    return this.bookings.findMine(req.user.sub);
  }

  @Delete('bookings/:id')
  @ApiParam({ name: 'id', type: String })
  cancel(
    @Req() req: AuthedRequest,
    @Param('id', ParseObjectIdPipe) id: Types.ObjectId,
  ) {
    return this.bookings.cancel(req.user.sub, id);
  }
}
