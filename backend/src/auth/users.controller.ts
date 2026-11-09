import { Inject } from '@nestjs/common';
import { Body, Controller, Get, Param, ParseIntPipe, Patch, Post, Req } from '@nestjs/common';
import { Access } from './auth-policy.js';
import { UsersService } from './users.service.js';
import type { AuthRequest } from './auth.guard.js';
@Access('USERS') @Controller('users')
export class UsersController {
  constructor(@Inject(UsersService) private readonly users: UsersService) {}
  @Get() list() { return this.users.list(); }
  @Get(':id') detail(@Param('id', ParseIntPipe) id: number) { return this.users.findOne(id); }
  @Post() create(@Body() body: unknown) { return this.users.create(body); }
  @Patch(':id') update(@Param('id', ParseIntPipe) id: number, @Body() body: unknown, @Req() request: AuthRequest) { return this.users.update(id, body, request.user.id); }
  @Patch(':id/password') password(@Param('id', ParseIntPipe) id: number, @Body() body: unknown) { return this.users.password(id, body); }
}
