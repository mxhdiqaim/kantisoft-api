import * as fs from "fs";
import {getEnvVariable} from "./index";

/**
 * Reads the content of a file, typically a Docker Secret,
 * and returns its trimmed string content.
 * @param filePath The absolute path to the secret file (e.g. /run/secrets/db_password_file).
 * @returns The content of the file as a string.
 */
export const readSecretFile = (filePath: string): string => {
    try {
        // Read the file synchronously and trim any leading/trailing whitespace (like newlines)
        return fs.readFileSync(filePath, "utf-8").trim();
    } catch (error) {
        // It's critical to throw an error if a mandatory secret is missing in prod
        console.error(
            `ERROR: Failed to read mandatory secret file at ${filePath} and error: ${error}`,
        );
        throw new Error(
            `Mandatory secret file not found or readable: ${filePath}`,
        );
    }
};

/**
 * Conditionally retrieves a password from an environment variable (dev)
 * or a mounted secret file (prod).
 * @param passwordEnvVar The environment variable name (e.g. "DB_PASSWORD").
 * @param filePathEnvVar The environment variable holding the path to the secret file (e.g. "DB_PASSWORD_FILE_PATH").
 * @returns The resolved password string.
 */
export const getPassword = (
    passwordEnvVar: string,
    filePathEnvVar: string,
): string => {
    // Check for the production environment flag
    const isProduction = getEnvVariable("NODE_ENV") === "production";

    if (isProduction /* && secretFilePath */) {
        // Check for the secret file path (if running in Docker Secrets mode)
        const secretFilePath = getEnvVariable(filePathEnvVar);

        // Production: Read from the mounted secret file
        return readSecretFile(secretFilePath);
    } else {
        // Development/Local: Read from the direct environment variable
        return getEnvVariable(passwordEnvVar);
    }
};
