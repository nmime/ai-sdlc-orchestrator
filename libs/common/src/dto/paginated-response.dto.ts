import { ApiProperty } from '@nestjs/swagger';

export class PaginatedResponseDto<T> {
  @ApiProperty()
  data: T[];

  @ApiProperty()
  total: number;

  @ApiProperty()
  limit: number;

  @ApiProperty()
  offset: number;

  static of<T>(data: T[], total: number, limit: number, offset: number): PaginatedResponseDto<T> {
    const dto = new PaginatedResponseDto<T>();
    dto.data = data;
    dto.total = total;
    dto.limit = limit;
    dto.offset = offset;
    return dto;
  }
}
