import { homedir } from 'node:os';
import { join } from 'node:path';

export const TIM_DIR = join(homedir(), '.tim');
export const CONFIG_PATH = join(TIM_DIR, 'config.json');
export const DB_PATH = join(TIM_DIR, 'tim.db');
