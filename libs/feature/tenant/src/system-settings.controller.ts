import { Controller, Get, Put, Delete, Body, Param, HttpCode, UseGuards } from '@nestjs/common';
import { SystemSettingsService } from './system-settings.service';
import { UpdateSystemSettingDto } from './dto';
import { AuthGuard } from './guards/auth.guard';
import { RbacGuard } from './guards/rbac.guard';
import { Roles } from './decorators/roles.decorator';

@Controller('settings')
@UseGuards(AuthGuard, RbacGuard)
export class SystemSettingsController {
  constructor(private readonly settingsService: SystemSettingsService) {}

  @Get()
  @Roles('admin')
  async list() {
    const result = await this.settingsService.list();
    if (result.isErr()) return { error: result.error };
    return result.value.map(s => ({ key: s.key, value: s.value, description: s.description, valueType: s.valueType, updatedAt: s.updatedAt }));
  }

  @Get(':key')
  @Roles('admin', 'operator')
  async get(@Param('key') key: string) {
    const value = await this.settingsService.get(key);
    if (value === undefined) return { key, value: null };
    return { key, value };
  }

  @Put()
  @Roles('admin')
  @HttpCode(200)
  async set(@Body() dto: UpdateSystemSettingDto) {
    const result = await this.settingsService.set(dto.key, dto.value, dto.description);
    if (result.isErr()) return { error: result.error };
    const s = result.value;
    return { key: s.key, value: s.value, description: s.description, updatedAt: s.updatedAt };
  }

  @Delete(':key')
  @Roles('admin')
  @HttpCode(200)
  async delete(@Param('key') key: string) {
    const result = await this.settingsService.delete(key);
    if (result.isErr()) return { error: result.error };
    return { deleted: true };
  }
}
