#!/usr/bin/env node
import { Command } from 'commander';
import { createInitCommand } from './commands/init';
import { createStatusCommand } from './commands/status';
import { createRunCommand } from './commands/run';
import { createReviewCommand } from './commands/review';
import { createChatCommand } from './commands/chat';
import { createProgressCommand } from './commands/progress';
import { createSelectCommand } from './commands/select';
import { createLoopCommand } from './commands/loop';
import { createApproveCommand } from './commands/approve';

const program = new Command();

program
  .name('phasegate')
  .description('Engineered AI coding workflow tool')
  .version('0.1.0');

program.addCommand(createInitCommand());
program.addCommand(createStatusCommand());
program.addCommand(createRunCommand());
program.addCommand(createReviewCommand());
program.addCommand(createChatCommand());
program.addCommand(createSelectCommand());
program.addCommand(createProgressCommand());
program.addCommand(createLoopCommand());
program.addCommand(createApproveCommand());

program.parse();
