import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export enum BookingStatus {
  Active = 'active',
  Cancelled = 'cancelled',
}

@Schema({ timestamps: true })
export class Booking {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  user: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Event', required: true })
  event: Types.ObjectId;

  @Prop({ required: true, min: 1, max: 5 })
  seats: number;

  @Prop({ type: String, enum: BookingStatus, default: BookingStatus.Active })
  status: BookingStatus;
}

export type BookingDocument = HydratedDocument<Booking>;
export const BookingSchema = SchemaFactory.createForClass(Booking);

// One active booking per user per event, enforced by the DB even under races.
// Cancelled bookings are excluded so the user can book again.
BookingSchema.index(
  { user: 1, event: 1 },
  { unique: true, partialFilterExpression: { status: BookingStatus.Active } },
);
