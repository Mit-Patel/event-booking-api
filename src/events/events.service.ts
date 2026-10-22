import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, QueryFilter, Types } from 'mongoose';
import { Booking } from '../bookings/booking.schema';
import {
  CreateEventDto,
  ListEventsQueryDto,
  UpdateEventDto,
} from './event.dto';
import { Event } from './event.schema';

const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

@Injectable()
export class EventsService {
  constructor(
    @InjectModel(Event.name) private readonly events: Model<Event>,
    @InjectModel(Booking.name) private readonly bookings: Model<Booking>,
  ) {}

  create(dto: CreateEventDto) {
    return this.events.create(dto);
  }

  async findAll({ page, limit, search, status }: ListEventsQueryDto) {
    const filter: QueryFilter<Event> = {};
    if (search) filter.title = { $regex: escapeRegex(search), $options: 'i' };
    if (status === 'upcoming') filter.date = { $gt: new Date() };
    if (status === 'past') filter.date = { $lte: new Date() };

    const [items, total] = await Promise.all([
      this.events
        .find(filter)
        .sort({ date: 1 })
        .skip((page - 1) * limit)
        .limit(limit),
      this.events.countDocuments(filter),
    ]);
    return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async findOne(id: Types.ObjectId) {
    const event = await this.events.findById(id);
    if (!event) throw new NotFoundException('Event not found');
    return event;
  }

  async update(id: Types.ObjectId, dto: UpdateEventDto) {
    const filter: QueryFilter<Event> = { _id: id };
    // Condition in the same query so a concurrent booking can't slip past the check.
    if (dto.totalSeats !== undefined) {
      filter.bookedSeats = { $lte: dto.totalSeats };
    }
    const event = await this.events.findOneAndUpdate(filter, dto, {
      returnDocument: 'after',
      runValidators: true,
    });
    if (event) return event;

    const existing = await this.findOne(id);
    throw new BadRequestException(
      `totalSeats cannot be less than booked seats (${existing.bookedSeats})`,
    );
  }

  async remove(id: Types.ObjectId) {
    const event = await this.events.findByIdAndDelete(id);
    if (!event) throw new NotFoundException('Event not found');
    const { deletedCount } = await this.bookings.deleteMany({ event: id });
    return { id, deletedBookings: deletedCount };
  }
}
