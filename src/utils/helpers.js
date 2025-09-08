import loggingService from '../services/loggingService';
import urlPersistenceService from '../services/urlPersistenceService';

export const generateShortcode = (length = 6) => {
    loggingService.info('utils', 'Generating a new shortcode.');
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    do {
        result = '';
        for (let i = 0; i < length; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
    } while (urlPersistenceService.isShortcodeTaken(result)); // Ensures it's always unique.
    loggingService.info('utils', `Generated unique shortcode: ${result}`);
    return result;
};

export const isValidUrl = (string) => {
    try {
        const url = new URL(string);
        return url.protocol === "http:" || url.protocol === "https:";
    } catch (_) {
        return false;
    }
};
