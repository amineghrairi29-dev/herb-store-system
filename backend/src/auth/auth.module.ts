import { SelfAccountService } from './self-account.service.js';
import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { AuthGuard } from './auth.guard.js';
import { AuthService } from './auth.service.js';
import { AuthController } from './auth.controller.js';
import { UsersService } from './users.service.js';
import { UsersController } from './users.controller.js';
@Module({ controllers: [AuthController, UsersController], providers: [SelfAccountService, AuthService, UsersService, { provide: APP_GUARD, useClass: AuthGuard }], exports: [AuthService, SelfAccountService] })
export class AuthModule {}
