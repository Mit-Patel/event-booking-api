import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Event } from '../events/event.schema';
import { Booking, BookingStatus } from './booking.schema';

const DUPLICATE_KEY = 11000;

@Injectable()
export class BookingsService {
  constructor(
    @InjectModel(Booking.name) private readonly bookings: Model<Booking>,
    @InjectModel(Event.name) private readonly events: Model<Event>,
  ) {}

  async book(userId: string, eventId: Types.ObjectId, seats: number) {
    const user = new Types.ObjectId(userId);
    if (
      await this.bookings.exists({
        user,
        event: eventId,
        status: BookingStatus.Active,
      })
    ) {
      throw new ConflictException('You already have a booking for this event');
    }

    // Atomic reserve: the seat check and the increment happen in one document
    // update, so two concurrent requests can never oversell the last seats.
    const reserved = await this.events.findOneAndUpdate(
      {
        _id: eventId,
        date: { $gt: new Date() },
        $expr: { $lte: [{ $add: ['$bookedSeats', seats] }, '$totalSeats'] },
      },
      { $inc: { bookedSeats: seats } },
    );
    if (!reserved) {
      const event = await this.events.findById(eventId);
      if (!event) throw new NotFoundException('Event not found');
      if (event.date <= new Date()) {
        throw new BadRequestException('Cannot book a past event');
      }
      throw new BadRequestException(
        `Not enough seats available (remaining: ${event.remainingSeats})`,
      );
    }

    try {
      return await this.bookings.create({ user, event: eventId, seats });
    } catch (err) {
      // Release the reserved seats; a duplicate here means the same user raced themselves.
      await this.events.updateOne(
        { _id: eventId },
        { $inc: { bookedSeats: -seats } },
      );
      if ((err as { code?: number }).code === DUPLICATE_KEY) {
        throw new ConflictException(
          'You already have a booking for this event',
        );
      }
      throw err;
    }
  }

  findMine(userId: string) {
    return this.bookings
      .find({ user: new Types.ObjectId(userId) })
      .populate('event', 'title date venue')
      .sort({ createdAt: -1 });
  }

  async cancel(userId: string, bookingId: Types.ObjectId) {
    const booking = await this.bookings.findById(bookingId);
    if (!booking) throw new NotFoundException('Booking not found');
    if (!booking.user.equals(userId)) {
      throw new ForbiddenException('You can only cancel your own bookings');
    }
    if (booking.status === BookingStatus.Cancelled) {
      throw new BadRequestException('Booking is already cancelled');
    }
    const event = await this.events.findById(booking.event);
    if (event && event.date <= new Date()) {
      throw new BadRequestException('Cannot cancel booking for a past event');
    }

    // Conditional on status so a double cancel can't release seats twice.
    const cancelled = await this.bookings.findOneAndUpdate(
      { _id: bookingId, status: BookingStatus.Active },
      { status: BookingStatus.Cancelled },
      { returnDocument: 'after' },
    );
    if (!cancelled) {
      throw new BadRequestException('Booking is already cancelled');
    }
    await this.events.updateOne(
      { _id: booking.event },
      { $inc: { bookedSeats: -booking.seats } },
    );
    return cancelled;
  }
}
