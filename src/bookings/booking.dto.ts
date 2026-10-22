import { IsInt, Max, Min } from 'class-validator';

export class BookEventDto {
  /** Number of seats to book (1–5) */
  @IsInt()
  @Min(1)
  @Max(5)
  seats: number;
}
