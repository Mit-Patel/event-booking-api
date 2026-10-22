import { PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDate,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export class CreateEventDto {
  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsNotEmpty()
  description: string;

  /** ISO 8601 date-time, e.g. 2026-12-31T18:00:00.000Z */
  @Type(() => Date)
  @IsDate()
  date: Date;

  @IsString()
  @IsNotEmpty()
  venue: string;

  @IsInt()
  @Min(1)
  totalSeats: number;
}

export class UpdateEventDto extends PartialType(CreateEventDto) {}

export class ListEventsQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit: number = 10;

  /** Case-insensitive partial match on title */
  @IsOptional()
  @IsString()
  search?: string;

  /** Omit to get all events */
  @IsOptional()
  @IsIn(['upcoming', 'past'])
  status?: 'upcoming' | 'past';
}
