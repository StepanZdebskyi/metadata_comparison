import fs from 'fs';
import path from 'path'

function saveLogsToFile(logContent, logFilePath) {
    
    const dirPath = path.dirname(logFilePath);
    
    try {
        fs.mkdirSync(dirPath, { recursive: true });

        fs.writeFile(logFilePath, logContent + '\n', (err) => {
            if (err) {
                console.error('Failed to write log to file:', err);
            }
        });
    } catch (err) {
        if (err.code !== 'EEXIST') { // EEXIST means the directory already exists (which is fine)
            console.error('Failed to create directory:', err);
            throw err; // Re-throw if it's a real error (like permissions)
        }
    }
}

export default saveLogsToFile;