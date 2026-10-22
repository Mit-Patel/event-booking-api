import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

@Schema({ timestamps: true, toJSON: { virtuals: true } })
export class Event {
  @Prop({ required: true, trim: true })
  title: string;

  @Prop({ required: true })
  description: string;

  @Prop({ required: true })
  date: Date;

  @Prop({ required: true })
  venue: string;

  @Prop({ required: true, min: 1 })
  totalSeats: number;

  // Updated only via atomic $inc in BookingsService, never trusted from input.
  @Prop({ default: 0, min: 0 })
  bookedSeats: number;

  remainingSeats: number;
}

export type EventDocument = HydratedDocument<Event>;
export const EventSchema = SchemaFactory.createForClass(Event);

EventSchema.virtual('remainingSeats').get(function (this: Event) {
  return this.totalSeats - this.bookedSeats;
});
