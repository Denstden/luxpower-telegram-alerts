import * as fs from 'fs';
import {logger} from './logger';

export function ensureJsonFileExists(
    filePath: string,
    defaultContent: string,
    fileDescription: string
): void {
    try {
        if (fs.existsSync(filePath)) {
            const stats = fs.statSync(filePath);
            if (stats.isDirectory()) {
                logger.error(`❌ ${fileDescription} is a directory instead of a file!`);
                logger.error(`📋 To fix this manually:`);
                logger.error(`   1. Stop the container: docker compose -f services/luxpower-telegram-alerts/docker-compose.yml stop`);
                logger.error(`   2. Remove directory: cd ~/home-infra/services/luxpower-telegram-alerts/data && rm -rf ${filePath.split('/').pop()}`);
                logger.error(`   3. Create file: echo '${defaultContent.replace(/'/g, "'\"'\"'")}' > ${filePath.split('/').pop()} && chmod 666 ${filePath.split('/').pop()}`);
                logger.error(`   4. Start container: docker compose -f services/luxpower-telegram-alerts/docker-compose.yml up -d`);
                return;
            }
        } else {
            fs.writeFileSync(filePath, defaultContent);
        }
    } catch (error: any) {
        logger.error(`Error ensuring ${fileDescription} exists: ${error.message}`);
    }
}
